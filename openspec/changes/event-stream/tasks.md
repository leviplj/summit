## 1. EventStream Class

- [x] 1.1 Create `frontend/server/utils/EventStream.ts` with `EventStream<T>` class implementing `push(event)`, `end()`, and `subscribe(afterId?)` returning `AsyncIterable<T>`. Support multiple concurrent subscribers with buffered replay.

## 2. Refactor EventBus

- [x] 2.1 Update `ActiveQuery` in `eventBus.ts` to use `EventStream<StreamEvent>` instead of `events: StreamEvent[]` + `listeners: Set<...>`.
- [x] 2.2 Update `emit()` to call `stream.push()` instead of manually iterating listeners.
- [x] 2.3 Update `subscribe()` to return `AsyncIterable<StreamEvent> | null` by delegating to `stream.subscribe(afterId)`.
- [x] 2.4 Update `finalize()` to call `stream.end()` instead of manually clearing listeners.

## 3. Update SSE Endpoints

- [x] 3.1 Refactor `routes/api/sessions/[id]/stream.get.ts` to use `for await` over the subscribe iterable instead of callback-based wiring.
- [x] 3.2 Verify `routes/api/events/stream.get.ts` (global events) — no changes needed, confirm it stays callback-based.

## 4. Update Discord Extension

- [x] 4.1 Refactor `subscribeToQuery` in `extensions/discord/index.ts` to use `for await` over the subscribe iterable instead of callback + unsub pattern.
- [x] 4.2 Refactor `handleCrossChannelNotification` to use `for await` instead of callback-based subscribe.

## 5. Update ExtensionAPI

- [x] 5.1 Update `events.subscribe` signature in `extensions/types.ts` to return `AsyncIterable<StreamEvent> | null`.

## 6. Verification

- [x] 6.1 Build passes with no errors.
- [x] 6.2 Dev server starts and SSE streaming works (query events reach the browser).
