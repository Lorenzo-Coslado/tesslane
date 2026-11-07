# Tesslane

**Local orchestration for coding agents.**

Tesslane turns development intentions into reviewed changes with a local, observable swarm of coding agents. Its entry path is **repository → skill → script → project dashboard**.

The dashboard includes features and tickets, scoped conversations, agent hierarchy and dependency maps, approvals, verification output, and real Git history. The selected silver icon is **variant A**.

## Project status

An initial local implementation is available. Codex uses its official app-server; Claude Code uses the official Agent SDK with your installed native CLI. A genuine native Codex delivery has passed locally, including independent reviews and integration. Claude/mixed execution is covered by explicit fixtures; genuine Claude inference and the Windows/Linux CI jobs remain unexecuted. See [implementation status](./docs/implementation/STATUS.md) for the exact boundary between implementation and proven behavior.

## Install the skill

Keep this repository in a stable location. On macOS or Linux:

```sh
bash scripts/install.sh codex
# Or: bash scripts/install.sh claude
```

On Windows:

```powershell
powershell -File scripts/install.ps1 -Agent codex
```

Restart the coding agent so it discovers the skill, open your target project, and invoke `$tesslane` in Codex or `/tesslane` in Claude Code. The skill opens that project's local dashboard. The first preparation needs Internet access to fetch locked dependencies, and a private Node.js runtime when no compatible runtime exists. It does not change your system installation. The pinned runtime comes from the [official Node.js distribution](https://nodejs.org/en/download) and its archive SHA-256 is checked against the vendor's checksum list.

You can launch directly without installing the skill:

```sh
bash scripts/start.sh "/absolute/path/to/your/project"
```

```powershell
powershell -File scripts/start.ps1 -Project 'C:\path\to\project'
```

Sign in through the official Codex or Claude Code CLI beforehand. Tesslane discovers models through those engines and does not collect tokens. Native authentication and your environment determine the billing route.

## Use the workspace

1. Review the detected conventions, autonomy mode and verification commands.
2. Add a feature or paste an existing TODO list. Keep an external issue URL when relevant.
3. Analyze the feature. Answer material questions in its conversation, then analyze again.
4. Review and edit tickets, criteria, dependencies and authorized checks before execution. Saving an edit creates a new plan revision.
5. Preview worktree preparation in Settings, then start execution. Assisted mode requests plan approval; setup commands and explicit local-file copies request their own approval unless authorized in Settings.
6. Inspect the swarm, setup logs, checks, reviews and diffs. Open the delivery report for the exact commit, verification evidence and manual Git handoff; copy it or download Markdown. Your original branch is preserved.

Writing agents need a Git repository with a first commit. The first run requires a clean user worktree. Tesslane does not automatically stash or delete your changes. Worktree preparation detects committed npm/pnpm/Yarn/Bun lockfiles, or uses your custom commands. Dependency lifecycle scripts are disabled by default. Configure other languages and any required generation explicitly in Settings. Only explicitly listed ignored local files are copied. Failed or interrupted setup needs a fresh approval before retrying. Configure only meaningful verification commands; suggested commands from an agent never acquire automatic shell authority.

Closing the browser keeps the engine alive. Re-running the skill reopens it. Pause takes effect at execution boundaries; Stop interrupts active work and preserves worktrees. Use Discuss for read-only advice and proposed actions, Control for explicit execution commands, and Guide agent to send an instruction to the selected active agent. Delivery receipts distinguish queued input from native acceptance.

After an engine crash, inspect the durable operation records in Git and reconcile their observed HEAD before retrying. Conflicts stay in the integration worktree: choose ours/theirs or edit a resolution, stage it and explicitly commit or abort the merge. A workspace-state export does not back up source code or Git worktrees.

## Development

```sh
npm ci
npm run dev -- --no-open
npm run verify
```

For a clearly labeled sample workspace with no model calls:

```sh
npm run preview -- --no-open
```

The CLI prints its URL and private data location. `--project`, `--port`, `--no-open`, and `--demo` are supported. `TESSLANE_DATA_DIR` selects an isolated state directory for testing. `TESSLANE_MANAGED_NODE=1` exercises the private runtime preparation path. Each real project has a single local engine and its own SQLite database under the platform's application-state directory.

`npm run verify` runs types, formatting, deterministic tests, the production build and compiled-launch/restart checks. It makes no provider inference requests. CI applies the same command to Node 24 and 26 on macOS, Linux and Windows, and archives a platform-specific result. See [execution controls](./docs/implementation/EXECUTION.md) and [validation evidence](./docs/implementation/VALIDATION.md).

The round agent avatar is customizable in the Inspector. Preview sphere colors and animated facial states at `/avatar-proposals.html` on the dashboard’s printed local origin. Animations pause offscreen and respect reduced motion.

## Documentation

- [Product and technical specification](./SPECIFICATION.md): validated scope, workflows, architecture, and V1 acceptance criteria.
- [Domain glossary](./GLOSSARY.md): canonical terminology for work, execution, and control.
- [Visual direction and explorations](./docs/design/README.md): icon concepts, dashboard studies, and the current design feedback.
- [Design system](./DESIGN.md): implemented tokens, native application feel and component rules.
- [Implementation evidence and remaining release work](./docs/implementation/STATUS.md).

Tesslane manages agent execution. Existing trackers retain responsibility for coordination between people.

## License

MIT. See [LICENSE](./LICENSE).
