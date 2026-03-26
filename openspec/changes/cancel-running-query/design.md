## Context

Summit currently has no way to stop a running query. Once `startQuery` is called in `queries.ts`, the SDK's `query()` async iterator runs to completion. The `for await` loop in `runQuery` blocks until all messages are consumed or an error occurs. The UI disables the input textarea and send button during this time, offering no cancel affordance.

The codebase is a Nuxt 4 app with:
- **Server utils**: `queries.ts` (SDK query execution with `startQuery`, `runQuery`, `finalize`, `active` map, `emit` helper), `sessions.ts` (CRUD + persistence)
- **Shared types**: `AppEvent` (event union type), `SessionStatus` (status enum), `StoredSession`
- **Frontend**: `useChat.ts` composable (orchestrates send, streaming, event handling), `useSessionStore.ts` (session CRUD), `index.vue` (UI with send button)
- **SDK**: `query()` accepts `abortController` in options; the returned async iterator has a `.close()` method

## Goals / Non-Goals

**Goals:**
- Users can cancel a running query at any time via a stop button
- The server aborts the SDK query cleanly using the SDK's built-in `abortController` option
- Partial conversation results (user message + any streamed assistant text) are preserved
- The UI transitions smoothly back to idle state after cancellation

**Non-Goals:**
- Undo/rollback of tool side effects (file writes, shell commands) that already executed before cancellation
- Cancelling queries from sessions other than the active one (future enhancement)
- Retry/re-send of the cancelled prompt (user can manually re-send)

## Decisions

### 1. Abort mechanism: SDK `abortController` option

An `AbortController` is created per query and passed to `query({ options: { abortController } })`. A server-side map (`abortControllers: Map<string, AbortController>`) stores the controller keyed by session ID. The cancel endpoint calls `controller.abort()`, which signals the SDK to stop.

**Current state:** `runQuery` does not create or pass an `AbortController`. The `active` map tracks query status but has no abort handle.

**Alternatives considered:**
- Calling `.close()` on the query iterator: Requires storing the iterator reference, and `.close()` is more of a forceful kill. `abortController` is the SDK's intended cancellation API and integrates with the standard `AbortSignal` pattern.
- Sending a kill signal to the CLI subprocess: Too low-level; the SDK's `abortController` handles subprocess cleanup internally.

### 2. AbortController storage: separate map alongside `active`

A new `Map<string, AbortController>` called `abortControllers` sits alongside the existing `active` map in `queries.ts`. It is set when `runQuery` starts and deleted in `finalize`.

**Alternatives considered:**
- Adding the controller to the `ActiveQuery` interface: Viable but mixes concerns — `ActiveQuery` is about event buffering for SSE clients, while the abort controller is about query lifecycle. Keeping them separate is cleaner and avoids exposing the controller to stream consumers.

### 3. Cancel endpoint: `POST /api/sessions/[id]/cancel`

A new route handler at `server/routes/api/sessions/[id]/cancel.post.ts`. It looks up the abort controller, calls `.abort()`, and returns `{ ok: true }`. Returns 409 if no active query, 404 if session doesn't exist.

**Alternatives considered:**
- `DELETE /api/sessions/[id]/query`: Semantically appealing but `DELETE` implies removing a resource. Cancellation is an action, not a deletion. `POST` to a `/cancel` sub-resource is a more standard RPC-style pattern consistent with the existing `/elicitation` and `/ask-user` endpoints.

### 4. New `"cancelled"` AppEvent type

A new event type `"cancelled"` is emitted before `"done"` when a query is aborted. This lets the frontend distinguish cancellation from normal completion and avoids showing an error state.

**Current state:** `AppEvent.type` is a union of `"init" | "thinking" | "tool_use" | "tool_result" | "text" | "result" | "error" | "done"`. Adding `"cancelled"` to this union is non-breaking.

**Alternatives considered:**
- Emitting `"done"` with a `cancelled: true` field: Works but less explicit. A dedicated type is cleaner for the `switch` in `handleEvent` and makes the event stream self-documenting.
- Emitting `"error"` with a cancellation message: Misleading — cancellation is user-initiated, not an error.

### 5. Partial result preservation: save in catch/finally of `runQuery`

When `abort()` is called, the SDK throws an abort error (or the `for await` loop exits). The `runQuery` function's existing persistence logic already runs after the loop. The abort case is handled by detecting the abort signal (`signal.aborted`) and skipping the error event emission while still persisting whatever text has been accumulated.

**Current state:** `runQuery` persists `state.assistantText` after the loop. This already captures partial text. The only change is to not treat an abort as an error.

### 6. UI: conditional stop button in the input area

The existing send button (`<SendHorizontal>` icon) is conditionally replaced with a stop button (`<Square>` icon from lucide-vue-next) when `loading` is true. The stop button calls a `cancel()` function in `useChat` that sends the POST request.

**Alternatives considered:**
- Floating stop button in the message area: Less discoverable and inconsistent with other chat UIs. Replacing the send button is the standard pattern (used by ChatGPT, Claude.ai, etc.).
- Separate button next to send: Adds visual clutter. The send and stop actions are mutually exclusive — only one should be visible at a time.

## Risks / Trade-offs

- **Tool side effects are not rolled back**: If the agent wrote files or ran commands before cancellation, those changes persist in the worktree. This is acceptable — the user can review changes in the changed files panel and the worktree is isolated from the source repo.

- **Abort race condition**: If the user cancels at the exact moment the query finishes naturally, both the normal completion path and abort path may run. Mitigation: `finalize` is idempotent, and the abort controller is deleted in `finalize` so a late cancel call gets a 409.

- **Partial assistant message may be mid-word**: The saved text is whatever was streamed before abort. This is expected behavior and matches other AI chat products.

## Open Questions

_None — the scope is small and well-defined._
