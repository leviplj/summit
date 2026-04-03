## ADDED Requirements

### Requirement: Sub-query execution within active session
The ExtensionAPI SHALL expose `queries.run(sessionId, prompt, options)` where options includes a required `agentId: string` and optional `source: string`. It SHALL run a query within an already-active session, sharing the existing EventStream. It SHALL return a `Promise<void>` that resolves when the sub-query completes.

#### Scenario: Successful sub-query
- **WHEN** an extension calls `queries.run(sessionId, prompt, { agentId: "backend" })`
- **THEN** the query runs through the full pipeline (session lookup, provider, interaction hooks, persistence) using the existing EventStream and resolves when done

#### Scenario: No active query exists
- **WHEN** `queries.run()` is called for a session with no active query
- **THEN** the promise rejects with an error

### Requirement: Sub-queries bypass the one-per-session guard
`queries.run()` SHALL NOT call `initQuery()`. Multiple `queries.run()` calls SHALL be allowed concurrently on the same session.

#### Scenario: Concurrent sub-queries
- **WHEN** three `queries.run()` calls are made on the same session simultaneously
- **THEN** all three run concurrently without blocking each other

### Requirement: Sub-query events tagged with agentId
Every event emitted by a sub-query SHALL include the `agentId` field from the options. Events from `queries.start()` (no agentId) SHALL remain untagged for backwards compatibility.

#### Scenario: Event tagging
- **WHEN** a sub-query with `agentId: "frontend"` emits a `text` event
- **THEN** the event in the stream includes `{ type: "text", agentId: "frontend", ... }`

#### Scenario: Normal query events unchanged
- **WHEN** a query started via `queries.start()` emits events
- **THEN** events do not include an `agentId` field

### Requirement: Sub-query holds the stream
`queries.run()` SHALL automatically call `holdStream()` before starting and `release()` when done or on error.

#### Scenario: Stream stays open during sub-query
- **WHEN** the orchestrator's main query calls `finalize()` while a sub-query is still running
- **THEN** the stream remains open until the sub-query completes and releases its hold

### Requirement: Sub-query message persistence
Each sub-query SHALL persist its assistant response to `session.messages` with the `agentId` field attached. Messages SHALL be collected locally during execution and appended atomically on completion.

#### Scenario: Message with agentId
- **WHEN** a sub-query with `agentId: "backend"` completes with assistant text
- **THEN** `session.messages` contains `{ role: "assistant", content: "...", agentId: "backend" }`
