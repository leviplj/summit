## 1. Per-Message Cost Formatting

- [ ] 1.1 Update `ChatMessage.vue` meta computed property to format `output_tokens` with `toLocaleString()` for comma-separated display (e.g., "1,204 tokens" instead of "1204 tokens")

## 2. Session Cost Totals (Computed)

- [ ] 2.1 Add a `sessionCost` computed property (or equivalent) that sums `cost_usd` across all assistant messages in the active session's `messages` array — returns `{ totalCost: number, totalTokens: number }` or null if no cost data exists
- [ ] 2.2 Expose `sessionCost` from `useChat()` (or a dedicated composable) so the template can bind to it

## 3. Session Cost Display in Sidebar

- [ ] 3.1 Update the sidebar footer section in `index.vue` (where model name is shown) to display session cost total below the model name (e.g., "2,500 tokens · $0.06")
- [ ] 3.2 Conditionally hide the cost line when `sessionCost` is null (no cost data in the session)
- [ ] 3.3 Format the session cost total to 4 decimal places and tokens with `toLocaleString()`

## 4. Verify End-to-End Data Flow

- [ ] 4.1 Confirm `agentEvents.ts` `translateMessage()` captures `total_cost_usd`, `usage.output_tokens`, and `duration_ms` from SDK `result` events into `state.assistantMeta` (already implemented — verify no regression)
- [ ] 4.2 Confirm `queries.ts` `runQuery()` persists `state.assistantMeta` as `meta` on the assistant `ChatMessage` when saving the session (already implemented — verify no regression)
- [ ] 4.3 Confirm `useChat.ts` `handleEvent()` sets `meta` on the client-side message object from the `result` event fields (already implemented — verify no regression)
