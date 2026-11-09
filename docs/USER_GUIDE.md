# Workspace guide

1. Review the detected conventions, autonomy mode and verification commands.
2. Add a feature or paste an existing TODO list. Keep an external issue URL when relevant.
3. Open **To do** to find questions, approval requests and blockers. Analyze a feature, then answer its questions directly on the feature page. Use a recommendation or write a decision, and select **Save answers & update plan**. This revises the plan without starting execution.
4. Review and edit tickets, criteria, dependencies and authorized checks before execution. Saving an edit creates a new plan revision.
5. Preview worktree preparation in **Settings → Execution & permissions**, then start execution. Assisted mode requests plan approval; setup commands and explicit local-file copies request their own approval unless authorized in Settings. Configure automated checks in **Settings → Verification**.
6. Inspect the swarm, setup logs, checks, reviews and diffs. Open the delivery report for the exact commit, verification evidence and manual Git handoff; copy it or download Markdown. Your original branch is preserved.

Writing agents need a Git repository with a first commit. The first run requires a clean user worktree. Tesslane does not automatically stash or delete your changes. Worktree preparation detects committed npm/pnpm/Yarn/Bun lockfiles, or uses your custom commands. Dependency lifecycle scripts are disabled by default. Configure other languages and any required generation explicitly in Settings. Only explicitly listed ignored local files are copied. Failed or interrupted setup needs a fresh approval before retrying. Configure only meaningful verification commands; suggested commands from an agent never acquire automatic shell authority.

Closing the browser keeps the engine alive. Re-running the skill reopens it. Pause takes effect at execution boundaries; Stop interrupts active work and preserves worktrees. The conversation panel is optional: **Discuss this feature** opens its explicit destination. Discussion provides read-only advice and proposed actions; run controls belong to their feature. Advanced execution commands remain available next to the composer. **Guide this active agent** opens a targeted instruction when the agent supports it. Inspecting a node does not redirect an existing draft. Delivery receipts distinguish queued input from native acceptance.

Conversation drafts stay separate by recipient; clarification drafts stay separate by feature and plan revision. They are kept on the device, with a tab-memory fallback when browser storage is unavailable. **Dictate** inserts editable text into a draft and never sends it automatically. Availability depends on the browser's Web Speech recognition service; some browsers process audio remotely and require network access. See [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). No transcription server is added to Tesslane.

After an engine crash, inspect the durable operation records in Git and reconcile their observed HEAD before retrying. Conflicts stay in the integration worktree: choose ours/theirs or edit a resolution, stage it and explicitly commit or abort the merge. A workspace-state export does not back up source code or Git worktrees.

For installation, updates and troubleshooting, see [getting started](GETTING_STARTED.md). For state storage and optional dictation, see [privacy](PRIVACY.md).
