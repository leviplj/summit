## ADDED Requirements

### Requirement: ClientConversation type
The frontend SHALL define a `ClientConversation` type extending `Conversation` with ephemeral fields:
- `events: ToolEvent[]` — tool execution events (not persisted)
- `streamText: string` — live streaming text accumulation
- `askUser: AskUserQuestion[] | null` — pending ask-user interaction

#### Scenario: Client conversation during active query
- **WHEN** a teammate conversation is actively streaming
- **THEN** its `ClientConversation` SHALL have `events` populated with tool calls and `streamText` accumulating response text

### Requirement: Session store manages conversations
`useSessionStore` (or equivalent) SHALL manage conversations as part of session state. The separate `useTeamStore` composable SHALL be removed.

#### Scenario: Access conversations from session
- **WHEN** code needs the current session's conversations
- **THEN** it SHALL access them via the session store, not a separate team store

### Requirement: Active conversation tracking
The session store SHALL track which conversation is currently being viewed per session. This replaces the `activeTeammateId` concept.

#### Scenario: Default active conversation
- **WHEN** a session has no teammates (only lead)
- **THEN** the active conversation SHALL be the lead

#### Scenario: Switch active conversation
- **WHEN** the user clicks a teammate tab
- **THEN** the active conversation SHALL change to that teammate's conversation

#### Scenario: Active conversation survives session switching
- **WHEN** the user switches to another session and back
- **THEN** the previously active conversation SHALL be restored

### Requirement: Display messages from active conversation
The UI SHALL display messages and events from the active conversation. The computed properties `displayMessages`, `displayEvents`, and `displayAskUser` SHALL read from the active `ClientConversation`.

#### Scenario: Viewing lead conversation
- **WHEN** the active conversation is "lead"
- **THEN** the message area SHALL show the lead's messages and tool events

#### Scenario: Viewing teammate conversation
- **WHEN** the active conversation is "backend"
- **THEN** the message area SHALL show the backend conversation's messages and tool events

### Requirement: Tab bar visibility
The conversation tab bar SHALL only be shown when the session has more than one conversation (`conversations.length > 1`).

#### Scenario: Single conversation session
- **WHEN** a session has only the lead conversation
- **THEN** the tab bar SHALL NOT be rendered

#### Scenario: Multi-conversation session
- **WHEN** a session has lead + two teammate conversations
- **THEN** the tab bar SHALL render three tabs: "Lead", and two teammate tabs with role names

### Requirement: Tab bar shows conversation status
Each tab in the conversation tab bar SHALL display the conversation's current status with an appropriate icon.

#### Scenario: Working conversation tab
- **WHEN** a conversation has `status: "working"`
- **THEN** its tab SHALL show a spinner icon

#### Scenario: Done conversation tab
- **WHEN** a conversation has `status: "done"`
- **THEN** its tab SHALL show a check icon

#### Scenario: Conversation with pending ask-user
- **WHEN** a conversation has a non-null `askUser`
- **THEN** its tab SHALL show a question mark icon

### Requirement: Conversation state restored on page load
When the page loads and sessions are fetched, persisted conversations SHALL be restored into `ClientConversation` objects with empty ephemeral fields.

#### Scenario: Restore persisted teammates
- **WHEN** the page loads and a session has `conversations: [lead, backend, frontend]`
- **THEN** the session store SHALL create `ClientConversation` objects with `events: []`, `streamText: ""`, and `askUser: null` for each

### Requirement: Conversations cleared on new query in UI
When the user sends a new message, the frontend SHALL clear all non-lead conversations from the session's state before the query starts.

#### Scenario: New query resets conversations
- **WHEN** the user sends a message in a session that previously had teammates
- **THEN** the session SHALL revert to only the lead conversation in the UI
- **AND** the tab bar SHALL disappear (only one conversation)

### Requirement: Reconnect to active queries on load
When the page loads and a session has an active query, the frontend SHALL reconnect to the SSE stream and rebuild conversation state from incoming events.

#### Scenario: Reconnect with active teammates
- **WHEN** the page reloads while a session has active teammate conversations
- **THEN** the SSE stream SHALL deliver `team_created` and subsequent events to rebuild the conversation tabs
