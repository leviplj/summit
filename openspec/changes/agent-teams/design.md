## Context

Summit currently runs one Agent SDK `query()` per session. When a user sends a message, a single agent handles the entire request end-to-end. For cross-cutting tasks (e.g., API + UI changes), the single agent context-switches between concerns sequentially.

The session model already supports multi-repo projects — each session gets worktrees for all repos in the project. This infrastructure makes agent teams natural: multiple concurrent `query()` calls can share the same worktrees, each focused on a specific domain.

Key constraint: the Agent SDK supports custom tools via `tool()` + `createSdkMcpServer()` + `mcpServers` option on `query()`. Tool handlers run in-process in the Node server, enabling shared in-memory state between teammates.

The SDK also has a built-in subagent system (`Agent` tool + `SendMessage`) that was evaluated as an alternative — see Decision #1 for the analysis.

## Goals / Non-Goals

**Goals:**
- Enable a session's agent to dynamically spin up N teammate agents that work concurrently
- Provide inter-agent communication so teammates can hand off work (e.g., backend sends endpoint specs to frontend)
- Prevent deadlocks via cycle detection on the wait graph
- Show per-teammate progress in the UI via tabs
- Keep the single-agent flow unchanged — teams are opt-in when the orchestrator decides they're needed

**Non-Goals:**
- Nested teams (a teammate cannot create its own sub-team)
- Cross-session teams (all teammates live within one session)
- Persistent teammate identities across messages (team is created fresh per user request)
- Agent-to-user direct communication from teammates (only orchestrator talks to user)

## Decisions

### 1. Teammates are concurrent `query()` calls, not SDK subagents

**Decision**: Each teammate is a separate Agent SDK `query()` call running concurrently in the same Node process, sharing the same `cwd` and `worktrees` as the session.

**Alternatives considered**:
- *SDK built-in subagents (`Agent` tool + `SendMessage`)*: The SDK has a first-class subagent system with automatic lifecycle management, named agents, team grouping, and async message delivery via `SendMessage`. However, it was rejected for two critical reasons:
  1. **No event streaming visibility**: The parent's `query()` stream only receives `task_started`, `task_progress` (with optional AI-generated summaries every ~30s), and `task_notification` events. It does NOT receive the subagent's internal events (thinking blocks, tool_use details, text streaming, tool_results). This makes it impossible to build a rich tab UI showing what each teammate is actually doing.
  2. **No blocking communication**: `SendMessage` delivers messages asynchronously between turns. A teammate cannot block-wait for a specific message from another teammate. This prevents the sequential handoff pattern (backend finishes → sends specs → frontend starts) — the frontend would start working immediately on assumptions rather than waiting for the real API contract.
- *Hybrid (SDK Agent tool for spawning + custom blocking tools)*: Using the SDK's `Agent` tool for lifecycle but adding custom blocking tools. Rejected — the SDK encapsulates subagent internals, so even with custom tools we'd lose event streaming visibility.
- *Separate sessions per teammate*: Would require merge/sync logic and duplicates the session abstraction. Rejected — adds complexity with no benefit since worktrees are already shared.
- *Single query with role-switching*: One agent pretends to be multiple roles. Rejected — loses parallelism and makes the context window enormous.

**Rationale**: Custom `query()` calls give us full control over event streaming (every thinking block, tool use, and text chunk is emitted to our SSE stream with a `teammateId`), enabling the rich tab UI. They also allow blocking tool handlers for sequential handoffs, using the same `await new Promise(resolve => ...)` pattern already proven by the elicitation and AskUserQuestion flows in `queries.ts`. The trade-off is managing lifecycle manually (AbortControllers, completion tracking), but these patterns already exist in the codebase.

### 2. Custom MCP tools for communication

**Decision**: Use the Agent SDK's `tool()` + `createSdkMcpServer()` to inject communication tools into each teammate's `query()`.

**Orchestrator tools** (via `mcp__orchestrator__*`):
- `create_teammate(role, systemPrompt, scopePath)` — Spawns a new teammate query
- `broadcast(content)` — Sends a message to all teammates
- `wait_for_team()` — Blocks until all teammates call notify_done

**Teammate tools** (via `mcp__team__*`):
- `send_message(to, content)` — Delivers a message to another teammate's mailbox
- `check_mailbox(from?)` — Blocks until a message arrives (optionally filtered by sender)
- `notify_done(summary)` — Signals completion to the orchestrator

**Rationale**: MCP tools are the SDK's supported extension mechanism. Tool handlers run in-process, so they can access shared in-memory state (the message bus). The `canUseTool` pattern already proves that blocking tool handlers work (see elicitation/AskUserQuestion). This approach was chosen over the SDK's built-in `SendMessage` because `SendMessage` only supports async delivery (messages arrive between turns) and cannot block a teammate mid-execution to wait for a handoff.

### 3. In-memory message bus with blocking receive

**Decision**: A per-team message bus stored as in-memory Maps. Messages are delivered immediately if the recipient is waiting, otherwise queued.

```
MessageBus {
  mailboxes: Map<teammateId, Message[]>    // queued messages
  waiters: Map<teammateId, resolve()>       // blocked receivers
  waitsFor: Map<teammateId, Set<string>>    // dependency graph for cycle detection
}
```

**Key behaviors**:
- `send_message` → checks if recipient has a waiter → if yes, resolves immediately; if no, queues
- `check_mailbox` → checks queue → if non-empty, returns immediately; if empty, creates a Promise and blocks
- Before blocking, checks the dependency graph for cycles. If adding the wait edge would create a cycle, the tool returns an error: "Circular dependency detected: A → B → A. Send your results first, then wait."

**Alternatives considered**:
- *Redis/external message queue*: Overkill for in-process communication. Rejected.
- *Polling (non-blocking check_mailbox)*: Would waste tokens on repeated empty checks. Rejected — blocking is cleaner and proven by existing patterns.

### 4. Orchestrator decides team composition dynamically

**Decision**: The orchestrator is the session's main `query()` with an enhanced system prompt and team management tools. It analyzes the user's request and decides:
- How many teammates to create
- What role each has (backend dev, frontend dev, QA, etc.)
- What directory scope each works in
- What the dependency order is (via system prompt instructions to teammates)

The orchestrator does NOT use a fixed team template. It reasons about the request and creates the appropriate team.

**Rationale**: Fixed templates (e.g., always backend+frontend) would be too rigid. The orchestrator is an LLM — it can reason about whether a request needs 1, 2, or 5 teammates and what roles make sense.

### 5. Tab-based UI with per-teammate event streams

**Decision**: Extend the existing SSE event stream to include a `teammateId` field on events. The frontend renders tabs — one per teammate plus one for the orchestrator. Each tab shows that teammate's event stream (thinking, tool_use, text, messages sent/received).

**Event extension**:
```typescript
interface AppEvent {
  // ... existing fields
  teammateId?: string;        // which teammate emitted this
  teammateName?: string;      // display name (e.g., "Backend Dev")
}

// New event types
| "team_created"              // orchestrator created the team
| "teammate_message"          // inter-agent message sent/received
| "teammate_done"             // teammate completed its work
```

**Status bar**: Shows all teammates with status indicators (waiting, working, done, error).

### 6. Scoping teammates to directories

**Decision**: Each teammate's system prompt explicitly scopes it to specific directories. The orchestrator determines scope based on project structure:

- **Multi-repo projects**: Each teammate is scoped to a worktree path (e.g., Backend → `/wt/api`, Frontend → `/wt/web`). Natural separation — different repos, no overlap.
- **Monorepo projects**: Each teammate is scoped to a subdirectory within the worktree (e.g., Backend → `/wt/monorepo/packages/backend`, Frontend → `/wt/monorepo/packages/frontend`). Shared directories (e.g., `packages/shared`) are coordinated via message bus — one teammate writes, sends a message, the other reads.

The system prompt includes:
> "You are a backend developer. Your workspace is `<path>`. Only create and edit files within this directory unless coordinating shared resources with other teammates. If you need to modify shared code, send a message to affected teammates before and after."

**Rationale**: File-level locking was considered but adds complexity. Directory scoping via system prompt is simpler and sufficient — agents follow instructions well, and the message bus handles shared resource coordination. This works identically for multi-repo and monorepo projects; only the path granularity differs.

## Risks / Trade-offs

**[Cost multiplication]** → Each teammate is a full `query()` burning tokens. A 3-teammate request costs ~3-5x a single agent. Mitigation: Surface per-teammate costs in the UI; allow the orchestrator to use cheaper models for simpler roles (e.g., Haiku for QA).

**[File conflicts]** → Two teammates could edit the same file simultaneously. In multi-repo projects, teammates work in separate worktrees so this is unlikely. In monorepo projects, teammates are scoped to subdirectories (e.g., `packages/backend`, `packages/frontend`) via system prompts. For shared code (e.g., `packages/shared/types.ts`), teammates coordinate via the message bus — one defines the types, sends a message, the other reads and uses them. No hard file-level enforcement — this is a known limitation of the MVP.

**[Runaway teammates]** → A teammate could go off-script and make unintended changes. Mitigation: The orchestrator can monitor and cancel teammates via abort controllers; the user can cancel the entire team.

**[Token context limits]** → Long-running teammates may hit context limits. Mitigation: Teammates are short-lived (one task per team invocation), so context shouldn't grow unbounded.

**[Message ordering]** → With async delivery, messages might arrive in unexpected order. Mitigation: Messages are timestamped and ordered per-mailbox; agents receive them in FIFO order.

**[SDK divergence]** → We're building custom lifecycle management instead of using the SDK's built-in subagent system. If the SDK later exposes subagent event streaming and blocking communication, our custom approach becomes tech debt. Mitigation: The TeamManager is a thin layer over `query()` — migrating to SDK subagents later would be straightforward if they add these capabilities. The message bus and cycle detection would remain useful regardless.
