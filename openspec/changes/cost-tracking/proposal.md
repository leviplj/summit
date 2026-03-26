## Why

Users have no visibility into how much their Claude usage costs. The SDK provides token counts and cost data per query, but Summit doesn't surface this. Users need cost awareness to manage their API spend — both per-message and per-session totals.

## What Changes

- Display **per-message cost** on assistant messages (tokens used, cost in USD)
- Show **session total cost** in the sidebar or session header
- Capture and persist cost metadata from the SDK response (already partially available via `ChatMessageMeta`)
- Optionally show a running cost total across all sessions

## Capabilities

### New Capabilities
- `cost-display`: Show per-message token usage and cost (USD) on assistant messages, and aggregate session-level cost totals. Data sourced from SDK response metadata already captured in `ChatMessageMeta`.

### Modified Capabilities

_None — no existing specs to modify._

## Impact

- **Frontend**: Cost badge on assistant messages, session cost total in sidebar/header, cost formatting utilities
- **Shared types**: Ensure `ChatMessageMeta.cost_usd` and `output_tokens` are reliably populated
- **Server**: Ensure cost metadata from SDK is correctly extracted and persisted on messages
