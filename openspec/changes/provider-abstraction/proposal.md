## Why

The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) is directly imported in 2 server files (`queries.ts`, `generate-message.post.ts`). Adding a second AI provider (Codex, Gemini, etc.) would require forking the query engine and duplicating all lifecycle logic. Separately, `queries.ts` bundles 6 responsibilities (event bus, interactions, session helpers, system prompt, SDK orchestration, persistence) into 251 lines, making it hard to extend for new input channels like Discord.

## What Changes

- **Provider abstraction layer**: New `AgentProvider` interface that any AI SDK can implement. Providers declare their models, capabilities, and expose `runQuery()` (streaming agent session) and `complete()` (one-shot generation). A registry maps provider names to implementations.
- **Claude Code provider**: The existing SDK integration moves into `server/providers/claude-code/` — the only place that imports `@anthropic-ai/claude-agent-sdk`. Includes event translation (current `agentEvents.ts`), model list, and system prompt builder.
- **Event bus extraction**: `emit()`, `subscribe()`, `getActiveQuery()`, `finalize()` move to a dedicated module. `ActiveQuery` gains a `source` field so input channels (web, Discord, future Slack) can self-identify without the bus knowing about them.
- **Interaction resolution extraction**: `resolveAskUser()`, `resolveElicitation()`, and their pending Maps become a standalone module, enabling channels to self-select for interaction handling based on query source.
- **Query manager**: `queries.ts` becomes a thin, provider-agnostic orchestrator — builds `QueryContext`, calls `provider.runQuery()`, iterates `AppEvent`s, persists results. No SDK imports.
- **Provider API endpoint**: New `GET /api/providers` returns available providers with their models and capabilities, enabling the frontend to build dynamic model selectors grouped by provider.
- **Session data model**: `StoredSession` gains `provider: string` (defaults to `"claude-code"`) and `channelMeta?: Record<string, unknown>` for channel-specific metadata (Discord thread IDs, etc.).

## Capabilities

### New Capabilities
- `provider-registry`: Provider interface, registry, and capability system. Defines `AgentProvider`, `QueryContext`, `QueryResult`, `InteractionHooks`, `ProviderModel`, and `ProviderCapability`. Registry maps provider names to implementations with `getProvider()` and `listProviders()`.
- `event-bus`: Extracted event distribution system. Manages active queries, event buffering, subscriber management, and query source tracking. Channel-agnostic — any input channel subscribes the same way.
- `interaction-resolution`: Extracted promise-based resolution for `ask_user` and `elicitation` flows. Tracks query source so the correct channel handles each interaction.
- `claude-code-provider`: Claude Agent SDK wrapped as an `AgentProvider` implementation. Owns SDK imports, event translation, model list, system prompt construction, and MCP server creation.

### Modified Capabilities
None — no existing specs to modify.

## Impact

- **Server code**: `server/utils/queries.ts` splits into `server/utils/queryManager.ts`, `server/utils/eventBus.ts`, `server/utils/interactions.ts`, `server/utils/sessionHelpers.ts`. New `server/providers/` directory with types, registry, and claude-code implementation. `server/utils/agentEvents.ts` moves to `server/providers/claude-code/events.ts`.
- **Routes**: `generate-message.post.ts` uses `provider.complete()` instead of direct SDK import. `chat.post.ts`, `stream.get.ts`, `cancel.post.ts`, `ask-user.post.ts`, `elicitation.post.ts` update imports from `queries.ts` to new modules. New `GET /api/providers` endpoint.
- **Shared types**: `StoredSession` and `SessionListItem` gain `provider` field. `StoredSession` gains `channelMeta` field.
- **Frontend**: Model selector fetches from `/api/providers` instead of hardcoded constants. Provider selector component (or grouped model selector). Capability gating for provider-specific features.
- **No new dependencies**: This is a restructuring of existing code. The Claude Agent SDK dependency stays; it just moves behind the provider interface.

## Related Changes

- `discord-integration`: Discord adds a second input channel (bot + threads). This refactor extracts the event bus with channel-agnostic `source` tracking and adds `channelMeta` to sessions — both prerequisites for clean Discord integration. Discord will consume `startQuery()`, `subscribe()`, and `resolveAskUser()` from the extracted modules.
