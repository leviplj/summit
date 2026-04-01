## 1. Types and Data Model

- [x] 1.1 Add teammate types to `shared/types.ts`: `Teammate` (id, role, status, scopePath), `TeamMessage`, `TeamState`, and new `AppEvent` types (team_created, teammate_message, teammate_done, teammate_status)
- [x] 1.2 Extend `AppEvent` interface with optional `teammateId` and `teammateName` fields for per-teammate event routing
- [x] 1.3 Add `TeamState` to `StoredSession` for persisting team activity summary in session history

## 2. Message Bus

- [x] 2.1 Create `frontend/server/utils/messageBus.ts` with `MessageBus` class: mailboxes Map, waiters Map, and waitsFor dependency graph
- [x] 2.2 Implement `deliver(msg)` — resolve waiter immediately if recipient is waiting, otherwise queue in mailbox
- [x] 2.3 Implement `receive(teammateId, from?)` — return queued message (FIFO) or block via Promise; register wait edge in dependency graph before blocking
- [x] 2.4 Implement `wouldCreateCycle(waiter, target)` — DFS cycle detection on the dependency graph; return cycle path or null
- [x] 2.5 Implement `broadcast(from, content)` — deliver message to all teammates except sender
- [x] 2.6 Implement cleanup: remove wait edges on message delivery, dispose method to clear all state
- [x] 2.7 Add filtered receive: when `from` parameter is set, skip non-matching messages in queue and only wait for messages from specified sender

## 3. MCP Tool Definitions

- [x] 3.1 Create `frontend/server/utils/teamTools.ts` with teammate MCP tools using `tool()` from Agent SDK: `check_mailbox` (with optional `from` filter), `send_message` (to, content), `notify_done` (summary)
- [x] 3.2 Create orchestrator MCP tools: `create_teammate` (role, systemPrompt, scopePath), `broadcast` (content), `wait_for_team`, `cancel_teammate` (id)
- [x] 3.3 Wrap teammate tools in `createSdkMcpServer({ name: "team", tools: [...] })`
- [x] 3.4 Wrap orchestrator tools in `createSdkMcpServer({ name: "orchestrator", tools: [...] })`

## 4. Team Lifecycle in Query Engine

- [x] 4.1 Create `frontend/server/utils/teamManager.ts` with `TeamManager` class: tracks active teammates (Map of id → { query, abortController, role, status }), holds the MessageBus instance
- [x] 4.2 Implement `spawnTeammate(role, systemPrompt, scopePath, session)` — starts a new `query()` with team MCP server, same cwd/worktrees as session, role-scoped system prompt including list of active teammates
- [x] 4.3 Implement teammate event forwarding — each teammate's `query()` stream emits events through the session's `emit()` with `teammateId` attached
- [x] 4.4 Implement `notify_done` collection — track which teammates have completed; resolve `wait_for_team` when all are done
- [x] 4.5 Implement `cancelTeammate(id)` — abort the teammate's query, update status, resolve any pending mailbox waiters with error
- [x] 4.6 Implement `cancelAll()` — abort all teammate queries and the orchestrator; used when user clicks cancel
- [x] 4.7 Implement team cleanup — dispose MessageBus and clear teammate state when orchestrator query finishes

## 5. Query Engine Integration

- [x] 5.1 Modify `runQuery` in `queries.ts` to detect when a query acts as orchestrator (creates teammates) and initialize a `TeamManager`
- [x] 5.2 Pass orchestrator MCP server to the main `query()` call via `mcpServers` option with `allowedTools: ["mcp__orchestrator__*"]`
- [x] 5.3 Wire `create_teammate` tool handler to call `TeamManager.spawnTeammate()`, which starts the teammate's `query()` with team MCP server
- [x] 5.4 Extend `abortControllers` map to track per-teammate abort controllers; wire session cancel to `TeamManager.cancelAll()`
- [x] 5.5 Emit `team_created` AppEvent when orchestrator creates the first teammate, including all teammate roles and IDs

## 6. Frontend — Team State Composable

- [x] 6.1 Create `useTeamStore` composable: tracks active teammates (roles, statuses), current tab selection, and per-teammate event streams
- [x] 6.2 Parse incoming SSE events — route events with `teammateId` to the corresponding teammate's stream; route events without `teammateId` to orchestrator stream
- [x] 6.3 Handle `team_created` event — initialize tabs and teammate state
- [x] 6.4 Handle `teammate_status` events — update teammate status (working, waiting, done, error, cancelled)
- [x] 6.5 Handle `teammate_message` events — add message display to both sender and recipient streams

## 7. Frontend — Tab UI Components

- [x] 7.1 Create `TeamTabBar.vue` component — renders tabs for orchestrator + each teammate, highlights active tab, shows status icon per tab
- [x] 7.2 Create `TeamStatusBar.vue` component — horizontal bar showing all teammates with role and status at a glance
- [x] 7.3 Create `TeammateMessageBubble.vue` component — styled differently from regular chat messages, shows sender/recipient labels and message content
- [x] 7.4 Integrate `TeamTabBar` into session chat view — conditionally rendered only when `team_created` event has been received
- [x] 7.5 Modify chat message list to filter by selected tab's `teammateId`
- [x] 7.6 Extend cancel button to call `TeamManager.cancelAll()` when a team is active

## 8. Orchestrator System Prompt

- [x] 8.1 Create orchestrator system prompt template that instructs the agent on: when to create a team vs. work solo, how to analyze requests for team composition, how to scope teammates to directories
- [x] 8.2 Add team-aware system prompt append in `runQuery` — when team tools are available, append orchestrator instructions to the existing session system prompt
- [x] 8.3 Include project structure context (repo paths, directory layout) in the orchestrator prompt so it can make informed scoping decisions

## 9. Testing and Validation

- [x] 9.1 Test message bus: send/receive, blocking, FIFO ordering, filtered receive by sender
- [x] 9.2 Test cycle detection: simple A↔B cycle, transitive A→B→C→A cycle, non-circular allowed
- [ ] 9.3 Test teammate lifecycle: create, notify_done, cancel, wait_for_team
- [ ] 9.4 Test team cancellation: user cancel aborts all teammates and orchestrator
- [ ] 9.5 End-to-end test: orchestrator creates 2 teammates, backend sends message to frontend, both complete, orchestrator summarizes
