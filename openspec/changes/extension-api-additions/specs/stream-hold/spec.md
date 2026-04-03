## ADDED Requirements

### Requirement: Refcount-based stream hold
The ExtensionAPI SHALL expose `events.holdStream(sessionId)` that prevents the session's EventStream from closing. It SHALL return a `release()` function. The stream SHALL close only when all holds are released and the query has finalized.

#### Scenario: Single hold and release
- **WHEN** an extension calls `holdStream(sessionId)` and later calls `release()`
- **THEN** the stream remains open until `release()` is called and `finalize()` has been called

#### Scenario: Multiple concurrent holds
- **WHEN** two extensions each call `holdStream(sessionId)`
- **THEN** the stream remains open until both call their respective `release()` functions

#### Scenario: finalize() called while holds are active
- **WHEN** `finalize(sessionId)` is called but holds remain
- **THEN** the ActiveQuery is marked `done = true` but the EventStream does NOT call `end()` and the cleanup timeout is NOT scheduled

#### Scenario: Last hold released after finalize
- **WHEN** the last `release()` is called and `finalize()` was already called
- **THEN** `stream.end()` is called and the cleanup timeout is scheduled

### Requirement: Hold safety timeout
Orphaned holds (where `release()` is never called) SHALL be auto-released after a configurable timeout (default 5 minutes) with a warning log.

#### Scenario: Hold not released within timeout
- **WHEN** `holdStream()` is called but `release()` is not called within 5 minutes
- **THEN** the hold is automatically released and a warning is logged

### Requirement: holdStream on nonexistent session
`holdStream()` SHALL return `null` if no ActiveQuery exists for the session.

#### Scenario: No active query
- **WHEN** `holdStream(sessionId)` is called for a session with no active query
- **THEN** it returns `null`
