# Archived feature workspace prototype

**Status: set aside on 9 November 2026. This proposal was not accepted for the current product. It is retained for possible future exploration and is excluded from the application build. The running application is the product reference.**

Status: interactive proposal, not implemented in the production dashboard and not validated with users.

The user requested a feature-centered workspace with a clear end-to-end journey, retaining **À traiter** as the opening view and all clarification questions inside the feature. This prototype explores the interaction model proposed by the [UX research review](../../docs/design/UX-RESEARCH-2026-11-08.md). It does not change the server, API contracts, orchestration, production routing or storage.

## Open the prototype

Open [the standalone HTML](index.html) in a browser by double-clicking it. It contains all styles, scripts and the existing Tesslane icon. There are no dependencies, external requests, model calls or saved data. Reloading resets the session.

During development a temporary preview is also available at `http://127.0.0.1:59831/`. The standalone file remains usable after this preview server stops.

## Question being explored

Can a developer move from an idea to a reviewed contribution while always understanding which feature is selected, what has happened, who must act, what the next useful action is, and whether that action can change code?

## Direction contract

**Thesis:** the feature owns the work. À traiter supplies direct entry to its current decision or result; users do not need to find the corresponding chat.

**Own-world:** extend the established Tesslane interface: charcoal surfaces, system typography, silver primary buttons, restrained semantic colors, labeled SVG symbols and the unchanged selected icon. This is an operational desktop workspace, not a new visual identity.

**Story:** describe the idea, answer the questions, review the plan, explicitly launch development, inspect the result and validate the human review. Permit return, interruption, correction and feature switching.

**First viewport:** a stable project/feature sidebar; feature identity and situation above four contextual perspectives; the current decision in the main column; responsibility, scope and recent activity beside it.

**Form:** one self-contained, disposable HTML prototype with an in-memory pure reducer, realistic working screens, free exploration, guided scenarios and a readable state inspector. No production integration or persistence. Existing approved direction retained; no new concept selection.

**Finish:** inspect the rendered interaction at desktop and laptop sizes, verify scenarios, obtain an independent finish review and record the limits of that evidence. Keep DESIGN.md and the production system intact.

## Journey and transitions

| Situation                    | User action                                          | Consequence                                                                                         |
| ---------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| À traiter                    | Open the relevant decision or work item              | Opens its feature at the useful perspective; navigation does not silently start work.               |
| New idea                     | Describe the need, start analysis                    | Read-only simulated analysis produces questions. The demo response illustrates CSV export.          |
| Questions                    | Edit answers or use suggested answers, then transmit | Answers stay in the feature; a plan is prepared without execution.                                  |
| Analysis failed              | Adjust or reuse retained answers, retry              | The next attempt returns a plan without re-entering the context in chat.                            |
| Plan ready                   | Review scope and criteria; explicitly launch         | Simulated development starts on the feature branch.                                                 |
| Work running                 | Wait, add a next-step instruction, pause or stop     | Instructions and conversation have an explicit feature recipient; partial work remains inspectable. |
| Work complete, check failed  | Request correction                                   | Development resumes, then checks run again; review approval stays unavailable.                      |
| Work complete, checks passed | Inspect changes and checks; validate review          | Marks the human review complete. It does not merge, commit or publish.                              |

The four perspectives are **Préciser → Plan → Travail → Résultat**. They describe the usual sequence, but remain navigable for reference. Empty future perspectives explain the prerequisite and provide a return path. This is not a rigid wizard: answers can be revised before launch, work interrupted and restarted, failed checks corrected, and features switched without losing session drafts.

## Explore the awkward cases

Use **Scénarios & état** in the top bar. Each scenario has an explicit start/reset, ordered real action buttons, the full relevant state in plain language, and free-play controls with prerequisites.

1. **Parcours complet:** decisions → plan → development → checks → human review.
2. **Analyse en échec:** first attempt fails; answers survive; retry succeeds.
3. **Reprise & consigne:** return through À traiter, pause the right feature, add its instruction and resume.
4. **Test en échec:** reject premature approval, correct, check again, review.

A second feature, **Navigation au clavier**, has independent context, branch, conversation and drafts. It lets observers detect recipient and scope mistakes when switching work.

## Deliberate simulation boundaries

- Model responses, elapsed work, changed files, check results, branch names and pause acknowledgements are fictional and labeled as such. In the product, state must come from actual server events; a pause request must remain pending until acknowledged.
- The new-idea screen demonstrates the same CSV case. It is not a general-purpose plan generator.
- The code sample is a review placeholder, not an implementation patch. No repository files are changed through the prototype.
- Conversation adds a simulated user message or instruction, with no agent response. Dictation, settings, merge and publication are outside this prototype.
- No localStorage or remote storage. Draft retention covers feature switching within the current page session only.
- A checkbox prevents accidental review approval in this demo; it is not evidence that a person read or understood the code.

## Evaluation and capture

Verification on 8 November 2026:

- Browser-driven completion of the four guided scenarios, plus new idea → read-only analysis, background analysis after feature switching, editable answers, retained per-feature drafts, pause/stop/restart and partial-result inspection.
- Direct instruction action opens the conversation in instruction mode and focuses its field; repeat use keeps it open. Draft text and message effect survive switching features. The other feature retains an independent empty draft and question mode.
- Filling the final answer updates the next useful action without removing focus. The review checkbox responds to Space; Tab then reaches the enabled review button.
- Full-page rendered captures inspected at 1440, 1280, 1100, 727 and 390 px widths, including questions, plan, running conversation, failed check, review and inbox. The 390 px view is a fallback, not a mobile product validation.
- Both inline JavaScript blocks pass `node --check`; artifact and documentation pass Prettier. The preview copy matches the standalone file, and the inline logo decodes to the exact original asset bytes. Production build inputs remain unchanged and do not include the prototype.
- The independent finish review requested three fixes: instruction action/mode, dynamic next action and review checkbox focus. Its verdict pass scored all three **resolved**, with disposition **ship**, limited to those corrections. No claim of end-user usability validation follows from this review.
- The Impeccable detector was attempted once but could not run because its engine was not installed and its cache was not writable. No detector findings or zero-findings verdict are available. The full production test suite was not rerun for this isolated HTML prototype.

The seven review captures are retained in the session artifact directory `feature-workspace-prototype`: `desktop.png`, `laptop-plan.png`, `conversation.png`, `failed-check.png`, `review.png`, `user-727.png` and `mobile.png`.

The artifact is ready for formative observation using the research report's task scenarios. The key outcomes are unassisted completion, first useful action, scope/recipient errors, mistaken completion, recovery and backtracking. Technical click-through checks and visual review establish prototype functionality, not intuitive use by the target population.

Do not absorb this shell into production or lift its reducer into orchestration. The reducer demonstrates presentation states and intentionally simplifies asynchronous acknowledgements. Once a design decision is validated, implement only that decision against the existing API contracts, and archive the disposable artifact on a `codex/` prototype branch with the observation record. No user validation has occurred yet.

The inline logo is an exact base64 encoding of the pre-existing selected asset `public/tesslane.png`; no raster was generated or altered for this prototype.
