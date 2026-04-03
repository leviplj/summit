## 1. Types & Config

- [x] 1.1 Add `TeamConfig` interface to `packages/summit-types/src/index.ts` — `{ orchestratorPrompt: string; teammates: Array<{ role: string; prompt: string; model?: string }> }`
- [x] 1.2 Add optional `team: TeamConfig | null` field to `Project` interface in `packages/summit-types/src/index.ts`
- [x] 1.3 Add team event types to `AppEvent` type union: `team_created`, `teammate_status`, `teammate_message`, `teammate_done`
- [x] 1.4 Update project API routes to accept and persist `team` field

## 2. MessageBus

- [x] 2.1 Create `frontend/server/extensions/teams/messageBus.ts` — mailbox queuing with `send()`, `receive()`, `broadcast()`, `dispose()`
- [x] 2.2 Implement cycle detection in `wouldCreateCycle()` — check waiting graph before blocking receive
- [x] 2.3 Implement receive timeout — reject promise after `timeoutMs` if no message arrives

## 3. TeamManager

- [x] 3.1 Create `frontend/server/extensions/teams/teamManager.ts` — manages teammate lifecycle (spawn, track status, emit team events)
- [x] 3.2 Implement `spawnTeammate(role, prompt, model?)` — calls `api.queries.run()` with agentId, tracks status, emits `teammate_status` events
- [x] 3.3 Implement stream hold management — hold on first spawn, release when all teammates complete
- [x] 3.4 Emit `team_created` event when first teammate spawned with full roster
- [x] 3.5 Emit `teammate_done` event with summary when a teammate completes

## 4. MCP Tools

- [x] 4.1 Create `frontend/server/extensions/teams/tools.ts` with orchestrator tools: `spawn_teammate`, `broadcast`
- [x] 4.2 Add teammate tools: `send_message`, `receive_message`
- [x] 4.3 Wire tools to TeamManager and MessageBus instances

## 5. Extension Entry Point

- [x] 5.1 Create `frontend/server/extensions/teams/index.ts` — register onBeforeQuery hook
- [x] 5.2 In onBeforeQuery, check if session's project has team config; if so, create TeamManager and register MCP tools
- [x] 5.3 Build orchestrator system prompt from team config (describe teammates, roles, available tools)

## 6. Team Tab UI

- [x] 6.1 Create `app/composables/useTeamStore.ts` — per-agent tab state (`TeammateTab` with id, role, status, events, messages, streamText)
- [x] 6.2 Implement event routing — route events by `agentId` to matching tab, team events (`team_created`, `teammate_status`, etc.) update team state
- [x] 6.3 Create `app/components/TeamTabBar.vue` — tab bar with role labels and status icons (spinner/clock/checkmark/alert/question)
- [x] 6.4 Integrate TeamTabBar into the chat view — show when `team_created` received, active tab controls which events/messages display
- [x] 6.5 Display `teammate_message` events as a distinct coordination message type in both sender and recipient tabs

## 7. Verification

- [x] 7.1 TypeScript compiles with no errors
- [ ] 7.2 Single-agent sessions (no team config) work unchanged
- [ ] 7.3 Team session spawns teammates, events flow to correct tabs, messages persist with agentId
