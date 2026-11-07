# Engine integration contracts

Verified 2026-11-07, without running inference or reading credential files. Installed binaries: `/Users/lorenzo/.local/bin/codex` (`codex-cli 0.164.0`) and `/Users/lorenzo/.local/bin/claude` (`2.1.312`). These are verification versions, not hardcoded user installation paths.

## Recommended integration boundary

Use Codex's documented app-server transport. Use Claude's public TypeScript Agent SDK with `pathToClaudeCodeExecutable` pointing to the user's official installed binary. Do not maintain a second implementation of Claude's internal stdio control protocol. Pin SDK versions and test provider event fixtures separately from Tesslane's normalized event schema. [Codex app-server](https://learn.chatgpt.com/docs/app-server), [Claude SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)

## Codex: checked against the installed binary's schemas

Reproduce the local protocol reference, without inference:

```sh
codex app-server generate-json-schema --out /private/tmp/tesslane-codex-schema
```

The following structures were checked against those generated schemas (`ClientRequest.json`, `ServerRequest.json`, `ServerNotification.json`, `v1/InitializeParams.json`, and `v2/*`). Generate fresh schemas when updating supported CLI versions. The public [app-server documentation](https://learn.chatgpt.com/docs/app-server) supplies the transport and lifecycle contract.

Spawn `codex app-server` with piped stdin/stdout. Stdio is newline-delimited JSON-RPC; the wire examples omit the `jsonrpc` member. Buffer partial lines, parse complete lines, retain request IDs, and keep stderr separate. Finish initialization before sending other requests:

```json
{"id":1,"method":"initialize","params":{"clientInfo":{"name":"tesslane","version":"0.1.0"}}}
{"method":"initialized"}
```

Send the second line only after the initialize response. Start a thread, then use its returned `thread.id`:

```json
{"id":2,"method":"thread/start","params":{"cwd":"/absolute/project/worktree","approvalPolicy":"on-request","sandbox":"workspace-write","developerInstructions":"Task and role instructions"}}
{"id":3,"method":"turn/start","params":{"threadId":"THREAD_ID","input":[{"type":"text","text":"Implement the agreed task"}]}}
```

`model` is optional on both requests; `effort` is a turn override. Obtain available model IDs and supported efforts from `model/list`, rather than copying documentation examples. Do not assume every installed version or account supports every effort.

Resume and interrupt use these exact shapes:

```json
{"id":4,"method":"thread/resume","params":{"threadId":"THREAD_ID"}}
{"id":5,"method":"turn/interrupt","params":{"threadId":"THREAD_ID","turnId":"TURN_ID"}}
```

An interrupt acknowledgment is not turn completion: reconcile `turn/completed`. Resume does not mean blindly retry an interrupted edit. Preserve IDs and inspect current worktree state before the next task.

### Events and correlation

The generated `ServerNotification.json` confirms these payloads:

| Method | Relevant parameters |
| --- | --- |
| `turn/started`, `turn/completed` | `threadId`, `turn` (with ID and status) |
| `item/started`, `item/completed` | `threadId`, `turnId`, `item`; version 0.164.0 also has lifecycle timestamps |
| `item/agentMessage/delta` | `threadId`, `turnId`, `itemId`, `delta` |
| `item/commandExecution/outputDelta` | same correlation fields and `delta` |
| `item/reasoning/summaryTextDelta` | same fields plus `summaryIndex` |
| `item/reasoning/textDelta` | same fields plus `contentIndex`; available output only |
| `turn/diff/updated` | `threadId`, `turnId`, `diff` |
| `turn/plan/updated` | turn-correlated plan update |

Completed item types include `agentMessage` (`text`), `reasoning` (`summary`, `content` when available), `commandExecution` (`command`, `cwd`, `status`, optional output/exit code/duration), `fileChange` (`changes`, `status`), `mcpToolCall`, and `dynamicToolCall`.

Native child-agent topology is observable through `collabAgentToolCall`: `senderThreadId`, `receiverThreadIds`, `agentsStates`, `tool`, `status`, optional `model`, `reasoningEffort`, `prompt`. `subAgentActivity` additionally identifies `agentThreadId`, `agentPath`, `kind`, optional model/effort. Use actual IDs; do not fabricate message edges from adjacent timestamps. Unknown future item types must remain inspectable.

Reasoning output is provider-dependent. Display only emitted summaries/content; do not promise hidden chain-of-thought or infer text from elapsed time.

### Pending approvals and user questions

These are server **requests**, not notifications. Preserve their JSON-RPC request ID and respond on the same process:

```json
{"id":"SERVER_REQUEST_ID","result":{"decision":"accept"}}
```

`item/commandExecution/requestApproval` and `item/fileChange/requestApproval` accept `accept`, `acceptForSession`, `decline`, or `cancel`. `decline` denies the action but allows the turn to continue; `cancel` also interrupts the turn. Command decisions additionally support structured policy amendments. An MVP can use the four basic decisions; do not silently persist a policy amendment.

`item/tool/requestUserInput` has questions with `id`, `header`, `question`, optional choices. Its response is nested by **question ID**:

```json
{"id":"SERVER_REQUEST_ID","result":{"answers":{"question_id":{"answers":["Selected label or free text"]}}}}
```

This question API is marked experimental in the installed schemas. Treat disconnects and canceled turns as terminal states for their pending prompts; stale UI responses must not approve unrelated later requests.

### Account and browser login

```json
{"id":6,"method":"account/read","params":{"refreshToken":false}}
{"id":7,"method":"account/login/start","params":{"type":"chatgpt"}}
{"id":8,"method":"model/list","params":{}}
```

Login returns `{type:"chatgpt",loginId,authUrl}`. Device-code login `{type:"chatgptDeviceCode"}` instead returns `loginId`, `verificationUrl`, `userCode`. Observe `account/login/completed` and `account/updated`; opening a URL is not proof of login. Read-only account results include the authentication kind, nullable account, and `requiresOpenaiAuth`. Rate limits have their own read/update methods. Never use the schema's externally managed `chatgptAuthTokens` flow: its description restricts it to OpenAI internal use.

## Claude: public TypeScript SDK

The [TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript) confirms these options and methods. They were also inspected directly in installed official package `@anthropic-ai/claude-agent-sdk` version `0.3.319`, `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` (`Options`, `Query`, `CanUseTool`, and message types). Installed native executables are supported. Use streaming input for runtime controls, preserve project settings explicitly, and inspect the installed SDK's exported types:

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";

const controller = new AbortController();
const session = query({
  prompt: inputMessages, // AsyncIterable<SDKUserMessage>
  options: {
    cwd: worktreePath,
    pathToClaudeCodeExecutable: claudePath,
    abortController: controller,
    settingSources: ["user", "project", "local"],
    permissionMode: "default",
    model: selectedModel,
    effort: selectedEffort,
    includePartialMessages: true,
    forwardSubagentText: true,
    canUseTool: permissionCallback,
    // Optional: outputFormat: { type: "json_schema", schema }
  },
});
```

Supported methods include `supportedModels()`, `accountInfo()`, `setModel()`, `setPermissionMode()`, `applyFlagSettings()`, `interrupt()`, `streamInput()`. Runtime model changes affect subsequent generation; do not assume existing child agents change too. For `effort`, use exported supported values; model compatibility remains provider-owned. Resume with `options.resume = sessionId`.

Permission modes include `default`, `acceptEdits`, `plan`, `dontAsk`, `auto`, `bypassPermissions`. The callback only receives actions requiring a prompt; modes/settings can approve earlier. Strict enforcement across all tools needs `PreToolUse`, not just the callback. Native permission modes are not an OS sandbox.

### Stream and child-agent telemetry

Confirmed directly in the installed official SDK declarations:

- `assistant` contains `message` (content blocks including text, thinking, and tool calls), `uuid`, `session_id`, `parent_tool_use_id`.
- `user` can contain `tool_result` blocks. Match their `tool_use_id` to the original assistant call.
- `stream_event` wraps raw API events in `event`; text deltas live in `event.delta.text` when the event is `content_block_delta` and the delta type is `text_delta`.
- `result` has a success/error subtype and is distinct from intermediate assistant output.
- `system/task_started` carries `task_id`, optional `run_id`, `tool_use_id`, `parent_task_id`, `spawn_depth`, and task classification. A resumed task may retain its task ID with a new run ID.
- `task_progress`, `task_updated`, and `task_notification` track task lifecycle. Preserve identifiers even if the UI has no renderer for a new subtype.

`forwardSubagentText: true` is essential: its installed declaration says it forwards child text and thinking blocks as assistant/user messages with `parent_tool_use_id`. By default only child tool calls/results are forwarded. Partial output and complete message output coexist; reconcile them rather than appending the same text twice. Current streaming guidance limits token-level deltas to the main session; use complete child messages for nested transcripts. [Streaming output](https://code.claude.com/docs/en/agent-sdk/streaming-output), [subagent behavior](https://code.claude.com/docs/en/agent-sdk/subagents)

### Permissions and questions

The SDK callback receives `(toolName, input, { signal, toolUseID, agentID?, requestId, ... })`. Resolve approval with `{behavior:"allow",updatedInput:input}` or denial with `{behavior:"deny",message,interrupt?:true}`. Abort pending UI promises with the supplied signal. Return `null` only if a response was already sent through another transport; otherwise it can block indefinitely. [Permission reference](https://code.claude.com/docs/en/agent-sdk/permissions)

Route `AskUserQuestion` separately. Its answers use **question text**, unlike Codex's question IDs:

```ts
return {
  behavior: "allow",
  updatedInput: {
    questions: input.questions,
    answers: { [question.question]: selectedLabelOrFreeText },
  },
};
```

Preserve the original questions. Multi-select may return label arrays or comma-joined labels. Ensure `AskUserQuestion` remains available when restricting tools. [Approvals and user input](https://code.claude.com/docs/en/agent-sdk/user-input)

### CLI flags versus internal controls

Confirmed by installed `claude --help`: `-p`, `--input-format stream-json`, `--output-format stream-json`, `--verbose`, `--include-partial-messages`, `--forward-subagent-text`, `--include-hook-events`, `--model`, `--effort`, `--resume`, `--session-id`, `--permission-mode`, `--permission-prompts`, `--setting-sources`, `--add-dir`, `--allowedTools`, `--disallowedTools`. The [headless documentation](https://code.claude.com/docs/en/headless) describes programmatic output. `--bare` bypasses ordinary project/auth discovery and is unsuitable for inheriting an existing native login.

The official SDK internally starts a subprocess and manages bidirectional control messages. That is an implementation detail, not a second stable CLI API for Tesslane. Prefer SDK permission callbacks and controls over implementing raw `initialize`, `set_model`, `interrupt`, or `--permission-prompt-tool stdio` messages. [Official transport implementation](https://github.com/anthropics/claude-agent-sdk-python/blob/main/src/claude_agent_sdk/_internal/transport/subprocess_cli.py), [official internal client](https://github.com/anthropics/claude-agent-sdk-python/blob/main/src/claude_agent_sdk/_internal/client.py)

### Authentication and billing boundary

Let the user authenticate through the unmodified official CLI. Do not read, copy, store, or expose credential files, setup tokens, or OAuth credentials. Anthropic distinguishes this native-binary route from offering a custom Claude login. [Authentication](https://code.claude.com/docs/en/authentication), [product integration conditions](https://code.claude.com/docs/en/legal-and-compliance)

Current official guidance, updated October 7, 2026, says SDK and `claude -p` runs signed into a Claude plan still consume subscription limits; linked Console API keys use their own billing/credits. API-key environment configuration can override the subscription route. Report the detected authentication method rather than promising subscription billing from binary presence alone. [SDK with a Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan), [Claude plan setup](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-max-or-ultra-plan)

## Validation remaining

No paid requests were issued. CLI help, official docs, and Codex-generated schemas were inspected. Live account capabilities, actual approval round trips, interruption behavior with active child tasks, and native login UI still require an explicitly initiated integration run. Linux and Windows process spawning, path handling, SQLite packaging, and termination behavior require platform CI; successful macOS schema inspection does not establish cross-platform support.

## Execution update

The subsequent native Codex delivery, strict JSON review-schema correction and explicit fixture coverage are recorded in [VALIDATION.md](VALIDATION.md). Active input, partial streams, child identity and process cleanup follow the more detailed [steering contracts](steering-contracts.md). This section supersedes the discovery-only evidence boundary at the top of this historical investigation.
