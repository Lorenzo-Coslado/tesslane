import { z } from 'zod';
import type { AvatarPreferences } from './avatars.ts';

export const EngineName = z.enum(['codex', 'claude']);
export type EngineName = z.infer<typeof EngineName>;
export const Profile = z.enum(['fast', 'balanced', 'deep']);
export type Profile = z.infer<typeof Profile>;
export const Mode = z.enum(['planning', 'assisted', 'autonomous']);
export type Mode = z.infer<typeof Mode>;
export const WorkState = z.enum([
  'draft',
  'clarifying',
  'ready',
  'queued',
  'running',
  'verifying',
  'reviewing',
  'ready_for_integration',
  'integrated',
  'blocked',
  'cancelled',
]);
export type WorkState = z.infer<typeof WorkState>;
export const AgentState = z.enum([
  'starting',
  'working',
  'waiting',
  'awaiting_approval',
  'pausing',
  'paused',
  'stopping',
  'interrupted',
  'recovering',
  'completed',
  'failed',
]);
export type AgentState = z.infer<typeof AgentState>;
export const Role = z.enum([
  'coordinator',
  'analyst',
  'implementer',
  'validator',
  'reviewer',
  'integrator',
  'specialist',
]);
export type Role = z.infer<typeof Role>;
export const ModelChoice = z.object({
  engine: EngineName,
  model: z.string().max(200).default(''),
  effort: z.string().max(30).default(''),
});
export type ModelChoice = z.infer<typeof ModelChoice>;
export const ModelRating = z.object({
  engine: EngineName,
  model: z.string().min(1).max(200),
  quality: z.number().min(1).max(5),
  speed: z.number().min(1).max(5),
  economy: z.number().min(1).max(5),
  enabled: z.boolean().default(true),
});
export type ModelRating = z.infer<typeof ModelRating>;
export const Settings = z.object({
  mode: Mode.default('assisted'),
  strategy: z.enum(['balanced', 'economic', 'quality']).default('balanced'),
  profiles: z
    .object({
      fast: ModelChoice.default({ engine: 'codex', model: '', effort: '' }),
      balanced: ModelChoice.default({ engine: 'codex', model: '', effort: '' }),
      deep: ModelChoice.default({ engine: 'codex', model: '', effort: '' }),
    })
    .default({
      fast: { engine: 'codex', model: '', effort: '' },
      balanced: { engine: 'codex', model: '', effort: '' },
      deep: { engine: 'codex', model: '', effort: '' },
    }),
  maxConcurrent: z.number().int().min(1).max(12).default(3),
  maxAttempts: z.number().int().min(1).max(8).default(4),
  diagnoseAfter: z.number().int().min(1).max(5).default(2),
  verificationCommands: z.array(z.string().min(1).max(1000)).max(12).default([]),
  checkTimeoutMs: z.number().int().min(1000).max(1800000).default(600000),
  allowNetwork: z.boolean().default(false),
  allowDependencyInstall: z.boolean().default(false),
  allowGitCommit: z.boolean().default(true),
  allowIntegration: z.boolean().default(true),
  fallbacks: z.array(ModelChoice).max(8).default([]),
  modelRatings: z.array(ModelRating).max(100).default([]),
  autoEffort: z.boolean().default(true),
  useObservedPerformance: z.boolean().default(true),
  worktreeSetup: z
    .object({
      dependencies: z.enum(['auto', 'manual', 'none']).default('auto'),
      commands: z.array(z.string().trim().min(1).max(1000)).max(12).default([]),
      localFiles: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
      inputFiles: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
      runScripts: z.boolean().default(false),
      autoRun: z.boolean().default(false),
      timeoutMs: z.number().int().min(1000).max(1800000).default(600000),
    })
    .default({
      dependencies: 'auto',
      commands: [],
      localFiles: [],
      inputFiles: [],
      runScripts: false,
      autoRun: false,
      timeoutMs: 600000,
    }),
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
});
export type Settings = z.infer<typeof Settings>;
export const defaultSettings = () => structuredClone(Settings.parse({}));

export interface Feature {
  id: string;
  title: string;
  description: string;
  criteria: string[];
  externalRef: string;
  status: WorkState;
  createdAt: string;
  updatedAt: string;
  planRevision: number;
  branch?: string;
  worktree?: string;
  baseRevision?: string;
  summary?: string;
  error?: string;
  questions?: { id: string; question: string; recommendation: string }[];
  sourceBranch?: string;
  deliveryId?: string;
}
export interface Finding {
  severity: 'blocking' | 'warning' | 'note';
  message: string;
  path?: string | null;
  line?: number | null;
}
export interface Ticket {
  id: string;
  featureId: string;
  title: string;
  description: string;
  criteria: string[];
  dependencies: string[];
  areas: string[];
  checks: string[];
  profile: Profile;
  state: WorkState;
  attempts: number;
  branch?: string;
  worktree?: string;
  commit?: string;
  summary?: string;
  findings?: Finding[];
  error?: string;
  createdAt: string;
  updatedAt: string;
  nextModel?: ModelChoice;
  reviewedRevision?: string;
  resumeFromCommit?: boolean;
  baseRevision?: string;
  verificationCommands?: string[];
}
export const TicketEditInput = z
  .object({
    ticketId: z.string().min(1).max(500),
    revision: z.number().int().nonnegative(),
    updatedAt: z.iso.datetime(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(50000),
    criteria: z.array(z.string().trim().min(1).max(2000)).min(1).max(30),
    dependencies: z.array(z.string().min(1).max(500)).max(30),
    areas: z.array(z.string().trim().min(1).max(500)).max(30),
    checks: z.array(z.string().trim().min(1).max(2000)).max(30),
    profile: Profile,
    verificationCommands: z.array(z.string().trim().min(1).max(1000)).max(12).default([]),
  })
  .strict();
export interface Preparation {
  id: string;
  featureId: string;
  ticketId?: string;
  runId: string;
  cwd: string;
  revision: string;
  fingerprint: string;
  state: 'awaiting_approval' | 'running' | 'ready' | 'failed' | 'interrupted';
  manager?: string;
  commands: string[];
  localFiles: string[];
  output: string;
  error?: string;
  createdAt: string;
  endedAt?: string;
  reusedFrom?: string;
}
export interface DeliveryReport {
  id: string;
  featureId: string;
  runId: string;
  createdAt: string;
  planRevision: number;
  title: string;
  description: string;
  criteria: string[];
  externalRef: string;
  branch: string;
  worktree: string;
  sourceRoot: string;
  sourceBranch?: string;
  baseRevision: string;
  revision: string;
  summary: string;
  changes: { path: string; status: string }[];
  stat: string;
  tickets: {
    id: string;
    title: string;
    state: WorkState;
    criteria: string[];
    commit?: string;
    summary?: string;
    findings: Finding[];
  }[];
  checks: Pick<Check, 'id' | 'ticketId' | 'command' | 'revision' | 'state' | 'exitCode'>[];
  review: {
    approved: boolean;
    summary: string;
    findings: Finding[];
    revision: string;
    agentId?: string;
  };
  limitations: string[];
  handoff: { label: string; command: string }[];
  markdown: string;
}
export interface Run {
  id: string;
  featureId: string;
  status: AgentState;
  kind: 'plan' | 'execution' | 'chat';
  startedAt: string;
  endedAt?: string;
  policy: Settings;
  planRevision: number;
  error?: string;
  targetId?: string;
}
export interface Agent {
  id: string;
  runId: string;
  featureId: string;
  ticketId?: string;
  parentId?: string;
  native?: boolean;
  name: string;
  role: Role;
  state: AgentState;
  profile: Profile;
  engine: EngineName;
  model: string;
  effort: string;
  effectiveModel?: string;
  configuredModel?: string;
  selectionReason: string;
  sessionId?: string;
  turnId?: string;
  workspace: string;
  startedAt: string;
  endedAt?: string;
  tokens?: number;
  error?: string;
  summary?: string;
  readOnly?: boolean;
  usage?: Usage;
  outcome?: 'accepted' | 'needs_changes';
  providerId?: string;
  capabilities?: string[];
}
export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
}
export interface ModelMetric {
  engine: EngineName;
  model: string;
  role: Role;
  completed: number;
  failed: number;
  accepted: number;
  needsChanges: number;
  meanDurationMs: number;
  inputTokens: number;
  outputTokens: number;
  usageSamples: number;
  reportedCostUsd: number | null;
}
export const Delivery = z.enum([
  'queued',
  'sending',
  'accepted',
  'sent',
  'failed',
  'cancelled',
  'uncertain',
]);
export interface Message {
  id: string;
  featureId: string;
  agentId?: string;
  targetId: string;
  role: 'user' | 'assistant' | 'system' | 'reasoning';
  content: string;
  createdAt: string;
  delivery?: z.infer<typeof Delivery>;
  deliveryDetail?: string;
  deliveredAt?: string;
  mode?: 'discuss' | 'clarify' | 'steer' | 'command';
  requestId?: string;
  truncated?: boolean;
  updatedAt?: string;
}
export const ChatActionKind = z.enum([
  'create_feature',
  'plan',
  'execute',
  'pause',
  'resume',
  'stop',
  'retry',
  'integrate',
]);
export interface ChatAction {
  id: string;
  featureId: string;
  messageId: string;
  kind: z.infer<typeof ChatActionKind>;
  title: string;
  targetId: string;
  data?: { title: string; description: string };
  revision: number;
  status: 'pending' | 'applying' | 'applied' | 'declined' | 'failed' | 'uncertain';
  createdAt: string;
  resolvedAt?: string;
  result?: string;
  error?: string;
}
export interface GitOperation {
  id: string;
  featureId: string;
  ticketId?: string;
  kind: 'worktree' | 'commit' | 'merge' | 'resolve' | 'abort';
  state: 'intent' | 'completed' | 'conflicted' | 'failed' | 'interrupted';
  cwd: string;
  branch?: string;
  before?: string;
  target?: string;
  after?: string;
  files?: string[];
  error?: string;
  createdAt: string;
  endedAt?: string;
}
export interface Approval {
  id: string;
  featureId: string;
  runId?: string;
  agentId?: string;
  kind: 'plan' | 'tool' | 'integration';
  title: string;
  description: string;
  details: unknown;
  revision: number;
  status: 'pending' | 'approved' | 'declined' | 'superseded';
  createdAt: string;
  resolvedAt?: string;
}
export interface Check {
  id: string;
  featureId: string;
  ticketId?: string;
  command: string;
  revision: string;
  state: 'running' | 'passed' | 'failed' | 'interrupted';
  output: string;
  exitCode: number | null;
  startedAt: string;
  endedAt?: string;
  outputTruncated?: boolean;
}
export interface Interaction {
  id: string;
  featureId: string;
  from: string;
  to: string;
  message: string;
  createdAt: string;
}
export interface Entities {
  feature: Feature;
  ticket: Ticket;
  run: Run;
  agent: Agent;
  message: Message;
  approval: Approval;
  check: Check;
  interaction: Interaction;
  action: ChatAction;
  operation: GitOperation;
  preparation: Preparation;
  delivery: DeliveryReport;
}
export type EntityKind = keyof Entities;
export interface JournalEvent {
  seq: number;
  type: string;
  entityId?: string;
  featureId?: string;
  payload: unknown;
  at: string;
  preview?: boolean;
}
export interface EngineInfo {
  name: EngineName;
  available: boolean;
  version: string;
  path: string;
  account?: string;
  connected?: boolean;
  error?: string;
  capabilities: string[];
}
export interface AvailableModel {
  id: string;
  name: string;
  efforts: string[];
  defaultEffort?: string;
  isDefault?: boolean;
  description?: string;
  aliases?: string[];
}
export interface Diagnostic {
  root: string;
  name: string;
  git: boolean;
  branch: string;
  dirty: boolean;
  instructions: string[];
  manifests: string[];
  workSources: string[];
  suggestedChecks: string[];
  organization: 'structured' | 'informal' | 'empty';
  engines: EngineInfo[];
}
export interface Snapshot {
  project: { name: string; root: string; dataDir: string; demo: boolean; configured: boolean };
  settings: Settings;
  avatars: AvatarPreferences;
  diagnostic: Diagnostic;
  seq: number;
  features: Feature[];
  tickets: Ticket[];
  runs: Run[];
  agents: Agent[];
  messages: Message[];
  approvals: Approval[];
  checks: Check[];
  interactions: Interaction[];
  events: JournalEvent[];
  actions: ChatAction[];
  operations: GitOperation[];
  metrics: ModelMetric[];
  preparations: Preparation[];
  totals: Partial<Record<EntityKind, number>>;
}
export const ChatInput = z.object({
  featureId: z.string().min(1),
  targetId: z.string().min(1),
  content: z.string().trim().min(1).max(50000),
  mode: z.enum(['discuss', 'clarify', 'steer', 'command']).default('discuss'),
  requestId: z.string().uuid().optional(),
});
export const ChatOutput = z.object({
  answer: z.string(),
  actions: z
    .array(
      z.object({
        kind: ChatActionKind,
        title: z.string(),
        targetId: z.string(),
        data: z.object({ title: z.string(), description: z.string() }).nullable(),
      }),
    )
    .max(4),
});
export const FeatureInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(50000),
  criteria: z.array(z.string().trim().min(1).max(2000)).max(30).default([]),
  externalRef: z.union([z.literal(''), z.url()]).default(''),
});
export const PlanOutput = z.object({
  summary: z.string(),
  criteria: z.array(z.string()).min(1),
  questions: z.array(
    z.object({ id: z.string(), question: z.string(), recommendation: z.string() }),
  ),
  tickets: z
    .array(
      z.object({
        key: z.string().min(1),
        title: z.string(),
        description: z.string(),
        criteria: z.array(z.string()),
        dependencies: z.array(z.string()),
        areas: z.array(z.string()),
        checks: z.array(z.string()),
        profile: Profile,
      }),
    )
    .max(30),
});
export type PlanOutput = z.infer<typeof PlanOutput>;
export const ReviewOutput = z.object({
  approved: z.boolean(),
  summary: z.string(),
  findings: z.array(
    z.object({
      severity: z.enum(['blocking', 'warning', 'note']),
      message: z.string(),
      path: z.string().nullable().default(null),
      line: z.number().int().positive().nullable().default(null),
    }),
  ),
});
export type ReviewOutput = z.infer<typeof ReviewOutput>;
