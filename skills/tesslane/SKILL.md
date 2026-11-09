---
name: tesslane
description: Open Tesslane's local Swarm Dashboard when the user asks to launch Tesslane or inspect a coding swarm's plans, execution, reviews and Git worktrees.
license: MIT
compatibility: Requires Git, a native Codex or Claude Code CLI, and Bash or PowerShell. Installation through the Vercel skills CLI needs Node.js 22.20 or newer. First launch needs network access; the application reuses Node.js 24+ or prepares a private runtime.
---

Launch Tesslane for the user's current project. The dashboard owns execution policies, durable state, and agent scheduling.

Resolve the user's target project to an absolute path. It is usually the active workspace, not Tesslane's source checkout or the installed skill directory.

If installation.json exists beside this SKILL.md, read its repository path and use that retained checkout. A full source or plugin checkout can also be located at ../.. relative to this SKILL.md; confirm it contains scripts/start.sh and package.json. For either checkout, run scripts/start.sh with the project path on macOS/Linux, or scripts/start.ps1 with -Project on Windows. If a recorded checkout has moved, report that its installer must be rerun from the new location.

Otherwise, use the bundled launcher from this skill's installed directory:

```sh
node "/absolute/path/to/installed/tesslane/scripts/open.mjs" "/absolute/path/to/project"
```

The bundled launcher downloads Tesslane's pinned published source into a local runtime cache, verifies the exact Git revision, and calls the native platform launcher. This works when a skill installer copies only this skill folder. Quote paths as shell arguments. First preparation installs locked dependencies and builds the dashboard, reusing Node.js 24+ or preparing a private checksum-verified runtime from nodejs.org. Repeated launches reuse the cache and project engine.

Finish when the script reports a reachable local dashboard for the correct project. If startup fails, inspect its reported log and report the concrete error. Keep the engine running after the browser closes.

Existing work lists, repository instructions and trackers remain authoritative. The setup screen offers a local feature workspace without overwriting them. Let the developer choose engines, models, autonomy and checks in the dashboard. Native CLI login owns credentials; never read or copy authentication tokens. Running this skill opens the workspace; starting code-writing agents requires the dashboard's configured policy and an execution request.
