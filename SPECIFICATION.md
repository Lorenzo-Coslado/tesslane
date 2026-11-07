# Tesslane Product and Technical Specification

Status: consolidated specification following the validated product interview.

Date: 7 November 2026.

Working English descriptor: **Local orchestration for coding agents.**

Tesslane is an open-source tool that turns development intentions into verified changes through visible, controlled orchestration of coding agents. A developer installs its skill, invokes it in a codebase, and runs a setup script that prepares a project-specific dashboard on their computer.

This specification records the agreed product behavior, V1 scope, reference architecture, and acceptance criteria. It does not claim that the application, integrations, packaging, or performance checks have already been implemented. The concrete runtime baseline is Node.js, prepared automatically by the script; the remaining technical validations are listed in section 22.

The canonical vocabulary is defined in [GLOSSARY.md](./GLOSSARY.md).

## 1. Product purpose

### 1.1 Intended users

Tesslane serves both an individual developer with informal todos and a developer working in a codebase with established engineering practices. The first real pilot is the project's author working alone. Existing team practices will be exercised through representative fixtures until real team usage is available.

The tool adapts to the codebase's conventions, instructions, checks, and existing sources of work. It can propose improvements to the organization of work, but an existing system is not automatically replaced.

### 1.2 Product responsibility

Tesslane is responsible for the execution of development work by agents: clarification, execution planning, dependencies, delegation, model assignment, worktree isolation, observation, verification, review, and integration.

Existing trackers remain responsible for coordination between people, including human assignments, team priorities, sprints, and shared backlogs. Tesslane can select or import a need, preserve its external reference, and prepare a result to return to the originating tool. Its local execution order does not silently change the team's priorities.

For a developer without a tracker, Tesslane provides local features and tickets sufficient to plan and execute agent work. They are not a distributed replacement for an issue tracker.

### 1.3 Definition of a useful first release

A developer must be able to take a real feature from an initial description to a reviewed and verified contribution, integrated into its designated branch, while inspecting and controlling the process from the dashboard.

The same release must demonstrate useful parallel execution, dependency-constrained sequential execution, a mixed Codex and Claude Code run where both are connected, and recovery from an interruption.

## 2. Validated delivery boundaries

### 2.1 Included in V1

| Area | Required behavior |
| --- | --- |
| Delivery | Open-source repository containing the skill, scripts, engine, and dashboard delivery components. |
| Entry points | Invocation from a supported coding-agent host or direct execution of the project launch script or command. |
| Execution location | The user's computer, with native support for macOS, Windows, and Linux. |
| Project scope | One project-specific dashboard and execution context; an installation can be reused by multiple projects separately. |
| Work input | Dashboard conversation, pasted descriptions or todos, local files, and manually attached external ticket references. |
| Clarification | Codebase-aware questions and recommendations when material information is missing. |
| Planning | Features, optional decomposition into tickets, acceptance criteria, and explicit dependencies. |
| Engines | Codex and Claude Code as first-class integrations, with either one sufficient to start. |
| Mixed execution | Different agents in the same run may use different connected engines. |
| Models | Task-aware profiles, supported reasoning settings, bounded escalation, and authorized fallback. |
| Control | Planning, Assisted, and Autonomous modes; scoped approvals; pause, stop, and recovery. |
| Dashboard | Overview, Features and Tickets, Swarm, and Git views, plus chat, contextual details, settings, and pending decisions. |
| Evidence | Available conversations, tool events, command outputs, diffs, checks, reviews, and integration outcomes. |
| History | Consultable run history and the records needed to investigate decisions and failures. |
| Data | Local SQLite persistence, a durable event journal, backups, and restoration. |
| Presentation | An English interface and primary documentation, with agent conversations in the user's language. |

### 2.2 Explicit exclusions

The following are outside V1:

- A hosted service, commercial hosting platform, or mobile application.
- A multiproject overview or organization-wide control plane.
- A shared dashboard through which multiple people control the same running Swarm.
- Human work allocation, ticket reservations between developers, shared-ticket locks, or ticket synchronization through Git.
- Synchronization of SQLite files or automatic sharing of full agent histories between people.
- Attachment or discovery of agent sessions started independently outside Tesslane.
- A complete replacement for existing trackers or a general-purpose Git client.
- Direct integrations with every tracker or every coding engine.
- A guarantee that all providers expose identical events, reasoning, limits, or controls.
- Full historical graph reconstruction with an interactive time-travel cursor.
- A learned routing system that silently rewrites the model-selection policy from a small number of observations.

GitHub Copilot, Cursor, Antigravity, GLM, and Kimi remain desired future integration candidates, subject to documented capabilities and account access. Direct tracker connectors are subsequent work; V1 must preserve the references and execution contracts that make them possible.

## 3. Primary user journeys

### 3.1 First use in a project

1. The developer retrieves Tesslane's repository and installs the skill for their selected host.
2. They invoke the skill from their target codebase.
3. The skill invokes Tesslane's setup script with that project as its target.
4. The script checks or prepares Tesslane's local runtime and application components.
5. Tesslane performs a proportionate diagnostic of the project and available engines.
6. The user chooses the work organization and essential execution settings.
7. The script starts the local engine and opens the project's dashboard in the browser.
8. The user describes an outcome or supplies an existing need and starts the clarification and execution workflow.

This journey is the distribution requirement. It does not depend on publishing or installing Tesslane through npm.

### 3.2 Returning to a configured project

The same entry point recognizes the project, locates its existing state, and opens its dashboard. It reuses a compatible active engine rather than starting a duplicate engine for the same local project context.

Previously answered setup questions are not repeated. Changed prerequisites, expired connections, incompatible configuration, or interrupted work are presented as specific items requiring attention.

### 3.3 Working entirely from the dashboard

After launch, the user can describe work, answer clarification questions, edit the plan, select models, approve actions, inspect agents, view changes, pause or stop work, and request integration without returning to the original coding-agent chat.

The skill remains an entry point and an interface to the same engine. It must not maintain a separate execution state that disagrees with the dashboard.

### 3.4 Working from an existing ticket

The user supplies the ticket's relevant content and external reference. Tesslane clarifies the execution need and builds its local plan. It retains the reference throughout the resulting tickets, runs, evidence, and contribution.

At completion, it prepares a concise result containing the outcome, code changes, verification evidence, unresolved limitations, and branch or pull-request reference when one exists. Automatic publication requires an implemented connector and an authorized action; V1 always offers the result inside the dashboard.

## 4. Installation and initial configuration

### 4.1 Application installation and project configuration

The application installation contains reusable skill instructions, scripts, executable engine components, and the built dashboard. A project's configuration and local execution state belong to that project context.

Opening a project does not require copying Tesslane's frontend source into the target codebase or making Tesslane a dependency of the target application's package manifest. Target codebases can use languages other than TypeScript.

### 4.2 Runtime preparation

Node.js is the baseline runtime. The setup script prepares a compatible, versioned runtime for Tesslane automatically, including a tool-managed runtime when required. Users are not expected to choose between Node.js and Bun or manage a global Node version for this product.

The dashboard is delivered precompiled. End users do not run a frontend development server to use it. Release assembly and a documented source-build path must produce the components consumed by the setup script.

The exact assembly format is validated through the packaging spike. An archive containing a runtime, application bundle, and dashboard assets is a reference option. A single executable is an optional technical optimization, not a product requirement. Bun is an alternative only if a concrete compatibility or distribution benefit is demonstrated.

### 4.3 Missing external tools

The script detects Git and the supported coding engines, explains missing requirements, and offers the official installation steps when needed. It must distinguish preparation of Tesslane's components from installation of third-party tools.

Connections use each engine's official authentication mechanisms. Tesslane must not collect passwords or implement a homemade reuse of subscription tokens. One connected engine is sufficient to configure and use a project; mixed-engine execution requires both relevant connections.

### 4.4 Proportionate project diagnostic

The diagnostic starts with directly relevant files and expands when findings justify it. It identifies:

- Repository and worktree context, current branch, and existing uncommitted work.
- Applicable instructions and development conventions.
- Languages, manifests, and relevant toolchain requirements.
- Existing sources of work, specifications, and task references where discoverable.
- Available build, lint, type-check, test, and other verification commands.
- Existing integration practices and constraints.
- Connected engines and capabilities that can be discovered through supported interfaces.

Deterministic inspection should establish facts before invoking an agent for interpretation. Deeper agent-assisted analysis requires a connected engine. Unknown information remains visibly unknown; the user is asked only for facts or decisions that cannot reasonably be obtained from the project or tools.

### 4.5 Organization proposal

Tesslane presents the detected organization and offers to preserve it, complement it, or replace the relevant parts with a proposed structure. It explains the concrete consequences before changing existing organizational files.

For an unstructured project, it proposes local features, tickets, criteria, and dependency relationships. For an established project, it respects the existing sources and maps work into a local execution plan. It does not create a new shared team workflow.

### 4.6 Progressive setup

The essential first-run choices are the work organization, connected engines, autonomy mode, execution profiles, permitted fallbacks, and resource limits. Advanced settings remain accessible later.

Assisted is the default autonomy mode. The setup concludes with a concrete recap of effective settings, proposed project-file changes, and remaining prerequisites. Setup choices are persisted so returning to a project is direct.

## 5. Work model and clarification

### 5.1 Features and tickets

A feature is the main unit of outcome and progress. Its analysis determines whether decomposition is useful. A small feature can be represented by one ticket without imposing an additional level of work management in the UI.

Tickets are created when they make delivery, verification, ownership by agents, or independent execution clearer. There is no mandatory epic, sprint, or fixed number of tickets. Individual tool calls, routine inspections, and minor implementation steps stay in execution records rather than becoming backlog items.

Standalone fixes and maintenance work can use the same execution model without inventing a larger feature.

### 5.2 Ticket execution contract

An executable ticket identifies:

- The intended result and its relationship to the feature.
- Acceptance criteria and relevant verification methods.
- Dependencies and inputs expected from predecessor work.
- Relevant code areas and known integration boundaries.
- Constraints, unresolved questions, and applicable project decisions.
- External ticket reference when present.
- Its current plan revision and applicable execution policy.

The planner may refine this contract as facts emerge. Scope changes affecting other tickets or the feature's outcome return to the coordinator and follow the autonomy policy.

### 5.3 Clarification workflow

Clarification follows a decision tree. Questions are grouped into rounds containing the decisions whose prerequisites are already known. Each question gives a recommendation and enough context to understand its consequences.

The agent researches discoverable facts itself, delegating factual exploration when justified. It must not ask the user to identify files, capabilities, or conventions that are readily inspectable.

Resolved questions are recorded as durable decisions. A clear, small change proceeds without an unnecessary interview. A materially ambiguous feature is not treated as ready by silently inventing its requirements.

### 5.4 Dependencies and progress

Ticket dependencies form an acyclic execution graph. Invalid cycles are rejected with an explanation of the conflicting relationships.

Progress is supported by ticket outcomes, acceptance evidence, and feature milestones. Activity, token usage, and the number of completed tool calls do not establish completion. A simple ticket count can be shown as a count, but must not masquerade as an accurate estimate of remaining effort.

## 6. Swarm responsibilities and hierarchy

### 6.1 Roles

| Role | Responsibility | Activation |
| --- | --- | --- |
| Coordinator | Understand the outcome, maintain the plan, propose delegations, identify blockers, and arbitrate scope. | Required responsibility for a run. |
| Analyst | Inspect the codebase or documentation and resolve factual uncertainty. | On demand. |
| Implementer | Produce the change described by a ticket or mission. | As required by executable work. |
| Validator | Assess acceptance criteria and checks requiring judgment. | Agent assistance when programmatic checks are insufficient. |
| Reviewer | Independently examine a coherent lot and report actionable findings. | Required before integration of a lot. |
| Integrator | Resolve difficult integration work and assess the combined result. | Agent assistance when normal Git operations and checks are insufficient. |
| Feature lead | Coordinate a feature with multiple substantial pieces of work. | Optional intermediate responsibility. |
| Specialist | Address a focused concern such as interface behavior, security, performance, or migration. | When the task warrants specialization. |

Roles are responsibilities, not permanently running processes. The minimal agent structure is coordination, implementation, and independent review. Check execution, dependency tracking, normal Git operations, and policy enforcement belong to the engine wherever they can be performed reproducibly.

A reviewer must be independent from the implementation attempt it evaluates. Independence does not require a different model vendor, but does require a separate review mission and a context that permits an independent assessment.

### 6.2 Adaptive hierarchy

The initial logical hierarchy is bounded at three levels, counting the project coordinator as level one:

1. Project coordinator.
2. Optional feature lead.
3. Executors or specialists delegated by that lead.

Without a feature lead, executors can be direct children of the coordinator. Simple work uses the smallest effective structure.

This is a Tesslane execution limit, not a claim that all providers support the same native nesting. Adapters map the logical hierarchy to supported engine mechanisms. Requested delegations, observed native children, and effective limits must remain distinguishable.

### 6.3 Engine authority

The coordinator proposes plans and delegation. The engine enforces dependency readiness, admission, policies, resource bounds, lifecycle transitions, and required evidence. Routine scheduling must not require a new model call for every event.

An agent may request more resources, a different model, or further delegation. It cannot independently expand its permissions, spending allowance, or permitted scope. Limits inherited by children cannot exceed their parent's applicable authorization.

## 7. Scheduling and code isolation

### 7.1 Conditions for parallel execution

A ticket may start when its dependencies and required decisions are satisfied, its execution contract is sufficiently clear, and policy and resource limits permit admission.

Dependency independence alone is insufficient to establish safe concurrency. The engine also considers overlapping code changes, shared test resources, integration assumptions, and other known execution conflicts. A newly discovered conflict can pause delegation and trigger replanning.

### 7.2 Worktrees and branches

Each concurrent writing lot uses a separate Git worktree and branch based on an identifiable revision. Read-only missions may share an appropriate immutable project view.

Worktrees prevent simultaneous edits to the same checkout; they do not eliminate semantic conflicts. Contributions with overlapping assumptions can still require sequential execution or coordinated integration.

The user's existing uncommitted changes must be preserved. Initialization and execution must not discard them or silently attribute them to an agent.

### 7.3 Integration process

The engine orders integration of reviewed lots into the designated branch and runs the relevant combined checks. An agent can assist with a conflict or difficult decision, after which the resulting code must be reviewed or rechecked as appropriate.

Review evidence and approvals are tied to the code revisions they evaluated. Material changes invalidate affected evidence. A clean review of an earlier diff is not authorization to integrate a later, changed contribution without reassessment.

Existing repository policies and the configured autonomy rules govern commits, pushes, pull requests, merges, and deployments.

## 8. Model selection and adaptation

### 8.1 Selection goals

The primary objective is a verified result meeting the task's criteria. The policy then seeks to reduce delivery time and consumption within configured limits. Balanced is the default routing strategy, with Economic and Maximum Quality strategies available as configurable alternatives. A project-level routing strategy is distinct from the Fast, Balanced, or Deep execution profile assigned to an individual mission.

### 8.2 Execution profiles

| Profile | Candidate work |
| --- | --- |
| Fast | Focused repository scans, inventories, clear repetitive work, and narrowly bounded changes. |
| Balanced | Normal implementation, test development, and analysis of a well-defined change. |
| Deep | Ambiguous requirements, architecture, difficult diagnosis, sensitive migrations, and demanding reviews. |

These are capability intentions rather than permanent model identifiers. The role provides an initial preference; the actual task can raise or lower it. Two implementers may receive different profiles because their tasks differ.

### 8.3 Capability discovery

The adapter discovers the models, settings, and relevant limits available to the connected account through supported interfaces. Tesslane must not assume that a model shown in documentation is available to every user.

Model identity, reasoning effort, and any provider speed tier are separate settings. Supported values vary by model and engine. The policy filters incompatible candidates before selecting a configuration.

Every agent records its requested and effective engine, model, supported reasoning setting, execution profile, selection rationale, and subsequent changes. Provider substitutions must not be silently displayed as the originally requested model.

### 8.4 Initial routing

Routing considers the role, ambiguity, expected difficulty, scope of change, impact of failure, available context, verification methods, account access, quotas, concurrency, and configured limits.

The engine starts with an appropriate profile rather than always beginning with the smallest model and waiting for failure. Initial mappings are explicit and editable. Provider guidance can seed them; it does not establish a measured ranking for Tesslane's workloads.

### 8.5 Quality escalation

Two attempts without meaningful progress on the same problem trigger a diagnostic by default. The threshold is configurable and must be recorded in the effective policy.

The diagnostic distinguishes insufficient information, an incorrect plan, environment problems, implementation defects, integration conflicts, and a possible model-capability limitation. Responses can include context repair, a revised strategy, a specialist, more reasoning, another model, or ticket decomposition.

Progress must be supported by changes in acceptance evidence or the diagnosed problem, not solely by an agent's confidence. Retries and escalations are bounded. Once authorized limits are exhausted, the run preserves its work and presents a blocker with possible decisions.

### 8.6 Stable assignment and handoff

An assignment remains stable during an attempt unless a supported intervention is required. Reassessment occurs at meaningful boundaries: a completed step, diagnosis, next attempt, or new ticket. A simpler subsequent step may return to a lighter profile.

A model change takes effect according to the adapter's supported execution boundary. Tesslane must not promise to swap an already-generating response or reconfigure all active native children instantaneously.

A cross-engine handoff creates an appropriate new execution context containing the mission, decisions, code revision and diff, relevant findings, check results, remaining work, and constraints. It does not assume portable provider-internal state or a lossless transfer of hidden reasoning.

### 8.7 Availability and quota fallback

Each project has an authorized fallback list. A fallback candidate must have the required capabilities and be connected and permitted. Otherwise the work waits with an actionable explanation.

Quality escalation and availability fallback are separate decisions. Authentication failures, quota exhaustion, environment errors, and model overload are not interchangeable failure classes.

An API billed separately can be used only when explicitly configured and enabled. Fallback must not silently change the user's billing arrangement.

### 8.8 Improving the policy

V1 records acceptance outcomes, review findings, correction attempts, elapsed time, and the consumption or quota information actually exposed by each engine. Unknown measurements remain unknown; subscription consumption is not presented as a fabricated per-run monetary cost.

Tesslane proposes routing improvements based on comparable tasks and sufficient evidence. Small samples are hypotheses. Automatic policy learning is subsequent functionality that requires an explicit activation and bounded behavior. This does not prevent the rule-based adaptation and escalation required in V1.

## 9. Context and communication

Each agent receives a targeted context: the global objective, its mission, applicable decisions and policies, relevant repository instructions, predecessor results, and code references needed for its work.

The complete raw history of every agent is not automatically injected into every other agent. Agents can request or retrieve additional relevant information. Durable decisions and acceptance evidence are shared independently of transient conversation text.

Direct agent-to-agent communication is allowed and recorded with the sender, recipient, related work, and time. A direct request that changes the global plan or scope returns to the coordinator's authority.

Task dependencies, delegation ancestry, and communication edges are distinct relationships. The dashboard must not present a message exchange as proof that a ticket dependency has been satisfied.

An agent's output is a reported result until the applicable evidence and checks establish its status. Shared summaries retain references to the underlying findings and artifacts.

## 10. Autonomy and approvals

### 10.1 Modes

| Mode | Behavior |
| --- | --- |
| Planning | Inspect and clarify the project and prepare work. Do not modify target application code without a transition or explicit authorization. |
| Assisted | Obtain approval for a defined plan or lot, then execute within that approved scope. Escalate decisions outside the authorization. |
| Autonomous | Continue planning, delegation, implementation, and checks within configured permissions and resource bounds. Ask for intervention when progress requires an unavailable decision or exceeds those bounds. |

Assisted is the default. Planning may persist Tesslane's own plans and configuration; it is not an assertion that every diagnostic command is free of side effects. Commands must obey the effective permissions.

### 10.2 Policy scope

The policy belongs to the project, with permitted per-run overrides. It addresses filesystem access, network access, target-project dependency installation, Git actions, external publication, merge and deployment actions, concurrency, consumption bounds, and escalation limits.

Tesslane policy is constrained by the engine's actual permissions and any applicable managed requirements. A prompt or UI setting cannot manufacture permissions that the underlying tool does not provide.

### 10.3 Approval behavior

Approvals identify the action, scope, relevant work revision, and consequences. Low-impact actions within an already approved lot do not each require another identical prompt. A material expansion is a new decision.

The dashboard centralizes pending approvals and clarification requests. A user can inspect the plan, diff, check evidence, or requested permission before responding. Superseded requests are marked as such and cannot authorize stale work.

## 11. Execution lifecycle and recovery

### 11.1 Work states

The implementation must represent clarification, readiness, queueing, execution, verification, review, readiness for integration, integration, blocking, and cancellation without conflating them.

The following reference state model provides explicit meanings; exact serialized identifiers are implementation details:

| State | Meaning |
| --- | --- |
| Draft or needs clarification | The need or execution contract is incomplete. |
| Ready | The work is sufficiently defined; execution constraints are known. |
| Queued | Work is selected for execution and is waiting for admission or a dependency. |
| Running | An admitted attempt is active. |
| Verifying | Relevant acceptance checks are being performed. |
| Reviewing | Independent review is in progress. |
| Ready for integration | Required lot-level verification and review are satisfied. |
| Integrated | The contribution has joined its designated target revision and required combined checks have completed. |
| Blocked | Progress requires a fact, decision, resource, or repair. |
| Cancelled | Further work has been deliberately abandoned; existing artifacts remain identifiable. |

Run and agent lifecycles additionally distinguish starting, awaiting approval, pausing, paused, stopping, interrupted, recovering, completed, and failed. A request to pause is not displayed as an acknowledged pause while work is still active.

### 11.2 Pause and stop

Pause suspends new delegations and requests safe stopping boundaries for active agents. The dashboard shows which activities are still settling and which have acknowledged the pause.

Stop requests interruption of the selected run, feature, or project activity. It preserves code changes, evidence, and journals. It is not an automatic reset or rollback.

Process interruption, native subagents, background commands, and child-process cleanup require adapter-specific handling. Activities whose termination cannot be confirmed remain visibly unresolved.

### 11.3 Application lifecycle

Closing the browser tab does not stop the engine. The engine operates in the background on the local computer. Machine sleep, shutdown, a crashed engine, or loss of access to a provider can interrupt work; local execution does not imply continuous availability.

On restart, Tesslane reconciles recorded state with processes, engine sessions, Git worktrees, and artifacts before offering recovery or continuing permitted work. Reconnection must not create a duplicate run merely because the browser lost its connection.

### 11.4 Durable execution boundaries

Run admission, important state transitions, and relevant operation identities are persisted. The event journal and current state must remain consistent across a committed transition.

Recovery distinguishes an action known not to have started, one known to have completed, and one with an uncertain outcome. An uncertain action is reconciled or presented for intervention instead of being blindly repeated.

A checkpoint supports recovery; it does not guarantee exactly-once model calls, commands, Git writes, or other external effects. Historical event replay reconstructs observations and must never execute those effects again.

## 12. Verification, review, and completion

### 12.1 Proportionate verification

Verification follows the change and the project. Relevant commands and meaningful acceptance checks are discovered or explicitly configured. Checks expand for sensitive or cross-cutting work and repeat when a change or unresolved result justifies doing so.

Tesslane must not create tests that simply mirror an implementation or run a whole suite repeatedly after every minor event. The evidence must explain what was checked, against which revision, and the remaining limitations.

### 12.2 Independent review

Each integration lot receives independent review of its relevant scope. Findings are tied to code and acceptance criteria. Blocking findings return the work for correction; passing tests do not automatically dismiss a substantive review finding.

### 12.3 Completion rules

A ticket is finished when its result is verified and the required review of its lot has no unresolved blocker. Its contribution's integration status is separately visible until integration has occurred.

A feature is complete when its required contributions have been integrated into the designated branch and its combined acceptance criteria are satisfied. Cancelled optional work must not silently remove a required acceptance criterion.

Deployment has its own state and follows the project's policy. An integrated local feature is not automatically described as deployed.

Known unrelated baseline failures or unavailable checks are recorded explicitly. Any acceptance of a verification limitation follows the applicable policy rather than silently reporting all checks as passed.

## 13. Observability and event history

### 13.1 Observable relationships

Records must identify the project, feature or ticket, run, attempt, agent, parent agent when applicable, conversation, operation, and related artifacts. The application can therefore explain which work produced an event and how an agent relates to other agents.

The observable record includes available:

- User and agent messages, including direct agent interactions.
- Delegation requests, effective parent-child relationships, and lifecycle changes.
- Requested and effective model settings and reasons for reassignment.
- Plans, revisions, important decisions, blockers, and approvals.
- Tool invocations and their results.
- Commands, relevant output, exit status, and duration.
- File changes, diffs, worktree and branch references, and commits.
- Verification results, review findings, and integration outcomes.
- Usage and quota measurements exposed by the engine.
- Interruptions, recovery decisions, and outcomes whose status remains uncertain.

### 13.2 Provider visibility boundaries

Tesslane displays the reasoning text, reasoning summaries, and other thinking-related content that a provider actually exposes. It does not claim access to the provider's complete internal reasoning.

The dashboard distinguishes unavailable information, delayed delivery, explicitly omitted content, and a genuinely empty result. It must not invent subagent messages or imply token-by-token streaming where only a final transcript is available.

The connector's observable capability set is visible. Agent hierarchy inferred from a supported native relationship must be distinguishable from hierarchy explicitly created by Tesslane.

### 13.3 Persistence and reconnection

Durable events have stable identities, an ordered position within their local project journal, an event type, origin, associated entities, and timestamps. Provider timestamps may be preserved separately from local receipt time; they do not establish a universal total order across providers.

The browser can load current state and resume its event stream from a known position. Reconnection reconciles missing events without launching work again. Operations submitted from the dashboard carry identifiable admission outcomes so a retried browser request can be reconciled.

High-volume partial output requires bounded buffering, suitable persistence batches, and backpressure. The implementation must define which boundaries are durable. It must not promise that every transient token is synchronously saved or silently drop durable lifecycle events under load.

Large outputs are navigable through pagination, filtering, virtualization, or artifact views. Any truncation of a displayed excerpt is visible and must not be confused with the complete stored evidence.

### 13.4 Historical inspection

V1 provides historical runs, conversations, events, plan revisions, and evidence references. Browsing a past run does not issue commands or replay tools.

A full time cursor that reconstructs every graph at any previous instant is deferred. Persisting the appropriate identities and revisions must allow this later without pretending the complete replay interface is already included in V1.

## 14. Dashboard behavior

### 14.1 Information architecture

The dashboard has four main spaces and project settings. It is the primary interface for execution, not merely an external log viewer.

| Space | Primary question | V1 content and actions |
| --- | --- | --- |
| Overview | What is moving, blocked, or waiting for me? | Feature outcomes, active runs, upcoming executable work, approvals, questions, blockers, and recent meaningful results. |
| Features and Tickets | What are we trying to deliver and what must happen first? | Description and criteria, clarification, ticket creation and editing, statuses, execution order, dependencies, evidence, and external references. |
| Swarm | Who is working on what and what is happening? | Agent hierarchy, effective model assignments, missions, conversations, interactions, activity timeline, outputs, and execution controls. |
| Git | What code changed and how will contributions join? | Actual branches, commits, merges, worktrees, uncommitted changes, diffs, linked work, reviews, checks, and integration controls. |

Features and Tickets can offer list, board, and dependency presentations. The agent hierarchy is the primary Swarm graph; communication and other relationships are selectable overlays or focused views. Git has its own history graph.

### 14.2 Connected views

The graphs are separate representations of related records. Selecting a ticket exposes its criteria, dependencies, agents, conversations, worktree, branch, code changes, checks, and review findings where they exist.

Navigation between these records preserves the relevant filters, selection, and graph position. A resizable contextual panel exposes details, conversations, journals, or diffs alongside the main view. A conversation can be enlarged when concentrated chat work is needed.

The user must be able to inspect detail without losing the execution overview. This does not require presenting every available record simultaneously.

Graph interactions include pan, zoom, fit-to-content, search or filtering, and focus on a selected object's neighborhood. Expanded and collapsed detail must preserve meaningful orientation. Labels or a legend explain the edge and state conventions in the active view.

### 14.3 Chat scopes

| Scope | Purpose |
| --- | --- |
| Project | Objectives, priority of agent execution, plans, and arbitration with the coordinator. |
| Feature or ticket | Clarification and direction of the relevant outcome or piece of work. |
| Agent | Inspection of its conversation and targeted questions or instructions. |

The composer always identifies its recipient and work scope. A graph selection must not silently redirect the next message. Existing drafts and the selected conversation must remain unambiguous when inspecting another record.

Messages are routed through the local engine and supported adapter controls. The UI distinguishes a message that is accepted, queued for a supported boundary, delivered, or rejected. Direct conversation does not bypass execution policy.

A change to global scope proposed in an agent conversation is escalated to the coordinator. Clarification and approval responses submitted from the dashboard join the same authoritative execution records used by the skill.

### 14.4 Swarm graph

Nodes expose the agent's mission, role, related work, status, engine, and effective model. Selection reveals the relevant conversation and activity. Additional detail includes reasoning settings, delegation ancestry, interactions, duration, available usage, artifacts, and blockers.

Delegation, dependency, and interaction edges are visually distinguishable. Expanding a subagent reveals its own records to the extent the adapter exposes them. Unavailable provider data is labeled rather than fabricated.

The graph remains stable while the user inspects it. New events and node arrivals are signaled without constantly repositioning the graph. Follow-live behavior and auto-scrolling must be under user control.

### 14.5 Git graph and actions

The Git graph represents real commit ancestry and merges, enriched with Tesslane's feature, ticket, run, agent, review, and verification references. Uncommitted changes are represented as worktree state, not invented commits.

From the view, users can inspect diffs, compare branches, inspect commits and worktrees, request the creation of agent work branches and worktrees, run reviews, and initiate permitted integration actions. Difficult conflicts can be assigned for agent assistance with subsequent verification.

The implementation provides the Git actions needed by the Swarm's delivery workflow. Advanced general-purpose Git editing is outside the initial scope.

Tesslane's own checks must be visible. External CI results may be shown when a supported source actually provides them; a complete hosted CI connector suite is not a V1 prerequisite.

### 14.6 Control surface

Project, feature, and run controls expose their scope before taking effect. Pending questions and approvals are visible from the Overview and remain accessible from relevant detail views.

The interface distinguishes scheduled work, active generation, a running command, waiting on a dependency, awaiting user input, and an uncertain connection. An animation or generic busy indicator is not a substitute for the last known state.

### 14.7 Essential interface states

The dashboard must cover first launch, empty work lists, disconnected engines, unsupported capabilities, loading, reconnecting, no search results, queued work, active execution, pending approval, quota wait, verification failure, review findings, integration conflict, pausing, stopping, recovery, completed work, and failed persistence.

Error views preserve useful context and offer actions consistent with the actual state. Failure to access an engine must not erase its prior records or display its work as complete.

## 15. Reference technical architecture

### 15.1 Selected baseline

| Concern | Baseline |
| --- | --- |
| Shared implementation language | TypeScript. |
| Local engine runtime | Node.js LTS, prepared automatically for Tesslane. |
| Browser application | React, built with Vite and served as compiled application assets. |
| Persistence | Local SQLite with schema migrations and coordinated writes. |
| Execution logic | A dedicated, bounded application orchestrator with explicit state transitions. |
| Coding integrations | Isolated adapters around the official Codex and Claude Code interfaces. |
| Git integration | Git operations and repository state through a dedicated integration boundary. |
| Browser commands | A local HTTP API with validated command contracts. |
| Browser observation | A resumable event stream; HTTP plus server-sent events is the reference implementation. |
| Task and agent graphs | React Flow is the preferred candidate, with layout and performance validated against representative graphs. |
| Git visualization | A rendering suited to real commit history and linked execution records. |

HTTP frameworks, SQLite drivers or ORMs, layout engines, state libraries, and exact dependency versions are implementation selections. They must support the required contracts and release assembly; none is an additional product the user must install or operate.

### 15.2 Component relationships

~~~mermaid
flowchart TD
    Skill[Skill and launch script] --> Engine[Local Tesslane engine]
    Dashboard[Project dashboard in browser] -->|Commands and responses| Engine
    Engine -->|State and event stream| Dashboard
    Engine --> Store[(Local SQLite and artifacts)]
    Engine --> Git[Git adapter and worktrees]
    Engine --> Codex[Codex adapter]
    Engine --> Claude[Claude Code adapter]
    Codex --> CodexProcess[Official Codex runtime]
    Claude --> ClaudeProcess[Official Claude Code runtime]
~~~

### 15.3 Internal boundaries

The implementation separates the work model, scheduler and state transitions, model-routing policy, permissions and approvals, event journal, provider adapters, Git integration, persistence, local API, and browser presentation.

Provider-specific events are preserved where useful and mapped into a common execution model without falsely claiming full equivalence. Frontend components consume application contracts rather than depending on raw provider transcript formats.

Normal execution needs one local control service for the selected project. It must coordinate its state writes and avoid duplicate local schedulers for that same project context. Any worker isolation added for database operations or expensive computation is an internal implementation detail.

### 15.4 Why a dedicated orchestrator

Tesslane coordinates existing coding engines instead of recreating their agent loops. Its own responsibilities are dependency readiness, bounded delegation, policy enforcement, evidence, recovery, and integration.

These responsibilities use an explicit, testable execution model. Existing libraries can implement the appropriate pieces. A general-purpose multiagent framework is not mandatory infrastructure and must not introduce hidden routing, retries, or state that bypass Tesslane's contracts.

### 15.5 Local API behavior

Commands cover project setup and settings, work and plan changes, conversation input, approval responses, execution control, verification, and Git workflow actions. Read interfaces expose current state, history, relationships, capabilities, and artifacts.

Runtime validation is required at process and browser boundaries; shared TypeScript types alone do not validate external input. Mutating commands identify their target and relevant revision so stale requests can be rejected or reconciled.

The service is local to the machine. Its browser interface must restrict unintended origins and protect mutating commands with an appropriate local session mechanism. This is implementation infrastructure, not a hosted user-account system.

## 16. Coding-engine integration contracts

### 16.1 Common adapter responsibilities

Each adapter must provide or explicitly declare the absence of:

- Engine version and connection status.
- Supported authentication and user-led sign-in flows.
- Model and setting discovery.
- Session and run creation or continuation.
- Input delivery at documented execution boundaries.
- Lifecycle, message, tool, file-change, and usage events.
- Subagent identities and observable parent-child relationships.
- Approval and clarification request handling.
- Supported model changes, interruption, and resumption behavior.
- Failure classification and remaining uncertainty after disconnects.

Requested behavior, supported capability, and observed result are separate records. Tesslane must not report an advisory constraint as a provider-enforced guarantee.

### 16.2 Codex

The reference integration is the official Codex app-server interface for authentication, conversations, approvals, and streamed events. A version-matched transport and schema are used; documented standard input/output communication is the initial reference option.

The adapter reads account-accessible model and reasoning options through the supported catalog, records effective settings, and respects the engine's permissions and managed requirements. It must implement the provider's actual turn boundaries when steering, changing settings, or interrupting work.

### 16.3 Claude Code

The reference integration uses the official unmodified Claude Code binary with documented noninteractive and structured streaming interfaces. A TypeScript SDK may be used where its selected version and authentication path satisfy the same requirements.

Each user connects through the official supported mechanism for their account. The implementation validates subscription-backed operation rather than treating an API-only path as equivalent. Configuration shortcuts that bypass required project context, background behavior, or subscription authentication must not be silently enabled.

The adapter validates how child agents, partial messages, full transcripts, background commands, model changes, and interruption are exposed in its supported version. Completion of a main response is not automatically proof that all background activity has ended.

### 16.4 Version compatibility

The release documents the supported versions or capability requirements for each engine. An incompatible engine produces a specific diagnostic and recovery instruction. Provider schema changes are isolated by adapters and tested against stored fixtures and supported real versions.

Native account credentials remain under the supported engine's management. Credentials and session authorization material must not be included in normal event records, exports, or backups of project work.

## 17. Persistence and local project identity

### 17.1 Data ownership

| Data | Location and authority |
| --- | --- |
| Shareable project conventions and defaults | Minimal project configuration that can be versioned. |
| Existing specifications and task sources | Their established project locations; Tesslane retains references and applicable revisions. |
| Tesslane's local features and tickets | The local project database when no existing source supplies the work. |
| Execution plans, runs, attempts, and decisions | The local engine's durable records. |
| Event history, conversations, and evidence | The local project store and associated artifacts. |
| Personal display settings and account selections | The local installation or project context as appropriate. |
| Provider credentials | The official authentication mechanism; separate from shareable project data. |
| Work branches, commits, and source changes | Git and the relevant working trees. |

The database belongs to a local execution context, not to a shared team account. Separate people or clones do not acquire synchronized execution state merely by working on the same repository.

### 17.2 Reference storage arrangement

A minimal versionable configuration under a project-specific Tesslane directory is a reference arrangement. SQLite, execution artifacts, logs, and personal settings live in tool-managed local data associated with the project context and are excluded from source control by default.

Exact paths follow the host platform's conventions and are an implementation detail. The UI and diagnostic command must expose the effective locations. Application updates must not replace project data.

An agent worktree is associated with its parent Tesslane project context. A second independent clone is not automatically treated as the same active workspace. Moving or restoring a project requires an explicit path reconciliation rather than silent attachment to another project's history.

### 17.3 SQLite behavior

Writes are coordinated by the local engine. Transactions remain short, migrations are versioned, and event persistence is kept consistent with state transitions. WAL is a reference option for local-disk operation, subject to validated settings and checkpoint behavior.

Database work must not make chat, event handling, or interruption unresponsive. The driver, execution isolation, buffering, and batch size are selected against representative workloads. A transaction-per-token design is not a requirement.

The database must not be treated as a file that several machines can safely share or merge. A backup is a coherent snapshot, not a live synchronization protocol.

### 17.4 Artifacts, retention, backup, and restoration

Large outputs and code-related artifacts may be stored separately with stable references and integrity information. Retention settings must distinguish required acceptance evidence from disposable excerpts or diagnostic verbosity. Any cleanup of retained work must have a clear scope and must not silently invalidate completion evidence.

The dashboard supports a project-data backup and restoration workflow. A backup must preserve a consistent database and its required artifacts using a coherent database snapshot mechanism. Copying an active database file alone is not the defined backup procedure.

Restoration identifies the target codebase and its revisions, reconciles paths and artifacts, and requests engine reconnection when required. Restoring Tesslane data does not guarantee that a provider-native session can continue or that absent Git branches and source files have been recreated.

## 18. Operational quality

### 18.1 Cross-platform support

macOS, Windows, and Linux are V1 requirements. Implementation differences in process startup, executable resolution, paths, shells, permissions, interruption, child cleanup, and background operation are handled by the tool.

Supported OS versions and hardware architectures are documented and checked through a release matrix. The three-system requirement must not silently become a promise based solely on testing one machine. Mobile layouts and mobile applications are outside scope.

### 18.2 Resource use and responsiveness

Concurrency is bounded by project policy and available engine capacity. Logs, event buffers, graph rendering, and history queries are bounded or paginated. Closing a detail view does not change the truth of execution state.

Performance targets are established from representative fixtures during implementation. This specification makes no unsupported numerical claim about maximum agents, graph size, throughput, startup time, or memory use.

### 18.3 Diagnostics

Diagnostics report the effective runtime, application and engine versions, connection state, project and data locations, applicable policy, active runs, known unresolved processes, and actionable failures. Useful excerpts and errors are prioritized over indiscriminate log dumps.

### 18.4 Updates and recovery of configuration

Updates preserve project configuration and local history. Application and database schema compatibility are checked before normal startup. A migration failure produces a recoverable diagnostic rather than resetting the database.

The application identifies changes requiring user action, such as reconnecting an engine or correcting an incompatible configuration. It does not repeat all onboarding merely because a component was updated.

## 19. Brand and interface direction

### 19.1 Identity

The selected product name is **Tesslane**. Its personality is precise, controlled, trustworthy, and accessible. The working descriptor is **Local orchestration for coding agents.**

English is the interface and primary documentation language. Agent conversations and clarification adapt to the user's language. Source-code identifiers and shared contracts should remain consistently English.

### 19.2 Visual reference

Superwhisper is the principal reference for visual language: a professional, reassuring, efficient, restrained interface with the feeling of a carefully designed desktop application.

The direction carries through to typography, compact familiar controls, restrained rounding, subtle surface distinctions, fine separators, a controlled accent palette, and polished light and dark appearances. Tesslane retains its own name, symbol, and assets.

The interface should feel equally coherent on macOS, Windows, and Linux. The desired desktop sensibility does not introduce an Apple-only implementation dependency.

### 19.3 Application of the identity

- Navigation and settings use a familiar desktop information hierarchy.
- Chat prioritizes readable messages, clear targeting, and accessible actions.
- Agent nodes remain concise, with colors tied to meaningful states and selection.
- Git history emphasizes ancestry, changes, and legible selection.
- Motion communicates state changes and preserves orientation.
- Advanced detail appears progressively in contextual panels.

The dashboard is an operational surface. The visual spaciousness of a marketing page must be adapted to its greater information density through hierarchy and progressive disclosure.

Graph edges, states, and notifications must remain understandable without color alone. Keyboard navigation, visible focus, readable contrast, reduced-motion behavior, and resizable panels are part of the interface quality baseline. Exact colors, typefaces, logo construction, and component tokens are design implementation work.

## 20. V1 acceptance criteria

Each criterion must be demonstrated with identifiable evidence. Simulated adapters support repeatable tests but do not replace real integration checks. Team-style fixtures demonstrate behavior, not validated adoption in a large organization.

| ID | Criterion | Required evidence |
| --- | --- | --- |
| AC-01 | The repository-to-skill-to-script-to-dashboard journey works. | A fresh supported environment launches a project dashboard through the documented path without frontend development commands or a separately managed Node installation. |
| AC-02 | The application works on all three required OS families. | Installation, startup, persistence, Git operations, event streaming, and interruption results for macOS, Windows, and Linux. |
| AC-03 | Returning to a project reuses its configuration and history. | Relaunch after browser closure and after engine restart; no duplicate scheduler or run. |
| AC-04 | Existing conventions are respected. | A structured fixture preserves its instructions and work sources; organizational changes are presented before application. |
| AC-05 | Informal work becomes an executable local plan. | A pasted todo or feature becomes criteria and useful tickets without mandatory extra hierarchy. |
| AC-06 | Clarification is proportionate. | A clear small change proceeds directly; an ambiguous feature prompts only material questions and records their answers. |
| AC-07 | Dependencies and real conflicts control admission. | Independent work runs concurrently; dependent work waits; overlapping changes are coordinated. |
| AC-08 | Both coding engines are operational integrations. | Real Codex and Claude Code runs using the supported account authentication paths, plus successful single-engine onboarding. |
| AC-09 | One run can use both engines. | A justified mixed-engine scenario with linked missions, artifacts, and verified handoff. |
| AC-10 | Model routing is explicit and capability-aware. | Requested and effective settings, selection reasons, valid reasoning options, and rejection of unavailable candidates. |
| AC-11 | Adaptation is bounded and diagnosable. | Two no-progress attempts trigger the configured diagnostic; a context or strategy repair is distinguishable from a model escalation. |
| AC-12 | Quota fallback follows authorization. | Permitted fallback or a visible wait; no unconfigured change of billing arrangement. |
| AC-13 | Autonomy modes have different effective behavior. | Planning protects target code; Assisted runs an approved lot; Autonomous remains inside its configured scope. |
| AC-14 | The dashboard is a complete execution interface. | Work creation, clarification, approval, chat, observation, model settings, pause, stop, checks, and integration can be performed there. |
| AC-15 | Chat targeting remains explicit. | Selecting a different graph node does not silently redirect a drafted message; delivery state is visible. |
| AC-16 | Agent relationships and activity are truthful. | Known hierarchy, interactions, available transcripts and tools are attributable; missing provider data is identified. |
| AC-17 | Parallel writes use isolated worktrees. | Agent contributions remain separate from each other and from pre-existing user changes. |
| AC-18 | Review and verification govern completion. | An integration lot has independent review and relevant checks; combined criteria govern feature completion. |
| AC-19 | Git visualization reflects actual repository state. | Real ancestry, merges, worktree changes, diffs, and execution links agree with Git. |
| AC-20 | Pause and stop preserve work and expose uncertainty. | Safe-boundary behavior, adapter interruption, background-process handling, and any unresolved activities are visible. |
| AC-21 | Recovery does not blindly repeat uncertain effects. | Forced interruption around admission, an agent action, and integration results in reconciliation rather than an assumed clean restart. |
| AC-22 | The event stream survives browser disconnects. | Missing events are recovered without duplicate execution; selected detail and navigation remain usable. |
| AC-23 | Persistence remains usable under representative concurrent activity. | Several active agents, concurrent dashboard reading, output recording, abrupt termination, and coherent recovery. |
| AC-24 | Backup and restoration preserve usable project records. | A coherent snapshot restores history and evidence, with codebase paths and provider continuity requirements explicitly reconciled. |
| AC-25 | External work stays externally identifiable. | An imported description retains its reference and produces a usable completion summary without taking over team management. |
| AC-26 | The agreed visual direction supports real work. | Rendered desktop views with representative dense content, keyboard and focus checks, graph readability, and essential error states. |

## 21. Implementation sequence

The following sequence organizes delivery without removing any required V1 view or workflow:

1. **Technical feasibility slice**: script preparation, local Node runtime, compiled dashboard serving, SQLite round trip, real engine streaming, interruption, and cross-platform packaging checks.
2. **Durable application core**: project identity, configuration, work contracts, state transitions, policies, admission, event persistence, and recovery primitives.
3. **End-to-end execution slice**: one useful feature, clarification, optional decomposition, a real engine, checks, independent review, and integration evidence.
4. **Swarm and routing**: bounded parallel work, worktrees, the second engine, mixed-engine handoff, dynamic profile assignment, diagnostics, fallback, and resource bounds.
5. **Full dashboard workflow**: all four spaces, scoped chat, pending decisions, connected detail views, provider observability, Git actions, and historical inspection.
6. **Release validation**: fresh installation on the three systems, realistic failure and recovery exercises, backup and migration checks, visual and interaction verification, and complete usage documentation.

The source repository must make implementation and validation understandable to contributors. This specification does not mandate a particular monorepo tool or publish a fictitious installation command for a product that is not yet built.

## 22. Technical validation register

These are implementation investigations, not unresolved questions about the user's intended workflow.

| ID | Baseline or requirement | Verification and consequence |
| --- | --- | --- |
| TV-01 | Node.js prepared automatically; compiled dashboard included. | Assemble and launch an isolated distribution on the supported OS and architecture matrix. Select the concrete archive or executable format from these results. |
| TV-02 | SQLite coordinated by the local engine. | Validate the driver, migrations, write latency, checkpoint settings, backup mechanism, and abrupt-termination behavior under representative activity. |
| TV-03 | Native Codex account-based integration. | Confirm supported app-server versions, schema generation or bindings, model discovery, approvals, subagent visibility, and lifecycle behavior. |
| TV-04 | Native Claude Code account-based integration. | Confirm selected CLI or SDK path, structured events, subscription-backed authentication, project-context loading, background work, and supported controls. |
| TV-05 | Equivalent product behavior on macOS, Windows, and Linux. | Verify executable discovery, quoting and paths, shell requirements, child-process interruption, background operation, and Git worktrees. |
| TV-06 | Reliable interruption and recovery. | Exercise main-agent completion with children still active, connection loss, unknown action outcomes, and a restarted engine. |
| TV-07 | Useful graph and log performance. | Validate layout, node updates, large history navigation, output backpressure, and stable inspection with representative data. React Flow remains the preferred candidate if it meets these needs. |
| TV-08 | Model assignments reflect real capabilities. | Validate available models, supported settings, provider substitutions, usage fields, and actual behavior after a model change. Calibrate profiles without claiming an unmeasured ranking. |
| TV-09 | Runtime alternative only for an evidenced benefit. | Consider Bun if a concrete Node distribution or compatibility issue justifies comparison. Preserve the same user journey and validate all adapters before a change. |

No universal performance optimum is claimed for this architecture. Measured results determine batching, process isolation, graph layout, driver selection, and distribution details. A failed technical check must lead to a compatible implementation adjustment or a clearly identified blocker; it must not silently reduce the validated product scope.

## 23. Publication and subsequent work

Before public release, choose and include the project's open-source license, check the intended repository and distribution identifiers, verify applicable third-party notices, and document installation, supported platforms, troubleshooting, and contribution practices. The Tesslane name has been selected; naming research is not proof of domain, package, or trademark availability.

Subsequent candidates include direct tracker selection and result publication, additional coding-engine adapters, a multiproject overview, richer historical graph reconstruction, and evidence-backed automatic improvement of routing policies.

Shared team orchestration, ticket ownership between people, Git-backed ticket locking, mobile clients, and attachment of external agent sessions are not implied by this roadmap.

## 24. Design and integration references

These references inform implementation patterns and capability checks. They do not establish benchmarks for Tesslane or replace validation against the versions selected for release.

- [Matt Pocock skills](https://github.com/mattpocock/skills): reference workflows for clarification, specifications, tickets, and implementation.
- [Matt Pocock grilling](https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md): decision-tree clarification with recommendations and factual exploration.
- [Matt Pocock implement-spec](https://github.com/mattpocock/skills/blob/main/skills/engineering/implement-spec/SKILL.md): dependency-aware work and isolated implementation contributions.
- [Codex app-server](https://learn.chatgpt.com/docs/app-server): documented client integration, authentication, events, capabilities, and control surfaces.
- [Codex subagents and model settings](https://learn.chatgpt.com/docs/agent-configuration/subagents#choosing-models-and-reasoning): model and reasoning configuration for delegated work.
- [Claude Code headless operation](https://code.claude.com/docs/en/headless): noninteractive execution, structured output, subagent observation, and lifecycle behavior.
- [Claude Code integration conditions](https://code.claude.com/docs/en/legal-and-compliance): supported use of the official binary and authentication boundaries.
- [Claude Code model configuration](https://code.claude.com/docs/en/model-config): model settings and provider fallback behavior.
- [Anthropic agent workflow patterns](https://www.anthropic.com/research/building-effective-agents): orchestrator-worker and evaluator patterns, with proportionate complexity.
- [SQLite deployment guidance](https://www.sqlite.org/whentouse.html) and [WAL behavior](https://www.sqlite.org/wal.html): local persistence and concurrency constraints.
- [LangGraph fault tolerance](https://docs.langchain.com/oss/python/langgraph/fault-tolerance): useful distinctions between persisted progress and repeated external effects.
- [Node.js releases](https://nodejs.org/en/about/previous-releases), [child processes](https://nodejs.org/api/child_process.html), and [single executable applications](https://nodejs.org/api/single-executable-applications.html): runtime and distribution validation inputs.
- [Vite production builds](https://vite.dev/guide/build.html): compiled browser-application delivery.
- [React Flow](https://reactflow.dev/learn): interactive task and agent graph implementation candidate.
- [Superwhisper](https://superwhisper.com/): principal visual and desktop-interface reference.
