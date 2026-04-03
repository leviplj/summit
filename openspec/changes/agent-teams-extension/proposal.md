## Why

Summit treats each session as a single agent. For complex tasks spanning multiple domains (backend, frontend, QA), users must manually coordinate across sessions. By adding agent teams as an extension, a single user message can spawn multiple specialized agents working concurrently in the same session and shared worktree, with the UI showing per-agent tabs for visibility.

## What Changes

- Add an **agent teams extension** at `.summit/extensions/teams.ts` that uses onBeforeQuery to detect team-enabled sessions, spawns teammate sub-queries via `queries.run()`, and coordinates them via a MessageBus
- Add a **TeamManager** that manages teammate lifecycle (spawn, track status, collect results), using `holdStream` to keep the session stream alive until all teammates complete
- Add a **MessageBus** for inter-agent communication with mailbox queuing, blocking receive, and cycle detection to prevent deadlocks
- Add **MCP tools** for agents: orchestrator gets `spawn_teammate` and `broadcast`; teammates get `send_message` and `receive_message`
- Add **team tab UI** — the chat view shows tabs per agent (like tmp/summit's `TeamTabBar`), each with its own event stream, messages, and status indicator. Events are routed client-side by `agentId`
- Add **team-specific AppEvent types**: `team_created`, `teammate_status`, `teammate_message`, `teammate_done` for the UI to track team state
- Add **team configuration** — teams are defined per project (e.g., team roster, agent prompts) and activated when a project has a team config

## Capabilities

### New Capabilities
- `team-orchestration`: TeamManager, MessageBus, teammate lifecycle, and MCP tools for agent coordination — all as an extension using the ExtensionAPI
- `team-ui`: Tab-based UI for per-agent visibility — TeamTabBar component, event routing by agentId, status indicators, per-agent message streams
- `team-config`: Team definition format and project-level configuration for activating agent teams

### Modified Capabilities

(none)

## Impact

- **New extension**: `.summit/extensions/teams.ts` (or `frontend/server/extensions/teams/`)
- **New server utils**: TeamManager, MessageBus (could live in the extension directory)
- **New components**: TeamTabBar.vue, team event routing composable
- **Session store**: Per-agent tab state (events, messages, status, streaming text)
- **AppEvent types**: New team event types in summit-types
- **ChatMessage**: Uses existing `agentId` field (from extension-api-additions) to attribute messages
- **Depends on**: extension-api-additions change (onBeforeQuery, holdStream, queries.run, askId routing, timestamps)
