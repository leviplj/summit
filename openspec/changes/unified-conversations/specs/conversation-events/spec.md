## ADDED Requirements

### Requirement: Events carry conversationId instead of agentId
`AppEvent` objects scoped to a specific conversation SHALL carry a `conversationId: string` field instead of `agentId`.

#### Scenario: Lead conversation event
- **WHEN** the lead conversation emits a `text` event
- **THEN** the event MAY omit `conversationId` (absence implies lead) OR set `conversationId: "lead"`

#### Scenario: Teammate conversation event
- **WHEN** a teammate conversation with id "backend" emits a `text` event
- **THEN** the event SHALL have `conversationId: "backend"`

### Requirement: Team lifecycle events use conversation terminology
Team lifecycle events SHALL be renamed:
- `team_created` → `team_created` (unchanged — session-level, no conversationId)
- `teammate_status` → `conversation_status`
- `teammate_message` → `conversation_message`
- `teammate_done` → `conversation_done`

#### Scenario: Conversation status event
- **WHEN** a teammate conversation transitions to "done"
- **THEN** a `conversation_status` event SHALL be emitted with `conversationId` and `status: "done"`

#### Scenario: Inter-conversation message event
- **WHEN** conversation "backend" sends a message to conversation "frontend"
- **THEN** a `conversation_message` event SHALL be emitted with `fromConversationId: "backend"` and `toConversationId: "frontend"`

### Requirement: Unified event routing
The frontend event handler SHALL route events based on the presence of `conversationId`:
- Events with `conversationId` → update the matching conversation's state
- Events without `conversationId` → update session-level state

There SHALL NOT be separate handler functions for orchestrator vs teammate events.

#### Scenario: Route teammate event
- **WHEN** a `text` event arrives with `conversationId: "backend"`
- **THEN** it SHALL be handled by the same handler that processes lead events, targeting the "backend" conversation

#### Scenario: Route session-level event
- **WHEN** a `done` event arrives without `conversationId`
- **THEN** it SHALL update session-level state (loading, status)

### Requirement: Stream state unified per conversation
The frontend SHALL maintain a single stream state map keyed by conversation ID, replacing the separate `streamState` and `teammateStreamState` maps.

#### Scenario: Streaming text accumulation
- **WHEN** `text` events arrive for conversation "backend"
- **THEN** the stream state for key "backend" SHALL accumulate the text
- **AND** the same mechanism SHALL be used for the "lead" conversation

### Requirement: Ask-user interactions keyed by conversationId
Pending ask-user interactions SHALL be keyed by `sessionId:conversationId` uniformly. The orchestrator uses `sessionId:lead`.

#### Scenario: Orchestrator ask-user
- **WHEN** the lead conversation triggers an ask-user
- **THEN** it SHALL be stored with key `sessionId:lead`

#### Scenario: Teammate ask-user
- **WHEN** conversation "backend" triggers an ask-user
- **THEN** it SHALL be stored with key `sessionId:backend`

#### Scenario: Resolve teammate ask-user
- **WHEN** the frontend posts to `/api/sessions/{id}/ask-user` with `conversationId: "backend"`
- **THEN** the interaction keyed by `sessionId:backend` SHALL be resolved

### Requirement: Extension API uses conversationId
`queries.run()` SHALL accept `conversationId` instead of `agentId` in its options. During a transition period, `agentId` SHALL be accepted as an alias with a deprecation warning logged.

#### Scenario: Extension spawns teammate with conversationId
- **WHEN** an extension calls `api.queries.run(sessionId, prompt, { conversationId: "backend" })`
- **THEN** the query SHALL run with events tagged with `conversationId: "backend"`

#### Scenario: Deprecated agentId still works
- **WHEN** an extension calls `api.queries.run(sessionId, prompt, { agentId: "backend" })`
- **THEN** the query SHALL run successfully AND a deprecation warning SHALL be logged

### Requirement: Hold/release pattern unchanged
The stream hold/release mechanism SHALL continue to work as today. Conversations holding the stream prevent session finalization until all holds are released.

#### Scenario: Teammate holds stream
- **WHEN** a teammate conversation starts a sub-query
- **THEN** `holdStream(sessionId)` SHALL be called, preventing the session from emitting `done` until released
