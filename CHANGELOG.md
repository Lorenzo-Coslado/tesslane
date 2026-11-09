# Changelog

Notable changes are recorded here. During the 0.x series, interfaces and local state formats may evolve; read release notes before updating.

## Unreleased

- Install Tesslane through the Vercel skills CLI, with a standalone skill-folder launcher that prepares a commit-verified v0.1.0 application runtime in a local cache.
- Reuse the pinned runtime across projects, preserve changed cache contents and handle simultaneous preparation safely.
- Add the native skills.sh installation badge and document its scope and telemetry opt-out.
- Exercise standalone skill distribution and platform launchers with real temporary Git fixtures.

## 0.1.0 — 2026-11-09

First public source release of Tesslane, the local swarm dashboard.

- Feature clarification, revisioned plans, delivery tickets and a To do workspace.
- Codex app-server and Claude Code Agent SDK adapters with per-role model routing.
- Agent hierarchy, dependencies, activity, transcripts and animated customizable avatars.
- Explicit approvals, Git worktrees, dependency preparation, checks, independent reviews and delivery reports.
- Durable SQLite state, resumable events, Git recovery and manual delivery handoff.
- Agent Skills entry point, Codex presentation metadata and a portable plugin manifest.
- Cross-platform verification workflow, contributor documentation and sample-only README media.
- Native Windows command quoting that preserves actual check/setup exit codes, with coverage for quoted paths and arguments.

This is an early release. The native Codex path has prior local evidence; genuine Claude and mixed-provider inference and broader real-project workloads still need validation. See [implementation status](docs/implementation/STATUS.md).
