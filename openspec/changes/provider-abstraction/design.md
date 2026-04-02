## Context

Summit's server has two files that import `@anthropic-ai/claude-agent-sdk`: `server/utils/queries.ts` (main query engine, 251 lines) and `server/routes/api/sessions/[id]/git/generate-message.post.ts` (one-shot commit message generation, 60 lines).

`queries.ts` handles 6 distinct responsibilities: event bus (emit/subscribe/finalize), interaction resolution (ask_user/elicitation), session path helpers, system prompt construction, SDK orchestration, and message persistence. This tangling makes it impossible to add a second AI provider without forking the entire file.

The `AppEvent` boundary is already clean — the frontend never touches SDK types. The SSE streaming layer, session storage, and worktree management are all provider-agnostic. The event translation layer (`agentEvents.ts`, 134 lines) cleanly maps SDK messages to `AppEvent` but lives in the wrong place (`utils/` instead of inside a provider module).

The upcoming Discord integration (see `openspec/changes/discord-integration`) will add a second input channel that needs to call `startQuery()`, `subscribe()`, and `resolveAskUser()`. These functions are currently tangled inside `queries.ts` alongside SDK-specific code. Extracting them now enables Discord to integrate cleanly.

## Goals / Non-Goals

**Goals:**
- SDK imported in exactly one directory per provider (`server/providers/<name>/`)
- Query manager orchestrates lifecycle without knowing which SDK is in use
- Event bus and interaction resolution are standalone modules any channel can consume
- Adding a new provider requires only: create a directory, implement the interface, register it
- Adding a new input channel requires only: call `startQuery()`, `subscribe()`, and interaction resolvers
- Zero behavior change — the refactor is invisible to users

**Non-Goals:**
- Team management restructuring (separate change, not on main branch)
- Actually adding a second provider (this change creates the abstraction; a future change adds Codex/Gemini)
- Discord integration (separate change, but this change prepares the ground)
- Frontend redesign (minimal changes — dynamic model list, provider field on sessions)
- MCP tool abstraction (needed for team management, not for provider abstraction alone)

## Decisions

### 1. Extract event bus as a standalone module

**Decision**: Move `emit()`, `subscribe()`, `getActiveQuery()`, `getActiveSessionIds()`, `finalize()`, the `active` Map, and the `abortControllers` Map to `server/utils/eventBus.ts`. Add a `source` field to `ActiveQuery` and a `source` parameter to `startQuery()` in the event bus.

**Alternatives considered**:
- *Keep in queries.ts*: Works for provider abstraction alone, but Discord integration would still need to import from a module that contains SDK code. Rejected.
- *Full pub/sub system*: Overkill — the current push-listener pattern is simple and sufficient. The `subscribe()` API already supports replay and unsubscribe.

**Rationale**: The event bus is the shared backbone consumed by SSE streaming, the Discord bot, and any future channel. It must have zero coupling to any SDK. The `source` field costs nothing now and is the minimal addition needed for channel-aware routing.

### 2. Extract interaction resolution as a standalone module

**Decision**: Move `resolveAskUser()`, `resolveElicitation()`, `pendingAskUser` Map, and `pendingElicitations` Map to `server/utils/interactions.ts`. Add `createPendingAskUser(sessionId, source)` and `createPendingElicitation(elicitationId)` functions that the query manager calls (instead of creating Promises inline). Add a cleanup function called by `finalize()`.

**Alternatives considered**:
- *Leave in queries.ts*: Routes (`ask-user.post.ts`, `elicitation.post.ts`) currently import from `queries.ts` just for these two functions. Extracting them makes the dependency explicit and breaks the circular concern.
- *Channel-specific resolution*: Have each channel implement its own resolution. Rejected — the resolution mechanism is the same (Promise resolve), only the trigger differs (web POST vs Discord reply). Channels self-select by checking `source`.

**Rationale**: The interaction module is the bridge between the agent (which blocks on a Promise) and the channel (which resolves it). Both the web UI and Discord need to call `resolveAskUser()`. Having it in a standalone module with source metadata lets channels self-route without importing SDK code.

### 3. Provider interface with async iterable stream

**Decision**: `AgentProvider.runQuery()` returns `QueryResult` with `stream: AsyncIterable<AppEvent>`. The provider owns event translation — it yields `AppEvent`s, not raw SDK messages.

**Alternatives considered**:
- *Callback-based*: `runQuery(ctx, hooks, onEvent)` — simpler but less composable. Can't easily pipe, filter, or transform the stream. Rejected.
- *EventEmitter-based*: Adds complexity and loses backpressure. Rejected.
- *Return raw SDK events + separate translator*: Leaks SDK types through the interface. The whole point is that nothing outside the provider sees SDK types. Rejected.

**Rationale**: `AsyncIterable` is the natural fit — the query manager does `for await (const event of result.stream)` which is exactly what it already does with the SDK's raw stream. The provider just wraps it with translation. Backpressure is automatic.

### 4. Registry is a simple Map, not a DI container

**Decision**: `server/providers/registry.ts` exports a `Map<string, AgentProvider>` with `getProvider(name)` and `listProviders()`. Providers register by calling `registerProvider()` at import time. The Claude Code provider self-registers in its `index.ts`.

**Alternatives considered**:
- *Dependency injection container*: Massively over-engineered for 1-3 providers. Rejected.
- *Config-driven dynamic loading*: `import(providerPath)` based on config. Adds complexity for no benefit — we know our providers at build time. Rejected.
- *Factory function*: `createProvider(name)` that switches on name. Works but doesn't scale as well and mixes construction with lookup. Rejected.

**Rationale**: A Map is the simplest correct solution. Provider count will be small (2-4). Adding a provider = add file + call `registerProvider()`.

### 5. System prompt as a composable function

**Decision**: Move the inline system prompt template from `queries.ts` (lines 162-172) to `server/providers/claude-code/prompt.ts` as `buildSystemPrompt(session, extraContext?)`. The query manager calls this and passes the result as `QueryContext.systemPromptSuffix`.

**Alternatives considered**:
- *Keep inline in query manager*: The prompt is provider-specific (references Claude Code behaviors). It belongs with the provider. Rejected.
- *Provider builds its own prompt internally*: The prompt needs session data (worktrees) that the query manager has. Passing it as `systemPromptSuffix` in `QueryContext` keeps the interface clean — any provider can use it or ignore it.

**Rationale**: The system prompt has provider-specific content (safety rules, repo listing format) and session-specific data (worktree paths). Putting the builder in the provider module and accepting extra context via parameter lets channels inject their own context (e.g., Discord might add "Keep responses concise for Discord").

### 6. Session gets `provider` string and generic `channelMeta`

**Decision**: Add `provider: string` (defaults to `"claude-code"`) and `channelMeta?: Record<string, unknown>` to `StoredSession`. Use `channelMeta` instead of a Discord-specific `discord` field.

**Alternatives considered**:
- *Typed union for channels*: `discord?: { threadId, channelId, guildId } | slack?: { ... }`. Each new channel modifies the type. Rejected — channels should be able to store metadata without changing shared types.
- *Separate metadata store*: A `channel-meta.json` per session. Unnecessary indirection — the session file already persists per-session data.

**Rationale**: `channelMeta` is opaque to the session store. Discord stores `{ discord: { threadId, channelId, guildId } }`, Slack would store `{ slack: { channelId, threadTs } }`. The session store persists it without interpretation. This avoids modifying `StoredSession` every time a new channel is added.

### 7. Phased migration preserving behavior

**Decision**: Implement in 4 phases, each producing a working system:
1. Extract utilities (eventBus, interactions, sessionHelpers) — no behavior change
2. Create provider types + registry — new code, nothing wired yet
3. Create Claude Code provider (move agentEvents.ts, models, prompt builder) — still no behavior change
4. Rewire consumers (queryManager uses provider, generate-message uses complete()) — behavior-preserving swap

**Alternatives considered**:
- *Big bang rewrite*: Replace queries.ts entirely in one commit. High risk — any bug is hard to bisect. Rejected.
- *Feature flag*: Run old and new paths in parallel. Unnecessary complexity for what's a pure refactor with no behavior change. Rejected.

**Rationale**: Each phase can be reviewed and tested independently. Phase 1 is zero-risk (just moving functions). Phases 2-3 add new code without touching existing behavior. Phase 4 is the only phase that changes the call path, and by then the new code is already tested.

## Risks / Trade-offs

**[Async iterable complexity]** → `AsyncIterable<AppEvent>` is slightly harder to debug than a simple callback. Mitigation: the pattern is already used in the codebase (the SDK itself returns an async iterable), so it's familiar territory.

**[Registry adds a level of indirection]** → `getProvider(name)` is one more hop vs direct import. Mitigation: the indirection is the entire point. It's a Map lookup, not a DI container. Negligible runtime cost.

**[Event bus extraction could break SSE]** → Moving `emit/subscribe` to a new module changes import paths for 5+ route files. Mitigation: phase 1 is strictly move-and-reexport. The old `queries.ts` can re-export from `eventBus.ts` temporarily if needed, but cleaner to update all imports at once since they're simple path changes.

**[channelMeta is untyped]** → `Record<string, unknown>` provides no compile-time safety for channel metadata. Mitigation: each channel module defines its own typed interface and casts on read. The session store doesn't need to validate channel-specific shapes — that's the channel's responsibility.

**[generate-message.post.ts model hardcoding]** → Currently uses `model: "haiku"`. Moving to `provider.complete(prompt, "haiku")` preserves this, but different providers may not have a "haiku" equivalent. Mitigation: `complete()` accepts an optional model string. If not provided, the provider uses its default cheap/fast model.
