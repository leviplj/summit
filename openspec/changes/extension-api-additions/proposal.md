## Why

Extensions that need to coordinate multiple concurrent agents (e.g., agent teams) cannot be built with the current ExtensionAPI. There is no way to intercept queries before they run, keep a stream alive while multiple agents write to it, run sub-queries within a session, route interaction responses to specific agents, or reconstruct event timing after reconnection. These gaps block agent teams and other advanced extensions.

## What Changes

- Add `events.onBeforeQuery(hook)` lifecycle hook that fires before a query executes, allowing extensions to intercept, modify context, or spawn additional work. Returns an unsubscribe function.
- Add `events.holdStream(sessionId)` refcount-based stream hold. Prevents the EventStream from closing while multiple agents are writing to the same session. Returns a release function; the stream closes only when all holds are released.
- Add `queries.run(sessionId, prompt, options)` for sub-query execution within an already-active session. Bypasses the one-query-per-session guard, shares the existing EventStream, tags all events with `agentId`, and returns a promise.
- Extend `interactions.createPendingAskUser` and `interactions.resolveAskUser` with an optional `askId` parameter so responses can be routed to a specific agent rather than the whole session.
- Add `timestamp` field to `StreamEvent`, automatically stamped by `emit()`. Enables timing reconstruction on reconnection and per-agent duration tracking.

## Capabilities

### New Capabilities
- `query-lifecycle-hooks`: onBeforeQuery hook for intercepting queries before execution
- `stream-hold`: Refcount-based stream holding to keep EventStreams alive across concurrent writers
- `sub-query-execution`: queries.run() for concurrent sub-queries within an active session, tagged with agentId
- `ask-id-routing`: Route ask_user interactions to specific agents via askId
- `event-timestamps`: Automatic timestamps on StreamEvent for timing reconstruction

### Modified Capabilities

(none — all additions are new API surface, no existing behavior changes)

## Impact

- **Types**: `ExtensionAPI` interface in `packages/summit-types/src/index.ts` gains new methods
- **Event bus**: `eventBus.ts` gains `holdStream()`, `onBeforeQuery` listener set, and `timestamp` on emit; `finalize()` checks hold refcount before closing
- **Query manager**: `queryManager.ts` gains `runSubQuery()` for agent-tagged sub-queries; fires onBeforeQuery hooks before running
- **Interactions**: `interactions.ts` maps gain composite `sessionId:askId` keys alongside plain `sessionId`
- **Extension API factory**: `createExtensionAPI.ts` wires new methods
- **No breaking changes**: All additions are optional; existing extensions and queries work unchanged
