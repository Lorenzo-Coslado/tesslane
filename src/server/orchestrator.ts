import { join, relative, isAbsolute } from 'node:path';
import { realpath } from 'node:fs/promises';
import { z } from 'zod';
import { Store, id, now } from './store.ts';
import { git, gitSummary, createWorktree, commitWork, runCheck, diffFor } from './git.ts';
import { runnable, validatePlan, Limiter } from './scheduler.ts';
import {
  PlanOutput,
  ReviewOutput,
  FeatureInput,
  ChatOutput,
  ChatInput,
  TicketEditInput,
  type Feature,
  type Ticket,
  type Agent,
  type Run,
  Profile,
  ModelChoice,
  type Settings,
  type Snapshot,
  type Diagnostic,
  type Approval,
  type Message,
  type ChatAction,
  type GitOperation,
} from '../shared/contracts.ts';
import type { Adapter, EngineEvent, Result, AgentControl } from './engines.ts';
import { EngineFailure } from './engines.ts';
import { routeBase, selectRoute, modelMetrics } from './routing.ts';
import { Telemetry } from './telemetry.ts';
import { GitService, type Checkpoint } from './git-service.ts';
import { parseCommand } from './chat-commands.ts';
import { WorktreePreparation } from './preparation.ts';
import { buildDelivery } from './delivery.ts';

type Reply = { allow: boolean; answers?: Record<string, string> };
type Live = {
  run: Run;
  controller: AbortController;
  pause: boolean;
  resumers: Set<() => void>;
  unavailable: Set<string>;
};
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
function jsonResult(result: Result): unknown {
  if (result.structured) return result.structured;
  const text = result.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0) return JSON.parse(text.slice(start, end + 1));
    throw new Error('The agent did not return the required structured result.');
  }
}
const baseInstructions =
  'You are working inside Tesslane, a local developer-controlled coding swarm. Follow repository instructions. Never push, publish, deploy, delete user work, or alter credentials. Do not modify files outside the assigned worktree. Do not commit or merge: Tesslane owns Git operations. Keep scope small. Ask for missing product decisions. Do not spawn native subagents: Tesslane schedules and observes independent agents itself. Provider reasoning output is optional, never invent it.';

export class Orchestrator {
  private live = new Map<string, Live>();
  private pending = new Map<string, (reply: Reply) => void>();
  private merges = new Map<string, Promise<void>>();
  private slots = new Limiter();
  private catalogs = new Map<string, Promise<Awaited<ReturnType<Adapter['catalog']>>>>();
  private sessions = new Map<string, { control: AgentControl; live: Live }>();
  readonly gitService: GitService;
  readonly preparation: WorktreePreparation;
  constructor(
    readonly root: string,
    readonly store: Store,
    readonly diagnostic: Diagnostic,
    readonly engines: Partial<Record<'codex' | 'claude', Adapter>>,
    readonly demo = false,
    hooks: { checkpoint?: Checkpoint } = {},
  ) {
    this.gitService = new GitService(root, store, hooks.checkpoint);
    this.preparation = new WorktreePreparation(root, store, this.gitService);
    const prior = store.meta('projectRoot');
    if (prior && prior !== root)
      throw new Error(
        'This local state belongs to a different project. Choose a separate data directory.',
      );
    store.setMeta('projectRoot', root);
    if (!demo) this.recover();
  }
  get active() {
    return this.live.size > 0;
  }
  snapshot(featureId?: string): Snapshot {
    const features = this.store.page('feature', { limit: 100 }).items;
    if (featureId && !features.some((f) => f.id === featureId)) {
      const selected = this.store.get('feature', featureId);
      if (selected) features.push(selected);
    }
    const scope = featureId ?? features[0]?.id;
    return {
      project: {
        name: this.diagnostic.name,
        root: this.root,
        dataDir: this.store.dataDir,
        demo: this.demo,
        configured: Boolean(this.store.meta('configured')),
      },
      settings: this.store.settings(),
      avatars: this.store.avatars(),
      diagnostic: this.diagnostic,
      seq: this.store.seq(),
      features,
      tickets: scope ? this.store.forFeature('ticket', scope) : [],
      runs: this.store.recentAndActive('run', 100),
      agents: this.store.recentAndActive('agent', 300),
      messages: this.store
        .page('message', { limit: 100 })
        .items.map((m) =>
          m.content.length > 4000 ? { ...m, content: m.content.slice(-4000), truncated: true } : m,
        ),
      approvals: this.store.recentAndActive('approval', 200),
      checks: this.store
        .page('check', { featureId: scope, limit: 100 })
        .items.map((c) =>
          c.output.length > 2000
            ? { ...c, output: c.output.slice(-2000), outputTruncated: true }
            : c,
        ),
      interactions: this.store.page('interaction', { featureId: scope, limit: 500 }).items,
      events: this.store.recentEvents(100).map((event) => {
        const serialized = JSON.stringify(event.payload);
        return serialized.length > 4000
          ? {
              ...event,
              payload: {
                agentId: (event.payload as any)?.agentId,
                excerpt: serialized.slice(0, 4000),
              },
              preview: true,
            }
          : event;
      }),
      actions: this.store.page('action', { limit: 100 }).items,
      operations: this.store.page('operation', { limit: 200 }).items,
      metrics: modelMetrics(this.store.page('agent', { limit: 500 }).items),
      preparations: this.store
        .page('preparation', { featureId: scope, limit: 100 })
        .items.map((p) => (p.output.length > 2000 ? { ...p, output: p.output.slice(-2000) } : p)),
      totals: Object.fromEntries(
        (
          [
            'feature',
            'ticket',
            'run',
            'agent',
            'message',
            'approval',
            'check',
            'interaction',
            'action',
            'operation',
            'preparation',
            'delivery',
          ] as const
        ).map((kind) => [kind, this.store.count(kind)]),
      ),
    };
  }
  private feature(featureId: string): Feature {
    if (featureId === 'project')
      return {
        id: 'project',
        title: this.diagnostic.name,
        description: 'Project conversation',
        criteria: [],
        externalRef: '',
        status: 'ready',
        planRevision: 0,
        createdAt: now(),
        updatedAt: now(),
      };
    const f = this.store.get('feature', featureId);
    if (!f) throw new Error('Feature not found.');
    return f;
  }
  private change(feature: Feature, changes: Partial<Feature>) {
    return this.store.save('feature', {
      ...this.feature(feature.id),
      ...changes,
      updatedAt: now(),
    });
  }
  private ticket(t: Ticket, changes: Partial<Ticket>) {
    return this.store.save('ticket', {
      ...this.store.get('ticket', t.id)!,
      ...changes,
      updatedAt: now(),
    });
  }
  create(input: unknown) {
    const data = FeatureInput.parse(input);
    return this.store.save(
      'feature',
      { ...data, id: id(), status: 'draft', planRevision: 0, createdAt: now(), updatedAt: now() },
      'feature.created',
    );
  }
  editTicket(input: unknown) {
    const value = TicketEditInput.parse(input),
      ticket = this.store.get('ticket', value.ticketId);
    if (!ticket) throw new Error('Ticket not found.');
    const feature = this.feature(ticket.featureId),
      tickets = this.store.forFeature('ticket', feature.id).filter((t) => t.state !== 'cancelled');
    if (this.demo) throw new Error('The sample plan cannot be edited. Open a project workspace.');
    if ([...this.live.values()].some((l) => l.run.featureId === feature.id))
      throw new Error('Stop active feature runs before editing its plan.');
    if (feature.worktree || tickets.some((t) => t.worktree || t.commit || t.attempts > 0))
      throw new Error(
        'This plan has begun execution. Create a follow-up feature to change its scope.',
      );
    if (feature.planRevision !== value.revision || ticket.updatedAt !== value.updatedAt)
      throw new Error('The ticket or plan changed. Reopen the editor before saving.');
    if (ticket.state === 'cancelled' || !tickets.some((t) => t.id === ticket.id))
      throw new Error('Cancelled tickets cannot be edited.');
    if (new Set(value.dependencies).size !== value.dependencies.length)
      throw new Error('Duplicate ticket dependency.');
    const { ticketId: _, revision: __, updatedAt: ___, ...fields } = value;
    const edited = {
      ...ticket,
      ...fields,
      state: 'ready' as const,
      error: undefined,
      updatedAt: now(),
    };
    validatePlan({
      summary: feature.summary ?? feature.title,
      criteria: feature.criteria,
      questions: feature.questions ?? [],
      tickets: tickets.map((t) => {
        const row = t.id === ticket.id ? edited : t;
        return { ...row, key: row.id };
      }),
    });
    const updated = {
      ...feature,
      status: feature.questions?.length ? ('clarifying' as const) : ('ready' as const),
      planRevision: feature.planRevision + 1,
      error: undefined,
      updatedAt: now(),
    };
    this.store.batch([
      { kind: 'ticket', entity: edited, type: 'ticket.edited' },
      { kind: 'feature', entity: updated, type: 'plan.revised' },
      ...this.store
        .forFeature('approval', feature.id)
        .filter((a) => a.status === 'pending')
        .map((a) => ({
          kind: 'approval' as const,
          entity: { ...a, status: 'superseded' as const, resolvedAt: now() },
        })),
    ]);
    return { ticket: edited, revision: updated.planRevision };
  }
  private recover() {
    for (const p of this.store.list('preparation'))
      if (['running', 'awaiting_approval'].includes(p.state))
        this.store.save('preparation', {
          ...p,
          state: 'interrupted',
          error:
            'Engine stopped during setup. Inspect the worktree; retry requires an explicit decision.',
          endedAt: now(),
        });
    for (const operation of this.store.list('operation'))
      if (operation.state === 'intent') {
        this.store.save('operation', {
          ...operation,
          state: 'interrupted',
          error:
            'Engine stopped around a Git side effect. Inspect its actual result before continuing.',
        });
        const feature = this.store.get('feature', operation.featureId);
        if (feature)
          this.change(feature, {
            status: 'blocked',
            error: 'An interrupted Git operation needs reconciliation.',
          });
      }
    for (const message of this.store.list('message'))
      if (['queued', 'sending'].includes(message.delivery ?? ''))
        this.store.save('message', {
          ...message,
          delivery: 'uncertain',
          deliveryDetail:
            'The engine restarted before delivery was confirmed. No input was replayed.',
        });
    for (const action of this.store.list('action'))
      if (action.status === 'applying')
        this.store.save('action', {
          ...action,
          status: 'uncertain',
          error:
            'The engine restarted around this command. Inspect its run or Git result before issuing it again.',
        });
    for (const run of this.store.list('run'))
      if (!['completed', 'failed', 'interrupted'].includes(run.status)) {
        this.store.save(
          'run',
          {
            ...run,
            status: 'interrupted',
            endedAt: now(),
            error: 'The engine stopped. Inspect worktrees before retrying.',
          },
          'run.recovery_required',
        );
        const feature = this.store.get('feature', run.featureId);
        if (feature)
          this.change(feature, {
            status: 'blocked',
            error:
              'Interrupted execution. Inspect Git and reconcile before starting a fresh attempt.',
          });
      }
    for (const agent of this.store.list('agent'))
      if (!['completed', 'failed', 'interrupted'].includes(agent.state))
        this.store.save('agent', { ...agent, state: 'interrupted', endedAt: now() });
    for (const check of this.store.list('check'))
      if (check.state === 'running')
        this.store.save('check', { ...check, state: 'interrupted', endedAt: now() });
    for (const approval of this.store.list('approval'))
      if (approval.status === 'pending')
        this.store.save('approval', { ...approval, status: 'superseded', resolvedAt: now() });
  }
  private newRun(f: Feature, kind: Run['kind']): Live {
    if (this.demo)
      throw new Error('Sample workspace is read-only. Launch without --demo to run real agents.');
    if ([...this.live.values()].some((x) => x.run.featureId === f.id && x.run.kind !== 'chat'))
      throw new Error('This feature already has an active run.');
    const run = this.store.save('run', {
      id: id(),
      featureId: f.id,
      kind,
      status: 'working',
      startedAt: now(),
      policy: this.store.settings(),
      planRevision: f.planRevision,
    });
    const live: Live = {
      run,
      controller: new AbortController(),
      pause: false,
      resumers: new Set(),
      unavailable: new Set(),
    };
    this.live.set(run.id, live);
    return live;
  }
  private finish(live: Live, error?: unknown) {
    this.store.save('run', {
      ...live.run,
      status: error ? (live.controller.signal.aborted ? 'interrupted' : 'failed') : 'completed',
      endedAt: now(),
      error: error ? errorText(error) : undefined,
    });
    this.live.delete(live.run.id);
    for (const approval of this.store
      .list('approval')
      .filter((a) => a.runId === live.run.id && a.status === 'pending')) {
      this.store.save('approval', { ...approval, status: 'superseded', resolvedAt: now() });
      this.pending.get(approval.id)?.({ allow: false });
      this.pending.delete(approval.id);
    }
  }
  private launch(live: Live, work: () => Promise<void>) {
    void work()
      .then(() => this.finish(live))
      .catch((error) => {
        const f = this.feature(live.run.featureId);
        if (f.id !== 'project' && live.run.kind !== 'chat')
          this.change(f, { status: 'blocked', error: errorText(error) });
        if (live.run.kind === 'chat')
          this.message(
            f.id,
            live.run.targetId ?? f.id,
            'system',
            'Analysis failed: ' + errorText(error),
          );
        this.finish(live, error);
      });
    return live.run;
  }
  private message(
    featureId: string,
    targetId: string,
    role: Message['role'],
    content: string,
    agentId?: string,
  ) {
    return this.store.save('message', {
      id: id(),
      featureId,
      targetId,
      role,
      content,
      agentId,
      createdAt: now(),
    });
  }
  private async boundary(live: Live) {
    if (live.controller.signal.aborted) throw new Error('Stopped by user; worktrees preserved.');
    if (live.pause) {
      this.store.save('run', { ...live.run, status: 'paused' });
      await new Promise<void>((resolve) => {
        live.resumers.add(resolve);
      });
      if (live.controller.signal.aborted) throw new Error('Stopped by user; worktrees preserved.');
      this.store.save('run', { ...live.run, status: 'working' });
    }
  }
  control(runId: string, action: 'pause' | 'resume' | 'stop') {
    const live = this.live.get(runId);
    if (!live)
      throw new Error('This run is no longer active. Interrupted runs require reconciliation.');
    if (action === 'pause') {
      live.pause = true;
      this.store.save('run', { ...live.run, status: 'pausing' });
    }
    if (action === 'resume') {
      live.pause = false;
      live.resumers.forEach((resolve) => resolve());
      live.resumers.clear();
    }
    if (action === 'stop') {
      this.store.save('run', { ...live.run, status: 'stopping' });
      live.controller.abort();
      live.resumers.forEach((resolve) => resolve());
      live.resumers.clear();
    }
  }
  private async approve(
    live: Live,
    agent: Agent | undefined,
    kind: Approval['kind'],
    title: string,
    details: unknown,
    externalSignal?: AbortSignal,
  ): Promise<Reply> {
    const f = this.feature(live.run.featureId);
    const approval = this.store.save('approval', {
      id: id(),
      featureId: f.id,
      runId: live.run.id,
      agentId: agent?.id,
      kind,
      title,
      description:
        kind === 'tool'
          ? 'Approve only the specific operation and access shown below.'
          : 'Approval applies to this plan revision and its recorded policy.',
      details,
      revision: f.planRevision,
      status: 'pending',
      createdAt: now(),
    });
    if (agent)
      this.store.save('agent', {
        ...this.store.get('agent', agent.id)!,
        state: 'awaiting_approval',
      });
    return new Promise<Reply>((resolve) => {
      const signal = externalSignal
        ? AbortSignal.any([live.controller.signal, externalSignal])
        : live.controller.signal;
      const done = (reply: Reply) => {
        signal.removeEventListener('abort', abort);
        this.pending.delete(approval.id);
        if (
          agent &&
          !['completed', 'failed', 'interrupted'].includes(
            this.store.get('agent', agent.id)?.state ?? '',
          )
        )
          this.store.save('agent', { ...this.store.get('agent', agent.id)!, state: 'working' });
        resolve(reply);
      };
      const abort = () => {
        this.store.save('approval', {
          ...this.store.get('approval', approval.id)!,
          status: 'superseded',
          resolvedAt: now(),
        });
        done({ allow: false });
      };
      this.pending.set(approval.id, done);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }
  reply(approvalId: string, reply: Reply) {
    const approval = this.store.get('approval', approvalId);
    const waiting = this.pending.get(approvalId);
    if (!approval || approval.status !== 'pending' || !waiting)
      throw new Error('This request has expired.');
    if (approval.revision !== this.feature(approval.featureId).planRevision)
      throw new Error('The plan changed. This approval is no longer valid.');
    this.store.save('approval', {
      ...approval,
      status: reply.allow ? 'approved' : 'declined',
      resolvedAt: now(),
    });
    waiting(reply);
  }
  private async deliverInput(message: Message) {
    const session = this.sessions.get(message.targetId);
    if (!session || session.live.controller.signal.aborted) return;
    const current = this.store.get('message', message.id);
    if (current?.delivery !== 'queued') return;
    this.store.save('message', {
      ...current,
      delivery: 'sending',
      deliveryDetail: 'Submitting to the native session.',
    });
    try {
      const receipt = await session.control.steer(message.content, message.id);
      const latest = this.store.get('message', message.id)!;
      if (['cancelled', 'uncertain', 'accepted'].includes(latest.delivery ?? '')) return;
      this.store.save('message', {
        ...latest,
        delivery: receipt.state,
        deliveryDetail: receipt.detail,
        deliveredAt: now(),
      });
    } catch (error) {
      const latest = this.store.get('message', message.id)!;
      if (latest.delivery !== 'cancelled')
        this.store.save('message', {
          ...latest,
          delivery: 'failed',
          deliveryDetail: errorText(error),
        });
    }
  }
  refreshCapabilities() {
    this.catalogs.clear();
  }
  private async mission(
    live: Live,
    role: Agent['role'],
    profile: Profile,
    cwd: string,
    prompt: string,
    readOnly: boolean,
    options: {
      ticket?: Ticket;
      parent?: Agent;
      schema?: Record<string, unknown>;
      attempt?: number;
    } = {},
  ): Promise<Result> {
    await this.boundary(live);
    if (cwd !== this.root) await this.gitService.assertWorktree(cwd);
    if (!readOnly && cwd === this.root)
      throw new Error('Writing missions require an isolated worktree.');
    const latestTicket = options.ticket ? this.store.get('ticket', options.ticket.id) : undefined;
    const routingInput = {
      policy: live.run.policy,
      profile,
      role,
      attempt: options.attempt,
      unavailable: live.unavailable,
      override: role === 'implementer' ? latestTicket?.nextModel : undefined,
    };
    const initial = routeBase(routingInput);
    const adapter = this.engines[initial.choice.engine];
    if (!adapter)
      throw new Error(
        'The ' +
          initial.choice.engine +
          ' CLI is unavailable. Configure an installed engine in Settings.',
      );
    if (!this.catalogs.has(initial.choice.engine))
      this.catalogs.set(
        initial.choice.engine,
        adapter.catalog().catch((error) => {
          this.catalogs.delete(initial.choice.engine);
          throw error;
        }),
      );
    const catalog = await this.catalogs.get(initial.choice.engine)!;
    const { choice, reason } = selectRoute({
      ...routingInput,
      catalog: catalog.models,
      metrics: modelMetrics(this.store.page('agent', { limit: 500 }).items),
    });
    const release = await this.slots.acquire(live.run.policy.maxConcurrent, live.controller.signal);
    const agent = this.store.save('agent', {
      id: id(),
      featureId: live.run.featureId,
      runId: live.run.id,
      ticketId: options.ticket?.id,
      parentId: options.parent?.id,
      name: role[0].toUpperCase() + role.slice(1),
      role,
      state: 'working',
      profile,
      ...choice,
      selectionReason: reason,
      workspace: cwd,
      startedAt: now(),
      readOnly,
    });
    this.message(agent.featureId, agent.id, 'user', prompt, agent.id);
    if (options.parent)
      this.store.save('interaction', {
        id: id(),
        featureId: agent.featureId,
        from: options.parent.id,
        to: agent.id,
        message: role + ' assignment',
        createdAt: now(),
      });
    const telemetry = new Telemetry(this.store, agent);
    const emit = (event: EngineEvent) => {
      telemetry.record(event);
      if (event.type === 'input.accepted' || event.type === 'input.uncertain') {
        const message = this.store.get('message', event.data.messageId);
        if (
          message &&
          message.agentId === agent.id &&
          !['cancelled', 'failed'].includes(message.delivery ?? '')
        )
          this.store.save('message', {
            ...message,
            delivery: event.type === 'input.accepted' ? 'accepted' : 'uncertain',
            deliveryDetail: event.data.detail,
            deliveredAt: now(),
          });
      }
    };
    try {
      const result = await adapter.run({
        cwd,
        prompt,
        instructions:
          baseInstructions +
          (readOnly
            ? ' This is a read-only analysis/review mission. Do not modify code.'
            : ' Implement only the assigned ticket, including meaningful tests where needed.'),
        choice,
        readOnly,
        signal: live.controller.signal,
        schema: options.schema,
        onControl: (control) => {
          if (control) {
            this.sessions.set(agent.id, { control, live });
            for (const message of this.store.page('message', { targetId: agent.id, limit: 500 })
              .items)
              if (message.delivery === 'queued') void this.deliverInput(message);
          } else this.sessions.delete(agent.id);
        },
        emit,
        permission: async (title, details, signal) => {
          if (signal.aborted) return { allow: false };
          const d = details as any;
          if (d.tool === 'Agent' || d.tool === 'Task') return { allow: false }; // the local scheduler owns concurrency
          if (!readOnly && ['Edit', 'Write', 'MultiEdit'].includes(d.tool)) {
            const path = d.input?.file_path ?? d.input?.path;
            if (typeof path === 'string') {
              const absolute = isAbsolute(path) ? path : join(cwd, path);
              // Resolve existing ancestors so a symlink cannot turn a covered
              // worktree edit into an out-of-scope write.
              let existing = absolute;
              while (true) {
                try {
                  existing = await realpath(existing);
                  break;
                } catch {
                  const parent = join(existing, '..');
                  if (parent === existing) break;
                  existing = parent;
                }
              }
              const rel = relative(cwd, absolute);
              const realRel = relative(await realpath(cwd), existing);
              if (
                rel &&
                !rel.startsWith('..') &&
                !isAbsolute(rel) &&
                !realRel.startsWith('..') &&
                !isAbsolute(realRel)
              )
                return { allow: true };
            }
          }
          return this.approve(live, agent, 'tool', title, details, signal);
        },
      });
      telemetry.finish();
      if (
        this.store
          .page('agent', { featureId: agent.featureId, limit: 500 })
          .items.some((a) => a.runId === live.run.id && a.native && a.state === 'recovering')
      )
        throw new Error(
          'Native child completion is uncertain. Inspect its events before retrying.',
        );
      if (live.controller.signal.aborted) throw new Error('Interrupted');
      if (
        !this.store.list('message').some((m) => m.agentId === agent.id && m.role === 'assistant') &&
        result.text
      )
        this.message(agent.featureId, agent.id, 'assistant', result.text, agent.id);
      this.store.save('agent', {
        ...this.store.get('agent', agent.id)!,
        state: 'completed',
        endedAt: now(),
        sessionId: result.sessionId ?? this.store.get('agent', agent.id)?.sessionId,
        effectiveModel: result.model || this.store.get('agent', agent.id)?.effectiveModel,
        configuredModel:
          result.configuredModel || this.store.get('agent', agent.id)?.configuredModel,
        summary: result.text.slice(-5000),
        usage: result.usage ?? this.store.get('agent', agent.id)?.usage,
      });
      return result;
    } catch (error) {
      telemetry.finish();
      if (error instanceof EngineFailure && error.kind === 'quota')
        live.unavailable.add(choice.engine);
      this.store.save('agent', {
        ...this.store.get('agent', agent.id)!,
        state: live.controller.signal.aborted ? 'interrupted' : 'failed',
        endedAt: now(),
        error: errorText(error),
      });
      throw error;
    } finally {
      this.sessions.delete(agent.id);
      for (const message of this.store.page('message', { targetId: agent.id, limit: 500 }).items)
        if (['queued', 'sending'].includes(message.delivery ?? ''))
          this.store.save('message', {
            ...message,
            delivery: live.controller.signal.aborted ? 'cancelled' : 'uncertain',
            deliveryDetail:
              'Session ended before delivery was confirmed. Inspect before resending.',
          });
      release();
    }
  }
  plan(featureId: string) {
    const f = this.feature(featureId);
    const live = this.newRun(f, 'plan');
    if (f.worktree) {
      this.finish(
        live,
        new Error(
          'Cannot replace a plan after execution has created worktrees. Create a follow-up feature.',
        ),
      );
      throw new Error('Create a follow-up feature to change an executed plan.');
    }
    return this.launch(live, async () => {
      this.change(f, { status: 'clarifying', error: undefined });
      const context = this.store
        .list('message')
        .filter((m) => m.featureId === f.id && m.targetId === f.id)
        .map((m) => m.role + ': ' + m.content)
        .join('\n');
      const result = await this.mission(
        live,
        'coordinator',
        'deep',
        this.root,
        'Inspect this repository and its existing workflow first. Keep existing systems unless the user explicitly requests replacement. Analyze the feature below. Return JSON matching the supplied schema. Ask only material unanswered questions, with recommendations. Split into the smallest useful delivery tickets, often one; avoid tool-call microtasks. Use stable ticket keys and an acyclic dependency graph. State owned file/directory areas; use * when unknown. Suggest checks, do not execute them. Profiles fast/balanced/deep describe task complexity, not hardcoded model names.\nFeature: ' +
          JSON.stringify(f) +
          '\nConversation decisions:\n' +
          context,
        true,
        { schema: z.toJSONSchema(PlanOutput) as Record<string, unknown> },
      );
      const plan = PlanOutput.parse(jsonResult(result));
      validatePlan(plan);
      const revision = f.planRevision + 1;
      const ids = new Map(plan.tickets.map((t) => [t.key, id()]));
      const updatedAt = now();
      this.store.batch([
        ...this.store
          .forFeature('ticket', f.id)
          .filter((t) => t.state !== 'cancelled')
          .map((t) => ({
            kind: 'ticket' as const,
            entity: { ...t, state: 'cancelled' as const, updatedAt },
          })),
        ...plan.tickets.map((t) => ({
          kind: 'ticket' as const,
          entity: {
            id: ids.get(t.key)!,
            featureId: f.id,
            title: t.title,
            description: t.description,
            criteria: t.criteria,
            dependencies: t.dependencies.map((k) => ids.get(k)!),
            areas: t.areas,
            checks: t.checks,
            profile: t.profile,
            state: 'ready' as const,
            attempts: 0,
            createdAt: updatedAt,
            updatedAt,
          },
        })),
        {
          kind: 'feature',
          entity: {
            ...this.feature(f.id),
            status: plan.questions.length ? 'clarifying' : 'ready',
            summary: plan.summary,
            criteria: plan.criteria,
            questions: plan.questions,
            planRevision: revision,
            updatedAt,
          },
        },
      ]);
      this.message(
        f.id,
        f.id,
        'assistant',
        plan.summary +
          (plan.questions.length
            ? '\n\n' +
              plan.questions
                .map((q) => q.question + '\nRecommendation: ' + q.recommendation)
                .join('\n\n')
            : '\n\nThe plan is ready for your review.'),
      );
    });
  }
  async chat(
    featureId: string,
    targetId: string,
    content: string,
    mode: 'discuss' | 'clarify' | 'steer' | 'command' = 'discuss',
    requestId: string = id(),
  ) {
    ChatInput.parse({ featureId, targetId, content, mode, requestId });
    const f = this.feature(featureId),
      agent = this.store.get('agent', targetId),
      ticket = this.store.get('ticket', targetId);
    if (targetId !== f.id && agent?.featureId !== f.id && ticket?.featureId !== f.id)
      throw new Error('Chat recipient not found in this scope.');
    const prior = this.store.get('message', requestId);
    if (prior) {
      if (prior.targetId !== targetId || prior.content !== content)
        throw new Error('Request identifier was reused for a different message.');
      return { message: prior, replayed: true };
    }
    if (mode === 'clarify' && (targetId !== f.id || f.status !== 'clarifying'))
      throw new Error('Clarification answers require a feature waiting for answers.');
    const message = this.store.save('message', {
      id: requestId,
      requestId,
      featureId: f.id,
      targetId,
      agentId: mode === 'steer' ? agent?.id : undefined,
      role: 'user',
      content: content.trim(),
      mode,
      delivery: 'queued',
      createdAt: now(),
    });
    if (this.demo) {
      this.store.save('message', {
        ...message,
        delivery: 'failed',
        deliveryDetail: 'Sample workspace does not execute commands or model calls.',
      });
      throw new Error('Launch a real workspace to send messages.');
    }
    if (mode === 'clarify') {
      const saved = this.store.save('message', {
        ...message,
        delivery: 'accepted',
        deliveryDetail: 'Clarification recorded. Analyze again when your answers are complete.',
        deliveredAt: now(),
      });
      return { message: saved };
    }
    if (mode === 'steer') {
      if (
        !agent ||
        agent.native ||
        !['starting', 'working', 'awaiting_approval'].includes(agent.state)
      ) {
        const failed = this.store.save('message', {
          ...message,
          delivery: 'failed',
          deliveryDetail: agent?.native
            ? 'Select the owning parent agent to guide its native child.'
            : 'Select an active model agent, or use Discuss for a follow-up.',
        });
        return { message: failed };
      }
      if (
        !this.sessions.has(agent.id) &&
        agent.role === 'coordinator' &&
        agent.readOnly === undefined
      )
        throw new Error('The local scheduler accepts run commands, not model input.');
      await this.deliverInput(message);
      return { message: this.store.get('message', message.id) };
    }
    if (mode === 'command' || content.trim().startsWith('/')) {
      try {
        const command = parseCommand(content);
        if (command.kind === 'status') {
          this.message(
            f.id,
            targetId,
            'assistant',
            JSON.stringify(
              {
                feature: f.title,
                state: f.status,
                tickets: this.store
                  .list('ticket')
                  .filter((t) => t.featureId === f.id)
                  .map((t) => ({ id: t.id, title: t.title, state: t.state })),
                runs: this.store
                  .list('run')
                  .filter((r) => r.featureId === f.id)
                  .slice(-3),
              },
              null,
              2,
            ),
          );
        } else if (command.kind === 'profile') {
          const targets = ticket
            ? [ticket]
            : agent?.ticketId
              ? [this.store.get('ticket', agent.ticketId)!]
              : this.store
                  .list('ticket')
                  .filter(
                    (t) =>
                      t.featureId === f.id && t.state !== 'integrated' && t.state !== 'cancelled',
                  );
          if (!targets.length)
            throw new Error('Select a delivery ticket before changing its next-attempt profile.');
          for (const t of targets) this.routeTicket(t.id, { profile: command.profile });
          this.message(
            f.id,
            targetId,
            'system',
            'The ' +
              command.profile +
              ' profile applies to future attempts. Active model settings are unchanged.',
          );
        } else {
          const target =
            command.kind === 'create_feature'
              ? 'project'
              : (command.argument ??
                ticket?.id ??
                (agent?.ticketId && ['retry', 'integrate'].includes(command.kind)
                  ? agent.ticketId
                  : f.id));
          const action = this.store.save('action', {
            id: id(),
            featureId: f.id,
            messageId: message.id,
            kind: command.kind,
            title: command.kind.replaceAll('_', ' '),
            targetId: target,
            data:
              command.kind === 'create_feature'
                ? { title: command.title, description: command.description }
                : undefined,
            revision:
              target === 'project'
                ? 0
                : (this.store.get('feature', target)?.planRevision ?? f.planRevision),
            status: 'pending',
            createdAt: now(),
          });
          await this.applyAction(action.id, true);
        }
        this.store.save('message', {
          ...message,
          delivery: 'accepted',
          deliveryDetail: 'Command processed through the execution policy.',
          deliveredAt: now(),
        });
      } catch (error) {
        this.store.save('message', {
          ...message,
          delivery: 'failed',
          deliveryDetail: errorText(error),
        });
        throw error;
      }
      return { message: this.store.get('message', message.id) };
    }
    const live = this.newRun(f, 'chat');
    live.run = { ...live.run, targetId };
    this.store.save('run', live.run);
    this.store.save('message', {
      ...message,
      delivery: 'accepted',
      deliveryDetail: 'Read-only analysis started.',
      deliveredAt: now(),
    });
    return this.launch(live, async () => {
      const context = this.store
        .page('message', { featureId: f.id, targetId, limit: 20 })
        .items.map((m) => m.role + ': ' + m.content)
        .join('\n');
      const featureCatalog = this.store.list('feature').map((feature) => ({
        id: feature.id,
        title: feature.title,
        status: feature.status,
        revision: feature.planRevision,
      }));
      const result = await this.mission(
        live,
        'analyst',
        'balanced',
        this.root,
        'Discuss this project read-only and return JSON matching the schema. Respond to the user even when the feature has unanswered clarification questions. When asked to split a feature, explain the separate scopes and propose a create_feature action for each requested outcome. Offer up to four concrete actions when the user asks to operate the swarm. Actions are proposals requiring an explicit user click, never executions here. Use only real feature/ticket identifiers from the supplied catalog. create_feature targets project and includes title/description; other actions have data:null. Explain approvals and scope. Conversation recipient: ' +
          targetId +
          '\nFeature: ' +
          JSON.stringify(f) +
          '\nFeatures: ' +
          JSON.stringify(featureCatalog) +
          '\nTickets: ' +
          JSON.stringify(this.store.list('ticket').filter((t) => t.featureId === f.id)) +
          '\nConversation:\n' +
          context,
        true,
        { schema: z.toJSONSchema(ChatOutput) as Record<string, unknown> },
      );
      const output = ChatOutput.parse(jsonResult(result));
      const reply = this.message(f.id, targetId, 'assistant', output.answer);
      for (const proposal of output.actions) {
        const targetFeature =
          this.store.get('feature', proposal.targetId) ??
          (this.store.get('ticket', proposal.targetId)
            ? this.feature(this.store.get('ticket', proposal.targetId)!.featureId)
            : undefined);
        if (
          proposal.kind !== 'create_feature' &&
          (!targetFeature || (f.id !== 'project' && targetFeature.id !== f.id))
        )
          continue;
        this.store.save('action', {
          ...proposal,
          data: proposal.data ?? undefined,
          id: id(),
          featureId: f.id,
          messageId: reply.id,
          revision: targetFeature?.planRevision ?? 0,
          status: 'pending',
          createdAt: now(),
        });
      }
    });
  }
  async applyAction(actionId: string, allow: boolean) {
    const action = this.store.get('action', actionId);
    if (!action) throw new Error('Action proposal not found.');
    if (action.status !== 'pending') return action;
    if (!allow)
      return this.store.save('action', { ...action, status: 'declined', resolvedAt: now() });
    const ticket = this.store.get('ticket', action.targetId),
      target = this.feature(ticket?.featureId ?? action.targetId);
    if (action.kind !== 'create_feature' && target.id === 'project')
      throw new Error('Select a feature or include its identifier in the command.');
    if (action.kind !== 'create_feature' && target.planRevision !== action.revision)
      throw new Error('The delivery plan changed. Request a new action proposal.');
    this.store.save('action', { ...action, status: 'applying' });
    try {
      let result: unknown;
      if (action.kind === 'create_feature') result = this.create(action.data);
      else if (action.kind === 'plan') result = this.plan(target.id);
      else if (action.kind === 'execute') result = this.execute(target.id);
      else if (['pause', 'resume', 'stop'].includes(action.kind)) {
        const live = [...this.live.values()].find(
          (l) => l.run.featureId === target.id && l.run.kind !== 'chat',
        );
        if (!live) throw new Error('No active execution or planning run in this feature.');
        this.control(live.run.id, action.kind as 'pause' | 'resume' | 'stop');
        result = { runId: live.run.id };
      } else if (action.kind === 'retry') {
        if (!ticket) throw new Error('Select a specific ticket before retrying.');
        const detail = await this.inspectTicket(ticket.id);
        if (detail.dirty || detail.conflicts?.length)
          throw new Error(
            'Inspect and reconcile this ticket’s preserved changes in Git before retrying.',
          );
        result = await this.reconcile(ticket.id, detail.head);
      } else if (action.kind === 'integrate') {
        if (!ticket) throw new Error('Select a reviewed ticket to integrate.');
        result = await this.integrateTicket(ticket.id);
      }
      const completed = this.store.save('action', {
        ...action,
        status: 'applied',
        result: JSON.stringify(result ?? {}),
        resolvedAt: now(),
      });
      this.message(
        action.featureId,
        this.store.get('message', action.messageId)?.targetId ?? action.featureId,
        'system',
        action.title + ' accepted. Execution still follows its recorded policy.',
      );
      return completed;
    } catch (error) {
      this.store.save('action', {
        ...action,
        status: 'failed',
        error: errorText(error),
        resolvedAt: now(),
      });
      throw error;
    }
  }
  routeTicket(ticketId: string, input: { profile?: Profile; choice?: ModelChoice }) {
    const ticket = this.store.get('ticket', ticketId);
    if (!ticket) throw new Error('Ticket not found.');
    if (['integrated', 'cancelled'].includes(ticket.state))
      throw new Error('This ticket has already ended.');
    if (input.profile) Profile.parse(input.profile);
    if (input.choice) ModelChoice.parse(input.choice);
    this.store.event(
      'routing.override_requested',
      { ticketId, ...input, boundary: 'next_attempt' },
      ticket.featureId,
    );
    return this.ticket(ticket, {
      ...(input.profile ? { profile: input.profile } : {}),
      nextModel: input.choice ?? (input.profile ? undefined : ticket.nextModel),
    });
  }
  execute(featureId: string) {
    const f = this.feature(featureId);
    if (!['ready', 'blocked', 'ready_for_integration'].includes(f.status) || f.questions?.length)
      throw new Error('Resolve the feature questions and review a plan before execution.');
    if (this.store.settings().mode === 'planning')
      throw new Error('Planning mode is read-only. Change the autonomy mode before execution.');
    if (
      this.store
        .list('ticket')
        .some(
          (t) =>
            t.featureId === f.id &&
            !['ready', 'ready_for_integration', 'integrated', 'cancelled'].includes(t.state),
        )
    )
      throw new Error('Reconcile interrupted or blocked tickets before retrying.');
    const live = this.newRun(f, 'execution');
    this.merges.delete(f.id);
    return this.launch(live, async () => {
      const policy = live.run.policy;
      if (!policy.allowGitCommit || !policy.allowIntegration)
        throw new Error(
          'Execution requires local ticket commits and integration into the feature branch. Enable them in Settings.',
        );
      if (
        policy.mode === 'assisted' &&
        !(
          await this.approve(live, undefined, 'plan', 'Approve this delivery plan', {
            feature: f,
            tickets: this.store
              .list('ticket')
              .filter((t) => t.featureId === f.id && t.state !== 'cancelled'),
            policy,
          })
        ).allow
      )
        throw new Error('Delivery plan declined.');
      await this.boundary(live);
      const repo = await gitSummary(this.root);
      if (!repo.git)
        throw new Error(
          'Initialize Git and create a first commit before running writing agents. Planning works without Git.',
        );
      if (!f.worktree && repo.dirty)
        throw new Error(
          'The working tree has uncommitted changes. Commit or stash them yourself, then retry. Tesslane will preserve them.',
        );
      let feature = this.feature(f.id);
      if (!feature.worktree) {
        const base = await git(this.root, ['rev-parse', 'HEAD']);
        const branch = 'tesslane/feature-' + f.id.slice(0, 8);
        const worktree = join(this.store.dataDir, 'worktrees', f.id, 'integration');
        // Record intent before the external Git operation. A crash requires inspection.
        feature = this.change(feature, {
          branch,
          worktree,
          baseRevision: base,
          sourceBranch: repo.branch === 'Detached HEAD' ? undefined : repo.branch,
        });
        this.store.event('git.worktree.intent', { branch, worktree, base }, f.id);
        await this.gitService.worktree(feature, undefined, worktree, branch, base);
      }
      await this.prepareWorktree(live, feature, feature.worktree!);
      this.change(feature, { status: 'running', error: undefined });
      const coordinator = this.store.save('agent', {
        id: id(),
        featureId: f.id,
        runId: live.run.id,
        name: 'Coordinator',
        role: 'coordinator',
        state: 'working',
        profile: 'balanced',
        ...policy.profiles.balanced,
        selectionReason: 'Deterministic scheduling; no model call for dependency dispatch.',
        workspace: feature.worktree!,
        startedAt: now(),
      });
      const active = new Map<string, Promise<void>>();
      try {
        while (true) {
          await this.boundary(live);
          const tickets = this.store
            .list('ticket')
            .filter((t) => t.featureId === f.id && t.state !== 'cancelled');
          if (!tickets.length) throw new Error('This feature has no delivery tickets.');
          if (tickets.every((t) => t.state === 'integrated')) break;
          const candidates = runnable(
            tickets,
            tickets.filter((t) => active.has(t.id)),
            policy.maxConcurrent,
          );
          for (const ticket of candidates) {
            const job = this.deliver(live, feature, ticket, coordinator)
              .catch((error) => {
                this.ticket(ticket, { state: 'blocked', error: errorText(error) });
              })
              .finally(() => active.delete(ticket.id));
            active.set(ticket.id, job);
          }
          if (!active.size)
            throw new Error(
              'No runnable tickets remain. ' +
                tickets
                  .filter((t) => t.state === 'blocked')
                  .map((t) => t.title + ': ' + (t.error ?? 'Inspect dependencies.'))
                  .join('\n'),
            );
          await Promise.race(active.values());
        }
        await Promise.all(active.values());
        this.change(feature, { status: 'verifying' });
        await this.prepareWorktree(live, feature, feature.worktree!);
        const finalCommands = [
          ...new Set([
            ...policy.verificationCommands,
            ...this.store
              .forFeature('ticket', feature.id)
              .filter((t) => t.state !== 'cancelled')
              .flatMap((t) => t.verificationCommands ?? []),
          ]),
        ];
        await this.checks(live, feature, undefined, feature.worktree!, finalCommands);
        this.change(feature, { status: 'reviewing' });
        const deliveredRevision = await git(feature.worktree!, ['rev-parse', 'HEAD']);
        const combinedDiff = await diffFor(feature.worktree!, feature.baseRevision);
        const combined = await this.mission(
          live,
          'reviewer',
          'deep',
          feature.worktree!,
          'Independently review the combined feature against all acceptance criteria and interactions between tickets. Read only. Return JSON matching the schema. This is the final acceptance gate, not a summary of earlier approvals.\nFeature: ' +
            JSON.stringify(this.feature(feature.id)) +
            '\nTickets: ' +
            JSON.stringify(
              this.store
                .list('ticket')
                .filter((t) => t.featureId === feature.id && t.state !== 'cancelled'),
            ) +
            '\nDiff excerpt (inspect relevant files when truncated):\n' +
            combinedDiff.slice(-80000),
          true,
          { parent: coordinator, schema: z.toJSONSchema(ReviewOutput) as Record<string, unknown> },
        );
        const acceptance = ReviewOutput.parse(jsonResult(combined));
        if (!acceptance.approved || acceptance.findings.some((f) => f.severity === 'blocking'))
          throw new Error(
            'Combined feature review requires a follow-up: ' + JSON.stringify(acceptance),
          );
        await this.boundary(live);
        const report = await buildDelivery(
          this.store,
          this.root,
          this.feature(feature.id),
          live.run.id,
          deliveredRevision,
          { ...acceptance, revision: deliveredRevision },
          finalCommands,
        );
        if (
          (await git(feature.worktree!, ['rev-parse', 'HEAD'])) !== deliveredRevision ||
          (await git(feature.worktree!, ['status', '--porcelain'])) ||
          (await git(feature.worktree!, ['branch', '--show-current'])) !== feature.branch
        )
          throw new Error(
            'The feature worktree changed during final review. Verify and review its new state before delivery.',
          );
        this.store.batch([
          { kind: 'delivery', entity: report, type: 'delivery.completed' },
          {
            kind: 'feature',
            entity: {
              ...this.feature(feature.id),
              status: 'integrated',
              error: undefined,
              summary: acceptance.summary,
              deliveryId: report.id,
              updatedAt: now(),
            },
          },
        ]);
        this.store.save('agent', { ...coordinator, state: 'completed', endedAt: now() });
      } catch (error) {
        await Promise.allSettled(active.values());
        this.store.save('agent', {
          ...coordinator,
          state: live.controller.signal.aborted ? 'interrupted' : 'failed',
          endedAt: now(),
          error: errorText(error),
        });
        throw error;
      }
    });
  }
  private async checks(
    live: Live,
    f: Feature,
    t: Ticket | undefined,
    cwd: string,
    commands: string[],
  ) {
    await this.gitService.assertWorktree(cwd);
    const revision = await git(cwd, ['rev-parse', 'HEAD']);
    if (!commands.length)
      this.store.event(
        'verification.none_configured',
        {
          ticketId: t?.id,
          revision,
          message: 'No automated checks configured. Review is not a substitute for test evidence.',
        },
        f.id,
      );
    for (const command of commands) {
      await this.boundary(live);
      let check = this.store.save('check', {
        id: id(),
        featureId: f.id,
        ticketId: t?.id,
        command,
        revision,
        state: 'running',
        output: '',
        exitCode: null,
        startedAt: now(),
      });
      try {
        let output = '';
        let timer: ReturnType<typeof setTimeout> | undefined;
        const flush = () => {
          clearTimeout(timer);
          timer = undefined;
          check = this.store.save('check', { ...check, output });
        };
        const code = await runCheck(
          cwd,
          command,
          live.controller.signal,
          live.run.policy.checkTimeoutMs,
          (chunk) => {
            output = (output + chunk).slice(-200000);
            if (!timer) timer = setTimeout(flush, 250);
          },
        );
        flush();
        check = this.store.save('check', {
          ...check,
          state: live.controller.signal.aborted ? 'interrupted' : code === 0 ? 'passed' : 'failed',
          exitCode: code,
          endedAt: now(),
        });
        if (code !== 0 || live.controller.signal.aborted)
          throw new Error('Check failed: ' + command + '\n' + output.slice(-8000));
        if (
          (await git(cwd, ['rev-parse', 'HEAD'])) !== revision ||
          (await git(cwd, ['status', '--porcelain']))
        )
          throw new Error(
            'Verification changed the revision or worktree. Review those changes before retrying: ' +
              command,
          );
      } catch (error) {
        this.store.save('check', {
          ...check,
          state: live.controller.signal.aborted ? 'interrupted' : 'failed',
          endedAt: now(),
          output: check.output + '\n' + errorText(error),
        });
        throw error;
      }
    }
  }
  private async prepareWorktree(live: Live, f: Feature, cwd: string, ticket?: Ticket) {
    await this.boundary(live);
    return this.preparation.prepare({
      featureId: f.id,
      ticketId: ticket?.id,
      runId: live.run.id,
      cwd,
      policy: live.run.policy,
      signal: live.controller.signal,
      approve: async (plan, retry) =>
        (
          await this.approve(
            live,
            undefined,
            'tool',
            retry ? 'Review and retry interrupted worktree setup' : 'Prepare worktree environment',
            {
              cwd,
              revision: plan.revision,
              commands: plan.steps,
              localFiles: plan.localFiles,
              manager: plan.manager,
              warnings: plan.warnings,
              network: plan.install
                ? 'Package installation may access the network.'
                : 'Commands use the local host environment.',
            },
          )
        ).allow,
    });
  }
  private async deliver(live: Live, f: Feature, original: Ticket, coordinator: Agent) {
    if (original.state === 'ready_for_integration') {
      await this.mergeTicket(live, f, original);
      return;
    }
    let t = this.ticket(original, { state: 'running', error: undefined });
    if (!t.worktree) {
      t = this.ticket(t, {
        branch: 'tesslane/ticket-' + f.id.slice(0, 8) + '-' + t.id.slice(0, 8),
        worktree: join(this.store.dataDir, 'worktrees', f.id, t.id),
      });
      t = this.ticket(t, { baseRevision: await git(f.worktree!, ['rev-parse', 'HEAD']) });
      await this.gitService.worktree(f, t, t.worktree!, t.branch!, t.baseRevision!);
    }
    await this.prepareWorktree(live, f, t.worktree!, t);
    let feedback = t.error ?? '';
    for (let attempt = t.attempts; attempt < live.run.policy.maxAttempts; attempt++) {
      await this.boundary(live);
      t = this.ticket(t, { state: 'running', attempts: attempt + 1 });
      try {
        if (attempt > 0 && attempt % live.run.policy.diagnoseAfter === 0) {
          const diagnosis = await this.mission(
            live,
            'analyst',
            'deep',
            t.worktree!,
            'Diagnose repeated lack of progress. Read only. Check task context, repository environment, previous verification failures and approach before proposing a model escalation.\nTask: ' +
              JSON.stringify(t) +
              '\nEvidence:\n' +
              feedback,
            true,
            { ticket: t, parent: coordinator },
          );
          feedback += '\nDiagnosis:\n' + diagnosis.text;
        }
        const resumeCommit = Boolean(t.resumeFromCommit && t.commit);
        if (
          resumeCommit &&
          ((await git(t.worktree!, ['rev-parse', 'HEAD'])) !== t.commit ||
            (await git(t.worktree!, ['status', '--porcelain'])))
        )
          throw new Error('Recovered commit changed. Inspect again before continuing.');
        const result = resumeCommit
          ? {
              text:
                t.summary ??
                'Recovered committed implementation; verification and independent review resumed.',
            }
          : await this.mission(
              live,
              'implementer',
              t.profile,
              t.worktree!,
              'Deliver this ticket within the feature. Inspect repository instructions and dependencies. Install dependencies or use network only after an explicit native approval. Do not run arbitrary check commands without approval; Tesslane runs the configured verification commands after your changes.\nFeature: ' +
                f.title +
                '\nTicket: ' +
                JSON.stringify(t) +
                '\nPrevious evidence and corrections:\n' +
                feedback,
              false,
              { ticket: t, parent: coordinator, attempt },
            );
        await this.prepareWorktree(live, f, t.worktree!, t);
        const commit = resumeCommit ? t.commit! : await this.gitService.commit(f, t);
        t = this.ticket(t, {
          commit,
          state: 'verifying',
          summary: result.text.slice(-5000),
          resumeFromCommit: false,
        });
        // Agent-suggested commands are visible in the plan but never become shell
        // authority implicitly. Only user-configured commands run automatically.
        await this.checks(live, f, t, t.worktree!, [
          ...new Set([...live.run.policy.verificationCommands, ...(t.verificationCommands ?? [])]),
        ]);
        t = this.ticket(t, { state: 'reviewing' });
        const reviewDiff = await diffFor(t.worktree!, f.baseRevision, commit);
        const reviewed = await this.mission(
          live,
          'reviewer',
          'deep',
          t.worktree!,
          'Independently review this ticket against its acceptance criteria. Inspect files and the Git diff, not just the implementer summary. Return JSON matching the schema. A blocking finding must set approved=false. Repository HEAD: ' +
            commit +
            '\nFeature base: ' +
            f.baseRevision +
            '\nTicket: ' +
            JSON.stringify(t) +
            '\nActual Git diff excerpt (inspect relevant files when truncated):\n' +
            reviewDiff.slice(-80000),
          true,
          {
            ticket: t,
            parent: coordinator,
            schema: z.toJSONSchema(ReviewOutput) as Record<string, unknown>,
          },
        );
        const review = ReviewOutput.parse(jsonResult(reviewed));
        const implementer = this.store
          .page('agent', { featureId: f.id, limit: 500 })
          .items.filter(
            (a) => a.ticketId === t.id && a.role === 'implementer' && a.runId === live.run.id,
          )
          .at(-1);
        if (implementer)
          this.store.save('agent', {
            ...implementer,
            outcome:
              review.approved && !review.findings.some((x) => x.severity === 'blocking')
                ? 'accepted'
                : 'needs_changes',
          });
        t = this.ticket(t, { findings: review.findings, summary: review.summary });
        if (!review.approved || review.findings.some((x) => x.severity === 'blocking'))
          throw new Error('Independent review requires changes: ' + JSON.stringify(review));
        t = this.ticket(t, { state: 'ready_for_integration', reviewedRevision: commit });
        await this.boundary(live);
        await this.mergeTicket(live, f, t);
        return;
      } catch (error) {
        feedback = errorText(error);
        this.store.event(
          'attempt.failed',
          { ticketId: t.id, attempt: attempt + 1, evidence: feedback },
          f.id,
        );
        if (
          live.controller.signal.aborted ||
          (Boolean(t.commit) && this.store.get('ticket', t.id)?.reviewedRevision === t.commit)
        )
          throw error;
        if (
          error instanceof EngineFailure &&
          (error.kind === 'authentication' ||
            (error.kind === 'quota' &&
              !live.run.policy.fallbacks.some((f) => !live.unavailable.has(f.engine))))
        )
          throw error;
        t = this.ticket(t, { error: feedback });
      }
    }
    throw new Error('Attempt budget exhausted. ' + feedback);
  }
  private async mergeTicket(live: Live, f: Feature, t: Ticket) {
    await this.boundary(live);
    if (!t.commit || t.reviewedRevision !== t.commit)
      throw new Error('This ticket has no review tied to its current commit.');
    const cwd = await this.gitService.assertWorktree(t.worktree!);
    if (
      (await git(cwd, ['rev-parse', 'HEAD'])) !== t.commit ||
      (await git(cwd, ['status', '--porcelain']))
    )
      throw new Error(
        'Ticket changed after review. Reconcile and review the new revision before integration.',
      );
    const prior = this.merges.get(f.id) ?? Promise.resolve();
    const merge = prior.then(() => this.gitService.merge(f, t));
    const settled = merge.then(() => {});
    this.merges.set(f.id, settled);
    void settled.catch(() => {});
    try {
      await merge;
      this.ticket(t, { state: 'integrated', error: undefined });
    } catch (error) {
      this.ticket(t, {
        state: 'blocked',
        error: 'Integration needs attention. ' + errorText(error),
      });
      throw error;
    }
  }
  async inspectTicket(ticketId: string) {
    const ticket = this.store.get('ticket', ticketId);
    if (!ticket) throw new Error('Ticket not found.');
    if (!ticket.worktree)
      return { ticket, head: undefined, dirty: false, conflicts: [], applied: false };
    const cwd = await this.gitService.assertWorktree(ticket.worktree);
    const [head, status, conflicts] = await Promise.all([
      git(cwd, ['rev-parse', 'HEAD']),
      git(cwd, ['status', '--porcelain']),
      this.gitService.conflicts(cwd),
    ]);
    const feature = this.feature(ticket.featureId);
    const applied = Boolean(
      ticket.commit &&
      feature.worktree &&
      (await this.gitService.contains(feature.worktree, ticket.commit)),
    );
    return { ticket, head, dirty: Boolean(status), status, conflicts, applied };
  }
  async reconcile(ticketId: string, expectedHead?: string) {
    const detail = await this.inspectTicket(ticketId),
      t = detail.ticket;
    if ([...this.live.values()].some((l) => l.run.featureId === t.featureId))
      throw new Error('Stop this feature before reconciliation.');
    if (t.state === 'integrated' || t.state === 'cancelled')
      throw new Error('This ticket does not need reconciliation.');
    if (t.worktree && (!expectedHead || detail.head !== expectedHead))
      throw new Error('Inspect the current Git HEAD before authorizing a retry.');
    if (detail.conflicts.length) throw new Error('Resolve or abort pending Git conflicts first.');
    this.store.event(
      'ticket.reconciled_by_user',
      { ticketId, expectedHead, applied: detail.applied, dirty: detail.dirty },
      t.featureId,
    );
    return this.ticket(t, {
      state: detail.applied
        ? 'integrated'
        : t.reviewedRevision === detail.head && t.commit === detail.head && !detail.dirty
          ? 'ready_for_integration'
          : 'ready',
      attempts: 0,
      error: undefined,
    });
  }
  async integrateTicket(ticketId: string) {
    const t = this.store.get('ticket', ticketId);
    if (!t) throw new Error('Ticket not found.');
    const f = this.feature(t.featureId);
    this.assertGitPolicy(f.id);
    if (!t.dependencies.every((d) => this.store.get('ticket', d)?.state === 'integrated'))
      throw new Error('Integrate this ticket’s dependencies first.');
    const live = this.newRun(f, 'execution');
    this.merges.delete(f.id);
    return this.launch(live, async () => {
      if (
        live.run.policy.mode === 'assisted' &&
        !(
          await this.approve(live, undefined, 'integration', 'Integrate reviewed ticket', {
            ticket: t,
            branch: f.branch,
            revision: t.commit,
          })
        ).allow
      )
        throw new Error('Integration declined.');
      await this.mergeTicket(live, f, t);
      this.change(f, {
        status: 'ready',
        error: undefined,
        summary:
          'Ticket integrated. Run the feature’s combined verification and review before marking it complete.',
      });
    });
  }
  private assertGitPolicy(featureId: string) {
    if (this.demo) throw new Error('Sample workspace does not modify Git.');
    if ([...this.live.values()].some((l) => l.run.featureId === featureId))
      throw new Error(
        'Wait for or stop this feature’s active run before changing integration state.',
      );
    const policy = this.store.settings();
    if (policy.mode === 'planning' || !policy.allowGitCommit || !policy.allowIntegration)
      throw new Error('Current policy does not authorize local Git integration changes.');
  }
  async resolveConflict(input: {
    operationId: string;
    expectedHead: string;
    action: 'file' | 'finish' | 'abort';
    path?: string;
    choice?: 'ours' | 'theirs' | 'edit';
    content?: string;
  }) {
    const operation = this.store.get('operation', input.operationId);
    if (!operation) throw new Error('Operation not found.');
    this.assertGitPolicy(operation.featureId);
    if (input.action === 'file')
      return this.gitService.resolveFile(
        operation.id,
        input.path ?? '',
        input.choice ?? 'edit',
        input.expectedHead,
        input.content,
      );
    const result =
      input.action === 'finish'
        ? await this.gitService.finishConflict(operation.id, input.expectedHead)
        : await this.gitService.abortConflict(operation.id, input.expectedHead);
    const ticket = this.store.get('ticket', operation.ticketId!);
    if (ticket)
      this.ticket(ticket, {
        state: input.action === 'finish' ? 'integrated' : 'ready_for_integration',
        error: undefined,
      });
    this.merges.delete(operation.featureId);
    this.change(this.feature(operation.featureId), {
      status: 'ready',
      error: undefined,
      summary:
        'Integration decision saved. Run the feature to verify and review the combined result.',
    });
    return result;
  }
  async reconcileOperation(operationId: string, expectedHead?: string) {
    const operation = this.store.get('operation', operationId);
    if (!operation) throw new Error('Operation not found.');
    this.assertGitPolicy(operation.featureId);
    const result = await this.gitService.reconcile(operationId, expectedHead);
    if (result.kind === 'worktree' && result.state === 'failed') {
      if (result.ticketId) {
        const t = this.store.get('ticket', result.ticketId)!;
        this.ticket(t, {
          worktree: undefined,
          branch: undefined,
          state: 'ready',
          error: undefined,
        });
      } else
        this.change(this.feature(result.featureId), {
          worktree: undefined,
          branch: undefined,
          baseRevision: undefined,
          status: 'ready',
          error: undefined,
        });
    }
    if (result.ticketId && result.kind === 'commit' && result.after) {
      const t = this.store.get('ticket', result.ticketId)!;
      this.ticket(t, {
        commit: result.after,
        state: 'ready',
        error: undefined,
        resumeFromCommit: true,
        attempts: Math.max(0, t.attempts - 1),
      });
    }
    if (result.ticketId && result.kind === 'merge') {
      const t = this.store.get('ticket', result.ticketId)!;
      this.ticket(t, { state: 'integrated', error: undefined });
    }
    return result;
  }
  async commitDetail(hash: string) {
    const detail = await this.gitService.inspectCommit(hash);
    const operations = this.store
      .list('operation')
      .filter((o) => o.after === hash || o.target === hash);
    const tickets = this.store
      .list('ticket')
      .filter((t) => t.commit === hash || operations.some((o) => o.ticketId === t.id));
    const featureIds = new Set([
      ...operations.map((o) => o.featureId),
      ...tickets.map((t) => t.featureId),
    ]);
    return {
      ...detail,
      operations,
      tickets,
      features: this.store.list('feature').filter((f) => featureIds.has(f.id)),
      agents: this.store
        .page('agent', { limit: 500 })
        .items.filter((a) => tickets.some((t) => a.ticketId === t.id)),
    };
  }
  stopAll() {
    for (const live of this.live.values()) this.control(live.run.id, 'stop');
  }
  reconcileRestoredState() {
    this.recover();
  }
}
