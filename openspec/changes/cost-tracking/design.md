## Context

Summit is a Nuxt 4 + Vue + TypeScript web chat UI for Claude Code using the Agent SDK. Users currently see assistant messages with no cost information. The SDK already provides cost metadata on `result` events (`total_cost_usd`, `usage.output_tokens`, `duration_ms`), and the server-side translator (`agentEvents.ts`) already captures this into `state.assistantMeta`. The `ChatMessageMeta` type already defines `cost_usd`, `output_tokens`, and `duration_ms` fields. The `ChatMessage.vue` component already formats and displays per-message metadata when present.

The key gaps are: (1) the per-message display could use improved formatting (locale-aware token counts), (2) there is no session-level cost aggregation, and (3) the session total is not surfaced anywhere in the UI.

## Goals / Non-Goals

**Goals:**
- Show per-message cost, tokens, and duration on assistant messages (partially exists, needs formatting improvements)
- Show session-level cost and token totals in the sidebar or header
- Ensure cost metadata is reliably captured from SDK and persisted
- Update session totals in real time as queries complete

**Non-Goals:**
- Cross-session or global cost tracking (e.g., "total spend this month")
- Cost budgets or spending limits/alerts
- Input token tracking (only output tokens are displayed)
- Customizable cost display preferences (show/hide, decimal places)
- Historical cost analytics or charts

## Decisions

### 1. Per-message cost display: enhance existing `ChatMessage.vue` metadata line

The `ChatMessage.vue` component already computes a `meta` string showing duration, tokens, and cost. The only change needed is improved formatting: use `toLocaleString()` for token counts (e.g., "1,204 tokens") and keep `$0.0042` formatting with `toFixed(4)` for cost.

**Current state:** `ChatMessage.vue` already renders `meta` with `${m.output_tokens} tokens` and `$${m.cost_usd.toFixed(4)}`.

**Change:** Update the token formatting to use `toLocaleString()` for comma-separated numbers. The cost and duration formatting remain as-is.

**Alternatives considered:**
- Dedicated `CostBadge.vue` component: Unnecessary given the metadata line already exists and the formatting change is minimal
- Tooltip with detailed breakdown: Over-engineering for the current scope; can be added later

### 2. Session cost totals: computed property in the existing reactive chain

Session totals are computed client-side by summing `cost_usd` and `output_tokens` across all assistant messages in the active session. This uses a `computed()` property derived from `messages`, which is already reactive. No new API endpoints or server-side aggregation is needed.

**Rationale:** Messages (including their `meta`) are already fully loaded client-side via `useSessionStore`. Computing sums in a `computed()` is simple, reactive, and updates automatically when a new `result` event populates `meta` on the latest message.

**Alternatives considered:**
- Server-side aggregation endpoint: Unnecessary round-trip; the client already has all the data
- Storing running totals on the session object: Adds write complexity and risks drift vs. the actual message data; computing from source is more reliable

### 3. Session total display location: sidebar footer, alongside model name

The sidebar footer already displays the model name (e.g., "claude-sonnet-4-20250514"). The session cost total will be shown in this same area, below or beside the model name. This keeps cost visible without consuming header space.

**Layout:** The sidebar footer becomes two lines — model name on top, session cost summary below (e.g., "2,500 tokens · $0.06"). When no cost data exists, the cost line is hidden.

**Alternatives considered:**
- Header bar: Already contains branch badge, theme toggle, and changed-files toggle; adding cost info crowds it
- Inline in session list items: Would add visual noise to every session entry; cost is most relevant for the active session
- Dedicated cost panel: Too heavy for the amount of data being shown

### 4. Data flow: no changes to server-side capture

The existing data flow already handles cost metadata end-to-end:
1. SDK emits `result` event with `total_cost_usd`, `usage.output_tokens`, `duration_ms`
2. `agentEvents.ts` `translateMessage()` captures these into `state.assistantMeta`
3. `queries.ts` `runQuery()` persists `state.assistantMeta` as `meta` on the assistant message
4. `useChat.ts` `handleEvent()` sets `meta` on the client-side message when the `result` event arrives

No server-side changes are required. The pipeline is already correctly populating `ChatMessageMeta` fields.

### 5. Cost formatting utilities: inline in components, no shared utility module

Given there are only two display locations (per-message in `ChatMessage.vue`, session total in sidebar), formatting logic stays inline. If a third location is added in the future, a shared `formatCost()` / `formatTokens()` utility can be extracted at that time.

**Alternatives considered:**
- `utils/costFormat.ts` shared module: Premature for two call sites with near-identical one-liners

## Risks / Trade-offs

- **SDK cost data availability**: The SDK may not always provide `total_cost_usd` (e.g., if the API key doesn't have cost visibility or the SDK version changes the field name). The UI gracefully handles this by hiding cost when the field is undefined. No error state is needed.

- **Floating-point summation**: Summing many small USD values could accumulate floating-point errors. At the scale of a single session (tens to low hundreds of messages), this is negligible. If precision matters in the future, costs could be stored in cents/microdollars as integers.

- **Session total reactivity during streaming**: The session total only updates when the `result` event arrives (at the end of a query), not during streaming. This is acceptable because cost is not known until the query completes. The UI does not show a "pending cost" during streaming.

## Open Questions

_None — the scope is small and the existing infrastructure handles most of the work._
