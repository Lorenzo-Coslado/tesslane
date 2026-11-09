# Development

Read [contributing](../CONTRIBUTING.md) for the pull request workflow and [architecture](ARCHITECTURE.md) for the source map.

## Commands

| Command                                                           | Purpose                                                                          |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `npm ci`                                                          | Install the exact committed dependency graph.                                    |
| `npm run dev -- --no-open`                                        | Start the local development app; print the URL.                                  |
| `npm run preview -- --no-open`                                    | Start a clearly labeled sample workspace with no model requests.                 |
| `npm run typecheck`                                               | Check TypeScript.                                                                |
| `npm run format`                                                  | Format application, scripts and tests.                                           |
| `npm test`                                                        | Run deterministic behavioral tests.                                              |
| `npm run build`                                                   | Build the React client and bundled server.                                       |
| `npm run smoke`                                                   | Check compiled launch, project singleton and restart persistence after building. |
| `npm run verify`                                                  | Run all release checks above in sequence.                                        |
| `npm run install:skill -- codex --target /absolute/path/tesslane` | Exercise installation in an isolated destination.                                |

Use Node.js 24 or 26. The server depends on built-in SQLite, so older runtimes are unsupported. Tests require permission to bind loopback sockets and create temporary repositories, worktrees and child processes.

## Test boundaries

Provider fixtures exercise orchestration without subscriptions, network inference or copied credentials. Real Git, SQLite, shell checks, streamed HTTP and separate crash-test processes supply the observable effects. An ordinary `npm run verify` must not acquire provider credentials or initiate inference.

The explicit native Codex probe in `tests/fixtures/live-codex.ts` is separate. Read its flags and [validation evidence](implementation/VALIDATION.md) before using it; it performs real inference and can consume quota. A passing fixture does not establish actual Claude inference or provider billing behavior.

CI runs the verification command across three operating systems and Node.js 24/26. Actions are pinned to full commit SHAs; Dependabot proposes updates to those pins and npm dependencies. Per-platform JSON reports are attached to each run.

## Design and historical material

The current runtime in `src/web/` is the application reference. [DESIGN.md](../DESIGN.md) describes its tokens and interactions. The selected silver Tesslane icon is `public/tesslane.png`; [design history](design/README.md) explains earlier assets. [Archived experiments](../experiments/README.md) are not a production roadmap.

README media is captured from the running application with authored sample data. [Media notes](assets/README.md) describe the source files and reproduction commands. Keep provider names, sample labels and verification boundaries visible when sharing captures.
