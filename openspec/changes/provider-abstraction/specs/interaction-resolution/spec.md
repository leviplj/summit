## ADDED Requirements

### Requirement: AskUser resolution with source tracking
The interaction module SHALL maintain a `Map<string, PendingAskUser>` where each pending entry includes the `resolve` function and the query `source`. `resolveAskUser(sessionId, answers)` SHALL resolve the pending promise and return `true`, or return `false` if no pending entry exists.

#### Scenario: Web UI resolves ask_user
- **WHEN** the web UI POSTs to `/api/sessions/{id}/ask-user` with answers
- **THEN** `resolveAskUser()` SHALL resolve the pending promise, allowing the provider to continue the agent session

#### Scenario: Discord resolves ask_user
- **WHEN** a Discord thread reply is received for a session with a pending ask_user where source is `"discord"`
- **THEN** the Discord channel SHALL call `resolveAskUser()` with the reply mapped to answers

### Requirement: Elicitation resolution
The interaction module SHALL maintain a `Map<string, PendingElicitation>` keyed by elicitation ID. `resolveElicitation(elicitationId, result)` SHALL resolve the pending promise with `{ action, content? }` and return `true`, or return `false` if no pending entry exists.

#### Scenario: User accepts elicitation
- **WHEN** the user submits an elicitation form with `action: "accept"` and form data
- **THEN** `resolveElicitation()` SHALL resolve with the action and content, allowing the provider to continue

### Requirement: Pending interaction creation
The module SHALL expose `createPendingAskUser(sessionId, source): Promise<Record<string, string>>` and `createPendingElicitation(elicitationId): Promise<ElicitationResult>` that create pending entries and return Promises the provider awaits.

#### Scenario: Provider awaits ask_user
- **WHEN** the provider calls `hooks.onAskUser()` which internally calls `createPendingAskUser()`
- **THEN** the returned Promise SHALL block until `resolveAskUser()` is called

### Requirement: Cleanup on finalize
When a query is finalized (done, cancelled, or errored), the interaction module SHALL clean up any pending entries for that session ID to prevent memory leaks.

#### Scenario: Cancelled query cleans up pending ask_user
- **WHEN** a query is cancelled while an ask_user is pending
- **THEN** the pending entry for that session SHALL be removed

### Requirement: Interaction module is provider-agnostic
The interaction module SHALL NOT import any AI SDK or provider module. It SHALL deal only with session IDs, elicitation IDs, and plain data objects.

#### Scenario: Interaction module has no SDK dependencies
- **WHEN** the interaction module is loaded
- **THEN** its import graph SHALL NOT include any AI SDK packages
