# Getting started

Tesslane is a local application launched from an agent skill. Keep the complete source checkout in a stable location: the installed skill records that path.

## Prerequisites

- Git and a project you trust. Writing agents require a repository with an initial commit and a clean source worktree at first execution.
- The native Codex or Claude Code CLI, already signed in through its own official login flow. Provider access and any usage charges are supplied by your account.
- Bash on macOS/Linux or PowerShell on Windows.
- Internet access for first preparation. A Node.js runtime at version 24 or newer is reused when available; otherwise the launcher downloads a private pinned runtime from `nodejs.org` and verifies its archive checksum.

Use the official [Codex CLI](https://developers.openai.com/codex/cli) or [Claude Code setup guide](https://code.claude.com/docs/en/setup) for engine installation. Tesslane does not distribute those engines or provide model access.

## Install from a full clone

```sh
git clone https://github.com/Lorenzo-Coslado/tesslane.git
cd tesslane
bash scripts/install.sh codex
```

For Claude Code, replace the last command with `bash scripts/install.sh claude`.

On Windows:

```powershell
git clone https://github.com/Lorenzo-Coslado/tesslane.git
cd tesslane
powershell -File scripts/install.ps1 -Agent codex
```

Use `-Agent claude` for Claude Code. The installer copies the complete skill, including its presentation assets, into `~/.agents/skills/tesslane` for Codex or `~/.claude/skills/tesslane` for Claude Code. It writes `installation.json` there to locate the retained application checkout. Installing does not start coding agents.

Open the target project in your coding agent and invoke `$tesslane` in Codex or `/tesslane` in Claude Code. If the skill does not appear, restart the agent. The first launch installs dependencies from the committed lockfile, builds the app, starts a detached local engine and opens the dashboard. Later launches reuse the project engine.

Copying only `SKILL.md` does not install the application. Generic skill-only downloaders need the full clone and the installer above to establish the launcher path.

## Launch directly

```sh
bash scripts/start.sh "/absolute/path/to/your/project"
```

```powershell
powershell -File scripts/start.ps1 -Project 'C:\path\to\project'
```

The compiled CLI supports `--project`, `--port`, `--no-open` and `--demo`. Closing the browser leaves the engine running. Reinvoke the skill to reopen it; **Stop** in the dashboard interrupts agent work and preserves worktrees.

## Update or uninstall

Stop active agent work before updating the retained checkout. Then run:

```sh
git pull --ff-only
bash scripts/install.sh codex
```

Reinstall the corresponding Claude skill if you use both. Re-running installation refreshes skill metadata and the saved repository path. The next launch rebuilds when source or lockfile inputs change. Restart the already-running project engine before expecting runtime changes to apply; closing its browser tab is insufficient. Read [release notes](../CHANGELOG.md) before updating.

To uninstall the skill, remove its `tesslane` directory from the appropriate skill location. This leaves the application checkout, project state and worktrees in place. See [privacy and local data](PRIVACY.md) before removing any of those separately.

## Skill and plugin packaging

`skills/tesslane/SKILL.md` follows the [Agent Skills specification](https://agentskills.io/specification). `agents/openai.yaml` adds Codex presentation metadata without granting additional execution permissions. The repository root also includes a portable `plugin.json` following the [official plugin packaging guide](https://developers.openai.com/plugins/build/plugins).

The supported install path for this release is the retained clone above. The plugin manifest describes the full package for compatible hosts; inclusion here does not mean Tesslane is listed or reviewed in a public plugin directory. Hosted ChatGPT surfaces cannot execute this local application without an appropriate local execution environment.

## Troubleshooting

| Symptom                                   | Check                                                                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Skill is missing                          | Confirm the install location and restart the agent. Remove duplicate old Tesslane skills if an earlier install used `~/.codex/skills`. |
| Checkout moved                            | Run the installer from the new location to refresh `installation.json`.                                                                |
| Engine unavailable                        | Confirm its CLI is on `PATH`, sign in natively, then inspect **Settings → Models**.                                                    |
| Runtime or dependency preparation fails   | Inspect the printed log; confirm access to `nodejs.org` and the npm registry.                                                          |
| Source repository has uncommitted changes | Commit or otherwise preserve them before starting writing agents. Tesslane does not automatically stash them.                          |
| Setup needs extra files or commands       | Configure explicit setup commands and local-file copies in **Settings → Execution & permissions**.                                     |

Continue with [the workspace guide](USER_GUIDE.md) or open a [bug report](https://github.com/Lorenzo-Coslado/tesslane/issues/new?template=bug_report.yml) with sanitized diagnostics.
