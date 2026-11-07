# Worktree preparation and delivery

The supported path is repository → installed skill → launch script → local dashboard. Before the first writing run, use a Git project with a first commit and a clean source checkout, sign in to the official Codex CLI and review Settings. No user-project inference is part of the automated verification suite.

## Prepare the project environment

Settings contain `worktreeSetup`:

| Setting | Default | Behavior |
| --- | --- | --- |
| `dependencies` | `auto` | Use the package manager declared in `package.json`, or the only manager with a committed lockfile. `manual` and `none` skip the automatic installer; explicitly configured commands still run. |
| `commands` | `[]` | Ordered shell commands in every managed worktree, for generation, native builds or other languages. |
| `localFiles` | `[]` | Explicit project-relative ignored and untracked files to copy from the source checkout. No implicit environment/credential copy. |
| `inputFiles` | `[]` | Additional files whose contents invalidate setup reuse. Known tracked manifests, lockfiles and package configuration are detected automatically. |
| `runScripts` | `false` | Opt in to dependency lifecycle/build scripts. Explicit custom commands remain executable regardless. |
| `autoRun` | `false` | Authorize the configured setup without an approval per workspace. Automatic dependency installs additionally need `allowDependencyInstall` and `allowNetwork`. |
| `timeoutMs` | `600000` | Per-command timeout. Stop cancels the process tree through the existing platform-specific check runner. |

Preview reads current checkout inputs and the draft settings without executing setup. Actual preparation reads each worktree and records its HEAD, commands, selected manager, local-file names, input fingerprint, output and outcome. Initial and retry approvals show concrete operations. They do not reveal copied-file contents. Commands themselves run in the host environment; the network setting is an authorization gate for automatic installs, not network isolation. Avoid placing secrets directly in command strings; command output is retained locally.

Automatic commands use npm `ci`, pnpm/Bun frozen lockfiles or Yarn immutable/frozen lockfiles. Lifecycle scripts are suppressed unless enabled; modern Yarn skips the build step as well. The selected manager must already be available in the process environment. The `packageManager` declaration selects the tool but does not install or pin its executable version. If a project needs a particular wrapper/version, configure explicit setup commands. Native addons or generators may require explicit authorization; errors preserve their diagnostics.

Each feature has an integration worktree and each ticket a writing worktree. Preparation occurs before writing and before verification, including after dependency/configuration changes. Reuse requires matching content/configuration fingerprints, expected dependency artifacts and unchanged copied files. Custom generator source inputs must be listed in `inputFiles`; arbitrary filesystem state is not inferred. Each workspace has its own installation; no writable source `node_modules` symlink is shared. Frozen lockfile installation does not promise a network-free or fully reproducible environment across operating systems.

Local files must remain ignored and untracked in both source and destination. Paths cannot escape the project or point directly at symlinks; existing parent paths are checked before creating directories. A destination with different content is preserved and blocks setup. Listed files must remain ignored after writing, before committing. Setup cannot change HEAD unnoticed. A failure, timeout or interruption is recorded, preserves files and requires a fresh retry approval. Restart marks pending/running setup interrupted without replaying commands. Partial custom effects can remain; inspect them before authorizing a retry.

## Refine the plan

Edit a ticket before any feature worktree/attempt starts. Update its criteria, description, file ownership, dependencies and complexity together. Saving validates the complete acyclic dependency graph and creates a new plan revision. Stale forms fail without overwriting another edit. Pending approvals of the old plan are superseded atomically.

Suggested checks are notes. Executable commands belong in the separate authorized field or workspace verification settings. Their union runs on each applicable ticket and again on the combined feature. Once execution starts, preserved work and reviews belong to that scope; use a follow-up feature for new scope rather than silently changing existing tickets.

## Read and hand off the delivery

Completion requires successful configured checks and an independently approved combined review at an unchanged, clean feature HEAD/branch. The deterministic report contains the plan revision, feature/ticket criteria, actual changed paths, commits, verification records at their revisions, review findings and limitations. It is saved atomically with feature completion and exported with workspace state. It does not copy Git files or back up worktrees.

The report is evidence at its recorded commit. **Refresh branch status** marks later HEAD/branch/dirty changes or a missing worktree explicitly. Copy or download the Markdown report to retain that evidence. A report without configured automated checks says so; review approval is not test coverage.

Manual commands inspect the source checkout and diff, then optionally fast-forward the recorded source branch to the recorded delivery commit. They are labeled for POSIX shells (macOS/Linux/Git Bash). They are never executed by report generation. Start from a clean target branch; a diverged branch requires manual integration. No automatic push, publication or deployment is introduced.

## Validation boundary

Real temporary Git worktrees, SQLite, shell commands, npm offline installation and HTTP routes are covered by automated tests. Desktop/laptop browser tests use an explicitly simulated provider. The next acceptance run is this complete path on an actual user project with Codex. Genuine Claude/mixed-provider runs, native Windows/Linux execution and real pnpm/Yarn/Bun installs have not been established by these fixtures.
