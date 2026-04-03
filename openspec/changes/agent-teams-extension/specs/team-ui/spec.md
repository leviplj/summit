## ADDED Requirements

### Requirement: Tab bar for team sessions
When a `team_created` event is received, the chat view SHALL switch to tab mode displaying a `TeamTabBar` component with one tab per teammate plus a "Main" tab for the orchestrator.

#### Scenario: Team created
- **WHEN** the stream delivers a `team_created` event with teammates `[{ id: "backend", role: "Backend Engineer" }, { id: "frontend", role: "Frontend Engineer" }]`
- **THEN** the tab bar appears with tabs: "Main", "Backend Engineer", "Frontend Engineer"

#### Scenario: No team
- **WHEN** a session has no `team_created` event
- **THEN** no tab bar is shown — the chat view renders as normal

### Requirement: Per-agent event routing
Events with an `agentId` field SHALL be routed to the corresponding teammate tab's event list. Events without `agentId` SHALL appear in the Main tab.

#### Scenario: Event with agentId
- **WHEN** a `text` event arrives with `agentId: "backend"`
- **THEN** the event is added to the "Backend Engineer" tab's event stream

#### Scenario: Event without agentId
- **WHEN** a `thinking` event arrives with no `agentId`
- **THEN** the event is added to the Main tab's event stream

### Requirement: Status indicators on tabs
Each tab SHALL show a status icon reflecting the teammate's current state: spinner (working), clock (waiting), checkmark (done), alert (error), question mark (ask_user).

#### Scenario: Teammate working
- **WHEN** a teammate's status is "working"
- **THEN** the tab shows a spinner icon

#### Scenario: Teammate done
- **WHEN** a `teammate_status` event sets status to "done"
- **THEN** the tab shows a checkmark icon

#### Scenario: Teammate needs input
- **WHEN** a teammate triggers ask_user
- **THEN** the tab shows a question mark icon and an attention dot if the tab is not selected

### Requirement: Per-agent message display
Each tab SHALL maintain its own message list. Assistant messages with matching `agentId` SHALL appear in that tab. The active tab's messages SHALL be displayed in the chat area.

#### Scenario: Switch between tabs
- **WHEN** user clicks the "Frontend Engineer" tab
- **THEN** the chat area shows only events and messages from the frontend agent

### Requirement: Team message visualization
`teammate_message` events SHALL be displayed as a distinct message type showing the sender, recipient, and content.

#### Scenario: Inter-agent message
- **WHEN** a `teammate_message` event arrives with `{ from: "backend", to: "frontend", content: "API ready" }`
- **THEN** it appears in both the "backend" and "frontend" tabs as a coordination message
