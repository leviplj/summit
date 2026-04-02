## ADDED Requirements

### Requirement: EventStream push and end
The `EventStream<T>` class SHALL support `push(event: T)` to buffer and broadcast an event to all active subscribers, and `end()` to signal that no more events will be emitted.

#### Scenario: Push events to subscribers
- **WHEN** a producer calls `stream.push(event)` while subscribers are active
- **THEN** each subscriber's async iterator yields the event

#### Scenario: End the stream
- **WHEN** a producer calls `stream.end()`
- **THEN** all active subscriber iterators complete (return `{ done: true }`)

#### Scenario: Push after end is ignored
- **WHEN** a producer calls `stream.push(event)` after `stream.end()`
- **THEN** the event is silently discarded

### Requirement: EventStream subscribe with replay
The `EventStream<T>` SHALL support `subscribe(afterId?: number)` returning an `AsyncIterable<T>` that replays buffered events starting from `afterId`, then yields new events as they arrive.

#### Scenario: Subscribe from the beginning
- **WHEN** a consumer calls `stream.subscribe(0)` after 3 events have been pushed
- **THEN** the iterator yields all 3 buffered events, then waits for new events

#### Scenario: Subscribe with afterId for replay
- **WHEN** a consumer calls `stream.subscribe(2)` after 5 events have been pushed
- **THEN** the iterator yields events 2, 3, 4, then waits for new events

#### Scenario: Subscribe to an ended stream
- **WHEN** a consumer calls `stream.subscribe(0)` after `stream.end()` has been called
- **THEN** the iterator yields all buffered events, then completes

### Requirement: Multiple concurrent subscribers
The `EventStream<T>` SHALL support multiple independent subscribers, each with their own iteration state.

#### Scenario: Two subscribers at different offsets
- **WHEN** subscriber A calls `subscribe(0)` and subscriber B calls `subscribe(3)`
- **THEN** subscriber A receives all events from the start while subscriber B receives events from index 3 onward, independently

### Requirement: Consumer cleanup on break
The `EventStream<T>` SHALL clean up subscriber state when a consumer breaks out of a `for await` loop.

#### Scenario: Consumer breaks early
- **WHEN** a consumer breaks out of `for await (const event of stream.subscribe())`
- **THEN** the subscriber's internal state is cleaned up and does not leak memory

### Requirement: EventBus subscribe returns AsyncIterable
The `subscribe()` function in the event bus SHALL return `AsyncIterable<StreamEvent> | null` instead of an unsub callback.

#### Scenario: Subscribe to active query
- **WHEN** a caller invokes `subscribe(sessionId, afterId)`
- **THEN** it receives an `AsyncIterable<StreamEvent>` that yields events for that query

#### Scenario: Subscribe to nonexistent query
- **WHEN** a caller invokes `subscribe(sessionId, afterId)` for a session with no active query
- **THEN** it receives `null`
