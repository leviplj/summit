## ADDED Requirements

### Requirement: TeamManager spawns teammates via queries.run()
The TeamManager SHALL spawn teammate agents by calling `api.queries.run(sessionId, prompt, { agentId, source })`. Each teammate SHALL run concurrently within the same session, sharing the existing EventStream.

#### Scenario: Orchestrator spawns two teammates
- **WHEN** the orchestrator calls `spawn_teammate("backend", "Implement the API endpoint")`
- **THEN** TeamManager calls `queries.run()` with `agentId: "backend"` and the teammate runs concurrently with other agents

#### Scenario: Teammate completes
- **WHEN** a teammate's `queries.run()` promise resolves
- **THEN** TeamManager updates the teammate's status to "done" and emits a `teammate_done` event

#### Scenario: Teammate errors
- **WHEN** a teammate's `queries.run()` promise rejects
- **THEN** TeamManager updates the teammate's status to "error" and emits a `teammate_status` event with the error

### Requirement: TeamManager holds the stream
TeamManager SHALL call `holdStream()` when the first teammate is spawned. The hold SHALL be released when all teammates have completed (done or error).

#### Scenario: Stream stays alive for teammates
- **WHEN** the orchestrator's main query finalizes but two teammates are still running
- **THEN** the EventStream remains open until both teammates complete

### Requirement: MessageBus with mailbox queuing
The MessageBus SHALL provide mailbox-style message passing between teammates with `send(from, to, content)`, `receive(teammateId, from?, timeoutMs?)`, and `broadcast(from, content, allIds)`.

#### Scenario: Send and receive
- **WHEN** teammate "backend" sends a message to "frontend"
- **THEN** "frontend" can receive it by calling `receive("frontend")` or `receive("frontend", "backend")`

#### Scenario: Blocking receive
- **WHEN** teammate "frontend" calls `receive("frontend")` with no messages queued
- **THEN** the call blocks until a message arrives or the timeout expires

#### Scenario: Broadcast
- **WHEN** the orchestrator broadcasts "start phase 2" to all teammates
- **THEN** every active teammate has the message in their mailbox

### Requirement: MessageBus cycle detection
The MessageBus SHALL detect potential deadlocks before allowing a blocking receive. If receiving would create a cycle (A waiting for B waiting for A), the receive SHALL fail with an error.

#### Scenario: Cycle detected
- **WHEN** "backend" is waiting for a message from "frontend" and "frontend" calls `receive("frontend", "backend")`
- **THEN** the receive call fails with a cycle detection error

### Requirement: Team events emitted to session stream
TeamManager SHALL emit structured team events to the session EventStream: `team_created`, `teammate_status`, `teammate_message`, `teammate_done`.

#### Scenario: Team created event
- **WHEN** the first teammate is spawned
- **THEN** a `team_created` event is emitted with the roster `[{ id, role }]`

#### Scenario: Status change event
- **WHEN** a teammate's status changes (e.g., working → done)
- **THEN** a `teammate_status` event is emitted with `{ teammateId, teammateName, status }`

#### Scenario: Message event
- **WHEN** a teammate sends a message to another
- **THEN** a `teammate_message` event is emitted with `{ from, to, content }`

### Requirement: MCP tools for orchestrator
The orchestrator agent SHALL have access to `spawn_teammate` and `broadcast` MCP tools.

#### Scenario: spawn_teammate tool
- **WHEN** the orchestrator calls `spawn_teammate({ role: "backend", prompt: "...", model: "sonnet" })`
- **THEN** TeamManager spawns a new teammate with the given role, prompt, and optional model override

#### Scenario: broadcast tool
- **WHEN** the orchestrator calls `broadcast({ content: "Start phase 2" })`
- **THEN** the message is delivered to all active teammates via MessageBus

### Requirement: MCP tools for teammates
Each teammate agent SHALL have access to `send_message` and `receive_message` MCP tools. Teammates SHALL NOT have access to `spawn_teammate`.

#### Scenario: send_message tool
- **WHEN** teammate "backend" calls `send_message({ to: "frontend", content: "API schema ready" })`
- **THEN** the message is queued in "frontend"'s mailbox

#### Scenario: receive_message tool
- **WHEN** teammate "frontend" calls `receive_message({ from: "backend", timeout: 30000 })`
- **THEN** the tool blocks until a message from "backend" arrives or 30 seconds elapse

### Requirement: onBeforeQuery activates team mode
The teams extension SHALL use `onBeforeQuery` to detect sessions belonging to projects with team config. When detected, it SHALL create a TeamManager and register MCP tools for the orchestrator.

#### Scenario: Project with team config
- **WHEN** a query starts on a session whose project has a `team` config
- **THEN** the onBeforeQuery hook creates a TeamManager and registers orchestrator MCP tools

#### Scenario: Project without team config
- **WHEN** a query starts on a session whose project has no `team` config
- **THEN** the onBeforeQuery hook does nothing — the query proceeds as normal
