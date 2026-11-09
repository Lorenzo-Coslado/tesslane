# Privacy and local data

Tesslane runs a local HTTP service with one engine and SQLite database per project. The CLI prints the exact state directory at startup. Default locations are:

| Platform | State directory                                                                        |
| -------- | -------------------------------------------------------------------------------------- |
| macOS    | `~/Library/Application Support/Tesslane/<project-hash>`                                |
| Linux    | `$XDG_STATE_HOME/Tesslane/<project-hash>`, or `~/.local/state/Tesslane/<project-hash>` |
| Windows  | `%LOCALAPPDATA%\Tesslane\<project-hash>`                                               |

`TESSLANE_DATA_DIR` overrides this location for testing. Demo mode uses a separate project hash. The source checkout's `.tesslane/` directory holds private runtime/build-validation artifacts and is ignored by Git.

The application has no Tesslane account or hosted control plane. Application state remains local. Provider execution still sends prompts and relevant project context through the selected native coding engine; its authentication, service terms, network behavior and billing apply. Local-first does not mean offline model inference.

Browser conversation and clarification drafts use local storage, with an in-memory fallback when storage is unavailable. Clearing browser storage removes those drafts. Server-side transcripts, events, settings and execution records remain in the project's state directory.

Optional dictation uses the browser's Web Speech recognition service. Some browsers send audio to their own remote service. Tesslane does not add a transcription backend. Dictation inserts editable text and does not submit it automatically; keep it off if the browser's processing is unsuitable for your content.

State exports may include prompts, transcripts, paths and tool output. They do not back up repository files or Git worktrees. Review exports and diagnostics before sharing them. Stop the relevant engine before moving or manually removing its state; preserve worktrees containing useful changes.

README screenshots and the animation show an explicitly labeled sample workspace. No private project database, credential file or live provider transcript is required to reproduce them.
