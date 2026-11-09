# Security policy

## Reporting a vulnerability

Use [GitHub's private vulnerability reporting](https://github.com/Lorenzo-Coslado/tesslane/security/advisories/new) for security issues. Include the affected commit or version, operating system, reproduction steps, expected impact and a minimal example with secrets removed. Do not post credentials, project archives or exploitable details in a public issue.

The project is maintained on a best-effort basis. There is no guaranteed response or remediation time. Security fixes target the latest `main` revision; older 0.x snapshots have no separate maintenance commitment.

## Trust boundary

Tesslane binds its dashboard to `127.0.0.1`. Cookie sessions, origin validation and CSRF checks protect local mutations. Keep this service local; exposing it through a public tunnel or reverse proxy is outside the supported deployment model.

Coding engines execute tools with the permissions selected in the dashboard and supported by their native runtime. A Git worktree isolates changes from the source branch; it is not an operating-system sandbox. Only run agents and setup/check commands against repositories you trust with the configured permissions.

Authentication remains with the native Codex or Claude Code CLI. Tesslane does not need copied tokens or an API key pasted into the dashboard. A provider may still receive prompts and repository context according to its own configuration and policies.

Local databases, transcripts, logs, exports and worktrees can contain source code, prompts, paths and tool output. Keep them private and review any diagnostic attachment before sharing it. The public demo and documentation captures use authored sample data.

See [privacy and local data](docs/PRIVACY.md) for storage and optional browser dictation behavior.
