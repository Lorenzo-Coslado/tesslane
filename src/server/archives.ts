import { z } from 'zod';
import { AvatarPreferences } from './avatar-contracts.ts';
import {
  AgentState,
  WorkState,
  Role,
  Profile,
  Settings,
  ModelChoice,
  EngineName,
  FeatureInput,
  ChatActionKind,
  Delivery,
} from '../shared/contracts.ts';
const id = z.string().min(1).max(500),
  time = z.iso.datetime(),
  text = z.string(),
  texts = z.array(text);
const base = z.object({ id, createdAt: time }).passthrough();
const finding = z.object({
  severity: z.enum(['blocking', 'warning', 'note']),
  message: text,
  path: text.nullable().optional(),
  line: z.number().int().positive().nullable().optional(),
});
export const storedSchemas = {
  feature: FeatureInput.extend({
    id,
    status: WorkState,
    createdAt: time,
    updatedAt: time,
    planRevision: z.number().int().nonnegative(),
    branch: text.optional(),
    worktree: text.optional(),
    baseRevision: text.optional(),
    sourceBranch: text.optional(),
    deliveryId: id.optional(),
    summary: text.optional(),
    error: text.optional(),
    questions: z.array(z.object({ id, question: text, recommendation: text })).optional(),
  }).passthrough(),
  ticket: base.extend({
    featureId: id,
    title: text,
    description: text,
    criteria: texts,
    dependencies: texts,
    areas: texts,
    checks: texts,
    profile: Profile,
    state: WorkState,
    attempts: z.number().int().nonnegative(),
    updatedAt: time,
    branch: text.optional(),
    worktree: text.optional(),
    commit: text.optional(),
    summary: text.optional(),
    findings: z.array(finding).optional(),
    nextModel: ModelChoice.optional(),
    reviewedRevision: text.optional(),
    baseRevision: text.optional(),
    verificationCommands: texts.optional(),
  }),
  run: z
    .object({
      id,
      featureId: id,
      status: AgentState,
      kind: z.enum(['plan', 'execution', 'chat']),
      startedAt: time,
      endedAt: time.optional(),
      policy: Settings,
      planRevision: z.number().int().nonnegative(),
    })
    .passthrough(),
  agent: z
    .object({
      id,
      runId: id,
      featureId: id,
      name: text,
      role: Role,
      state: AgentState,
      profile: Profile,
      engine: EngineName,
      model: text,
      effort: text,
      selectionReason: text,
      workspace: text,
      startedAt: time,
      ticketId: id.optional(),
      parentId: id.optional(),
      endedAt: time.optional(),
      native: z.boolean().optional(),
      usage: z
        .object({
          inputTokens: z.number().nonnegative().optional(),
          outputTokens: z.number().nonnegative().optional(),
          cachedInputTokens: z.number().nonnegative().optional(),
          totalTokens: z.number().nonnegative().optional(),
          costUsd: z.number().nonnegative().optional(),
        })
        .optional(),
    })
    .passthrough(),
  message: base.extend({
    featureId: id,
    targetId: id,
    agentId: id.optional(),
    role: z.enum(['user', 'assistant', 'system', 'reasoning']),
    content: text,
    delivery: Delivery.optional(),
  }),
  approval: base.extend({
    featureId: id,
    runId: id.optional(),
    agentId: id.optional(),
    kind: z.enum(['plan', 'tool', 'integration']),
    title: text,
    description: text,
    details: z.unknown(),
    revision: z.number().int().nonnegative(),
    status: z.enum(['pending', 'approved', 'declined', 'superseded']),
  }),
  check: z
    .object({
      id,
      featureId: id,
      ticketId: id.optional(),
      command: text,
      revision: text,
      state: z.enum(['running', 'passed', 'failed', 'interrupted']),
      output: text,
      exitCode: z.number().int().nullable(),
      startedAt: time,
      endedAt: time.optional(),
    })
    .passthrough(),
  interaction: base.extend({ featureId: id, from: id, to: id, message: text }),
  action: base.extend({
    featureId: id,
    messageId: id,
    kind: ChatActionKind,
    title: text,
    targetId: id,
    revision: z.number().int().nonnegative(),
    status: z.enum(['pending', 'applying', 'applied', 'declined', 'failed', 'uncertain']),
  }),
  operation: base.extend({
    featureId: id,
    ticketId: id.optional(),
    kind: z.enum(['worktree', 'commit', 'merge', 'resolve', 'abort']),
    state: z.enum(['intent', 'completed', 'conflicted', 'failed', 'interrupted']),
    cwd: text,
  }),
  preparation: base.extend({
    featureId: id,
    runId: id,
    ticketId: id.optional(),
    cwd: text,
    revision: text,
    fingerprint: text,
    state: z.enum(['awaiting_approval', 'running', 'ready', 'failed', 'interrupted']),
    commands: texts,
    localFiles: texts,
    output: text,
    endedAt: time.optional(),
  }),
  delivery: base.extend({
    featureId: id,
    runId: id,
    planRevision: z.number().int().nonnegative(),
    title: text,
    description: text,
    criteria: texts,
    externalRef: text,
    branch: text,
    worktree: text,
    sourceRoot: text,
    baseRevision: text,
    revision: text,
    summary: text,
    changes: z.array(z.object({ path: text, status: text })),
    stat: text,
    tickets: z.array(
      z.object({
        id,
        title: text,
        state: WorkState,
        criteria: texts,
        commit: text.optional(),
        summary: text.optional(),
        findings: z.array(finding),
      }),
    ),
    checks: z.array(
      z.object({
        id,
        ticketId: id.optional(),
        command: text,
        revision: text,
        state: z.enum(['running', 'passed', 'failed', 'interrupted']),
        exitCode: z.number().int().nullable(),
      }),
    ),
    review: z.object({
      approved: z.boolean(),
      summary: text,
      findings: z.array(finding),
      revision: text,
      agentId: id.optional(),
    }),
    limitations: texts,
    handoff: z.array(z.object({ label: text, command: text })),
    markdown: text,
  }),
};
const archiveSchema = z.object({
  format: z.literal('tesslane-workspace'),
  version: z.union([z.literal(1), z.literal(2)]),
  projectRoot: text.optional(),
  createdAt: time,
  settings: Settings,
  avatars: AvatarPreferences.default({}),
  configured: z.boolean().optional(),
  entities: z
    .array(
      z.object({
        kind: z.enum([
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
        ]),
        id,
        data: z.string().max(4 * 1024 * 1024),
      }),
    )
    .max(100000),
  events: z
    .array(
      z.object({
        seq: z.number().int().positive(),
        type: text,
        entity_id: text.nullable(),
        feature_id: text.nullable(),
        payload: text,
        at: time,
      }),
    )
    .max(1000000),
});
export function validateArchive(value: unknown) {
  const archive = archiveSchema.parse(value);
  const records = new Map<string, any>();
  for (const row of archive.entities) {
    const parsed = storedSchemas[row.kind].parse(JSON.parse(row.data));
    if (parsed.id !== row.id || records.has(row.kind + ':' + row.id))
      throw new Error('Duplicate or mismatched backup entity.');
    records.set(row.kind + ':' + row.id, parsed);
  }
  const get = (kind: string, key: string) => records.get(kind + ':' + key);
  const feature = (key: string) => key === 'project' || get('feature', key);
  for (const row of archive.entities) {
    const r = get(row.kind, row.id);
    if (row.kind !== 'feature' && !feature(r.featureId))
      throw new Error('Orphan backup record: ' + row.kind);
    if (r.ticketId && get('ticket', r.ticketId)?.featureId !== r.featureId)
      throw new Error('Invalid ticket reference.');
    if (r.runId && get('run', r.runId)?.featureId !== r.featureId)
      throw new Error('Invalid run reference.');
    if (r.agentId && get('agent', r.agentId)?.featureId !== r.featureId)
      throw new Error('Invalid agent reference.');
    if (row.kind === 'feature' && r.deliveryId && get('delivery', r.deliveryId)?.featureId !== r.id)
      throw new Error('Invalid delivery report reference.');
    if (row.kind === 'delivery') {
      for (const ticket of r.tickets)
        if (get('ticket', ticket.id)?.featureId !== r.featureId)
          throw new Error('Invalid delivery ticket reference.');
      for (const check of r.checks)
        if (get('check', check.id)?.featureId !== r.featureId)
          throw new Error('Invalid delivery check reference.');
    }
    if (row.kind === 'ticket')
      for (const dep of r.dependencies)
        if (get('ticket', dep)?.featureId !== r.featureId)
          throw new Error('Invalid ticket dependency.');
    if (row.kind === 'agent' && r.parentId && get('agent', r.parentId)?.featureId !== r.featureId)
      throw new Error('Invalid agent parent.');
    if (row.kind === 'interaction' && (!get('agent', r.from) || !get('agent', r.to)))
      throw new Error('Invalid interaction endpoint.');
  }
  const visited = new Set<string>(),
    visiting = new Set<string>();
  const visit = (key: string) => {
    if (visiting.has(key)) throw new Error('Backup contains a dependency/parent cycle.');
    if (visited.has(key)) return;
    visiting.add(key);
    const r = records.get(key);
    const children = key.startsWith('ticket:')
      ? r.dependencies.map((d: string) => 'ticket:' + d)
      : r.parentId
        ? ['agent:' + r.parentId]
        : [];
    children.forEach(visit);
    visiting.delete(key);
    visited.add(key);
  };
  for (const key of records.keys())
    if (key.startsWith('ticket:') || key.startsWith('agent:')) visit(key);
  let last = 0;
  for (const event of archive.events) {
    if (event.seq <= last) throw new Error('Backup events are not strictly ordered.');
    JSON.parse(event.payload);
    last = event.seq;
  }
  return archive;
}
