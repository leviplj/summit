## ADDED Requirements

### Requirement: Automatic timestamps on StreamEvent
The `StreamEvent` interface SHALL include a `timestamp: number` field. The `emit()` function in eventBus.ts SHALL automatically set this to `Date.now()` when the event is created.

#### Scenario: Event includes timestamp
- **WHEN** `emit(sessionId, appEvent)` is called
- **THEN** the resulting StreamEvent has `timestamp` set to the current time in milliseconds

#### Scenario: Timestamp reflects emission time not creation time
- **WHEN** an AppEvent is created at time T1 and emitted at time T2
- **THEN** the StreamEvent's timestamp is T2 (emission time)

### Requirement: Timestamp on StreamEvent not AppEvent
Timestamps SHALL be added to `StreamEvent` only. The `AppEvent` interface SHALL remain unchanged.

#### Scenario: AppEvent unchanged
- **WHEN** a provider creates an AppEvent
- **THEN** the provider does not need to set any timestamp field

### Requirement: summit-types package updated
The `StreamEvent` interface in `packages/summit-types/src/index.ts` SHALL include the `timestamp` field.

#### Scenario: Type definition
- **WHEN** an extension imports `StreamEvent` from `summit-types`
- **THEN** the type includes `id: number`, `timestamp: number`, and `data: AppEvent`
