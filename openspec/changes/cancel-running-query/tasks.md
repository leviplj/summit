## 1. Shared Types

- [ ] 1.1 Add `"cancelled"` to the `AppEvent.type` union in `shared/types.ts`

## 2. Server: AbortController Management

- [ ] 2.1 Add an `abortControllers` map (`Map<string, AbortController>`) in `queries.ts` alongside the existing `active` map
- [ ] 2.2 In `runQuery`, create an `AbortController`, store it in the map keyed by session ID, and pass it to `query({ options: { abortController } })`
- [ ] 2.3 In `finalize`, delete the session's entry from the `abortControllers` map
- [ ] 2.4 Export a `cancelQuery(sessionId)` function that looks up the controller, calls `.abort()`, and returns `true`; returns `false` if no active query

## 3. Server: Abort Handling in runQuery

- [ ] 3.1 Detect abort in the `catch` block of `runQuery` by checking if the error is an abort error (`signal.aborted` or error name `"AbortError"`); skip emitting an `"error"` event in that case
- [ ] 3.2 Emit `{ type: "cancelled" }` via `emit()` when the query was aborted, before `finalize` emits `"done"`
- [ ] 3.3 Ensure partial results are still persisted: the user message and any accumulated `state.assistantText` are saved to the session even on abort

## 4. Server: Cancel API Endpoint

- [ ] 4.1 Create `server/routes/api/sessions/[id]/cancel.post.ts` route handler
- [ ] 4.2 Validate the session exists (404 if not)
- [ ] 4.3 Call `cancelQuery(sessionId)` — return `{ ok: true }` on success, 409 if no active query

## 5. Frontend: useChat Cancel Support

- [ ] 5.1 Add a `cancel()` async function in `useChat` that sends `POST /api/sessions/{activeSessionId}/cancel`
- [ ] 5.2 Handle the `"cancelled"` event in `handleEvent`: set `session.loading = false`, `session.status = "idle"`, clear `session.events`
- [ ] 5.3 Export `cancel` from `useChat` return object

## 6. Frontend: Stop Button UI

- [ ] 6.1 Import `Square` icon from `lucide-vue-next` in `index.vue`
- [ ] 6.2 Destructure `cancel` from `useChat()` in `index.vue`
- [ ] 6.3 Replace the send button with a conditional: show stop button (Square icon) when `loading` is true, show send button (SendHorizontal icon) when `loading` is false
- [ ] 6.4 Stop button calls `cancel()` on click; disable the stop button after click until the query finishes (prevent double-cancel)
