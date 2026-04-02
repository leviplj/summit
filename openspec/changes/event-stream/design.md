## Context

The current event bus (`eventBus.ts`) uses a callback pattern: `emit()` pushes events to a `Set<listener>`, `subscribe()` registers a callback and returns an unsub function. It manually buffers events in an array for replay when late subscribers join (SSE reconnection with `afterId`). Consumers like SSE endpoints and Discord then bridge these callbacks into their own streaming patterns.

The provider layer already produces `AsyncIterable<AppEvent>` — the queryManager consumes it with `for await`, then calls `emit()` to push into the callback system. Consumers then convert callbacks back into streams. The `EventStream` eliminates this callback middle layer.

## Goals / Non-Goals

**Goals:**
- Create an `EventStream<T>` class that is both pushable and async-iterable
- Support multiple concurrent consumers with buffered replay
- Simplify SSE endpoints and Discord subscription to `for await` loops
- Keep the same external SSE behavior (clients see no change)

**Non-Goals:**
- Backpressure enforcement (consumers that fall behind just get events queued)
- Replacing the GlobalEvent system (callbacks are fine for lifecycle events)
- Changing the provider `AsyncIterable<AppEvent>` interface
- Adding new event types or changing event semantics

## Decisions

### 1. EventStream as a class with push/end/subscribe

```typescript
class EventStream<T> {
  push(event: T): void;       // Producer side
  end(): void;                 // Signal completion
  subscribe(afterId?: number): AsyncIterable<T>;  // Consumer side
}
```

Each `subscribe()` call returns an independent `AsyncIterable` that replays buffered events from `afterId` then yields new events as they arrive. Multiple consumers can subscribe independently.

**Why over transforming the provider AsyncIterable directly**: The event bus serves as a fan-out point — one producer, many consumers. A simple passthrough of the provider's iterable doesn't support multiple subscribers or late-join replay.

### 2. Internal implementation with resolve-queue pattern

Each subscriber gets its own promise-based queue. When `push()` is called, it resolves the pending promise for each subscriber. When a subscriber's `for await` loop pulls the next value, it either gets a buffered event or waits on a new promise.

**Why over Node.js EventEmitter or Streams**: No external dependencies, minimal code (~40 lines), and the async iterator protocol handles cleanup naturally when the consumer breaks out of the loop.

### 3. ActiveQuery keeps the EventStream instance

`ActiveQuery` replaces its `events: StreamEvent[]` + `listeners: Set<...>` with a single `stream: EventStream<StreamEvent>`. The `emit()` function calls `stream.push()`. The `finalize()` function calls `stream.end()`. The `subscribe()` function delegates to `stream.subscribe(afterId)`.

### 4. SSE endpoints consume with for-await

The session SSE endpoint becomes:

```typescript
const stream = subscribe(id, after);
if (!stream) { return 204; }
for await (const event of stream) {
  controller.enqueue(`id: ${event.id}\ndata: ${JSON.stringify(event.data)}\n\n`);
  if (event.data.type === "done") break;
}
```

The `ReadableStream` wrapper stays (SSE requires it), but the internal wiring is simpler.

### 5. ExtensionAPI subscribe signature changes

`api.events.subscribe()` returns `AsyncIterable<StreamEvent> | null` instead of `(() => void) | null`. This is a breaking change for the extension API, but since the extension system was just introduced, there are no external consumers to migrate.

## Risks / Trade-offs

- **[Memory for buffered events]** → Events are buffered in the EventStream until `end()` + cleanup timeout. Same behavior as current system — no regression. The 60-second cleanup timeout in `finalize` stays.
- **[Breaking ExtensionAPI]** → `subscribe()` return type changes. Mitigation: only Discord uses it, and we're updating Discord in this change.
- **[Leaked iterators]** → If a consumer subscribes but never iterates, the subscriber entry stays in memory. Mitigation: `end()` resolves all pending promises, allowing GC. Same risk profile as current listener pattern.
