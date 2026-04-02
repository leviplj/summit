## Why

The event bus uses a callback-based pub/sub pattern with manual listener sets, unsubscribe functions, and buffered replay logic. Consumers (SSE endpoints, Discord extension) must manually wire callbacks into `ReadableStream` controllers. The provider side already produces `AsyncIterable<AppEvent>` — but the event bus converts that into callbacks, and then consumers convert callbacks back into streams. An `EventStream<T>` class that implements `AsyncIterable` eliminates this round-trip and simplifies every consumer.

## What Changes

- New `EventStream<T>` class: pushable on the producer side, `for await`-able on the consumer side, with buffered replay for late subscribers
- `ActiveQuery` uses `EventStream<StreamEvent>` instead of a manual listener `Set` and event array
- SSE endpoints simplified to `for await` over the stream instead of manually wiring `subscribe` callbacks into `ReadableStream` controllers
- Discord extension's `subscribeToQuery` simplified to `for await` instead of callback + unsub tracking
- `subscribe()` in eventBus returns an `AsyncIterable` instead of an unsub callback
- **Removed**: Manual listener management (`listeners.add/delete/clear`) from ActiveQuery
- **Kept as-is**: GlobalEvent system (callbacks are appropriate for fire-and-forget lifecycle events)

## Capabilities

### New Capabilities
- `event-stream`: Typed `EventStream<T>` class implementing `AsyncIterable` with push/end/subscribe semantics and buffered replay support

### Modified Capabilities

_(none — no existing spec-level requirements change, this is an internal refactor)_

## Impact

- **Code**: `frontend/server/utils/eventBus.ts` (major refactor), SSE endpoints in `frontend/server/routes/api/` (simplified), `frontend/server/extensions/discord/index.ts` (simplified subscription), `frontend/server/extensions/types.ts` (subscribe signature change)
- **APIs**: SSE endpoint behavior unchanged from the client's perspective. ExtensionAPI `events.subscribe()` return type changes from `(() => void) | null` to `AsyncIterable<StreamEvent> | null` — **breaking for extensions using subscribe**
- **Dependencies**: None
