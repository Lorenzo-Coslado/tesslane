# Implementation and validation status

Updated 9 November 2026 for the first public source release, v0.1.0. Tesslane is an early local application; this page distinguishes implementation from demonstrated provider behavior.

## Current application

The maintained interface is the current `src/web/` application: a To do workspace, feature-centered clarification and plan review, delivery tickets, agent graphs, scoped conversations, settings, Git inspection and delivery reports. The animated round avatars and silver Tesslane icon are the accepted visual direction.

The separate [feature workspace prototype](../../experiments/feature-workspace/README.md) was set aside on 9 November 2026. It is retained as an archived experiment, excluded from the production build and not a roadmap commitment.

## Implemented

- Revisioned plans and inline feature decisions, optimistic ticket editing, dependency validation and execution scope freeze.
- Codex app-server and Claude Code Agent SDK adapters, role/profile routing, advertised model validation and explicit fallback policy.
- Hierarchy, interactions, native transcripts, reported usage and separate requested/configured/reported model identities.
- Scoped discussion, explicit execution controls, active-agent guidance and queued versus native-accepted input receipts.
- Approval-bound setup commands and local-file copies, committed-lockfile preparation and retained setup evidence.
- Isolated Git worktrees, independent ticket/final review, authorized checks and a delivery report bound to the integration commit.
- Durable Git operation intents, observed-state reconciliation, explicit conflict resolution and source-branch preservation.
- SQLite migrations, state export/restore, paginated histories, resumable SSE, singleton launch and owned process cleanup.
- Agent Skills entry point, Codex UI metadata, portable plugin manifest, Vercel skills CLI distribution and retained-clone installers. The standalone skill launcher prepares a commit-verified v0.1.0 app runtime in a local cache.

## Verified locally for publication

`npm run verify` passed on **macOS arm64 / Node.js 26.13.0** on 9 November 2026:

- TypeScript and formatting.
- **58 deterministic tests** using real temporary Git repositories, SQLite, shell checks and provider fixtures.
- Production client/server build.
- Compiled launch, HTTP readiness, singleton reuse and restart persistence.
- Skill installation into paths containing spaces, launcher provenance, copied UI assets and invalid-target refusal.
- Standalone skill-folder distribution with real local Git: pinned revision validation, offline cache reuse, concurrent preparation, local-change preservation and native-launch failure propagation.

A copied-folder forward-test and an actual Vercel CLI installation both opened the intended local dashboard without model requests. A cold launch with Node.js 22.20.0 successfully prepared the private Node.js 26.13.0 runtime; see [standalone installation evidence](VALIDATION.md#standalone-skill-installation).

The current skill also passes the reference Agent Skills validator, and the portable manifest passes its published JSON schema. README media was captured from the current application with authored sample data and no provider requests. See [media provenance](../assets/README.md) and the retained [local verification report](evidence/macos-verification.json).

## Genuine provider evidence

An earlier native Codex run on 7 November 2026 completed planning, isolated implementation, checks, independent ticket review, integration and final review in a synthetic repository. Its [sanitized report](evidence/live-codex-macos.json) is retained. That probe predates later UI and workspace-delivery additions; it does not establish the full current journey on every real project.

No genuine Claude or mixed-provider inference is claimed. Those adapters have deterministic protocol and orchestration fixtures. Native account configuration determines access and billing; Tesslane's observations do not independently prove billing behavior.

## Native CI results

The public [Check workflow](https://github.com/Lorenzo-Coslado/tesslane/actions/workflows/check.yml) runs the same verification on macOS, Ubuntu and Windows with Node.js 24 and 26. Each job uploads its platform result. Consult the run for the relevant commit before treating an operating-system result as proven. CI uses simulated providers and does not validate real vendor login, subscriptions or inference.

## Remaining validation and follow-up

- Genuine Claude/mixed inference, native quota/approval/interrupt variations and broader real-project Codex journeys.
- Private-runtime download and installer upgrade journeys across native operating systems; genuine pnpm/Yarn/Bun setup beyond command-selection fixtures.
- Long-running resource behavior, dense native subagents and the remaining specification acceptance matrix.
- Shareable defaults, moved-project reconciliation and configurable artifact retention.

A passing fixture or successful small delivery does not establish universal model quality, cost, latency or production-scale reliability. Read [validation evidence](VALIDATION.md), [execution controls](EXECUTION.md) and [workspace delivery](WORKSPACE-DELIVERY.md) for the concrete contracts.
