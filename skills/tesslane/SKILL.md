---
name: tesslane
description: Open Tesslane's local swarm dashboard when the user wants to plan features, orchestrate Codex or Claude Code agents, or inspect their execution, reviews and Git worktrees.
license: MIT
compatibility: Requires a full Tesslane checkout, Git, a native Codex or Claude Code CLI, and Bash or PowerShell. First preparation needs network access; Node.js 24 or newer is reused or downloaded privately.
---

Launch Tesslane for the user's current project. The dashboard owns execution policies, durable state, and agent scheduling.

Locate this skill's installation.json and read its repository path. When running from a full source or plugin checkout without that file, resolve ../.. relative to this SKILL.md and confirm it contains scripts/start.sh and package.json. If the checkout is unavailable, explain that the full repository must be cloned and its scripts/install.sh or scripts/install.ps1 run; a copied SKILL.md alone does not include the application. Resolve the user's target project to an absolute path; it is usually the active workspace, not Tesslane's source checkout.

Run the repository's scripts/start.sh with the project path on macOS or Linux; on Windows run scripts/start.ps1 with -Project. Quote paths as shell arguments. The first launch reuses a compatible Node.js or prepares a private checksum-verified runtime from nodejs.org, installs locked dependencies and builds the dashboard. It leaves the system runtime untouched. The script starts a detached local engine and opens the dashboard; repeated launches reuse it.

Finish when the script reports a reachable local dashboard for the correct project. If startup fails, inspect its reported log and report the concrete error. Keep the engine running after the browser closes.

Existing work lists, repository instructions and trackers remain authoritative. The setup screen offers a local feature workspace without overwriting them. Let the developer choose engines, models, autonomy and checks in the dashboard. Native CLI login owns credentials; never read or copy authentication tokens. Running this skill opens the workspace; starting code-writing agents requires the dashboard's configured policy and an execution request.
