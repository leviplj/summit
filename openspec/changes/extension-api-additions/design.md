## Context

Summit's ExtensionAPI currently exposes session CRUD, event bus subscription/emission, query starting, provider registration, and ask_user/elicitation resolution. Extensions like Discord use these to react to queries and interact with users through external channels.

To support agent teams (and other multi-agent extensions), five gaps need filling: lifecycle hooks before query execution, stream lifetime management for concurrent writers, sub-query execution within a session, agent-specific interaction routing, and event timestamps for timing reconstruction.

**Prior art analyzed:**
- `tmp/summit` (our prior agent teams branch) — TeamManager tags every event with `teammateId`/`teammateName`, emits to a single shared EventStream per session. The UI filters events by teammate into `TeammateTab` objects with separate events/messages/status. MessageBus provides inter-agent communication with cycle detection.
- `tmp/pi-messenger` (Crew) — separate process per worker, no shared stream, file-based coordination. Wave-based orchestration. Doesn't fit our single-session model but validates the pattern of tagging events with agent identity.

Key files:
- `packages/summit-types/src/index.ts` — ExtensionAPI interface
- `frontend/server/extensions/createExtensionAPI.ts` — wires interface to implementations
- `frontend/server/utils/eventBus.ts` — EventStream, ActiveQuery, initQuery(), finalize()
- `frontend/server/utils/queryManager.ts` — startQuery(), runQuery()
- `frontend/server/utils/interactions.ts` — pendingAskUser/pendingElicitation maps

## Goals / Non-Goals

**Goals:**
- Each addition is independently useful — no coupling between the four features
- Zero breaking changes to existing extensions or query flow
- Minimal implementation surface — thin wrappers over existing internals

**Non-Goals:**
- Multi-agent orchestration logic (TeamManager, MessageBus — that's the agent-teams extension)
- Tab UI for per-agent events (that's the agent-teams UI work)
- Modifying the query pipeline itself (onBeforeQuery observes/spawns, doesn't replace)

## Decisions

### 1. onBeforeQuery as an observer hook, not middleware

`onBeforeQuery` fires after `initQuery()` creates the ActiveQuery but before the provider's `runQuery()` executes. Hooks receive `{ sessionId, prompt, source }` and return `void | Promise<void>`. They observe and can spawn side work, but don't modify or block the query.

**Why not middleware (modify/cancel):** Middleware chains add ordering complexity and error handling ambiguity. The agent teams extension doesn't need to block queries — it needs to detect them and spawn teammates. If interception is needed later, it can be added as a separate `onQueryMiddleware` without changing this hook.

**Where it fires:** In `queryManager.ts`, after `initQuery()` succeeds but before calling `provider.runQuery()`. All hooks run concurrently via `Promise.all()`.

### 2. holdStream as a refcount on ActiveQuery

`holdStream(sessionId)` increments a `holds` counter on the ActiveQuery. It returns a `release()` function that decrements it. `finalize()` in eventBus.ts checks: if `holds > 0`, it marks `done = true` but does NOT call `stream.end()` or schedule deletion. Instead, when the last `release()` fires and `holds` reaches 0, it calls `stream.end()` and schedules cleanup.

**Why refcount over explicit lock:** Multiple agents may hold the same stream concurrently. Refcount is the simplest pattern for "close when all writers are done" without needing to track who holds what. This mirrors how tmp/summit's TeamManager kept the session alive until all teammates completed.

**Implementation:** Add `holds: number` field to the internal `ActiveQuery` (not the public type). Modify `finalize()` to check `holds > 0`. Add `holdStream()` and the release logic to eventBus.ts, expose through ExtensionAPI.

### 3. queries.run() — sub-query execution within a session

`queries.run(sessionId, prompt, options)` runs a query within an already-active session, sharing the session's existing EventStream. This is fundamentally different from `queries.start()` which creates a new ActiveQuery and rejects concurrent queries on the same session (via `initQuery()`).

```ts
queries: {
  start(sessionId, text, source?): Promise<void>;       // existing — creates new ActiveQuery, one per session
  run(sessionId, prompt, opts: { agentId: string; source?: string }): Promise<void>;  // new — sub-query within active session
  getActive(sessionId): ActiveQuery | undefined;         // existing
}
```

**The core problem:** `initQuery()` guards against concurrent queries: `if (existing && !existing.done) return null`. A teammate trying to `start()` on the same session silently fails. This is by design for the normal single-agent flow, but blocks multi-agent use.

**How queries.run() works:**
1. Does NOT call `initQuery()` — skips the one-query-per-session guard
2. Looks up the existing ActiveQuery's EventStream (must already exist via a prior `start()`)
3. Calls `holdStream()` to prevent the stream from closing
4. Resolves the provider and runs the full query pipeline (session lookup, system prompt, interaction hooks)
5. Tags every emitted event with `agentId`: `emit(sessionId, { ...appEvent, agentId })`
6. When done, persists the agent's response to `session.messages` with the `agentId` field
7. Releases the stream hold and resolves the returned promise

**Why `agentId` is required:** Following tmp/summit's proven pattern — every event from a teammate carries `teammateId`/`teammateName` so the UI can route events into per-agent tabs. Without tagging, events from concurrent agents interleave in an unusable flat stream.

**Why not bypass the query pipeline:** Calling `provider.runQuery()` directly would skip session persistence, event emission, and interaction wiring. Extensions should go through the full pipeline. tmp/summit's TeamManager did this manually (provider call + manual emit loop + manual persistence) — `queries.run()` encapsulates that pattern.

**What queries.run() does NOT do:**
- Create a new ActiveQuery or EventStream (uses the existing one)
- Call `finalize()` (the orchestrator's `start()` handles that after all holds are released)
- Block other `queries.run()` calls on the same session (multiple can run concurrently)

### 4. askId as an optional composite key

`createPendingAskUser(sessionId, source, askId?)` and `resolveAskUser(sessionId, answers, askId?)` use a composite key `sessionId:askId` when askId is provided, falling back to plain `sessionId` when not. The `ask_user` event emitted to the stream includes the `askId` field so the UI/Discord can route the response back to the right agent.

**Why optional:** Existing single-agent flows don't need askId. Making it optional means zero changes to current callers.

**Why composite key over nested map:** Simpler — one Map, string key. A nested `Map<string, Map<string, PendingAskUser>>` adds complexity for no benefit.

**How it connects to agentId:** When `queries.run({ agentId: "backend" })` triggers an ask_user, the interaction hooks use `agentId` as the `askId`. The emitted event carries both `agentId` and `askId`. The UI shows the question in the right tab and posts the answer back with `askId` so it resolves the correct pending promise.

### 5. Timestamps on StreamEvent, not AppEvent

Add `timestamp: number` (via `Date.now()`) to `StreamEvent`, stamped automatically by `emit()` in eventBus.ts:

```ts
export interface StreamEvent {
  id: number;
  timestamp: number;  // Date.now() at emission
  data: AppEvent;
}
```

**Why StreamEvent not AppEvent:** Timestamps are an infrastructure concern (when the event was emitted into the bus), not a domain concern (what happened). Keeping `AppEvent` clean means providers don't need to think about timing.

**Why it matters for multi-agent:** With concurrent agents, `id` gives ordering but not timing. Timestamps let the UI show per-agent durations, tool call elapsed times, and reconstruct timing on reconnection/reload. Both tmp/summit (`TeamMessage.timestamp`) and pi-messenger (ISO timestamps on every progress entry) validate this need.

**Cost:** Minimal — one `Date.now()` call per `emit()`. No caller changes needed.

## Risks / Trade-offs

- **onBeforeQuery ordering**: Hooks run concurrently, so if two extensions both use onBeforeQuery, their side effects may interleave. → Acceptable for v1; hooks are observers, not mutators.
- **holdStream leak**: If an extension holds a stream and crashes without releasing, the stream stays open forever. → Mitigation: Add a safety timeout (e.g., 5 minutes) that auto-releases orphaned holds and logs a warning.
- **queries.run() re-entrancy**: An extension could trigger an infinite loop by calling `queries.run()` from an `onBeforeQuery` hook. → Mitigation: `queries.run()` passes a `source` that `onBeforeQuery` hooks can inspect to avoid re-triggering (e.g., skip if `source === "team-orchestrator"`).
- **Concurrent message persistence**: Multiple `queries.run()` calls appending to `session.messages` simultaneously could cause race conditions. → Mitigation: each `queries.run()` collects its messages locally and appends atomically at completion, same pattern as tmp/summit's TeamManager.
- **Event ordering**: Events from concurrent agents arrive in real-time order, not grouped by agent. → This is intentional and matches tmp/summit's approach — the UI groups them client-side by `agentId`.
