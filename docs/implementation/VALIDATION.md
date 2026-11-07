# Validation evidence

Verified locally on 7 November 2026 on macOS arm64 with Node.js 26.13.0. These observations distinguish deterministic fixtures, genuine inference and unexecuted targets.

## Reproducible local checks

Run `npm ci` then `npm run verify`. The command runs TypeScript, Prettier, all 45 automated tests, the production build and a compiled CLI launch/singleton/restart probe. It does not call a model. Results are written to `.tesslane/local/verification/<platform>-<arch>-<node>.json`. A sanitized macOS result is retained under `evidence/`.

Tests use real SQLite and temporary Git repositories/worktrees. Provider responses are fixtures, including deliberately failed reviews, reported usage limits, mixed-engine fallback, concurrent dependent tickets and interrupted missions.

| Area | Evidence |
| --- | --- |
| Chat control | Explicit commands, request UUID deduplication, concrete Assisted gate, stop superseding approvals, active-mission guidance, native acceptance receipts, no late-agent replacement mission, revision-bound action proposals. |
| Routing | Role/profile strategy, pinned choices, advertised capabilities, invalid model/effort refusal, authorized fallback and quota handling, evidence threshold and bounded adaptation. |
| Native protocols | Codex JSONL framing/request IDs/native questions/sandbox policy/turn steering/child completion; Claude persistent input queue, UUID correlation, background completion, cumulative results and uncertain input on stop. No Claude inference. |
| Telemetry | Claude partial/full sibling blocks, envelope deduplication, child/grandchild identities and explicit parent relationships, reported child model, cumulative usage without double counting. |
| Crash recovery | A separate engine process is actually SIGKILLed at four durable Git checkpoints: before/after worktree creation, after commit, after merge. Reopen, inspect, reconcile and complete without replaying a confirmed implementation or commit. |
| Git | Actual conflicting merges, ours/theirs/edit, abort preserving ticket commit, stale-HEAD and out-of-scope refusal, repeated staging, resolved merge, combined review and commit-to-execution links. Original branch remains unchanged. |
| Persistence | Transactional state/event ordering, coherent export/restore, invalid archive rejection without mutation, v1 migration, future-schema refusal, integrity check. |
| Histories/streaming | 3,000 full 6,000-character messages paginate once each; bounded snapshots under 1 MB in this fixture. SSE Last-Event-ID resumes without duplicate events or command replay. A paused consumer does not block another snapshot request. This is a fixture observation, not a general performance SLA. |
| Processes/platform paths | Real CLI/tool heartbeat stops after process cleanup, also after SDK-style AbortSignal cancellation. Verified npm shim resolution, paths with spaces and shell metacharacters passed literally. Compiled CLI reuses its instance and restores durable history after restart. |

## Genuine Codex delivery

The opt-in probe `node --import tsx tests/fixtures/live-codex.ts --native-subscription` checked native account metadata and required `chatgpt` before starting inference; it has no API fallback. It used a synthetic repository, one ticket, one attempt and one concurrent mission. The advertised model was `gpt-6.1-sol`; this is a tested configuration, not a default hardcoded into Tesslane.

The successful run completed planning, isolated implementation, a real file-content check, independent ticket review, integration and combined feature checks/review. The source branch remained clean. Requested/configured model identity was reported; per-turn actual model identity was not asserted where the provider did not expose it. Native account metadata is not independent proof of billing.

An earlier run exposed a real provider rejection: finding locations were optional JSON keys. The review contract now emits required nullable locations, matching the [official Structured Outputs requirements](https://developers.openai.com/api/docs/guides/structured-outputs#all-fields-must-be-required). A regression test inspects all three generated model-output schemas. The corrected real delivery passed. The sanitized result is `evidence/live-codex-macos.json`.

Genuine in-flight guidance, interactive native approvals, real quota exhaustion and native child-agent execution were not all exercised in that inference probe. Their automated fixtures are identified above.

## Dashboard verification

Browser interaction at 1280×800 and 1024×768 exercised Control `/run`, active-agent guidance with its receipt, inspection, Stop → Interrupted, model assessment edit/save, SQLite health, actual commit links, conflict edit → Stage → Commit and Git refresh. Provider fixtures are visibly named “QA fixture · simulated provider”; Git/SQLite/HTTP are real. No browser warning/error logs were observed in this run.

The current captures live in `.impeccable/review/` with `chat-`, `git-`, `routing-` and `conflict-` prefixes. They are screen-level evidence, not a claim of real paid inference. The finish-review outcome is recorded separately. The optional design detector was unavailable because its engine/cache was not installed; the independent visual review replaces that mechanical coverage only at its stated scope.

## Windows and Linux

`.github/workflows/check.yml` runs the same verification on macOS, Ubuntu and Windows with Node 24 and 26 and uploads its platform result. The workflow performs no provider inference and requires no Claude subscription. The compiled launch test uses paths with spaces and checks singleton/restart behavior. Platform-specific process termination runs on its actual OS when CI executes.

Only the macOS job-equivalent command was executed in this workspace. There is no Git remote/CI run here. A matrix definition, emulated `.cmd` path fixtures on macOS, or code inspection is not a Windows/Linux pass. Those results must come from their native CI jobs; the user does not need to supply or manually operate those machines. Private-runtime installation/download and native vendor CLI behavior on those systems remain separate release validation.

## Animated round avatars

The shared SVG drives the preview and actual dashboard. At 727×825, 1024×768 and 1280×800, browser checks exercised sphere tint, activity/wait expressions, animation toggle and actual Inspector save/reset. Changing to Mint updated the SVG shell gradient, including its base stop to `#8eb6a2`. Actual graph customization to Sky persisted `#92afcd`, then Reset restored the initial role appearance.

Computed SVG styles showed blink/mouth animations running and distinct mouth scaleY samples (`.517438`, `.712934`). Disabling the toggle paused them. In an explicitly diagnostic short viewport, scrolling the portrait fully offscreen put its bounding-box bottom at `-95.35`; IntersectionObserver disabled animation and the computed eye play state became paused. Returning to a visible normal viewport resumed animation. Static screenshots cannot demonstrate this motion; the live preview can. The reduced-motion media rule is implemented, but native OS preference emulation was not available in this browser test. No audio was added and no model inference was required.


## Worktree preparation, ticket editing and delivery reports

The added `tests/delivery-workspace.test.ts` contains eight tests. It exercises a real offline npm installation from a committed local dependency and lockfile, disabled lifecycle scripts, explicit script authorization, input-based setup reuse, explicit ignored-file copying, source preservation, tracked-file refusal, modified local-file preservation and symlink escape refusal before directory creation. Package-manager selection/flags for pnpm/Yarn/Bun are inspected; genuine installs with those managers have not been run here. The Yarn build suppression follows the [official install documentation](https://yarnpkg.com/cli/install).

Other cases cover changed inputs while approval is pending (no effects), nonzero exit, timeout, engine recovery, explicit retry, stopping a pending setup without replay, rejection of edits during active approval, dependency errors/cycles, stale revisions and scope freeze after execution starts. Authorized ticket commands run both per-ticket and on the combined feature; generated suggestions do not run. A real diff, commit/check/review report is validated/exported, and later changes flag it stale. A source path containing a quote and spaces exercises the generated POSIX handoff; fast-forwarding that disposable fixture succeeds. Changes during final review block delivery. A report with no automated checks states that limitation. Existing conflict fixtures now record their actual base revision, as real orchestrator-created worktrees do.

At 1280×800 and 1024×768, the browser exercised ticket edit/save, setup preview from settings, separate feature/ticket setup approvals, retained setup output, simulated completion, report copy and a real Markdown download, manual Git instructions, branch-status refresh and keyboard access to editor actions. Captures in `.impeccable/review/` use `ticket-editor-`, `setup-` and `delivery-` prefixes. No warning/error console messages were observed. These are desktop/laptop viewport captures at the relevant application scroll position. Mobile is outside scope.

No provider inference was made for this extension. The prior genuine Codex result does not prove this new complete journey on a real project. Native Windows/Linux and genuine pnpm/Yarn/Bun setup remain unexecuted. This task does not require another Claude subscription or access to another operating system.
