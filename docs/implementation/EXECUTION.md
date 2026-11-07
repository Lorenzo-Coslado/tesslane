# Execution controls

## Chat

Every conversation names a project, feature, ticket or agent recipient. Clicking a graph node opens its inspector without silently changing that recipient.

**Discuss** runs a read-only scoped analysis. Suggested execution actions appear as revision-bound proposals with Apply and Dismiss controls. They never execute solely because a model returned them. Clarification replies on an unresolved feature are saved as decisions for its next analysis.

**Control** accepts explicit commands: `/feature Title` (description on following lines), `/plan`, `/run`, `/pause`, `/resume`, `/stop`, `/status`, `/retry`, `/integrate`, and `/profile fast|balanced|deep`. Select a concrete feature/ticket or supply its identifier where relevant. Project scope cannot start an imaginary project feature. Commands retain the run's autonomy and permission gates.

**Guide agent** delivers text to the selected active mission. Codex uses `turn/steer` with the expected active turn ID. Claude queues a UUID-tagged message into its existing SDK input stream with native `next` priority; delivery can affect the active response or a later response in that session. Tesslane does not promise identical provider semantics. Native child sessions without a supported control channel direct the user to their parent.

The client reuses a request UUID after an ambiguous HTTP retry. The server records queued, sending, accepted, failed, cancelled or uncertain delivery. Enqueueing is not a provider acknowledgment. Restart never automatically resends uncertain instructions. A completed agent cannot receive active guidance through a replacement read-only mission; use its explicit scoped follow-up instead.

## Routing

Fast, Balanced and Deep describe task complexity. Planning, diagnosis and independent review use Deep; implementation uses the ticket profile and selected strategy. Failures trigger bounded attempts, diagnosis and explicitly authorized fallback choices. A reported provider usage limit never silently authorizes another engine or API billing route.

A pinned model wins. With an unpinned profile, only enabled candidates rated by the user and advertised by the selected engine compete. Profile weights prioritize speed/economy for Fast and quality for Deep. No model-name substring establishes quality, latency or price. Without ratings, Tesslane uses the advertised default or inherits the native engine configuration.

Acceptance evidence adjusts this ranking only after at least three independently reviewed outcomes for the same engine/model/role, with a bounded contribution. A successful model response alone is not accepted work. Wall time includes tools and approvals; it is not inference latency. Metrics cover a bounded recent sample, not a universal benchmark.

Automatic reasoning effort selects only an advertised capability. Explicit profile and next-attempt ticket choices take precedence. Running mission model/effort settings remain fixed. The inspector distinguishes requested model, engine configuration and provider-reported actual model. Missing token/quota/cost data remains unknown; provider estimates do not prove subscription billing.

## Git and recovery

Tesslane records an operation intent before creating a worktree, committing or merging. It records the confirmed result only after the effect completes. Interrupted effects become inspection/reconciliation work, never an automatic replay.

Writing and integration stay inside managed worktrees belonging to the source repository. Ticket checks and independent review are tied to its commit. A reviewed commit is integrated serially; combined feature checks and review still run before the feature is marked integrated. The original worktree is preserved.

A merge conflict stays available for inspection. The Git view shows ours/theirs, allows a text edit, stages the chosen resolution, and explicitly commits or aborts the merge. Actions verify both HEAD and MERGE_HEAD. Repeating an already staged file decision does not stage it again. Aborting preserves the ticket commit. External changes require reloading evidence. Refresh Git reads current external Git state.

Commit inspection shows the actual patch and recorded feature/ticket/agent links. Recovery compares branch, ancestry and operation-specific commit markers before accepting that an interrupted effect happened. Unconfirmable cases remain explicit manual inspection; no reset, stash, push or deletion is introduced.

## History and persistence

SQLite schema v2 migrates earlier local databases transactionally and rejects future versions. Archive validation checks entity shapes, identity/reference consistency, dependency/parent cycles and ordered JSON journal entries before replacing state. State exports do not include Git objects or worktree files.

Snapshots contain bounded message/check/event previews and retain active runs, agents and pending approvals. Conversations, native transcripts, operations and journals page earlier records. Full retained check output can be loaded explicitly. Individual retained transcript/check output is capped at 200,000 characters; raw events remain the authoritative provider record. The SSE stream resumes from its cursor and waits for slow consumers instead of accumulating an unbounded per-client queue.

The local application is still subject to the release limits in STATUS.md. Provider hidden reasoning is never fabricated.


## Worktree preparation, editable plans and delivery

Before execution, expand a delivery ticket and choose **Edit ticket**. Title, description, criteria, dependencies, owned areas, complexity and check notes are editable. **Authorized verification commands** are separate shell authority: they run in the ticket worktree and on the combined feature. The server validates the dependency graph and checks both ticket timestamp and plan revision atomically. Active feature runs or any recorded worktree/attempt freeze this editor; subsequent scope changes belong in a follow-up feature.

**Settings → Worktree preparation** controls dependency detection, custom setup commands, explicit ignored local files, additional fingerprint inputs, lifecycle scripts, setup authorization and timeout. Preview uses the unsaved settings and reads the current source checkout; execution computes the actual plan from each managed worktree. Automatic installs require a committed matching lockfile. Other languages use explicit commands. Missing tools or failed setup preserve the worktree and expose the error/output.

Preparation runs before writing, again when implementation changes setup inputs, and before combined verification. Successful setup is reused when inputs and expected artifacts/local files remain valid. Configuration/local-file changes invalidate reuse. Every failed or interrupted setup needs a new approval, including when automatic setup was configured. Logs retain a 200,000-character tail; snapshots are shorter previews, with full retained output loaded on demand. See [the detailed contract](WORKSPACE-DELIVERY.md).

An approved final review produces a deterministic **Delivery report** without another model call. It records the actual feature diff and exact commit, per-ticket and combined checks, criteria and findings. Missing automated checks are an explicit limitation. HEAD, branch or uncommitted changes during final review block completion. The report is durable and included in state backup; refresh compares the current worktree with the recorded evidence. Copy/download do not merge or push. POSIX/Git Bash handoff commands use the recorded commit, and `--ff-only` refuses divergent integration.
