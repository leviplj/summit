## Why

Summit sessions currently run a single Agent SDK query at a time — one agent, one conversation thread. For complex tasks that span multiple repos or domains (e.g., "build a user dashboard with API"), users must manually coordinate between concerns, switching context between backend and frontend work. Real development teams parallelize this naturally: a backend dev builds the API while a frontend dev waits for endpoint specs, then builds the UI, then QA tests the integrated result. Agent teams bring this real-world collaboration model into Summit.

## What Changes

- **Orchestrator role**: When a user sends a message, the session's agent can choose to act as an orchestrator — analyzing the request and deciding what teammates are needed (e.g., backend + frontend, or fullstack + QA).
- **Dynamic teammate spawning**: The orchestrator spins up N concurrent Agent SDK `query()` calls within the same session, each with a role-specific system prompt and scoped to specific directories/repos.
- **Inter-agent communication**: Teammates get custom MCP tools (`check_mailbox`, `send_message`, `notify_done`) backed by an in-memory message bus. Teammates can wait for messages from each other, enabling sequential handoffs (backend → frontend → QA).
- **Deadlock prevention**: A dependency tracker with cycle detection prevents circular waits. If teammate A waits for B and B tries to wait for A, the tool call fails with a clear error message guiding the agent to send results first.
- **Orchestrator management tools**: The orchestrator gets tools to create teammates, broadcast messages, and wait for team completion.
- **Tab-based UI**: Each teammate appears as a tab within the session, streaming its own events (thinking, tool use, text). A status bar shows per-teammate progress.

## Capabilities

### New Capabilities
- `message-bus`: In-memory inter-agent message bus with mailboxes, blocking receive, and broadcast. Includes dependency tracking with cycle detection for deadlock prevention.
- `teammate-lifecycle`: Teammate creation, role assignment, system prompt injection, and concurrent query execution within a session. Orchestrator tools for team management.
- `team-ui`: Tab-based UI for viewing per-teammate event streams, status indicators, and inter-agent message display within a session.

### Modified Capabilities

## Impact

- **Server (`frontend/server/utils/queries.ts`)**: Major changes — support multiple concurrent `query()` calls per session, per-teammate event emission, message bus integration.
- **Types (`frontend/shared/types.ts`)**: New types for teammates, team messages, team events, and extended `AppEvent` with teammate IDs.
- **Session storage (`frontend/server/utils/sessions.ts`)**: Persist team state (roles, message history, status) within the session JSON.
- **Frontend components**: New tab container component, per-teammate chat view, status bar, message indicators.
- **Dependencies**: Uses existing `@anthropic-ai/claude-agent-sdk` — specifically `tool()`, `createSdkMcpServer()`, and `mcpServers` option on `query()`. No new dependencies required.
