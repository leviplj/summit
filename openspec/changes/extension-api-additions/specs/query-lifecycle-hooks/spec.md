## ADDED Requirements

### Requirement: onBeforeQuery hook registration
The ExtensionAPI SHALL expose `events.onBeforeQuery(hook)` that registers a callback invoked before each query executes. The hook SHALL receive `{ sessionId: string, prompt: string, source: string }`. The method SHALL return an unsubscribe function.

#### Scenario: Extension registers a hook
- **WHEN** an extension calls `api.events.onBeforeQuery(hook)`
- **THEN** the hook is added to the listener set and an unsubscribe function is returned

#### Scenario: Hook fires before query execution
- **WHEN** `startQuery()` is called for a session
- **THEN** all registered onBeforeQuery hooks fire after `initQuery()` succeeds but before the provider's `runQuery()` executes

#### Scenario: Multiple hooks run concurrently
- **WHEN** two extensions have registered onBeforeQuery hooks
- **THEN** both hooks fire concurrently via `Promise.all()` and the query does not start until all hooks settle

#### Scenario: Unsubscribe removes the hook
- **WHEN** an extension calls the unsubscribe function returned from `onBeforeQuery`
- **THEN** the hook is no longer invoked on subsequent queries

### Requirement: onBeforeQuery hooks are observers
Hooks SHALL NOT be able to modify the query prompt, cancel the query, or alter execution. They observe and may spawn side work.

#### Scenario: Hook throws an error
- **WHEN** an onBeforeQuery hook throws
- **THEN** the error is logged but the query proceeds normally
