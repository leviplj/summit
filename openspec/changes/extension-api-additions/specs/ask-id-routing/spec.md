## ADDED Requirements

### Requirement: askId parameter on interaction methods
`interactions.createPendingAskUser(sessionId, source, askId?)` and `interactions.resolveAskUser(sessionId, answers, askId?)` SHALL accept an optional `askId` parameter. When provided, the pending interaction SHALL be keyed by `sessionId:askId` instead of plain `sessionId`.

#### Scenario: Create and resolve with askId
- **WHEN** `createPendingAskUser(sessionId, source, "backend")` is called
- **THEN** the pending interaction is stored under key `sessionId:backend` and `resolveAskUser(sessionId, answers, "backend")` resolves it

#### Scenario: Without askId (backwards compatible)
- **WHEN** `createPendingAskUser(sessionId, source)` is called without askId
- **THEN** behavior is identical to current implementation, keyed by plain `sessionId`

### Requirement: askId in emitted events
When a sub-query triggers ask_user, the emitted event SHALL include the `askId` field so consumers can route responses to the correct agent.

#### Scenario: ask_user event with askId
- **WHEN** a sub-query with `agentId: "backend"` triggers ask_user
- **THEN** the emitted event includes `{ type: "ask_user", agentId: "backend", askId: "backend", ... }`

#### Scenario: Normal ask_user event unchanged
- **WHEN** a standard query (no agentId) triggers ask_user
- **THEN** the emitted event has no `askId` field
