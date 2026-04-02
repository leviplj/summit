## 1. Extract event bus from queries.ts

- [x] 1.1 Create `server/utils/eventBus.ts` with `StreamEvent` and `ActiveQuery` interfaces (include `source: string` and `sessionId` fields on ActiveQuery)
- [x] 1.2 Move `emit()`, `subscribe()`, `getActiveQuery()`, `getActiveSessionIds()`, `finalize()`, `active` Map, and `abortControllers` Map from `queries.ts` to `eventBus.ts`
- [x] 1.3 Add `startQuery(sessionId, source?)` to eventBus that creates the ActiveQuery placeholder (lines 86-91 of current queries.ts) with source defaulting to `"web"`
- [x] 1.4 Add `cancelQuery(sessionId)` to eventBus that aborts via the abortControllers Map
- [x] 1.5 Add `getQuerySource(sessionId)` function that returns the source from the ActiveQuery
- [x] 1.6 Update `stream.get.ts`, `cancel.post.ts` to import from `eventBus.ts` instead of `queries.ts`

## 2. Extract interaction resolution

- [x] 2.1 Create `server/utils/interactions.ts` with `PendingAskUser` and `PendingElicitation` interfaces (include `source` field on PendingAskUser)
- [x] 2.2 Move `resolveAskUser()`, `resolveElicitation()`, `pendingAskUser` Map, and `pendingElicitations` Map from `queries.ts` to `interactions.ts`
- [x] 2.3 Add `createPendingAskUser(sessionId, source): Promise<Record<string, string>>` that creates the pending entry and returns the Promise
- [x] 2.4 Add `createPendingElicitation(elicitationId): Promise<ElicitationResult>` that creates the pending entry and returns the Promise
- [x] 2.5 Add `cleanupSession(sessionId)` that removes pending entries for a session (called by finalize)
- [x] 2.6 Update `ask-user.post.ts` and `elicitation.post.ts` to import from `interactions.ts` instead of `queries.ts`

## 3. Extract session helpers

- [x] 3.1 Create `server/utils/sessionHelpers.ts` with `getSessionCwd()` and `getSessionAdditionalDirs()` moved from `queries.ts`
- [x] 3.2 Export both functions for use by query manager and any future consumer (e.g., team runner)

## 4. Provider types and registry

- [x] 4.1 Create `server/providers/types.ts` with `AgentProvider`, `QueryContext`, `InteractionHooks`, `QueryResult`, `ProviderModel`, `ProviderCapability`, and `ToolDefinition` interfaces
- [x] 4.2 Create `server/providers/registry.ts` with `registerProvider()`, `getProvider()`, and `listProviders()` backed by a `Map<string, AgentProvider>`
- [x] 4.3 Create `GET /api/providers` endpoint that returns `listProviders()` mapped to `{ name, models, capabilities }`

## 5. Claude Code provider

- [x] 5.1 Create `server/providers/claude-code/models.ts` with `LATEST_MODELS` and `LEGACY_MODELS` arrays (move from `app/constants/models.ts`, keep frontend constants as-is for now)
- [x] 5.2 Create `server/providers/claude-code/events.ts` — move `translateMessage()`, `createStreamState()`, and `AgentStreamState` from `server/utils/agentEvents.ts`
- [x] 5.3 Create `server/providers/claude-code/prompt.ts` with `buildSystemPrompt(session, extraContext?)` — extract the inline template string from `queries.ts` lines 162-172
- [x] 5.4 Create `server/providers/claude-code/index.ts` implementing `AgentProvider`:
  - `runQuery()` wrapping SDK `query()` call with event translation via async generator
  - `complete()` wrapping SDK `query()` with `maxTurns: 1` and `allowedTools: []`
  - `supports()` returning true for all capabilities
  - `models` from the models module
- [x] 5.5 Register the provider in `registry.ts` via import side-effect in the provider's `index.ts`

## 6. Rewire query manager

- [x] 6.1 Refactor `queries.ts` into `server/utils/queryManager.ts` — import `getProvider()` from registry, `emit/finalize/startQuery` from eventBus, `createPendingAskUser/createPendingElicitation` from interactions, `getSessionCwd/getSessionAdditionalDirs` from sessionHelpers
- [x] 6.2 Update `runQuery()` to build `QueryContext` and `InteractionHooks`, call `provider.runQuery(ctx, hooks)`, iterate the `AppEvent` stream, emit events, and persist — no SDK imports
- [x] 6.3 Update `chat.post.ts` to import `startQuery` from the new queryManager module
- [x] 6.4 Update `generate-message.post.ts` to use `getProvider("claude-code").complete()` instead of direct SDK `query()` import
- [x] 6.5 Delete `server/utils/agentEvents.ts` (now at `providers/claude-code/events.ts`)
- [x] 6.6 Verify no files outside `server/providers/claude-code/` import from `@anthropic-ai/claude-agent-sdk`

## 7. Data model and frontend

- [x] 7.1 Add `provider: string` field to `StoredSession` and `SessionListItem` in `shared/types.ts` (default: `"claude-code"`)
- [x] 7.2 Add `channelMeta?: Record<string, unknown>` field to `StoredSession` in `shared/types.ts`
- [x] 7.3 Update session creation in `sessions.post.ts` to set `provider` field (default `"claude-code"`)
- [x] 7.4 Update model selector to fetch from `GET /api/providers` and group models by provider (or keep flat for single provider)
- [x] 7.5 Keep `app/constants/models.ts` as a fallback until the providers endpoint is wired to the frontend

## 8. Validation

- [x] 8.1 Verify the dev server starts without errors (`bun run dev`)
- [ ] 8.2 Verify sending a message works end-to-end (creates query, streams events, persists session)
- [ ] 8.3 Verify ask_user flow works (question appears, answer resolves, agent continues)
- [ ] 8.4 Verify elicitation flow works
- [ ] 8.5 Verify cancel works mid-query
- [ ] 8.6 Verify commit message generation works via the changed files panel
- [ ] 8.7 Verify session resume works (send second message on existing session)
- [ ] 8.8 Verify `GET /api/providers` returns correct provider data
