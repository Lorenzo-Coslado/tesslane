import { type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AvailableModel, EngineInfo, ModelChoice, Usage } from '../shared/contracts.ts';
import { ProcessOwner } from './processes.ts';
import { InputQueue } from './input-queue.ts';

export interface EngineEvent {
  type: string;
  data: Record<string, any>;
}
export class EngineFailure extends Error {
  constructor(
    readonly kind: 'quota' | 'authentication' | 'runtime',
    message: string,
  ) {
    super(message);
    this.name = 'EngineFailure';
  }
}
export interface Mission {
  cwd: string;
  prompt: string;
  instructions: string;
  choice: ModelChoice;
  readOnly: boolean;
  signal: AbortSignal;
  schema?: Record<string, unknown>;
  onControl?: (control: AgentControl | undefined) => void;
  emit: (event: EngineEvent) => void;
  permission: (
    title: string,
    details: unknown,
    signal: AbortSignal,
  ) => Promise<{ allow: boolean; answers?: Record<string, string> }>;
}
export interface Result {
  text: string;
  structured?: unknown;
  sessionId?: string;
  model?: string;
  configuredModel?: string;
  usage?: Usage;
}
export interface AgentControl {
  steer(
    text: string,
    messageId: string,
  ): Promise<{ state: 'accepted' | 'queued' | 'sent'; detail: string }>;
}
export interface Adapter {
  run(mission: Mission): Promise<Result>;
  catalog(): Promise<{ models: AvailableModel[]; account: string }>;
}

// One official app-server process per mission. Responses and server requests share
// the transport, but never the same pending-request table.
export class CodexConnection {
  private owner: ProcessOwner;
  private child: ChildProcessWithoutNullStreams;
  private seq = 0;
  private pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  onNotification: (method: string, params: any) => void = () => {};
  onRequest: (method: string, params: any) => Promise<unknown> = async () => ({
    decision: 'decline',
  });
  onExit: (error: Error) => void = () => {};
  private stderr = '';
  private closed = false;
  constructor(path: string, cwd?: string, args = ['app-server']) {
    this.owner = new ProcessOwner(path, args, { cwd });
    this.child = this.owner.child;
    this.child.stdin.on('error', () => {});
    const lines = createInterface({ input: this.child.stdout });
    lines.on('line', (line) => {
      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      if (msg.method && msg.id !== undefined) {
        void this.onRequest(msg.method, msg.params)
          .then((result) => this.send({ id: msg.id, result }))
          .catch((error) =>
            this.send({ id: msg.id, error: { code: -32000, message: String(error.message) } }),
          );
      } else if (msg.method) this.onNotification(msg.method, msg.params);
      else {
        const waiting = this.pending.get(msg.id);
        if (waiting) {
          clearTimeout(waiting.timer);
          this.pending.delete(msg.id);
          msg.error ? waiting.reject(new Error(msg.error.message)) : waiting.resolve(msg.result);
        }
      }
    });
    this.child.stderr.on('data', (data) => {
      this.stderr = (this.stderr + String(data)).slice(-3000);
    });
    this.child.once('error', (error) => this.fail(error));
    this.child.once('exit', (code) =>
      this.fail(new Error('Codex app-server closed (' + code + '). ' + this.stderr)),
    );
  }
  private fail(error: Error) {
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(error);
    }
    this.pending.clear();
    if (!this.closed) this.onExit(error);
  }
  private send(value: unknown) {
    if (!this.child.stdin.destroyed) this.child.stdin.write(JSON.stringify(value) + '\n');
  }
  request(method: string, params: unknown = {}): Promise<any> {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Codex request timed out: ' + method));
      }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ id, method, params });
    });
  }
  async initialize() {
    await this.request('initialize', { clientInfo: { name: 'tesslane', version: '0.1.0' } });
    this.send({ method: 'initialized' });
  }
  async close() {
    this.closed = true;
    this.fail(new Error('Connection closed'));
    this.child.stdin.end();
    await this.owner.terminate();
  }
}
export class CodexAdapter implements Adapter {
  constructor(
    private info: EngineInfo,
    private connect = (path: string, cwd?: string) => new CodexConnection(path, cwd),
  ) {}
  async catalog(): Promise<{ models: AvailableModel[]; account: string }> {
    const connection = this.connect(this.info.path);
    try {
      await connection.initialize();
      const [catalog, account] = await Promise.all([
        connection.request('model/list'),
        connection.request('account/read', { refreshToken: false }),
      ]);
      return {
        models: (catalog.data ?? []).map((x: any) => ({
          id: x.model ?? x.id,
          aliases: x.id !== x.model ? [x.id] : [],
          name: x.displayName ?? x.id,
          description: x.description,
          isDefault: x.isDefault,
          efforts: (x.supportedReasoningEfforts ?? []).map((e: any) => e.reasoningEffort),
          defaultEffort: x.defaultReasoningEffort,
        })),
        account:
          account.account?.type ??
          (account.requiresOpenaiAuth ? 'Sign in with codex login' : 'Native configuration'),
      };
    } finally {
      await connection.close();
    }
  }
  async run(m: Mission): Promise<Result> {
    const connection = this.connect(this.info.path, m.cwd);
    let threadId = '';
    let turnId = '';
    let output = '';
    let effectiveModel = '';
    let usage: Usage | undefined;
    const children = new Set<string>();
    let parentComplete = false;
    let childrenTimer: ReturnType<typeof setTimeout> | undefined;
    let rejectTurn: (error: Error) => void = () => {};
    const complete = new Promise<Result>((resolve, reject) => {
      rejectTurn = reject;
      connection.onExit = reject;
      connection.onNotification = (method, p) => {
        m.emit({ type: method, data: p ?? {} });
        if (method === 'thread/started' && !p.thread.parentThreadId && !p.thread.source?.subAgent) {
          threadId = p.thread.id;
          effectiveModel = p.thread.model ?? '';
        }
        if (method === 'turn/started' && (!p.threadId || p.threadId === threadId))
          turnId = p.turn.id;
        if (method === 'thread/tokenUsage/updated' && p.threadId === threadId)
          usage = { ...p.tokenUsage.total };
        if (
          method === 'item/completed' &&
          p.item.type === 'agentMessage' &&
          (!p.threadId || p.threadId === threadId)
        )
          output += p.item.text + '\n';
        if (['item/started', 'item/completed'].includes(method)) {
          const item = p.item;
          if (item.type === 'collabAgentToolCall')
            for (const child of item.receiverThreadIds ?? []) {
              const status = item.agentsStates?.[child]?.status;
              if (['completed', 'errored', 'interrupted', 'shutdown', 'notFound'].includes(status))
                children.delete(child);
              else if (item.tool === 'spawnAgent' || status) children.add(child);
            }
          if (item.type === 'subAgentActivity') {
            if (['completed', 'interrupted'].includes(item.kind))
              children.delete(item.agentThreadId);
            else if (item.kind === 'started') children.add(item.agentThreadId);
          }
        }
        if (method === 'turn/completed' && (!p.threadId || p.threadId === threadId)) {
          if (p.turn.status === 'completed') {
            parentComplete = true;
            if (children.size)
              childrenTimer = setTimeout(
                () =>
                  reject(
                    new Error(
                      'Native child completion was not confirmed. Inspect the preserved events.',
                    ),
                  ),
                30000,
              );
          } else {
            const code = p.turn.error?.codexErrorInfo;
            reject(
              new EngineFailure(
                ['usageLimitExceeded', 'rateLimitExceeded'].includes(code) ? 'quota' : 'runtime',
                p.turn.error?.message ?? 'Codex turn ' + p.turn.status,
              ),
            );
          }
        }
        if (parentComplete && !children.size) {
          clearTimeout(childrenTimer);
          resolve({
            text: output.trim(),
            sessionId: threadId,
            configuredModel: effectiveModel,
            usage,
          });
        }
      };
    });
    // Attach immediately: initialization failures must not leave an unhandled rejection.
    void complete.catch(() => {});
    connection.onRequest = async (method, params) => {
      if (method === 'item/tool/requestUserInput') {
        const reply = await m.permission(
          'Codex needs your input',
          { ...params, questions: params.questions },
          m.signal,
        );
        return {
          answers: Object.fromEntries(
            (params.questions ?? []).map((q: any) => [
              q.id,
              { answers: [reply.answers?.[q.id] ?? 'Cancelled by user'] },
            ]),
          ),
        };
      }
      if (
        m.readOnly ||
        !['item/commandExecution/requestApproval', 'item/fileChange/requestApproval'].includes(
          method,
        )
      )
        return { decision: 'decline' };
      const reply = await m.permission(
        params.command ?? params.reason ?? 'Codex tool approval',
        { method, ...params },
        m.signal,
      );
      return { decision: reply.allow ? 'accept' : 'decline' };
    };
    let interruptTimer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => {
      if (threadId && turnId)
        void connection.request('turn/interrupt', { threadId, turnId }).catch(() => {});
      clearTimeout(interruptTimer);
      interruptTimer = setTimeout(
        () =>
          rejectTurn(new Error('Interrupted; native process did not finish within 10 seconds.')),
        10000,
      );
    };
    m.signal.addEventListener('abort', abort, { once: true });
    try {
      if (m.signal.aborted) throw new Error('Interrupted');
      await connection.initialize();
      const thread = await connection.request('thread/start', {
        cwd: m.cwd,
        ...(m.choice.model ? { model: m.choice.model } : {}),
        approvalPolicy: 'on-request',
        sandbox: m.readOnly ? 'read-only' : 'workspace-write',
        developerInstructions: m.instructions,
      });
      threadId = thread.thread.id;
      effectiveModel = thread.model ?? effectiveModel;
      m.emit({ type: 'session', data: { sessionId: threadId, configuredModel: thread.model } });
      const started = await connection.request('turn/start', {
        threadId,
        sandboxPolicy: m.readOnly
          ? { type: 'readOnly', networkAccess: false }
          : {
              type: 'workspaceWrite',
              networkAccess: false,
              writableRoots: [m.cwd],
              excludeSlashTmp: true,
              excludeTmpdirEnvVar: true,
            },
        input: [{ type: 'text', text: m.prompt }],
        ...(m.choice.model ? { model: m.choice.model } : {}),
        ...(m.choice.effort ? { effort: m.choice.effort } : {}),
        ...(m.schema ? { outputSchema: m.schema } : {}),
      });
      turnId = started.turn.id;
      m.onControl?.({
        steer: async (text, messageId) => {
          if (m.signal.aborted) throw new Error('This turn is stopping.');
          const expectedTurnId = turnId;
          const response = await connection.request('turn/steer', {
            threadId,
            expectedTurnId,
            input: [{ type: 'text', text }],
          });
          if (response.turnId !== expectedTurnId)
            throw new Error('The native turn changed; delivery is uncertain.');
          m.emit({
            type: 'input.accepted',
            data: { messageId, detail: 'Codex accepted the input for turn ' + expectedTurnId },
          });
          return {
            state: 'accepted',
            detail: 'Codex accepted the input for turn ' + expectedTurnId,
          };
        },
      });
      if (m.signal.aborted) abort();
      return await complete;
    } finally {
      clearTimeout(interruptTimer);
      clearTimeout(childrenTimer);
      m.onControl?.(undefined);
      m.signal.removeEventListener('abort', abort);
      await connection.close();
    }
  }
}
export class ClaudeAdapter implements Adapter {
  constructor(
    private info: EngineInfo,
    private startQuery: typeof query = query,
  ) {}
  async catalog(): Promise<{ models: AvailableModel[]; account: string }> {
    const controller = new AbortController();
    let finish!: () => void;
    const end = new Promise<void>((resolve) => {
      finish = resolve;
    });
    async function* input(): AsyncGenerator<any> {
      await end;
    }
    const session = this.startQuery({
      prompt: input(),
      options: {
        cwd: process.cwd(),
        pathToClaudeCodeExecutable: this.info.path,
        abortController: controller,
        permissionMode: 'default',
        settingSources: ['user', 'project', 'local'],
      },
    });
    try {
      const [models, account] = await Promise.all([
        session.supportedModels(),
        session.accountInfo(),
      ]);
      const sources = [
        account.apiProvider,
        account.subscriptionType,
        account.tokenSource,
        account.apiKeySource,
      ].filter((x) => x && x !== 'none');
      return {
        models: models.flatMap((x) => {
          const item = {
            id: x.value,
            name: x.displayName,
            description: x.description,
            efforts: x.supportedEffortLevels ?? [],
          };
          return x.resolvedModel && x.resolvedModel !== x.value
            ? [item, { ...item, id: x.resolvedModel }]
            : [item];
        }),
        account: sources.join(' · ') || 'Authentication not reported; check claude auth status',
      };
    } finally {
      finish();
      controller.abort();
      session.close();
    }
  }
  async run(m: Mission): Promise<Result> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    m.signal.addEventListener('abort', abort, { once: true });
    if (m.signal.aborted) controller.abort();
    const inputs = new InputQueue<any>();
    const pending = new Set<string>();
    const owners: ProcessOwner[] = [];
    inputs.push({
      type: 'user',
      uuid: crypto.randomUUID(),
      message: { role: 'user', content: m.prompt },
      parent_tool_use_id: null,
    });
    const session = this.startQuery({
      prompt: inputs,
      options: {
        cwd: m.cwd,
        pathToClaudeCodeExecutable: this.info.path,
        abortController: controller,
        spawnClaudeCodeProcess: (options) => {
          const owner = new ProcessOwner(options.command, options.args, {
            cwd: options.cwd,
            env: options.env,
            signal: options.signal,
          });
          owners.push(owner);
          owner.child.stderr.on('data', () => {});
          return owner.child;
        },
        settingSources: ['user', 'project', 'local'],
        permissionMode: 'default',
        includePartialMessages: true,
        forwardSubagentText: true,
        ...(m.choice.model ? { model: m.choice.model } : {}),
        ...(m.choice.effort
          ? { effort: m.choice.effort as 'low' | 'medium' | 'high' | 'xhigh' | 'max' }
          : {}),
        systemPrompt: { type: 'preset', preset: 'claude_code', append: m.instructions },
        ...(m.schema ? { outputFormat: { type: 'json_schema', schema: m.schema } } : {}),
        hooks: {
          PreToolUse: [
            {
              hooks: [
                async (input) => {
                  if (input.hook_event_name !== 'PreToolUse') return {};
                  const readTool = [
                    'Read',
                    'Glob',
                    'Grep',
                    'LS',
                    'TaskOutput',
                    'AskUserQuestion',
                    'ToolSearch',
                  ].includes(input.tool_name);
                  if (readTool) return {};
                  // Every non-read tool crosses Tesslane's gate, including tools preapproved
                  // by a user's native settings. Read-only missions cannot acquire write access.
                  if (m.readOnly)
                    return {
                      hookSpecificOutput: {
                        hookEventName: 'PreToolUse',
                        permissionDecision: 'deny',
                        permissionDecisionReason:
                          'This Tesslane role is read-only. Use file reading tools.',
                      },
                    };
                  const reply = await m.permission(
                    input.tool_name,
                    { tool: input.tool_name, input: input.tool_input },
                    m.signal,
                  );
                  return {
                    hookSpecificOutput: {
                      hookEventName: 'PreToolUse',
                      permissionDecision: reply.allow ? 'allow' : 'deny',
                      permissionDecisionReason: 'Tesslane policy decision',
                    },
                  };
                },
              ],
            },
          ],
        },
        canUseTool: async (tool, input, options) => {
          const reply = await m.permission(
            tool === 'AskUserQuestion' ? 'Claude needs your input' : tool,
            { tool, input, questions: tool === 'AskUserQuestion' ? input.questions : undefined },
            options.signal,
          );
          if (!reply.allow) return { behavior: 'deny', message: 'Declined in Tesslane' };
          if (tool === 'AskUserQuestion') {
            const questions = input.questions as { question: string }[];
            return {
              behavior: 'allow',
              updatedInput: {
                ...input,
                answers: Object.fromEntries(
                  questions.map((q) => [q.question, reply.answers?.[q.question] ?? '']),
                ),
              },
            };
          }
          return { behavior: 'allow', updatedInput: input };
        },
      },
    });
    let text = '';
    let structured: unknown;
    let sessionId = '';
    let model = '';
    let usage: Usage | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const background = new Set<string>();
    let uncertain = false;
    let completedResponse = false;
    m.onControl?.({
      steer: async (text, messageId) => {
        if (m.signal.aborted) throw new Error('This session is stopping.');
        pending.add(messageId);
        completedResponse = false;
        inputs.push({
          type: 'user',
          uuid: messageId,
          message: { role: 'user', content: text },
          parent_tool_use_id: null,
          priority: 'next',
        });
        return {
          state: 'queued',
          detail: 'Queued in the Claude SDK input stream; awaiting native correlation.',
        };
      },
    });
    try {
      for await (const message of session) {
        m.emit({ type: 'claude.' + message.type, data: message as any });
        const correlated = [
          (message as any).user_message_uuid,
          ...((message as any).user_message_uuids ?? []),
        ].filter(Boolean);
        for (const messageId of correlated)
          if (pending.has(messageId)) {
            clearTimeout(deadline);
            pending.delete(messageId);
            m.emit({
              type: 'input.accepted',
              data: { messageId, detail: 'Claude correlated this input with its response.' },
            });
          }
        if (message.type === 'system' && message.subtype === 'task_started')
          background.add(message.task_id);
        if (message.type === 'system' && message.subtype === 'task_notification')
          background.delete(message.task_id);
        if (
          message.type === 'system' &&
          message.subtype === 'task_updated' &&
          ['completed', 'failed', 'interrupted', 'stopped'].includes((message as any).patch?.status)
        )
          background.delete((message as any).task_id);
        sessionId = 'session_id' in message ? (message.session_id ?? sessionId) : sessionId;
        if (message.type === 'assistant' && !message.parent_tool_use_id) {
          if (message.error)
            throw new EngineFailure(
              ['rate_limit', 'billing_error'].includes(message.error)
                ? 'quota'
                : ['authentication_failed', 'oauth_org_not_allowed'].includes(message.error)
                  ? 'authentication'
                  : 'runtime',
              'Claude: ' + message.error,
            );
          model = message.message.model;
          text = message.message.content
            .filter((x) => x.type === 'text')
            .map((x) => (x.type === 'text' ? x.text : ''))
            .join('\n');
        }
        if (message.type === 'result') {
          completedResponse = true;
          if (message.is_error)
            throw new Error('errors' in message ? message.errors.join('\n') : 'Claude run failed');
          if ('result' in message) text = message.result;
          if ('structured_output' in message) structured = message.structured_output;
          const totals = Object.values(message.modelUsage ?? {}).reduce(
            (sum, value) => ({
              inputTokens: sum.inputTokens + value.inputTokens,
              outputTokens: sum.outputTokens + value.outputTokens,
              cachedInputTokens: sum.cachedInputTokens + value.cacheReadInputTokens,
            }),
            { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
          );
          usage = {
            ...totals,
            totalTokens: totals.inputTokens + totals.outputTokens,
            costUsd: message.total_cost_usd,
          };
          if (!pending.size && !background.size) break;
          clearTimeout(deadline);
          deadline = setTimeout(() => {
            uncertain = true;
            controller.abort();
          }, 30000);
        }
        if (completedResponse && !pending.size && !background.size) break;
      }
      if (uncertain)
        throw new Error(
          'Native input or background completion was not confirmed; inspect events before resending.',
        );
      if (m.signal.aborted) throw new Error('Interrupted');
      return { text, structured, sessionId, model, usage };
    } finally {
      clearTimeout(deadline);
      inputs.close();
      m.onControl?.(undefined);
      for (const messageId of pending)
        m.emit({
          type: 'input.uncertain',
          data: {
            messageId,
            detail: 'Session closed without a provider acknowledgment. Inspect before resending.',
          },
        });
      m.signal.removeEventListener('abort', abort);
      session.close();
      await Promise.race([
        Promise.all(owners.map((owner) => owner.closed)),
        new Promise((resolve) => {
          const timer = setTimeout(resolve, 2100);
          timer.unref();
        }),
      ]);
      await Promise.all(owners.map((owner) => owner.terminate()));
    }
  }
}
export function adapters(infos: EngineInfo[]): Partial<Record<'codex' | 'claude', Adapter>> {
  return Object.fromEntries(
    infos
      .filter((x) => x.available)
      .map((x) => [x.name, x.name === 'codex' ? new CodexAdapter(x) : new ClaudeAdapter(x)]),
  );
}
