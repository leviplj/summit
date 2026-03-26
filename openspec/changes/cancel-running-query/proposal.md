## Why

Once a query is sent to Claude, there's no way to stop it. If the agent goes down a wrong path or the user realizes the prompt was wrong, they must wait for it to finish. Users need a cancel/stop button to abort running queries immediately.

## What Changes

- Add a **stop button** that replaces the send button while a query is running
- Server-side cancellation via the SDK's abort mechanism (AbortController or equivalent)
- Clean cancellation: the conversation history up to the cancellation point is preserved
- UI transitions back to idle state after cancellation

## Capabilities

### New Capabilities
- `query-cancellation`: Cancel a running SDK query mid-execution. The server aborts the query stream, the UI shows a stop button during active queries, and partial results are preserved in the conversation.

### Modified Capabilities

_None — no existing specs to modify._

## Impact

- **Server**: Add abort controller to query execution in `queries.ts`, new `POST /api/sessions/[id]/cancel` endpoint
- **Frontend**: Replace send button with stop button during loading state, handle cancellation state in `useChat`
