---
name: tesslane
description: Open a local Tesslane dashboard for the current project to clarify features, orchestrate Codex and Claude Code agents, and inspect execution, verification, and Git worktrees.
---

Launch Tesslane for the user's current project. The dashboard owns execution policies, durable state, and agent scheduling.

Locate this skill's installation.json and read its repository path. If invoked from the source repository instead, use the repository containing scripts/start.sh. Resolve the user's target project to an absolute path; it is usually the active workspace, not Tesslane's source checkout.

Run the repository's scripts/start.sh with the project path on macOS or Linux; on Windows run scripts/start.ps1 with -Project. Quote paths as shell arguments. The first launch reuses a compatible Node.js or prepares a private checksum-verified runtime from nodejs.org, installs locked dependencies and builds the dashboard. It leaves the system runtime untouched. The script starts a detached local engine and opens the dashboard; repeated launches reuse it.

Finish when the script reports a reachable local dashboard for the correct project. If startup fails, inspect its reported log and report the concrete error. Keep the engine running after the browser closes.

Existing work lists, repository instructions and trackers remain authoritative. The setup screen offers a local feature workspace without overwriting them. Let the developer choose engines, models, autonomy and checks in the dashboard. Native CLI login owns credentials; never read or copy authentication tokens. Running this skill opens the workspace; starting code-writing agents requires the dashboard's configured policy and an execution request.
