# Getting started

Tesslane is a local application launched from an agent skill. Install the skill with the Vercel skills CLI, or retain a complete source checkout and use its installer.

## Prerequisites

- Git and a project you trust. Writing agents require a repository with an initial commit and a clean source worktree at first execution.
- The native Codex or Claude Code CLI, already signed in through its own official login flow. Provider access and any usage charges are supplied by your account.
- Bash on macOS/Linux or PowerShell on Windows.
- Node.js 22.20 or newer and npm when using the Vercel skills CLI. The source-checkout installer can prepare a private runtime without a system Node installation.
- Internet access for first preparation. A Node.js runtime at version 24 or newer is reused when available; otherwise the launcher downloads a private pinned runtime from `nodejs.org` and verifies its archive checksum.

Use the official [Codex CLI](https://developers.openai.com/codex/cli) or [Claude Code setup guide](https://code.claude.com/docs/en/setup) for engine installation. Tesslane does not distribute those engines or provide model access.

## Install with the Vercel skills CLI

For Codex:

```sh
npx skills add Lorenzo-Coslado/tesslane --skill tesslane --agent codex --global
```

For Claude Code:

```sh
npx skills add Lorenzo-Coslado/tesslane --skill tesslane --agent claude-code --global
```

The CLI installs the complete skill folder, including the standalone launcher and icon. `--global` makes it available across projects; omit it for a project-scoped installation. Review the installation summary before confirming. Reopen or restart the agent if the skill does not appear.

Open the intended project and invoke `$tesslane` in Codex or `/tesslane` in Claude Code. On first launch, the bundled launcher downloads the pinned v0.1.0 application source and verifies its exact Git revision before running the platform launcher. Dependencies are installed from the committed lockfile, the app is built, and the dashboard opens for that project. No coding agents start just from installing or opening the skill.

The current Vercel CLI requires Node.js 22.20+. Tesslane's application needs Node.js 24+, so a compatible host runtime is reused or a private runtime is prepared automatically. The standalone launcher uses no npm dependencies of its own.

### Runtime cache

Prepared application checkouts are stored under:

| Platform | Runtime cache                                                                        |
| -------- | ------------------------------------------------------------------------------------ |
| macOS    | `~/Library/Caches/Tesslane/runtime/<commit>`                                         |
| Linux    | `$XDG_CACHE_HOME/Tesslane/runtime/<commit>`, or `~/.cache/Tesslane/runtime/<commit>` |
| Windows  | `%LOCALAPPDATA%\Tesslane\runtime\<commit>`                                           |

`TESSLANE_RUNTIME_DIR` selects another cache parent. This is separate from per-project state and worktrees. Repeated launches reuse the pinned source without fetching updates; modified tracked cache files are refused rather than overwritten. A future skill update can select a newer pinned runtime. Preserve any cache changes before replacing a damaged cache, and keep project state/worktrees separately.

The [installation badge](https://skills.sh/Lorenzo-Coslado/tesslane) reflects events recorded by the Vercel CLI, not unique users or all distribution methods. See [installation metrics](PRIVACY.md#installation-metrics) for details and opt-out.

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

For a Vercel skills installation, use `npx skills update --global` (or omit `--global` for project scope), and follow the CLI summary. To remove the global skill, use `npx skills remove tesslane --agent codex --global`, or select `claude-code`. Updating or removing the skill does not remove cached application sources, per-project state or Git worktrees. Stop an already-running project engine before expecting an updated runtime to apply.

For the retained-source installation:

Stop active agent work before updating the retained checkout. Then run:

```sh
git pull --ff-only
bash scripts/install.sh codex
```

Reinstall the corresponding Claude skill if you use both. Re-running installation refreshes skill metadata and the saved repository path. The next launch rebuilds when source or lockfile inputs change. Restart the already-running project engine before expecting runtime changes to apply; closing its browser tab is insufficient. Read [release notes](../CHANGELOG.md) before updating.

To uninstall the skill, remove its `tesslane` directory from the appropriate skill location. This leaves the application checkout, project state and worktrees in place. See [privacy and local data](PRIVACY.md) before removing any of those separately.

## Skill and plugin packaging

`skills/tesslane/SKILL.md` follows the [Agent Skills specification](https://agentskills.io/specification). `agents/openai.yaml` adds Codex presentation metadata without granting additional execution permissions. The repository root also includes a portable `plugin.json` following the [official plugin packaging guide](https://developers.openai.com/plugins/build/plugins).

Both the Vercel skills CLI and retained-clone routes above are supported. The bundled launcher allows a complete skill-folder copy to prepare the application; copying only SKILL.md without its scripts is insufficient. The plugin manifest describes the full package for compatible hosts. A skills.sh listing or install badge does not mean the package is listed or reviewed in OpenAI’s public plugin directory. Hosted ChatGPT surfaces cannot execute this local application without an appropriate local execution environment.

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
