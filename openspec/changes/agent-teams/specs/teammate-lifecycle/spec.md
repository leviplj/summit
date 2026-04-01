## ADDED Requirements

### Requirement: Orchestrator can create teammates dynamically
The system SHALL provide a `create_teammate` MCP tool to the orchestrator that spawns a new teammate. The tool SHALL accept a role name, a system prompt, and an optional scope path (directory the teammate should focus on). Each teammate SHALL be a concurrent Agent SDK `query()` call sharing the session's `cwd` and `worktrees`.

#### Scenario: Create a backend teammate
- **WHEN** Orchestrator calls `create_teammate(role: "backend", systemPrompt: "You are a backend developer...", scopePath: "/wt/api")`
- **THEN** a new `query()` call SHALL be started concurrently with the given system prompt
- **AND** the teammate SHALL have access to all standard tools (Read, Write, Bash, etc.)
- **AND** the teammate SHALL have access to team communication tools (check_mailbox, send_message, notify_done)

#### Scenario: Create multiple teammates
- **WHEN** Orchestrator calls `create_teammate` three times with roles "backend", "frontend", and "qa"
- **THEN** three concurrent `query()` calls SHALL be running simultaneously

### Requirement: Teammates receive role-scoped system prompts
Each teammate's `query()` SHALL be initialized with a system prompt that includes: their role, their directory scope, instructions to use mailbox tools for coordination, and the list of other active teammates (roles and IDs) so they know who to communicate with.

#### Scenario: System prompt includes team awareness
- **WHEN** a teammate is created with role "frontend"
- **AND** there is already a "backend" teammate active
- **THEN** the frontend teammate's system prompt SHALL list "backend" as an available teammate to communicate with

### Requirement: Teammates can signal completion
The system SHALL provide a `notify_done` MCP tool that teammates call when they have completed their assigned work. The tool SHALL accept a summary string describing what was accomplished. This signal SHALL be delivered to the orchestrator.

#### Scenario: Teammate completes work
- **WHEN** Backend teammate calls `notify_done(summary: "Created REST API with 5 endpoints for user management")`
- **THEN** the orchestrator SHALL be notified that the backend teammate has finished
- **AND** the teammate's status SHALL change to "done"

### Requirement: Orchestrator can wait for all teammates to finish
The system SHALL provide a `wait_for_team` MCP tool that blocks until all active teammates have called `notify_done`.

#### Scenario: Wait for full team completion
- **WHEN** Orchestrator calls `wait_for_team()`
- **AND** there are 2 active teammates
- **THEN** the tool SHALL block until both teammates have called `notify_done`
- **AND** the tool SHALL return a summary of all teammate completion messages

#### Scenario: All teammates already done
- **WHEN** all teammates have already called `notify_done`
- **AND** Orchestrator calls `wait_for_team()`
- **THEN** the tool SHALL return immediately with all summaries

### Requirement: Orchestrator can cancel a teammate
The system SHALL allow the orchestrator to cancel a specific teammate's `query()` by aborting its AbortController. The cancelled teammate's status SHALL change to "cancelled".

#### Scenario: Cancel a misbehaving teammate
- **WHEN** Orchestrator calls `cancel_teammate(id: "frontend")`
- **THEN** the frontend teammate's `query()` SHALL be aborted
- **AND** the frontend teammate's status SHALL be "cancelled"
- **AND** any pending `check_mailbox` calls waiting for messages from the cancelled teammate SHALL resolve with an error

### Requirement: No nested teams
A teammate SHALL NOT have access to the `create_teammate` tool. Only the orchestrator can create teammates.

#### Scenario: Teammate cannot create sub-teams
- **WHEN** a teammate's `query()` is initialized
- **THEN** the teammate SHALL NOT have the `create_teammate`, `wait_for_team`, or `cancel_teammate` tools available

### Requirement: Team is scoped to a single user request
The team SHALL be created when the orchestrator decides one is needed for a user message and SHALL be torn down after the orchestrator's `query()` completes. Teammate state is not persisted across user messages.

#### Scenario: Team cleanup after completion
- **WHEN** the orchestrator's `query()` finishes (all teammates done, orchestrator summarizes)
- **THEN** all teammate `query()` calls SHALL be completed or aborted
- **AND** the message bus SHALL be disposed
