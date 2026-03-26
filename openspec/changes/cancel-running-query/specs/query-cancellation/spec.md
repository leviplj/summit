## ADDED Requirements

### Requirement: Cancel a running query via API
The system SHALL expose a `POST /api/sessions/[id]/cancel` endpoint that aborts the currently running SDK query for the given session. If the session has an active query, the system SHALL signal the abort and return success. If no query is running, the system SHALL return a 409 status.

#### Scenario: Cancel an active query
- **WHEN** a query is running for session "abc-123" and the user sends `POST /api/sessions/abc-123/cancel`
- **THEN** the server aborts the SDK query, the query stream ends, and the endpoint returns `{ ok: true }`

#### Scenario: Cancel when no query is running
- **WHEN** no query is running for session "abc-123" and the user sends `POST /api/sessions/abc-123/cancel`
- **THEN** the endpoint returns a 409 error indicating no active query to cancel

#### Scenario: Cancel a non-existent session
- **WHEN** the user sends `POST /api/sessions/no-such-id/cancel`
- **THEN** the endpoint returns a 404 error

### Requirement: Server-side abort via AbortController
The system SHALL create an `AbortController` for each query execution and pass it to the SDK's `query()` options as `abortController`. The controller SHALL be stored in a map keyed by session ID so it can be triggered by the cancel endpoint.

#### Scenario: AbortController lifecycle
- **WHEN** a query starts for session "abc-123"
- **THEN** an `AbortController` is created, stored in the abort map, and passed to `query({ options: { abortController } })`
- **AND WHEN** the query finishes normally
- **THEN** the controller is removed from the abort map

#### Scenario: Abort signal triggers SDK cleanup
- **WHEN** the cancel endpoint calls `abort()` on the stored controller
- **THEN** the SDK query stops producing messages, the `for await` loop exits, and resources are cleaned up

### Requirement: Preserve partial results on cancellation
When a query is cancelled, the system SHALL persist any conversation history accumulated up to the cancellation point. The user message and any partial assistant response SHALL be saved to the session.

#### Scenario: Cancel during assistant streaming
- **WHEN** the assistant has streamed partial text "Here is my an" and the user cancels
- **THEN** the session persists the user message and a partial assistant message with content "Here is my an"

#### Scenario: Cancel before any assistant response
- **WHEN** the user cancels while the agent is still in the thinking/tool phase with no text output yet
- **THEN** the session persists only the user message (no empty assistant message is created)

### Requirement: Emit cancellation event to the stream
When a query is cancelled, the system SHALL emit an `AppEvent` with `type: "cancelled"` to all connected stream listeners before emitting `"done"`. This allows the frontend to distinguish cancellation from normal completion.

#### Scenario: Stream receives cancellation event
- **WHEN** a query is cancelled
- **THEN** the stream emits `{ type: "cancelled" }` followed by `{ type: "done" }`

### Requirement: Stop button replaces send button during active queries
The UI SHALL display a stop button in place of the send button while a query is running (`loading` is true). Clicking the stop button SHALL send a cancel request to the server.

#### Scenario: Stop button visible during query
- **WHEN** a query is running and `loading` is true
- **THEN** the send button is hidden and a stop button (square icon) is displayed in its place

#### Scenario: Stop button triggers cancel
- **WHEN** the user clicks the stop button
- **THEN** the UI sends `POST /api/sessions/{id}/cancel` and the button becomes disabled until the query finishes

#### Scenario: Return to send button after cancellation
- **WHEN** the query ends (via cancellation or normal completion)
- **THEN** the stop button is replaced by the send button and the input textarea is re-enabled

### Requirement: UI transitions to idle after cancellation
When the frontend receives a `"cancelled"` event, it SHALL set the session status to `"idle"`, clear loading state, and clear ephemeral events. The textarea SHALL be re-enabled for new input.

#### Scenario: Handle cancellation event
- **WHEN** the frontend receives `{ type: "cancelled" }` from the stream
- **THEN** `session.loading` is set to `false`, `session.status` is set to `"idle"`, and `session.events` is cleared

### Requirement: Input enabled during query for cancel-only interaction
While a query is running, the textarea SHALL remain disabled (no typing allowed). Only the stop button is interactive. After cancellation or completion, the textarea is re-enabled.

#### Scenario: Textarea disabled during query
- **WHEN** a query is running
- **THEN** the textarea is disabled and the stop button is the only actionable control in the input area
