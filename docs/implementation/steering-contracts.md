# Native steering and streaming contracts

Verified 2026-11-07. This supplements [engine-contracts.md](engine-contracts.md). Evidence: Codex CLI **0.164.0** generated JSON schemas in `/private/tmp/tesslane-codex-schema`, official Claude Agent SDK **0.3.319** installed in `node_modules/@anthropic-ai/claude-agent-sdk`, and the official documentation linked below. No inference, paid Claude call, login, or credential-file inspection was performed. Schema presence establishes a type contract, not successful runtime behavior or account entitlement.

## Codex steering: append to the existing turn

The official [app-server contract](https://learn.chatgpt.com/docs/app-server#steer-an-active-turn) specifies:

```json
{"id":42,"method":"turn/steer","params":{"threadId":"thread-id","expectedTurnId":"active-turn-id","input":[{"type":"text","text":"Use the existing API instead"}]}}
{"id":42,"result":{"turnId":"active-turn-id"}}
```

Local `v2/TurnSteerParams.json` requires **all three** of `threadId`, `expectedTurnId`, and `input`; the precondition fails if the active turn differs. It additionally permits optional nullable `clientUserMessageId`. `TurnSteerResponse.json` requires `turnId`. There is no model or effort override on steering. Steering does not emit a new `turn/started`; its accepted input remains in the active turn. Continue reducing that turn's item events and eventual `turn/completed`.

Implementation constraints:

- Store the actual turn ID from `turn/start` or `turn/started`. A local “running” flag is insufficient to form a steer request.
- Mark the steering request accepted only after the matching JSON-RPC success response. A successful stdin write is transport progress only. Keep its local message ID/request ID for reconciliation; use `clientUserMessageId` only on supported versions.
- On a stale-turn failure, reread/reconcile state and retain the unsent input. Do not automatically convert it into a new generation without making that behavior explicit.
- `turn/interrupt` acknowledges cancellation separately from `turn/completed`; interrupt does not mean all background processes have been reaped. See the [turn lifecycle](https://learn.chatgpt.com/docs/app-server#lifecycle-overview).

## Codex native children and accounting

These are exact local schema contracts from `ServerNotification.json` definitions and `v2/ThreadStartedNotification.json`; regenerate them when changing the supported CLI version, as [documented](https://learn.chatgpt.com/docs/app-server#message-schema).

| Evidence | Native identities and interpretation |
| --- | --- |
| `Thread` in `thread/started` | `id`, nullable/optional `parentThreadId`, `source`; also `model`, `reasoningEffort`, `agentNickname`, `agentRole` when supplied. `source.subAgent.thread_spawn` carries required `parent_thread_id`, `depth`, and optional `agent_path`, `agent_nickname`, `agent_role`. Preserve the provider's snake_case inside this source object. |
| `ThreadItem.type = collabAgentToolCall` | Required `id`, `senderThreadId`, `receiverThreadIds: string[]`, `agentsStates: Record<string, {status, message?}>`, `tool`, `status`. Optional nullable `prompt`, `model`, `reasoningEffort` describe the request. On spawn, receiver IDs identify the created agents. |
| `CollabAgentTool` | `spawnAgent`, `sendInput`, `resumeAgent`, `wait`, `closeAgent`, `sendMessage`, `followupTask`, `interruptAgent`, `listAgents`. Preserve unknown future values instead of dropping their raw event. |
| Collab status | Tool call: `inProgress`, `completed`, `failed`, `interrupted`. Agent: `pendingInit`, `running`, `interrupted`, `completed`, `errored`, `shutdown`, `notFound`. These are different state machines. |
| `ThreadItem.type = subAgentActivity` | Required `id`, `agentThreadId`, `agentPath`, `kind`; kind is `started`, `interacted`, `interrupted`, `completed`. Optional `model`/`reasoningEffort` are **resolved at child creation**, unlike requested overrides on collab tool calls. |

All items additionally retain their event envelope's `threadId` and `turnId`. Render a native child using its actual thread ID; build edges only from explicit sender/receiver or parent identities. The schema does not guarantee that discovering a child subscribes the client to its entire transcript. Treat detailed child event coverage as a separate integration capability to validate; do not synthesize child text from a parent tool summary.

`Thread.model` and `Thread.reasoningEffort` describe current configured values while loaded or latest persisted values otherwise; their schema comments explicitly say they are **not per-turn execution telemetry**. Keep them distinct from requested child overrides and resolved-at-creation child metadata.

`v2/ThreadTokenUsageUpdatedNotification.json` defines:

```ts
// method: "thread/tokenUsage/updated"
type TokenUpdate = {
  threadId: string;
  turnId: string;
  tokenUsage: {
    total: Breakdown;
    last: Breakdown;
    modelContextWindow?: number | null;
  };
};
type Breakdown = {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens?: number; // schema default: 0
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
};
```

Keep these as provider snapshots with timestamps. Do not add successive `total` snapshots together, infer monetary cost, or interpret `modelContextWindow` as an account quota. Reasoning deltas are `item/reasoning/summaryTextDelta` with `summaryIndex`, and `item/reasoning/textDelta` with `contentIndex`; both are item/turn/thread correlated. Render only emitted text.

`v2/GetAccountRateLimitsResponse.json` requires `rateLimits` and optionally supplies `rateLimitsByLimitId`, keyed by metered bucket ID. A `RateLimitSnapshot` may contain nullable `limitId`, `limitName`, `normalModelSlug`, `planType`, `primary`, `secondary`, `credits`, `individualLimit`, `spendControlReached`, and `rateLimitReachedType`. Each present window requires `usedPercent`; `windowDurationMins` and `resetsAt` are nullable/optional. `resetsAt` is Unix **seconds**, not milliseconds. `credits.balance` is a nullable **string**. [Official rate-limit fields](https://learn.chatgpt.com/docs/app-server#6-rate-limits-chatgpt).

`account/rateLimits/updated` contains `{rateLimits}` and is explicitly a **sparse rolling update**: merge available metadata into the preceding read or refetch; nullable metadata does not clear earlier known metadata. Exception: `spendControlReached: null` means unavailable, never recovery. The read response's `ordinaryUsageAllowed` is a nullable backend permission; its description explicitly forbids inferring recovery from percentages/reset times. Missing limits mean unknown, not unlimited. Model names, aliases, plan names, and elapsed reset times do not establish price, access, or available quota.

## Claude: one persistent input stream

Installed declarations: `sdk.d.ts:1602` (`Options`), `:2962` (`Query`), `:3376` (`query`), `:6686` (`SDKUserMessage`). Source implementation: `core.mjs`, methods `streamInput`, `writeStreamMessage`, `endRun`.

```ts
query({
  prompt: inputQueue, // AsyncIterable<SDKUserMessage>, remains open for this session
  options: {
    pathToClaudeCodeExecutable: discoveredOfficialExecutable,
    includePartialMessages: true,
    forwardSubagentText: true,
    abortController,
  },
});
// Push onto that same inputQueue while the output iterator keeps being consumed:
const input: SDKUserMessage = {
  type: "user",
  uuid: clientMessageUuid,
  message: { role: "user", content: "Use the existing API instead" },
  parent_tool_use_id: null,
  priority: "next",
};
```

`query` returns `Query extends AsyncGenerator<SDKMessage, void>`. Its `streamInput(stream: AsyncIterable<SDKUserMessage>): Promise<void>` is a stream pump, **not** a per-message acknowledgment. Inspection of 0.3.319 shows that it writes each message, then calls `transport.endInput()` after iterable exhaustion (waiting for run-end when bidirectional features require it). The initial `query({prompt: iterable})` already starts that pump. Therefore use one owned asynchronous queue, do not call `streamInput()` repeatedly with one-element generators, and do not end the generator after each result. There is **no `keepStreamOpen` option** in this version's public declarations or implementation. See [streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode).

Official [message priority semantics](https://code.claude.com/docs/en/agent-sdk/typescript#sdkusermessage):

- `next` or omitted: the active turn reads it after current tool calls finish; if that turn finishes first, it starts another turn.
- `later`: hold until the current turn ends, then start another turn.
- `now` plus `origin: {kind: "human"}`: current CLIs background movable work and read the message in the same turn; if only generating text or unable to move the work, interrupt and read it next. This requires CLI 2.1.286+; WebFetch/WebSearch backgrounding needs 2.1.287+.
- `now` without human origin interrupts the turn. Do not claim that every “steer” stays within one turn across providers.

The installed local CLI baseline is 2.1.312, but version/capability support must be checked for each user's installation. `shouldQuery: false` appends context for a later user query, rather than independently starting generation. Use `client_composed` only deliberately: this version also skips the CLI turn-start attachment pass, not just mention/slash-command expansion (installed `Options.verbatimPrompts` documentation).

### Acknowledgments, interruption, and shutdown

Installed `SDKAssistantMessage` (`sdk.d.ts:3740`), `SDKPartialAssistantMessage` (`:5827`), and result types carry optional `user_message_uuid` and `user_message_uuids`. Supply a stable UUID on every outgoing user message. A returned UUID match is evidence the reply answers that input; lists cover provider-batched messages. Fields can be absent on older producers and are not on every frame. `SDKThinkingTokensMessage.user_message_uuid` can correlate early thinking progress, but does not contain thinking text. Keep transport-enqueued, provider-correlated, and completed states distinct; lack of a UUID echo is not a rejection or permission to replay input.

`Query.interrupt(): Promise<SDKControlInterruptResponse | undefined>` is supported with streaming input. If init `capabilities` includes `interrupt_receipt_v1`, the receipt's `still_queued: string[]` names input UUIDs that may **still run after interruption**. Older producers return `undefined`. Although the implementation accepts an internal cancel-queued argument, 0.3.319's public `Query.interrupt` signature exposes **no arguments**. Do not cast around it to call an internal protocol or promise “cancel all queued inputs.” For a hard stop, stop the local input producer and close the query. [Interrupt reference](https://code.claude.com/docs/en/agent-sdk/typescript#sdkcontrolinterruptresponse).

Installed `Options.abortController` promises query cancellation/resource cleanup. `Query.close(): void` is documented to terminate the CLI subprocess and clean pending requests/MCP transports; it is not an awaitable process-exit barrier. In `core.mjs`, `close()` starts asynchronous cleanup, closes stdin, then the transport schedules termination escalation if the child remains alive; Windows handling differs from POSIX. Treat abort/close as the terminal session boundary, invalidate pending approval promises, end/cancel the owned input queue, and ignore stale delivery callbacks. Do not equate `close()` returning with all descendant processes having exited. Process reaping needs a separately observed child exit when the host owns the spawn handle (`spawnClaudeCodeProcess`) and platform fixture coverage.

`result` ends one response; the persistent session may keep running, including background tasks. `system/session_state_changed` supplies `idle | running | requires_action` when emitted. It does not replace per-task lifecycle events or process exit observation.

### Owning the process and proving termination

`Query` has **no public PID accessor** in 0.3.319. `Options.spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess` is the public ownership seam (`sdk.d.ts:2538`). `SpawnOptions` supplies `command`, `args`, `cwd?`, `env`, and `signal`; return a real Node `ChildProcess` created with piped stdin/stdout, retaining that handle and its `pid` in the adapter. Attach `error`, `exit`, and stream/`close` observers before returning it; always drain stderr separately. An exit promise proves the immediate child's exit; `close` additionally waits for stdio to close. Do not log the supplied environment.

Crucially, the hook's `signal` is the SDK transport's **forwarded signal**: installed comments say it aborts after stdin EOF and approximately two seconds of graceful-close opportunity. Pass that signal to the custom spawn. Do not substitute the caller's immediate `abortController.signal`, which would bypass the SDK's graceful chance, especially Windows `TerminateProcess`. `SpawnedProcess` itself requires stdin/stdout, killed/exitCode, kill, and lifecycle listeners; `signalCode` is optional and PID is not part of this abstraction. Host-owned Node handles supply PID outside it (`sdk.d.ts:10024`, `:10082`).

Tree cleanup remains an explicit host responsibility to verify. A bare child PID/Node `kill()` is not a portable tree kill. If strict containment is required, use an owned process group on POSIX and a Windows Job Object/supervisor with termination-on-close, then validate descendant exit in native OS fixtures. Bound escalation to the group/job created for this session and its live handles; never kill by executable name or an unvalidated/recycled persisted PID. These are design recommendations, not SDK guarantees. Waiting for a closed transcript cannot substitute for supervising the process tree.

## Claude reducer: block identity and native child identity

Installed `SDKAssistantMessage` explicitly says each completed content block is an assistant envelope, so sibling envelopes can share **`message.id`**. `message.stop_reason` is then null and block-level usage is not final. With partial output enabled, the complete envelope arrives **before** its block's `content_block_stop`. [Official message flow](https://code.claude.com/docs/en/agent-sdk/streaming-output#message-flow).

Reducer requirements derived from this contract:

1. Deduplicate exact envelopes by provider `uuid`, never discard all later envelopes with the same `message.id`.
2. For main-session partials, track `message_start.message.id` and `content_block_start.index`; append typed deltas into that block. Render text deltas as text, thinking deltas as emitted thinking, and tool JSON deltas as provisional tool input.
3. When the corresponding completed assistant block arrives, **replace/finalize the provisional block** instead of appending its full text again. Preserve all sibling blocks. Use `tool_use.id` for tools and the active message/block stream position for text/thinking; if mapping is ambiguous, retain the raw envelope and avoid silently deleting content.
4. Child token deltas are not promised. Public streaming docs state partial events are main-session only; use complete child envelopes for nested text. Enable `forwardSubagentText`, whose installed option documentation explicitly forwards child text/thinking; default forwarding covers tool-use/results only.
5. Honor optional `supersedes` UUIDs and `aborted` on assistant messages. They represent canonical replacements and truncated output, respectively.

Native identity evidence (`sdk.d.ts:6497`, `:3740`, `:6686`):

| Field/event | Meaning |
| --- | --- |
| `assistant.agent_id` / child `user.agent_id` | Native subagent **task ID**, unchanged across resume; available only when supplied. |
| `parent_tool_use_id` | Tool-use call that launched this subagent transcript. It is not the parent's task ID. |
| `system/task_started.task_id` | Stable task identity. Required with `description`, `uuid`, `session_id`; `task_type` distinguishes subagents from other native background tasks. |
| `task_started.parent_task_id` | Parent subagent's task ID when known. May reference a completed/foreground task; unknown parents must remain unresolved, not be assigned by timing. |
| `task_started.tool_use_id`, `spawn_depth`, `subagent_type` | Optional spawn-call link, depth (top-level child = 1), native type. |
| `run_id` | Optional run identity across `task_*`; resume retains `task_id` and gets another `run_id`. For one task, documented plain string ordering distinguishes older runs; do not parse the format. |
| `task_updated.patch` | Merge native changed fields; do not replace the entire task record with a patch. |

Thinking-only assistant blocks are valid and may carry the first input correlation. Do not require text before creating an assistant message or native child transcript. `system/thinking_tokens` reports estimates, not hidden reasoning content.

## Claude models, effort, tokens, and rate limits

Exact installed declaration evidence:

- `Options.model?: string`; `Options.effort?: EffortLevel`, where `EffortLevel = low | medium | high | xhigh | max` (`sdk.d.ts:730`, `:1995`, `:2044`). Omission inherits native defaults. `supportedModels()` returns `ModelInfo` with `value`, optional `resolvedModel`, `supportsEffort`, `supportedEffortLevels`; it is a catalog, not a successful entitlement check.
- `setModel()` changes session configuration; `applyFlagSettings({effortLevel})` is the supported runtime effort control (`:3048`). The request key is **`effortLevel`**, unlike initial `options.effort`. A null reset returns to model default and does not restore an old explicit setting. Do not presume this changes already-running children.
- `system/init.model` and `assistant.message.model` are observed values. Init `effort?` is nullable and producer-dependent; it describes the next-message applied effort when present. `task_started` itself has **no model/effort fields**. Child assistant model is observable; requested Agent-tool model is a request, and absent resolved child effort stays unknown.
- `SDKResultMessage.usage` is per-turn **main-agent-loop only**. `modelUsage: Record<string, ModelUsage>` covers query-pipeline main/child/sidechain calls and is **cumulative across streaming turns**; so is `total_cost_usd`. Resume may restore earlier totals; `/clear` resets them. Upsert the newest cumulative result, never sum every result. These are estimates, not subscription billing statements (`sdk.d.ts:6030` onward).
- `ModelUsage` has `inputTokens`, `outputTokens`, `cacheReadInputTokens`, `cacheCreationInputTokens`, `webSearchRequests`, `costUSD`, `contextWindow`, `maxOutputTokens`. Optional `thinkingTokens` is **already inside outputTokens**. Optional `canonicalModel`, `provider`, `costBasis` describe accounting context, not guaranteed billing (`:1505`).
- `rate_limit_event` wraps `rate_limit_info`, plus `uuid`, `session_id`. Info requires `status: allowed | allowed_warning | rejected`; optional fields include `resetsAt`, `rateLimitType`, `utilization`, `overageStatus`, `overageResetsAt`, `overageDisabledReason`, `isUsingOverage`, `overageInUse`, `overageEnabled`, and `surpassedThreshold` (`:5981`). Preserve additional native metadata. Installed type comments scope these events to claude.ai subscription users. No event means unknown; do not invent quota data for this user, who currently has no Claude subscription.

For profile-driven model/effort selection, retain this installed catalog shape instead of deriving support from a model name:

```ts
type ModelInfo = {
  value: string;
  resolvedModel?: string;
  displayName: string;
  description: string;
  supportsEffort?: boolean;
  supportedEffortLevels?: EffortLevel[];
  supportsAdaptiveThinking?: boolean;
  supportsFastMode?: boolean;
  supportsAutoMode?: boolean;
};
```

A profile may choose an explicit effort only from the selected entry's advertised supported levels. If support/levels are missing, leave the override unset and report native/default or unknown; do not invent a support matrix. Keep requested versus observed values separate, since organizational limits and provider defaults can downgrade requested effort. An `auto` permission-mode capability is unrelated to automatic effort selection.

The compact exact installed rate-info shape is:

```ts
type RateLimitInfo = {
  status: "allowed" | "allowed_warning" | "rejected";
  resetsAt?: number;
  rateLimitType?: "five_hour" | "seven_day" | "seven_day_opus" |
    "seven_day_sonnet" | "seven_day_overage_included" | "overage";
  utilization?: number;
  overageStatus?: "allowed" | "allowed_warning" | "rejected";
  overageResetsAt?: number;
  overageDisabledReason?: "overage_not_provisioned" | "org_level_disabled" |
    "org_level_disabled_until" | "out_of_credits" | "seat_tier_level_disabled" |
    "member_level_disabled" | "seat_tier_zero_credit_limit" |
    "group_zero_credit_limit" | "member_zero_credit_limit" |
    "org_service_level_disabled" | "no_limits_configured" | "fetch_error" | "unknown";
  isUsingOverage?: boolean;
  overageInUse?: boolean;
  overageEnabled?: boolean;
  surpassedThreshold?: number;
  limitScope?: "service" | "channel" | "group_pool";
  errorCode?: "credits_required";
  canUserPurchaseCredits?: boolean;
  hasChargeableSavedPaymentMethod?: boolean;
};
```

The declarations type `utilization` as a number but do not specify its unit/range in that comment. Preserve the raw value until the corresponding producer contract or a fixture establishes display conversion; do not blindly reuse Codex's explicitly named `usedPercent` conversion.

## Windows executable resolution

Node's [child-process documentation](https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows) says `.cmd`/`.bat` need a command interpreter on Windows; enabling a shell introduces argument interpretation. npm places global executable links directly in its Windows prefix, while package files live under `prefix/node_modules`. [npm folder layout](https://docs.npmjs.com/cli/v11/configuring-npm/folders/#executables).

Recommended resolver, not a claim of a provider-stable package layout:

1. Prefer an explicitly selected or discovered native `.exe`; verify with an argument-array `--version` probe and a timeout. Preserve the selected installation and record its version.
2. If PATH finds a known npm shim, locate the package associated with that shim's prefix and inspect its **package metadata**, not credentials. Validate the package name and declared `bin` target; resolve symlinks and require the target to exist. Do not execute shim text, arbitrary shell content, or assume every shim can be parsed safely. If ownership/layout is ambiguous, report that exact installation as unsupported and allow choosing its real executable.
3. Codex's official [npm launcher source](https://github.com/openai/codex/blob/main/codex-cli/bin/codex.js) is a JS entrypoint choosing a platform native executable (`codex.exe` on Windows). Launch the verified JS entry using a real Node executable and `[entrypoint, "app-server"]` with `shell: false`. Prefer the launcher over hardcoding internal vendor paths; bypassing it can lose its environment/PATH preparation.
4. Claude's current [npm installation contract](https://code.claude.com/docs/en/setup#install-with-npm) installs the same **native binary** as the standalone installer via platform optional dependencies/postinstall linking. Therefore do **not** hardcode `@anthropic-ai/claude-code/cli.js` for modern installs. Pass the resolved native target into `pathToClaudeCodeExecutable`. For an older installation whose verified `bin` is JS, the installed SDK selects its runtime for `.js`/`.mjs` (and TS/JS variants); all other extensions, including `.cmd`, are treated as native by `core.mjs`'s executable classifier. Passing a `.cmd` path directly to the SDK is therefore insufficient.

No Windows machine was exercised in this research. The resolver should use fixtures for both historical JS and modern native Claude npm layouts, rather than silently promising universal shim support.

## Required no-inference verification before claiming platform support

These are implementation recommendations, not results of this investigation:

- Run the provider adapters' process-fixture suite on **macOS, Linux, native Windows**. Use actual spawned fixture processes and shell-free argument arrays; test spaces, Unicode, shell metacharacters in paths/arguments, npm-shim resolution, missing optional binaries, startup failure, EOF, and large/fragmented stdout/stderr.
- Exercise Codex fixtures for initialize gating, accepted/stale steering, steer/completion races, interleaved child IDs, sparse limit updates, usage snapshots, unresolved approvals at disconnect, and final stderr arriving after process exit. Exercise Claude fixtures through `spawnClaudeCodeProcess` so the public SDK pump/control/close behavior is covered, including retained stdin between turns and queued inputs surviving interruption.
- Replay thinking-only and sibling assistant blocks sharing `message.id`, streamed/final block overlap, input UUID batching, child nested task/run IDs, aborted/replaced envelopes, and cumulative accounting resets. Assertions should target user-visible behavior and preserved identities.
- Add credential-free real-binary smoke checks for `--version`, Codex schema generation/handshake, and bounded shutdown. Keep configuration isolated and avoid inference-starting messages. Fixtures establish local transport behavior; they do not prove remote model/tool behavior.
- Validate descendant cleanup and cancellation separately per OS; a sent signal, `killed === true`, interrupt receipt, or synchronous `close()` return is not a process-reaped assertion. Use bounded waits and observed exit; do not report POSIX-only signal fixtures as Windows coverage.
- A later explicitly authorized live run is still needed for provider-observed steering timing, approval round trips, child transcript subscription, and termination with actual child tools. This research does not require a Claude subscription or justify a paid probe.
