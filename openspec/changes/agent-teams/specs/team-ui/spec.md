## ADDED Requirements

### Requirement: Session displays teammate tabs when a team is active
The system SHALL render a tab bar within the session when an orchestrator creates teammates. There SHALL be one tab for the orchestrator and one tab per teammate. Each tab SHALL display the teammate's role name.

#### Scenario: Team with two teammates
- **WHEN** the orchestrator creates "backend" and "frontend" teammates
- **THEN** the UI SHALL show 3 tabs: "Lead", "Backend", "Frontend"
- **AND** the "Lead" tab SHALL be selected by default

### Requirement: Each tab streams its own events
Each tab SHALL display the event stream (thinking, tool_use, tool_result, text) for its corresponding teammate. Events SHALL be filtered by `teammateId` so each tab only shows its own activity.

#### Scenario: Backend tab shows backend activity
- **WHEN** the user switches to the "Backend" tab
- **THEN** only events with `teammateId` matching the backend teammate SHALL be displayed
- **AND** events SHALL render using the same components as regular chat messages (thinking blocks, tool use, text)

### Requirement: Status indicators per teammate
Each tab SHALL display a status indicator showing the teammate's current state. States SHALL include: "working" (actively executing), "waiting" (blocked on check_mailbox), "done" (called notify_done), "error" (query failed), and "cancelled" (aborted by orchestrator).

#### Scenario: Teammate waiting for message
- **WHEN** the frontend teammate calls `check_mailbox` and blocks
- **THEN** the Frontend tab's status indicator SHALL show "waiting"

#### Scenario: Teammate completes
- **WHEN** the backend teammate calls `notify_done`
- **THEN** the Backend tab's status indicator SHALL show "done"

### Requirement: Inter-agent messages are visible in the stream
When a teammate sends or receives a message, the event SHALL appear in both the sender's and recipient's tab streams. Messages SHALL be visually distinct from regular agent output (e.g., styled as a message bubble with sender/recipient labels).

#### Scenario: Message appears in both tabs
- **WHEN** Backend sends a message to Frontend: "GET /api/users returns {id, name}"
- **THEN** the Backend tab SHALL show an outgoing message event: "Sent to Frontend: ..."
- **AND** the Frontend tab SHALL show an incoming message event: "From Backend: ..."

### Requirement: Status bar shows team overview
When a team is active, a status bar SHALL be displayed showing all teammates with their current status. This provides at-a-glance visibility without switching tabs.

#### Scenario: Mixed team status
- **WHEN** Backend is "done", Frontend is "working", QA is "waiting"
- **THEN** the status bar SHALL show: "Backend: done | Frontend: working | QA: waiting"

### Requirement: Tab bar is hidden for non-team sessions
When a session is running a regular single-agent query (no team), the tab bar SHALL NOT be displayed. The UI SHALL look identical to the current single-agent experience.

#### Scenario: Regular query without team
- **WHEN** the user sends a message and the agent responds without creating a team
- **THEN** no tab bar SHALL be rendered
- **AND** the session SHALL behave exactly as it does today

### Requirement: User can cancel the entire team
The existing cancel/stop button SHALL cancel all teammate queries and the orchestrator query when a team is active.

#### Scenario: User cancels during team execution
- **WHEN** a team is active with 3 teammates
- **AND** the user clicks the cancel button
- **THEN** all teammate `query()` calls SHALL be aborted
- **AND** the orchestrator `query()` SHALL be aborted
- **AND** all tabs SHALL show "cancelled" status
