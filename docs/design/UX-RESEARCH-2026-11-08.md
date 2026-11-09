# Tesslane: evidence for understandable workflows

Date: 8 November 2026. Research question: how can a complex web interface help developers orient themselves, understand ongoing activity, identify their next useful action, and follow work across time?

## Scope and interpretation

This research uses original publications and author or institutional copies. It separates experiments, explanatory theories, practitioner methods, and design guidance. Publication age alone does not invalidate a cognitive mechanism, but older laboratory interfaces cannot establish the performance of a contemporary coding-agent dashboard.

Local context comes from [PRODUCT.md](../../PRODUCT.md) and the [7 November audit](UX-AUDIT-2026-11-07.md), including its implementation follow-up. The audit describes problems before the redesign and reports subsequent technical validation. Its heuristic scores are editorial judgments. Its automated tests establish technical behavior in the exercised scenarios; they do not establish user comprehension, usability, or transfer to unfamiliar tasks. This research did not inspect the current rendered application, recruit users, execute a model, or operate a dashboard workflow. Consequently, the proposals below are hypotheses to evaluate, not newly observed defects.

The working interpretation of “intuitive” should be specific: a developer with a stated background can infer a useful action, predict its consequence, recognize the resulting state, and resume work without reconstructing hidden context. It should not mean “understandable to everyone without learning.”

## Evidence map

| Source                                          | Evidence type                                             | What it contributes                                   | Main transfer limit                                                            |
| ----------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| Blackler, Popovic & Mahar, 2007                 | Three empirical studies summarized by their authors       | Familiarity and first use                             | Consumer devices; coded intuition; familiarity is not randomly assigned        |
| Lewis & Rieman, 1993/1994; Wharton et al., 1994 | Task-centered method and theory-informed inspection       | Goal → action → feedback analysis                     | An evaluator's plausible story needs user validation                           |
| Pirolli & Fu, 2003                              | Cognitive model fitted to behavioral traces               | Information scent and navigation                      | Four people; unfamiliar web search; model fit is not redesign causality        |
| Hornof, 2001                                    | Controlled experiment                                     | Named visual groups and search                        | Artificial targets; group location was explicitly cued                         |
| Altmann & Trafton, 2004                         | Four controlled experiments                               | Interruption and task resumption                      | Student simulation; cue benefit depends on preparation conditions              |
| Sarter & Woods, 1995                            | Authors' converging operational and simulator research    | Mode awareness and automation surprises               | Aviation demands differ markedly from software work                            |
| Amershi et al., 2019                            | Guidelines, practitioner evaluation and expert validation | Capability, correction, consequences and control      | Relevance/clarity validation, not causal task-success evidence                 |
| Buçinca, Malaya & Gajos, 2021                   | Controlled human–AI decision experiment                   | Explanation, overreliance and effort trade-offs       | Simulated AI and a short nutrition task                                        |
| McGrenere, Baecker & Booth, 2002                | Six-week field study                                      | User-controlled simplified and complete interfaces    | Intermediate/experienced Word users; fixed condition order; perceived outcomes |
| McDougall & Isherwood, 2009                     | Icon identification experiment and regression analysis    | Function familiarity and icon–meaning relationships   | Student participants; repeated laboratory identification                       |
| Department for Education, 2026                  | First-party qualitative prototype research                | Scope, task labels and task-detail expectations       | Support-work domain; this report does not supply a participant count           |
| W3C cognitive guidance; GOV.UK patterns         | Official design guidance                                  | Clear steps, familiar controls and bounded task flows | Supplemental/practice guidance, not experiments establishing a layout effect   |
| Nielsen Norman Group, 2006/2020                 | Practitioner guidance and first-party applied research    | Progressive disclosure and nonlinear complex work     | Public articles do not establish effect sizes for Tesslane                     |

“Strong” below refers to confidence in the reported result within its study conditions. No source directly validates Tesslane's proposed layout.

## 1. Familiarity is a resource, not a universal interface property

**Primary source:** Blackler, A., Popovic, V., & Mahar, D. (2007), _Empirical investigations into intuitive interaction: a summary_, MMI-Interaktiv 13, 4–24. [Author-version full text](https://www.researchgate.net/publication/27469586_Empirical_investigations_into_intuitive_interaction_A_summary), especially methods and results §§2–3.

**Protocol and finding:** Camera tasks involved 20 participants; a remote-control study involved 30; a subsequent matched-groups redesign study used four interface groups of 15. Video and concurrent verbal protocols supported coding of first uses. Greater technology familiarity was associated with faster task completion and more intuitive first uses. The redesign experiment compared appearance, location, their combination, and the default interface; the combined redesign was faster than the location-only and default versions. [Blackler et al., full text](https://www.researchgate.net/publication/27469586_Empirical_investigations_into_intuitive_interaction_A_summary)

**Strength and limits:** Useful converging evidence, but small device studies and observer-coded constructs. Familiarity associations do not isolate every causal factor. “Appearance” included labels, shape, size and color; this is not evidence that decorative polish solves workflow confusion.

**Tesslane inference:** Investigate what developers already mean by feature, plan, run, review and approval. Familiar-looking controls need familiar consequences. A familiar Send button with an unexpected target can create a confidently wrong action.

## 2. Learnability is a sequence of justified actions

**Primary sources:** Lewis, C., & Rieman, J. (1993/1994), _Task-Centered User Interface Design_, [chapter 4, original text](https://www.hcibib.org/tcuid/chap-4.html); Wharton, C., Rieman, J., Lewis, C., & Polson, P. (1994), _The Cognitive Walkthrough: A Practitioner's Guide_, [institutional report copy](https://www.colorado.edu/ics/sites/default/files/attached-files/93-07.pdf).

**Contribution:** The walkthrough examines a concrete task action by action: whether the user has reason to pursue the required subgoal, can find the action, can connect it to that goal, and receives meaningful feedback. The authors explicitly distinguish inspection from testing with users. Their examples expose technically available actions that users have no reason to seek. [Lewis & Rieman, §§4.1–4.1.4](https://www.hcibib.org/tcuid/chap-4.html)

**Strength and limits:** A useful theory-informed diagnostic method, not an experiment proving that a particular navigation arrangement works. Its value depends on credible knowledge of users and tasks; design-team familiarity can conceal missing links.

**Tesslane inference:** Review complete work episodes, including return visits. “Answer → saved → plan updating → reviewable plan” needs understandable transitions, not merely present controls. Record the knowledge each step assumes before changing the layout.

## 3. Navigation cues must connect with the user's goal

**Primary source:** Pirolli, P., & Fu, W.-T. (2003), _SNIF-ACT: A Model of Information Foraging on the World Wide Web_. [Author-hosted full text](https://www.peterpirolli.com/ewExternalFiles/Pirolli-Fu%20UM2003.pdf), §§3–4.

**Protocol and finding:** The model was fitted to traces from four participants performing two unfamiliar web-search tasks each. Browser logging, eye tracking and think-aloud recordings supported the traces. Links with greater modeled relevance to the user's goal were chosen more often; declining information scent was associated with leaving a site. [Pirolli & Fu](https://www.peterpirolli.com/ewExternalFiles/Pirolli-Fu%20UM2003.pdf)

**Strength and limits:** A coherent computational account with a very small empirical base here. Multiple clicks from one person are not independent participants. Search behavior and retrospective model fit cannot establish that a particular dashboard label will improve task success.

**Tesslane inference:** A destination should explain why it is useful now: “Answer 3 questions for Checkout,” for example, offers more task information than an abstract engine destination. Evaluate where people expect a link to lead before measuring click speed.

## 4. Meaningful grouping can reduce search without hiding the work

**Primary source:** Hornof, A. J. (2001), _Visual Search and Mouse-Pointing in Labeled versus Unlabeled Two-Dimensional Visual Hierarchies_, TOCHI 8(3), 171–197. [Author-hosted full text](https://ix.cs.uoregon.edu/~hornof/downloads/ToCHI_2001.pdf); [DOI](https://doi.org/10.1145/502907.502908).

**Protocol and finding:** Sixteen experienced computer users searched experimental layouts of boxed consonant–vowel–consonant targets. Labeled conditions supplied both target and group label in a precue. A movement deadline separated search from pointing. Labeled groups were searched faster and more systematically than unlabeled groups. [Hornof, §§7–9](https://ix.cs.uoregon.edu/~hornof/downloads/ToCHI_2001.pdf)

**Strength and limits:** Controlled evidence for a narrow visual-search mechanism. Artificial labels and an explicit group cue remove much of the semantic uncertainty present in real products. It does not prescribe a card count, density percentage, or maximum number of controls.

**Tesslane inference:** Prefer groups that help someone locate their work—decisions, active work, results—over an accumulation of visually equal boxes. Test whether headings actually predict their contents. Removing comparison information can increase the work required to decide.

## 5. Resumption is a separate interaction problem

**Primary source:** Altmann, E. M., & Trafton, J. G. (2004), _Task Interruption: Resumption Lag and the Role of Cues_, Proceedings of the Cognitive Science Society. [Full paper](https://interruptions.net/literature/Altmann-CogSci04.pdf); [institutional proceedings record](https://escholarship.org/uc/item/18b4r661).

**Protocol and finding:** Ninety-six undergraduates took part in four experiments, 24 per experiment. A resource-allocation simulation was interrupted by a radar-classification task. The researchers varied preparation time and whether the primary display remained visible before interruption. Resuming took longer than uninterrupted actions. Cue availability produced a reliable benefit at the longest preparation interval, eight seconds; shorter intervals did not show the same reliable benefit, and the pooled cue effect was marginal. [Altmann & Trafton, methods/results](https://interruptions.net/literature/Altmann-CogSci04.pdf)

**Strength and limits:** Stronger support for a resumption cost than for an unconditional benefit of persistent cues. A trained simulation cannot predict a developer's recovery time after hours away.

**Tesslane inference:** Preserve the work object, unfinished draft and last meaningful transition when people return. Test recovery after an interruption; do not assume a breadcrumb or persistent sidebar alone solves it.

## 6. System state must support prediction, not just observation

**Primary source:** Sarter, N. B., & Woods, D. D. (1995), _How in the World Did We Ever Get into That Mode? Mode Error and Awareness in Supervisory Control_, Human Factors 37(1), 5–19. [DOI](https://doi.org/10.1518/001872095779049516); [author-uploaded full text](https://www.researchgate.net/publication/258138719_How_in_the_World_Did_We_Ever_Get_into_That_Mode_Mode_Error_and_Awareness_in_Supervisory_Control).

**Protocol and finding:** The authors combine operational incident accounts, transition-training observations and a scenario-based simulator investigation involving 20 airline pilots. They connect automation surprises with inadequate feedback, gaps in mental models and difficulty anticipating transitions, especially in unusual situations. Their analysis treats monitoring the automation itself as additional cognitive work. [Sarter & Woods, pp. 10–15](https://www.researchgate.net/publication/258138719_How_in_the_World_Did_We_Ever_Get_into_That_Mode_Mode_Error_and_Awareness_in_Supervisory_Control)

**Strength and limits:** Converging research by the investigators, not a randomized dashboard intervention. Aviation error rates and severity should not be transferred to Tesslane.

**Tesslane inference:** Near an action, expose its affected feature/run, current effective state and anticipated consequence. Distinguish waiting for the user, working, queued and failed with a usable explanation of what changes next. A status badge alone may leave those relationships unclear.

## 7. Human–AI guidance provides review questions, not proof of usability

**Primary source:** Amershi, S., et al. (2019), _Guidelines for Human-AI Interaction_, CHI. [Research-team full text](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf); [DOI](https://doi.org/10.1145/3290605.3300233).

**Protocol and contribution:** The authors consolidated prior recommendations, iterated the guidelines, and studied 49 HCI practitioners evaluating 20 AI-infused products through heuristic evaluation; an additional expert-validation phase followed. The resulting 18 guidelines address capabilities and limitations, timely context, dismissal and correction, uncertainty about intent, explanation, consequences and global controls. [Amershi et al., Table 1 and §§3–6](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf)

**Strength and limits:** Systematic, practitioner-tested guidance. The study assesses applicability and clarity; it does not demonstrate that applying all guidelines causes better end-user performance. Its products also predate current coding-agent workflows.

**Tesslane inference:** Explain the system's boundary at the moment it matters: what analysis changes, what execution changes, what needs permission and how to correct an unwanted result. Put recovery alongside a failure instead of requiring a search through the conversation.

## 8. More explanation can coexist with poor reliance decisions

**Primary source:** Buçinca, Z., Malaya, M. B., & Gajos, K. Z. (2021), _To Trust or to Think: Cognitive Forcing Functions Can Reduce Overreliance on AI in AI-Assisted Decision-Making_, PACMHCI 5(CSCW1), Article 188. [Author-hosted full text](https://www.eecs.harvard.edu/~kgajos/papers/2021/bucinca21trust.pdf); [DOI](https://doi.org/10.1145/3449287).

**Protocol and finding:** Of 260 US MTurk recruits, 199 were retained after the reported exclusions. Participants made food-substitution decisions with a simulated AI, comparing explanation designs, cognitive forcing interventions and no AI. Forcing interventions reduced overreliance on incorrect AI suggestions for identifying the carbohydrate source; the corresponding overall-choice overreliance difference was not significant. They did not significantly improve overall performance compared with simple explainable-AI designs. More demanding designs received worse subjective ratings. [Buçinca et al., §§3.5–4, 6](https://www.eecs.harvard.edu/~kgajos/papers/2021/bucinca21trust.pdf)

**Strength and limits:** Controlled evidence that preference, error detection and overall accuracy can diverge. Short, low-stakes decisions with simulated AI do not establish the right friction for code review.

**Tesslane inference:** Evaluate whether users detect a deliberately unsupported completion claim. A longer rationale is not verification. Put inspectable changes/checks near a review decision; reserve additional deliberation for consequential transitions rather than slowing every interaction.

## 9. Simplification should preserve stable access to needed functions

**Primary source:** McGrenere, J., Baecker, R. M., & Booth, K. S. (2002), _An Evaluation of a Multiple Interface Design Solution for Bloated Software_, CHI. [Author-hosted paper](https://www.cs.ubc.ca/~joanna/papers/CHI2002_McGrenere.pdf); [DOI](https://doi.org/10.1145/503376.503406).

Twenty intermediate/experienced Word users participated for approximately six weeks. A user-personalized interface with a full-interface toggle was compared with Word's adaptive menus. Reported navigation and control favored the prototype; these were principally perceived outcomes. The personalized condition came first, so order and exposure were not counterbalanced. One participant's logging data were incomplete. The result does not establish that every user needs a restricted mode, or that automatically hiding controls improves unfamiliar tasks.

**Tesslane inference:** Keep the common work path compact and the expert path identifiable and stable. Determine which details are secondary from observed tasks; do not move important evidence or recovery controls into a generic advanced drawer simply to reduce visible density.

## 10. An icon's meaning matters beyond its appearance

**Primary source:** McDougall, S., & Isherwood, S. (2009), _What's in a name? The role of graphics, functions, and their interrelationships in icon identification_, Behavior Research Methods 41, 325–337. [Publisher full text](https://link.springer.com/content/pdf/10.3758/BRM.41.2.325.pdf); [DOI](https://doi.org/10.3758/BRM.41.2.325).

The identification experiment analyzed 29 participants after one exclusion, using 72 target icons across 13 blocks. The relationship between icon and function was important early; familiarity with the function also contributed to identification as learning developed. These are predictive analyses of experimental identification, not a test that custom artwork improves an application's workflows.

**Tesslane inference:** Test what people think a symbol means before investing in its rendering. Distinctive artwork can preserve conventional metaphors and visible labels. The [W3C icon pattern](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p07-icons-used/) recommends familiar, unambiguous symbols close to their content and warns against dense icon clutter; this is supplemental accessibility guidance.

## 11. A close applied example: task-management confusion

**Primary source:** UK Department for Education, [Task visibility and management — user research findings](https://design-histories.education.gov.uk/trs-console/task-visibility-user-research-findings), updated 5 March 2026.

Operations and Support staff evaluated task-management prototypes. The report describes confusion when a destination's label suggested opening the task but led to administrative controls, disagreement over the meaning of Blocked, and a preference for relevant actions within task detail. It is a qualitative first-party report, without a participant count or controlled comparison sufficient to claim a universal effect.

**Tesslane inference:** Investigate action expectations and scope explicitly. A technically correct destination can still be wrong for the expectation its label creates. This example is closer to an administrative web workbench than a consumer-device experiment, but support-team expectations need not match developers'.

## 12. Practical patterns and their boundaries

### Clear orientation and controls

The [W3C clear-steps pattern](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o1p04-clear-steps/) recommends making completed, current and pending steps, plus important choices, easy to recover. Its [understandable-controls objective](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o1-understandable/) connects recognizable purpose, familiar terms and an explicit relationship between a control and the content it affects. These are supplemental cognitive-accessibility recommendations, not additional WCAG conformance requirements or quantified performance guarantees.

**Tesslane inference:** Orientation must survive a return visit. Keep the work name, effective state and outstanding decision visible where the action happens; avoid requiring a mental join between the selected feature and a separately scoped panel.

### Progressive disclosure and nonlinear work

[Nielsen's progressive-disclosure guidance](https://www.nngroup.com/articles/progressive-disclosure/) requires a usable split between frequent and secondary functionality, and clear access to the latter. Hiding the wrong capability merely relocates the difficulty. This is practitioner guidance, not a controlled trial of Tesslane.

[NN/G's complex-application research](https://www.nngroup.com/articles/complex-application-design-framework/) draws on eye tracking, practitioner interviews and remote observation. It identifies broad goals, variable sub-tasks and nonlinear work as characteristics of complex applications; the public article supplies no usable effect size for a particular screen arrangement.

**Tesslane inference:** Offer a comprehensible default continuation while preserving comparison, parallel execution, revisions and recovery. A mandatory wizard can obstruct real work. Details should open at the relevant decision, with a stable way back, rather than appearing in an indiscriminate secondary area.

### Task lists and grouped questions

[GOV.UK's multiple-task pattern](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/) is intended for longer, multi-task, potentially multi-session transactions. It recommends simplifying first, grouping related activities and using the smallest useful status vocabulary, expanding it when user research warrants. It allows task-order flexibility where possible. This does not establish that an inbox is a sufficient working surface after entering a task.

The [question-page pattern](https://design-system.service.gov.uk/patterns/question-pages/) starts with one question per page, but explicitly permits related questions together when research supports it, including internal services with frequent task switching. It also asks designers to explain why questions matter and avoid asking for already-provided information again.

**Tesslane inference:** Preserve the user's accepted choice of all feature questions in one place. Group decisions by purpose and make their consequences understandable; the choice does not require every recommendation, diagnostic and historical detail to have equal prominence.

## Current code observations and hypotheses

These facts were checked in the current source after the redesign. They are not fresh rendered observations, user-test findings, or demonstrated explanations of the reported confusion.

| Current source fact                                                                                                                                                                               | Plausible comprehension risk                                                                          | Test                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `main.tsx` supplies feature-filtered agents to `Swarm`, while `GitView` loads project Git history. These appear as sibling primary destinations, Agents and Changes.                              | Similar navigation levels can suggest the same scope while opening different scopes.                  | Before and after a feature switch, ask users which work they believe each view includes.                                        |
| `workflow.ts` supplies Analyze feature as a next-action label; the corresponding `WorkInbox.tsx` row calls `openFeature`, which navigates to detail. The analysis command is a subsequent action. | An action-sounding label can suggest that analysis has started when it has only opened a destination. | Observe the first action and then check what the participant believes occurred.                                                 |
| Conversation retains an explicit independent recipient, and the feature page provides a button to open its conversation.                                                                          | This protects drafts but still makes context alignment a user task.                                   | Switch between inspection and writing with a draft present; check both orientation and accidental retargeting.                  |
| `WorkspaceSettings.tsx` has useful section navigation, but model profiles, engine choice, effort and advanced selection remain different concepts.                                                | Better grouping may leave the relationship between choices unexplained.                               | Give a concrete goal about authorization or verification; measure whether users find the setting and predict its actual effect. |

Source entry points: [main.tsx](../../src/web/main.tsx), [WorkInbox.tsx](../../src/web/WorkInbox.tsx), [workflow.ts](../../src/web/workflow.ts), [WorkspaceSettings.tsx](../../src/web/WorkspaceSettings.tsx).

## Design hypotheses to evaluate in Tesslane

These are research-informed proposals, not published findings about this product. The examples are illustrative copy, not a final information architecture.

| Hypothesis                                                           | Concrete candidate                                                                                                                    | Evidence connection                                          | What would disconfirm it                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| One persistent work object can anchor orientation                    | A feature header names the feature, its stage, current condition and the relevant plan/run revision                                   | Familiarity; mode awareness; walkthrough method, §§1–2 and 6 | Users still describe the wrong target, or the header consumes attention without helping             |
| A next action needs a reason and consequence                         | “3 answers needed before updating this plan”; action names the change it will cause                                                   | Action-goal association; human–AI consequences, §§2 and 7    | Users follow the emphasis but cannot predict its effect or distinguish planning from execution      |
| Monitoring and intervention should be distinguishable                | Clearly say when work is progressing and no response is required; bring a blocker to its exact decision                               | Automation monitoring, §6                                    | People repeatedly interrupt healthy work, miss blockers, or believe silence means a stalled process |
| Details should support the decision they belong to                   | Scope and acceptance criteria near plan review; change/check evidence near result review; execution diagnostics available when needed | Task-centered inspection and meaningful grouping, §§2 and 4  | Useful comparison becomes harder, or critical evidence is routinely missed behind disclosure        |
| Return visits need an explicit recovery path                         | Preserve draft and local position; summarize what changed since the last visit and the unresolved decision                            | Resumption research, §5                                      | Users must reconstruct their intent or rely on memory to select the correct continuation            |
| Recommendation acceptance and evidence review need distinct meanings | Show a recommendation as editable advice; show observed checks as evidence with provenance                                            | Reliance experiment, §8; product verification principle      | People treat a proposed answer as an executed check or approve an unsupported result                |

A compact example for testing is: “Checkout → Plan → Waiting for your answers → 2 unresolved decisions → Save answers and update plan.” After submission, the interface must make saving, analysis, completion and failure distinguishable. A different example is “Checkout → Execute → Running → No response needed → Latest verified event.” Neither example implies that the entire product should become a mandatory linear wizard: concurrent features, revisions and recovery remain real work.

## Candidate interaction contract

This is a proposed design direction inferred from the source review, not a validated new specification. Anchor daily work in one persistent feature workspace. The inbox identifies which feature needs attention; entering it preserves scope through clarification, plan review, execution and result review. Agent and Git views are inspectable perspectives on that work, with explicit project-wide alternatives. Keep the existing backend, permission rules and evidence provenance authoritative.

At each meaningful state, the interface should answer:

1. Which project and feature does this concern?
2. What has actually happened, and what is happening now?
3. Who must act: the user, an agent, or a dependency?
4. What useful action is available, and why?
5. What will happen after that action, including whether code can change?

An illustrative handoff might say: “Your decisions are saved. Tesslane is updating this feature's plan. No implementation has started.” On completion: “The revised plan is ready. Review the scope and tickets before starting.” Failure should identify which step failed and the safe continuation. These messages describe actual recorded transitions; they must not invent progress, completion, timing or certainty.

This direction preserves inspection and expert controls. A primary continuation does not justify hiding Stop, recovery, evidence or scope. Nor should selecting an agent silently move an existing draft. The task model must accommodate loops, parallel features and return visits, rather than implying that all work is a single irreversible sequence.

## How to validate the next design

The [GOV.UK moderated-testing method](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing) recommends realistic goals, neutral instructions and observation without revealing the route. Its [benchmarking guidance](https://www.gov.uk/service-manual/measuring-success/usability-benchmarking-a-website-or-whole-service) separates actual completion, time, abandonment and mistaken completion from perceived difficulty and confidence. These are methods, not numerical evidence that Tesslane is currently usable.

### Participants and comparison

Use an initial formative round of roughly six relevant developers, deliberately including people new to Tesslane, occasional returning users, and experienced agent-tool users. Include keyboard, voice or other access needs in recruitment. This is a proposed practical sample, consistent with [GOV.UK's small-round guidance](https://www.gov.uk/service-manual/user-research/plan-user-research-for-your-service); it cannot estimate population success rates. Fix the largest problems and test again with fresh participants. A later quantitative benchmark requires a suitably designed larger sample.

Compare the current interface with a low-fidelity, feature-centered candidate using equivalent content and task outcomes. If people see both, alternate the order and account for practice effects. A prototype does not need to execute a real engine: use recorded/simulated states, including a failure, and keep display fidelity comparable enough not to turn the exercise into an aesthetic preference test.

### Tasks and observable outcomes

Give goals rather than navigation instructions. Select a small relevant subset per participant; do not require every scenario in one session.

| Scenario         | Neutral goal                                                                                  | Observable success                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Initial intent   | Prepare a plan for a small requested change without modifying code.                           | Starts the correct analysis and understands what has and has not begun.                                                   |
| Clarification    | Continue the chosen feature using the supplied decisions until there is a reviewable plan.    | Answers in the correct feature, recognizes saving/analysis/completion, does not start execution accidentally.             |
| Return visit     | Resume the interrupted work and establish what needs attention.                               | Identifies scope, latest meaningful event, unresolved issue and next action without reconstructing the history manually.  |
| Intervention     | A new constraint must be taken into account during the ongoing work.                          | Reaches a compatible destination, understands the instruction's scope, and distinguishes receipt from actual application. |
| Review           | Decide whether the result is ready to integrate; a supplied scenario includes a failed check. | Finds relevant changes and evidence, recognizes the failure and chooses an appropriate correction or continuation.        |
| Settings variant | Configure a meaningful check or change when plan approval is required.                        | Finds the right control, predicts its effect and retains the intended permissions.                                        |

Record unassisted completion, first relevant action, mistaken completion, scope errors, help requests, backtracking and recovery after interruption. Track time to the first useful action and total task time as diagnostic measures; use a separate replay/probing pass to ask what people expected each action to do. This avoids treating answers elicited by coaching as evidence of discoverability. Confidence/ease ratings complement observed correctness.

Do not set an invented universal ten-second or three-click threshold. Agree product-specific acceptance criteria before the next round: users must distinguish analysis from execution, identify the affected work, recover saved answers after a failed analysis, and recognize unresolved verification failures. A small round with no observed critical mistake is a reason to continue evaluation, not proof that every user will succeed.

### Concrete next deliverables

Before another broad implementation pass, produce the smallest reviewable set: a map of actual task/state transitions, a single-feature workspace prototype covering both success and failure, and an observation sheet for the scenarios above. Preserve the accepted inbox and grouped-question choices while testing whether the path after entry is understandable. The technical architecture can remain unchanged throughout.

## Claims this evidence does not justify

- There is a universally intuitive navigation model, vocabulary, or screen layout.
- A fixed number of visible choices is safe or unsafe; “7 ± 2” does not provide a dashboard control limit here.
- Three clicks is an appropriate success criterion. A short route with weak cues can still be incomprehensible.
- Fewer choices or less visible information always improves complex work. Comparison, correction and verification can require simultaneous context.
- A familiar visual style establishes a correct mental model of unfamiliar automation.
- More explanation, confidence language, or a fluent rationale establishes correctness or calibrated reliance.
- Technical test success, a heuristic score, or subjective preference alone demonstrates an understandable workflow.

## Research limitations and next evidence needed

This is a targeted primary-source review, not a systematic review or meta-analysis. Selection favors mechanisms relevant to the reported problems; it cannot establish publication-bias estimates, pooled effects or causal improvements for Tesslane. The source set contains older device and aviation work, very small model-validation samples, laboratory simulations and one short human–AI task. Those differences are recorded rather than averaged away.

Most importantly, the current evidence does not locate the remaining failure in the redesigned product. Candidate explanations include unfamiliar terminology, weak action cues, ambiguous transitions, competing contexts, or a mismatch with the user's desired work sequence. Observe representative developers attempting real work episodes, then distinguish failures of finding, understanding, predicting, completing and resuming. Compare those observations with the hypotheses above before committing to another broad visual refit.

Source-access note: the Colorado walkthrough PDF opened but exposed no machine-readable body through the browser tool; its original authors' readable book chapter supplies the operational method used here. The DRS download of the earlier Blackler paper returned HTTP 403, so the detailed claims use the authors' accessible 2007 summary instead. The eScholarship record challenged automated access; the complete Altmann–Trafton paper was read through its research archive copy. No unavailable full-text statistics were inferred from abstracts.
