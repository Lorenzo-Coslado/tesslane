# Tesslane

Tesslane turns development intentions into verified changes by coordinating coding agents within a project. This glossary defines the language used in its product specification.

## Work

**Project**:
The codebase and development context that Tesslane is helping to change. A project provides the conventions, objectives, and applicable execution policy.
_Avoid_: Team workspace, organization

**Feature**:
A development outcome with an identifiable purpose and acceptance criteria. It is the primary unit for understanding progress, whether it needs one ticket or several.
_Avoid_: Epic as a mandatory hierarchy level

**Ticket**:
A bounded, verifiable piece of work contributing to a feature or addressing a standalone change. In Tesslane, a ticket describes work for agents; it is not a reservation of work between people.
_Avoid_: Human assignment, agent, tool call

**Execution plan**:
The current arrangement of tickets, dependencies, acceptance criteria, and execution constraints for an outcome.
_Avoid_: Sprint, roadmap

**Integration lot**:
A coherent set of contributions reviewed and checked together before joining its designated target branch.
_Avoid_: Individual tool action, release

**External ticket reference**:
A link between Tesslane's execution work and an item managed in an existing task or issue tracker.
_Avoid_: Shared Tesslane ticket reservation

## Execution

**Local engine**:
Tesslane's authority for supervising work within a local project context. It maintains execution state and applies the project's control policy.
_Avoid_: Coding engine, coordinator agent

**Coding engine**:
A connected coding-agent system, such as Codex or Claude Code, that carries out missions supervised by Tesslane.
_Avoid_: Local engine, individual model

**Run**:
A supervised execution of a defined scope of work under a recorded policy. A run can contain multiple attempts and agent executions.
_Avoid_: Conversation, model request

**Attempt**:
One bounded effort to satisfy a ticket or assigned mission using a particular strategy. An attempt ends in a verified result, a need for correction, an interruption, or a blocker.
_Avoid_: Retry for every subsequent model request

**Agent**:
A supervised worker with a mission, role, context, and effective model configuration. An agent may delegate within the project's permitted hierarchy and resource limits.
_Avoid_: Model, role, ticket

**Role**:
A responsibility an agent can fulfill, such as coordination, implementation, analysis, or review. A role does not require a permanently running agent.
_Avoid_: Always-on employee

**Subagent**:
An agent delegated a mission by another agent. Delegation ancestry is distinct from task dependencies and communication relationships.
_Avoid_: Dependency

**Coordinator**:
The agent responsible for the development plan, delegation proposals, blockers, and scope arbitration. It works within the execution rules enforced by Tesslane.
_Avoid_: Scheduler, unrestricted supervisor

**Execution profile**:
A named intent for assigning model capabilities to work, such as Fast, Balanced, or Deep. A profile is resolved using the available models and the task's needs.
_Avoid_: Fixed model identifier

**Routing strategy**:
The project's preference for balancing verified quality, delivery time, and consumption when assigning models. It is distinct from the execution profile selected for an individual mission.
_Avoid_: Execution profile

**Acceptance evidence**:
The identifiable results supporting a claim that work meets its criteria, including relevant checks, observations, and review findings.
_Avoid_: Agent confidence, completion claim

**Checkpoint**:
A recorded boundary describing the known state of work and the information required to consider continuing it. Its existence does not establish that an interrupted external action can safely be repeated.
_Avoid_: Guaranteed replay, automatic rollback

## Control and observation

**Autonomy mode**:
A project setting describing how much work may proceed without a new human decision. Planning, Assisted, and Autonomous are distinct modes operating within applicable permissions.
_Avoid_: Unlimited access

**Approval**:
A human decision authorizing a defined action, plan, or lot under stated conditions. Its scope and the work revision it applies to are identifiable.
_Avoid_: Permanent blanket consent

**Pause**:
A request to suspend new delegation and bring active work to safe stopping boundaries while preserving its state.
_Avoid_: Immediate termination, rollback

**Stop**:
A request to interrupt selected execution activity while preserving the work and evidence already produced.
_Avoid_: Undo, discard changes

**Blocker**:
A condition preventing permitted progress and requiring a missing fact, decision, resource, or technical repair.
_Avoid_: Every warning or transient error

**Event**:
An identifiable observation of a change or action in a Tesslane execution, with its origin and relationship to the relevant work.
_Avoid_: Unattributed activity indicator

**Handoff**:
A transfer of an agent mission with the objective, decisions, code state, evidence, and remaining work needed by its successor.
_Avoid_: Guaranteed migration of a provider's internal conversation state
