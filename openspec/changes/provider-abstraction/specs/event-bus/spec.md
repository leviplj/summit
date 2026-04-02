## ADDED Requirements

### Requirement: Event bus manages active queries
The event bus SHALL maintain a `Map<string, ActiveQuery>` tracking all active and recently-completed queries. Each `ActiveQuery` SHALL store: buffered events, done status, listener set, source string, and session ID.

#### Scenario: Query events are buffered
- **WHEN** `emit(sessionId, appEvent)` is called
- **THEN** the event SHALL be appended to the query's buffer with an incrementing ID and delivered to all registered listeners

### Requirement: Source tracking on queries
`ActiveQuery` SHALL include a `source: string` field set when the query starts (e.g., `"web"`, `"discord"`). The event bus SHALL expose `getQuerySource(sessionId): string | undefined` for channels to check who initiated the current query.

#### Scenario: Discord-initiated query has discord source
- **WHEN** `startQuery(sessionId, text, "discord")` is called
- **THEN** `getQuerySource(sessionId)` SHALL return `"discord"`

#### Scenario: Default source is web
- **WHEN** `startQuery(sessionId, text)` is called without a source
- **THEN** `getQuerySource(sessionId)` SHALL return `"web"`

### Requirement: Subscribe with replay
`subscribe(sessionId, afterId, listener)` SHALL replay all buffered events with `id > afterId` to the listener, then register it for future events. It SHALL return an unsubscribe function, or `null` if the query is already done and all events have been replayed.

#### Scenario: Late subscriber gets buffered events
- **WHEN** a subscriber connects with `afterId = 0` after 5 events have been emitted
- **THEN** it SHALL receive all 5 buffered events immediately, then receive future events live

### Requirement: Finalization and cleanup
`finalize(sessionId)` SHALL mark the query as done, clear listeners, and schedule removal of the query buffer after a timeout (60 seconds). After finalization, `subscribe()` SHALL still replay buffered events until the buffer is removed.

#### Scenario: SSE reconnect after finalize
- **WHEN** a client reconnects within 60 seconds of query completion
- **THEN** `subscribe()` SHALL replay all buffered events and return `null` (no live subscription needed)

### Requirement: Event bus is provider-agnostic
The event bus SHALL NOT import any AI SDK or provider module. It SHALL only deal with `AppEvent` objects and session IDs.

#### Scenario: Event bus has no SDK dependencies
- **WHEN** the event bus module is loaded
- **THEN** its import graph SHALL NOT include any AI SDK packages
