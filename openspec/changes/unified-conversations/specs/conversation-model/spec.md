## ADDED Requirements

### Requirement: Conversation type definition
The system SHALL define a `Conversation` type with the following fields:
- `id: string` — unique within the session (`"lead"` for the orchestrator)
- `role: string` — human-readable label (e.g., `"lead"`, `"backend-engineer"`)
- `status: "idle" | "working" | "done" | "error" | "cancelled"`
- `messages: ChatMessage[]` — ordered chat messages belonging to this conversation
- `model?: string` — optional per-conversation model override

#### Scenario: Lead conversation structure
- **WHEN** a Conversation has `id: "lead"`
- **THEN** it SHALL have `role: "lead"` and `status: "idle"` at creation time

#### Scenario: Teammate conversation structure
- **WHEN** a Conversation is created for a teammate with role "backend-engineer"
- **THEN** it SHALL have a generated `id` derived from the role, `role: "backend-engineer"`, and `status: "working"`

### Requirement: Session contains conversations array
`StoredSession` SHALL replace `messages: ChatMessage[]` and `teammates?: StoredTeammate[]` with a single `conversations: Conversation[]` field.

#### Scenario: New session creation
- **WHEN** a new session is created
- **THEN** it SHALL contain exactly one conversation with `id: "lead"`, `role: "lead"`, `status: "idle"`, and empty `messages[]`

#### Scenario: Session with teammates
- **WHEN** a session has a lead and two teammates
- **THEN** `conversations` SHALL contain three entries: the lead at index 0 and the two teammates in spawn order

### Requirement: StoredTeammate type removed
The `StoredTeammate` type SHALL be removed. All functionality previously provided by `StoredTeammate` is covered by `Conversation`.

#### Scenario: Type replacement
- **WHEN** code previously referenced `StoredTeammate`
- **THEN** it SHALL use `Conversation` instead with equivalent fields (`id`, `role`, `status`, `messages`)

### Requirement: ChatMessage drops agentId
`ChatMessage` SHALL NOT contain an `agentId` field. Message ownership is determined by which conversation's `messages[]` array contains the message.

#### Scenario: Message belongs to conversation
- **WHEN** a message is created for the backend-engineer conversation
- **THEN** it SHALL be appended to that conversation's `messages[]` without any `agentId` field

### Requirement: Lead conversation created at session creation
Every new session SHALL be initialized with a lead conversation. The lead conversation SHALL always be `conversations[0]`.

#### Scenario: Session initialization
- **WHEN** `POST /api/sessions` is called
- **THEN** the returned session SHALL have `conversations[0]` with `id: "lead"` and empty messages

### Requirement: Teammate conversations cleared on new query
When a new query starts on a session, all conversations except the lead SHALL be removed. The lead conversation's messages SHALL be preserved.

#### Scenario: New query clears teammates
- **WHEN** a session has conversations `["lead", "backend", "frontend"]` and a new query starts
- **THEN** the session SHALL have only the `"lead"` conversation, with its messages intact

### Requirement: Backward-compatible session migration
When loading a session file that contains the old format (`messages[]` at root and optional `teammates[]`), the system SHALL convert it to the `conversations[]` format in memory.

#### Scenario: Migrate old session with no teammates
- **WHEN** a session file has `messages: [...]` and no `teammates` field
- **THEN** loading SHALL produce `conversations: [{ id: "lead", role: "lead", status: "idle", messages: [...] }]`

#### Scenario: Migrate old session with teammates
- **WHEN** a session file has `messages: [...]` and `teammates: [{ id: "backend", role: "backend", status: "done", messages: [...] }]`
- **THEN** loading SHALL produce `conversations: [{ id: "lead", role: "lead", status: "idle", messages: [...] }, { id: "backend", role: "backend", status: "done", messages: [...] }]`

#### Scenario: Save migrated session in new format
- **WHEN** a migrated session is saved
- **THEN** the file SHALL be written with `conversations[]` and WITHOUT top-level `messages` or `teammates` fields

### Requirement: SessionListItem uses conversations
`SessionListItem` SHALL contain `conversations: Conversation[]` instead of `messages[]` and `teammates[]`.

#### Scenario: Session list response
- **WHEN** `GET /api/sessions` returns session list items
- **THEN** each item SHALL have a `conversations` array matching the session's conversations
