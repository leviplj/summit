## Context

Summit's extension system allows adding integrations by dropping `.ts` files into `.summit/extensions/`. The `extension-api-additions` change adds four capabilities that make multi-agent orchestration possible: `onBeforeQuery`, `holdStream`, `queries.run()` (with `agentId` tagging), and `askId` routing.

The prior implementation in `tmp/summit` proved the core architecture: TeamManager spawns teammates, MessageBus enables coordination with cycle detection, MCP tools give agents communication primitives, and a tab UI routes events by `teammateId`. This design ports that architecture into the extension system.

**Prior art:**
- `tmp/summit` — TeamManager, MessageBus, MCP tools (orchestrator + teammate), TeamTabBar.vue, useTeamStore.ts. Worked but was tightly coupled to internals; this redesign uses the ExtensionAPI.
- `tmp/pi-messenger` — Wave-based crew with file-based coordination. Validated task assignment patterns but doesn't fit our shared-session model.

## Goals / Non-Goals

**Goals:**
- Agent teams work as a standard extension — no core modifications beyond what extension-api-additions provides
- Single session, multiple agents, shared worktree — user sees one chat with tabs per teammate
- Agents coordinate via message-passing (not file-based) with deadlock prevention
- Team configuration is per-project and backwards compatible (projects without teams work unchanged)

**Non-Goals:**
- Agent definition files (markdown + frontmatter) — simplify to inline config for v1, file-based definitions can come later
- Drag-and-drop reordering in the UI
- Per-agent worktree isolation
- SDK-native `agents` option (tmp/summit's old design) — we use `queries.run()` which gives us more control and visibility

## Decisions

### 1. Extension structure: single extension with co-located utilities

The teams extension lives at `frontend/server/extensions/teams/index.ts` with TeamManager and MessageBus as co-located modules (`teamManager.ts`, `messageBus.ts`). MCP tool definitions live in `tools.ts`.

**Why co-located not separate extensions:** These components are tightly coupled — MessageBus only exists for team coordination, TeamManager only exists to manage teammates. Splitting them into separate extensions adds wiring complexity for no benefit.

**Why not `.summit/extensions/`:** The teams extension needs to ship with Summit, not be a user-installed extension. It lives alongside the Discord and claude-code extensions.

### 2. TeamManager uses queries.run() for teammate execution

When the orchestrator calls the `spawn_teammate` MCP tool, TeamManager:
1. Calls `api.events.holdStream(sessionId)` to keep the stream alive
2. Calls `api.queries.run(sessionId, prompt, { agentId: teammateId })` which handles the full pipeline
3. Events are automatically tagged with `agentId` and flow to the shared EventStream
4. On completion, the hold is auto-released by `queries.run()`

**Why queries.run() over direct provider calls:** tmp/summit's TeamManager manually called the provider, manually emitted events, manually persisted messages — ~80 lines of boilerplate per teammate. `queries.run()` encapsulates all of that. The extension stays thin.

### 3. MessageBus with cycle detection (ported from tmp/summit)

Inter-agent communication via mailbox-style message passing:
- `send(from, to, content)` — queues a message in the recipient's mailbox
- `receive(teammateId, from?, timeoutMs?)` — blocks until a message arrives, with optional sender filter
- `broadcast(from, content, allIds)` — sends to all teammates
- `wouldCreateCycle()` — checks if a receive would create a deadlock (A waiting for B waiting for A)

**Why not shared memory/files:** Message passing is explicit, traceable, and debuggable. The MessageBus emits `teammate_message` events so the UI can show communication flow. tmp/summit proved this pattern works well.

### 4. MCP tools: two tool sets (orchestrator vs teammate)

**Orchestrator tools:**
- `spawn_teammate(role, prompt, model?)` — spawn a new teammate agent
- `broadcast(content)` — send a message to all active teammates

**Teammate tools:**
- `send_message(to, content)` — send a message to another teammate
- `receive_message(from?, timeout?)` — wait for a message

**Why MCP tools:** Agents interact with the world through tools. MCP tools are the standard mechanism in Summit's provider system. The orchestrator agent's system prompt describes the team and available tools; it decides when to delegate.

**Why separate tool sets:** The orchestrator spawns; teammates communicate. Giving teammates `spawn_teammate` would create uncontrolled recursion.

### 5. Team events as AppEvent subtypes

New event types emitted to the session stream:
- `team_created { teammates: [{ id, role }] }` — team roster established
- `teammate_status { teammateId, status }` — status change (working/done/error/cancelled)
- `teammate_message { from, to, content, direction }` — inter-agent message (direction: sent/received)
- `teammate_done { teammateId, summary }` — teammate completed with result summary

**Why custom event types over plain text:** The UI needs structured data to render tabs, status icons, and message flows. Plain text events would require parsing.

### 6. Tab UI: client-side routing by agentId

The chat view detects `team_created` events and switches to tab mode:
- `useTeamStore` composable maintains per-agent state: `{ id, role, status, events, messages, streamText }`
- Events with `agentId` are routed to the matching tab's event list
- `TeamTabBar.vue` renders tabs with status icons (spinner/clock/checkmark/alert)
- Clicking a tab shows that agent's event stream and messages
- The "main" tab (no agentId) shows the orchestrator

**Why client-side routing:** Events arrive in real-time interleaved order. Client-side filtering is simpler than server-side stream splitting and works naturally with SSE reconnection (replay from afterId, re-route by agentId).

### 7. Team configuration: project-level config object

Teams are configured per project via a `team` field on the Project type:

```ts
interface TeamConfig {
  orchestratorPrompt: string;
  teammates: Array<{ role: string; prompt: string; model?: string }>;
}
```

When a project has `team` config and a query arrives, the onBeforeQuery hook activates team mode: it creates a TeamManager, registers MCP tools, and modifies the orchestrator's system prompt to describe its team.

**Why inline config over file-based definitions:** Simpler for v1. The ProjectConfigDialog can expose a "Team" tab later. File-based markdown definitions (like tmp/summit's agent files) can be added as an enhancement without changing the runtime model.

## Risks / Trade-offs

- **Extension API surface:** Teams depend heavily on extension-api-additions. If any of those APIs change, the teams extension breaks. → Mitigation: extension-api-additions is designed to be stable; teams is the primary consumer and validates the API.
- **MCP tool registration timing:** Tools must be registered before the query runs. The onBeforeQuery hook fires at the right time, but tool registration needs to happen within the hook. → Verify that the provider accepts tools registered during onBeforeQuery.
- **Concurrent message persistence:** Multiple `queries.run()` appending to session.messages. → queries.run() handles atomic append (from extension-api-additions design).
- **Team + Discord interaction:** When a team session runs, Discord needs to handle multiple agents' events. → The existing Discord extension sees all events with agentId tags; it can format messages with agent attribution.
- **No per-agent cancel:** Cancelling a session cancels all agents. Per-agent cancel could be added later via the AbortController from queries.run().
