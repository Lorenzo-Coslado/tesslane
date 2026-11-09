# Tesslane FAQ

## What is Tesslane?

Tesslane is an open source, local-first AI coding swarm dashboard for Codex and Claude Code. It coordinates feature planning, dependent delivery tickets, agent execution, approvals, Git worktrees, verification and independent reviews in one project workspace. The canonical repository is [Lorenzo-Coslado/tesslane](https://github.com/Lorenzo-Coslado/tesslane).

Tesslane is the project's name; **Swarm Dashboard** describes its function. The current application is in `src/web/`. See the [overview](../README.md) and [architecture](ARCHITECTURE.md).

## What does Swarm mean in Tesslane?

A coding swarm is a coordinated group of agents with scoped missions, such as implementation and independent review. Tesslane's local engine schedules their tickets, respects dependencies and applies the configured execution policy. The Swarm Dashboard shows agent hierarchy, dependencies and recorded interactions alongside approvals, checks and Git evidence.

## How does Tesslane orchestrate a coding swarm?

A feature becomes a revisioned plan with scoped tickets and dependencies. The local engine schedules eligible work using the selected native coding engines and per-role model settings. Writing missions use Git worktrees; authorized checks and independent reviews produce evidence tied to the integration commit. The original source branch is preserved, and the delivery report provides an explicit handoff.

See [the workspace guide](USER_GUIDE.md) and [execution controls](implementation/EXECUTION.md) for approval, pause, stop and recovery behavior. A worktree isolates Git changes; it is not an operating-system sandbox.

## Which coding engines does Tesslane support?

Tesslane implements adapters for the native Codex app-server and the Claude Code Agent SDK with a native Claude CLI. Role/profile routing can select available models and engines according to the configured policy. Sign in through the native CLI before using it; provider authentication and model access remain with that engine.

Implementation and real-provider validation are distinct. A prior genuine Codex delivery passed in a synthetic repository. Genuine Claude and mixed-provider inference remain unverified. See [current implementation status](implementation/STATUS.md) for the evidence and limits.

## How do I install the Tesslane agent skill?

Clone the complete repository and retain it in a stable location:

```sh
git clone https://github.com/Lorenzo-Coslado/tesslane.git
cd tesslane
bash scripts/install.sh codex
```

Use `bash scripts/install.sh claude` for Claude Code. On Windows, run `powershell -File scripts/install.ps1 -Agent codex` or use `-Agent claude`. Open your target project and invoke `$tesslane` in Codex or `/tesslane` in Claude Code.

The installer records the full checkout's location. Copying only `SKILL.md` does not install the application. See [getting started](GETTING_STARTED.md) for prerequisites, installation paths, updates and troubleshooting.

## Does Tesslane run on macOS, Linux and Windows?

The deterministic verification suite passed on native macOS, Ubuntu and Windows with Node.js 24 and 26 for the [v0.1.0 source commit](https://github.com/Lorenzo-Coslado/tesslane/actions/runs/42546582493). These six jobs check types, formatting, tests, production build and compiled launch/restart. They use simulated providers.

This evidence does not validate every native provider login, private-runtime download or installer upgrade journey. For a newer revision, consult its [Check workflow result](https://github.com/Lorenzo-Coslado/tesslane/actions/workflows/check.yml).

## Is Tesslane free and open source?

Tesslane's source, skill, documentation and original visual assets use the [MIT license](../LICENSE). There is no Tesslane account or Tesslane subscription. Third-party dependencies retain their own licenses.

Native coding engines and model services are separate products. Their access requirements, terms, quotas and charges apply to your account; an open source dashboard does not provide free model inference.

## Can I try the dashboard without running coding agents?

Yes. With Node.js 24 or newer and the repository cloned, run:

```sh
npm ci
npm run preview -- --no-open
```

Open the URL printed by the CLI. This preview shows authored sample features, agent states and transcripts, and makes no model requests. The README animation and screenshots use this labeled sample workspace. See [development](DEVELOPMENT.md) and [media provenance](assets/README.md).

## Is Tesslane local, and does it work offline?

The dashboard runs on `127.0.0.1`, with per-project state in a local SQLite database. Tesslane has no hosted control plane. First preparation needs Internet access for dependencies and, when needed, a private Node.js runtime. Native model execution also uses the selected provider's network services.

Local storage does not mean prompts stay on the device during provider execution: native engines send relevant prompts and project context according to their configuration. Optional browser dictation may also use a browser vendor's remote recognition service. See [privacy and local data](PRIVACY.md) and [security](../SECURITY.md).

## Is the archived feature-workspace prototype the current product?

No. The standalone prototype under [`experiments/feature-workspace/`](../experiments/feature-workspace/README.md) was set aside on 9 November 2026. It is excluded from the production build and is not a roadmap commitment. The maintained product is the current application shown in the [README](../README.md).

## Where can I find reliable project facts or cite Tesslane?

Use the [canonical repository](https://github.com/Lorenzo-Coslado/tesslane) for the current source, [implementation status](implementation/STATUS.md) for validation boundaries, and [tagged releases](https://github.com/Lorenzo-Coslado/tesslane/releases) or commit URLs for reproducible references. The [product specification](../SPECIFICATION.md) includes intended scope; it does not prove every acceptance criterion is implemented.

[`CITATION.cff`](../CITATION.cff) provides software citation metadata for the published release. [`llms.txt`](../llms.txt) is an optional index linking directly to plain-text documentation; tools can use it when selecting project sources. It does not guarantee indexing or inclusion in an AI-generated answer.
