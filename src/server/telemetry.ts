import { Store, now } from './store.ts';
import type { Agent, AgentState, Message, Usage } from '../shared/contracts.ts';
import type { EngineEvent } from './engines.ts';
const terminal = new Set(['completed', 'failed', 'interrupted']);
const state = (value: string): AgentState =>
  (
    ({
      pendingInit: 'starting',
      running: 'working',
      in_progress: 'working',
      completed: 'completed',
      errored: 'failed',
      failed: 'failed',
      interrupted: 'interrupted',
      shutdown: 'interrupted',
      notFound: 'failed',
      stopped: 'completed',
    }) as Record<string, AgentState>
  )[value] ?? 'working';
export class Telemetry {
  private buffers = new Map<string, Message>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private children = new Map<string, string>();
  private spawnTools = new Map<string, string>();
  private parents = new Map<string, string>();
  private seen = new Set<string>();
  private blocks = new Map<
    string,
    { messageId: string; index: number; type: string; final: boolean }
  >();
  constructor(
    private store: Store,
    private root: Agent,
  ) {}
  flush = () => {
    clearTimeout(this.timer);
    this.timer = undefined;
    const changes = [...this.buffers.values()].map((entity) => ({
      kind: 'message' as const,
      entity,
    }));
    if (changes.length) this.store.batch(changes);
    this.buffers.clear();
  };
  private output(agent: Agent, key: string, content: string, reasoning = false, replace = false) {
    const messageId = agent.id + ':' + key;
    const old = this.buffers.get(messageId) ?? this.store.get('message', messageId);
    const text = replace ? content : (old?.content ?? '') + content;
    this.buffers.set(messageId, {
      id: messageId,
      featureId: agent.featureId,
      agentId: agent.id,
      targetId: agent.id,
      role: reasoning ? 'reasoning' : 'assistant',
      content: text.slice(-200000),
      truncated: text.length > 200000 || (!replace && old?.truncated) || false,
      createdAt: old?.createdAt ?? now(),
      updatedAt: now(),
    });
    if (!this.timer) this.timer = setTimeout(this.flush, 200);
  }
  private update(agent: Agent, patch: Partial<Agent>) {
    return this.store.save('agent', { ...this.store.get('agent', agent.id)!, ...patch });
  }
  private child(providerId: string, patch: Partial<Agent> = {}, parentProvider?: string) {
    const id = this.root.id + ':native:' + providerId;
    this.children.set(providerId, id);
    if (parentProvider) this.parents.set(providerId, parentProvider);
    parentProvider ??= this.parents.get(providerId);
    const existing = this.store.get('agent', id);
    const parentId = parentProvider
      ? (this.children.get(parentProvider) ??
        (parentProvider === this.store.get('agent', this.root.id)?.sessionId
          ? this.root.id
          : undefined))
      : undefined;
    const child: Agent = {
      ...this.root,
      id,
      parentId,
      native: true,
      providerId,
      name: 'Native agent ' + providerId.slice(0, 8),
      role: 'specialist',
      state: 'working',
      model: '',
      effort: '',
      sessionId: undefined,
      turnId: undefined,
      effectiveModel: undefined,
      configuredModel: undefined,
      usage: undefined,
      tokens: undefined,
      outcome: undefined,
      endedAt: undefined,
      startedAt: now(),
      selectionReason:
        'Observed native child. Model/parent details remain unknown unless reported.',
      capabilities: [],
      ...existing,
      ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && v !== '')),
    };
    if (parentId) child.parentId = parentId;
    if (terminal.has(child.state)) child.endedAt ??= now();
    else if (patch.state) child.endedAt = undefined;
    this.store.save('agent', child);
    for (const [childProvider, parent] of this.parents)
      if (parent === providerId && childProvider !== providerId) {
        const nested = this.store.get('agent', this.children.get(childProvider)!);
        if (nested && nested.parentId !== id) this.store.save('agent', { ...nested, parentId: id });
      }
    return child;
  }
  private byProvider(provider?: string) {
    return provider && this.children.has(provider)
      ? this.store.get('agent', this.children.get(provider)!)!
      : this.store.get('agent', this.root.id)!;
  }
  record(event: EngineEvent) {
    const p = event.data;
    if (p.agent_id && !this.children.has(p.agent_id)) this.child(p.agent_id);
    const rootSession = this.store.get('agent', this.root.id)?.sessionId;
    if (p.threadId && rootSession && p.threadId !== rootSession && !this.children.has(p.threadId))
      this.child(p.threadId, { sessionId: p.threadId });
    let agent = this.byProvider(p.threadId ?? p.agent_id);
    this.store.event('engine.' + event.type, { ...p, agentId: agent.id }, this.root.featureId);
    if (event.type === 'session')
      this.update(this.root, { sessionId: p.sessionId, configuredModel: p.configuredModel });
    if (event.type === 'thread/started') {
      const thread = p.thread,
        parent = thread.parentThreadId ?? thread.source?.subAgent?.thread_spawn?.parent_thread_id;
      if (parent)
        agent = this.child(
          thread.id,
          {
            sessionId: thread.id,
            name: thread.agentNickname ?? 'Native Codex agent',
            model: thread.model ?? '',
            effort: thread.reasoningEffort ?? '',
          },
          parent,
        );
      else if (rootSession && thread.id !== rootSession)
        this.child(thread.id, { sessionId: thread.id });
      else this.update(this.root, { sessionId: thread.id });
    }
    if (event.type === 'turn/started') this.update(agent, { turnId: p.turn.id });
    if (event.type === 'thread/tokenUsage/updated')
      this.update(agent, {
        usage: { ...p.tokenUsage.total },
        tokens: p.tokenUsage.total.totalTokens,
      });
    if (event.type === 'account/rateLimits/updated') {
      const prior = this.store.meta<any>('limits.codex') ?? {};
      this.store.setMeta('limits.codex', {
        ...prior,
        ...Object.fromEntries(
          Object.entries(p.rateLimits ?? {}).filter(
            ([key, v]) => v !== null || key === 'spendControlReached',
          ),
        ),
        observedAt: now(),
      });
    }
    if (event.type === 'item/agentMessage/delta') this.output(agent, p.itemId, p.delta);
    if (event.type.startsWith('item/reasoning/') && event.type.endsWith('Delta'))
      this.output(
        agent,
        'reasoning:' + p.itemId + ':' + (p.summaryIndex ?? p.contentIndex ?? 0),
        p.delta,
        true,
      );
    if (event.type === 'item/completed' || event.type === 'item/started') {
      const item = p.item;
      if (item.type === 'agentMessage' && event.type === 'item/completed')
        this.output(agent, item.id, item.text, false, true);
      if (item.type === 'collabAgentToolCall')
        for (const receiver of item.receiverThreadIds ?? []) {
          const nativeState = item.agentsStates?.[receiver];
          const child = this.child(
            receiver,
            {
              model: item.model ?? '',
              effort: item.reasoningEffort ?? '',
              ...(nativeState
                ? { state: state(nativeState.status), summary: nativeState.message }
                : {}),
              sessionId: receiver,
            },
            item.senderThreadId,
          );
          if (['sendInput', 'sendMessage', 'followupTask', 'spawnAgent'].includes(item.tool))
            this.store.save('interaction', {
              id: this.root.id + ':interaction:' + item.id + ':' + receiver,
              featureId: this.root.featureId,
              from: this.children.get(item.senderThreadId) ?? this.root.id,
              to: child.id,
              message: item.prompt ?? item.tool,
              createdAt: now(),
            });
        }
      if (item.type === 'subAgentActivity')
        this.child(
          item.agentThreadId,
          {
            state: state(item.kind === 'started' ? 'running' : item.kind),
            effectiveModel: item.model ?? undefined,
            sessionId: item.agentThreadId,
          },
          p.threadId,
        );
    }
    if (event.type === 'claude.system') {
      if (p.subtype === 'init')
        this.update(this.root, { sessionId: p.session_id, effectiveModel: p.model });
      if (
        p.subtype === 'task_started' &&
        (p.task_type === 'local_agent' || p.subagent_type || p.spawn_depth)
      ) {
        const child = this.child(
          p.task_id,
          { name: p.description ?? 'Native Claude agent' },
          p.parent_task_id ?? this.store.get('agent', this.root.id)?.sessionId,
        );
        if (p.tool_use_id) this.spawnTools.set(p.tool_use_id, child.providerId!);
      }
      if (
        ['task_notification', 'task_updated', 'task_progress'].includes(p.subtype) &&
        this.children.has(p.task_id)
      )
        this.child(p.task_id, {
          ...(p.status || p.patch?.status ? { state: state(p.status ?? p.patch.status) } : {}),
          ...(p.summary ? { summary: p.summary } : {}),
        });
    }
    if (event.type === 'claude.rate_limit_event')
      this.store.setMeta('limits.claude', { ...p.rate_limit_info, observedAt: now() });
    if (event.type === 'claude.stream_event') {
      const e = p.event;
      const channel = p.parent_tool_use_id ?? 'main';
      if (e.type === 'message_start')
        this.blocks.set(channel, { messageId: e.message.id, index: 0, type: '', final: false });
      const block = this.blocks.get(channel);
      if (block && e.type === 'content_block_start') {
        block.index = e.index;
        block.type = e.content_block.type;
        block.final = false;
      }
      if (block && e.type === 'content_block_delta' && !block.final) {
        const text = e.delta.text ?? e.delta.thinking;
        if (typeof text === 'string')
          this.output(
            agent,
            'claude:' + block.messageId + ':' + block.index,
            text,
            e.delta.type === 'thinking_delta',
          );
      }
    }
    if (event.type === 'claude.assistant') {
      if (p.uuid && this.seen.has(p.uuid)) return;
      if (p.uuid) this.seen.add(p.uuid);
      const provider = p.agent_id ?? this.spawnTools.get(p.parent_tool_use_id);
      if (provider)
        agent = this.children.has(provider) ? this.byProvider(provider) : this.child(provider);
      const current = this.blocks.get(p.parent_tool_use_id ?? 'main');
      for (const [index, block] of (p.message?.content ?? []).entries())
        if (['text', 'thinking'].includes(block.type)) {
          const provisional =
            current &&
            current.messageId === p.message.id &&
            current.type === block.type &&
            !current.final;
          const key = provisional
            ? 'claude:' + current.messageId + ':' + current.index
            : 'claude-envelope:' + p.uuid + ':' + index;
          this.output(agent, key, block.text ?? block.thinking, block.type === 'thinking', true);
          if (provisional) current.final = true;
        }
      if (p.message?.model)
        this.update(agent, {
          ...(p.session_id && !agent.native ? { sessionId: p.session_id } : {}),
          effectiveModel: p.message.model,
        });
    }
    if (event.type === 'claude.result') {
      const usage: Usage = {
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        costUsd: p.total_cost_usd,
      };
      for (const u of Object.values(p.modelUsage ?? {}) as any[]) {
        usage.inputTokens! += u.inputTokens ?? 0;
        usage.outputTokens! += u.outputTokens ?? 0;
        usage.cachedInputTokens! += u.cacheReadInputTokens ?? 0;
      }
      usage.totalTokens = usage.inputTokens! + usage.outputTokens!;
      this.update(this.root, { usage, tokens: usage.totalTokens });
    }
  }
  finish() {
    this.flush();
    for (const childId of this.children.values()) {
      const child = this.store.get('agent', childId)!;
      if (!terminal.has(child.state))
        this.update(child, {
          state: 'recovering',
          error:
            'Native child completion was not reported. Inspect provider events before retrying.',
        });
    }
  }
}
