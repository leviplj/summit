## Why

Summit currently treats each Claude Code session as an independent instance — no coordination, no shared context, no delegation. For complex tasks that span multiple repositories or domains (backend, frontend, infrastructure), users must manually context-switch between sessions and coordinate work themselves. By allowing users to define hierarchical agent teams, a single conversation with a root agent can orchestrate multiple specialized sub-agents working in parallel on a shared worktree, dramatically reducing coordination overhead.

## What Changes

- Add an **Agents tab** to the ProjectConfigDialog where users can define, edit, and organize agent teams with a visual tree + editor panel
- Add a **configurable agents directory** path (shown in the Agents tab) pointing to where agent definition files (`.md` with frontmatter) are read from and saved to
- Store agent definitions as **markdown files** in the configured directory, with frontmatter fields: `name`, `parent`, `model`, `repos` — making them editable both via UI and directly in the filesystem
- Build agent hierarchy from flat files using `parent` references, reconstructed into a tree at read time
- When a project has agents defined, new sessions use the **root agent** (no parent) as the entry point, with all descendants passed to the Claude Agent SDK's native `agents` option
- Sub-agents run on the **shared worktree** — no isolated branches per agent
- The **orchestrator (root agent) decides** whether to delegate sequentially or in parallel
- Sub-agent `AskUserQuestion` calls are **handled by the parent agent**, which adds context before relaying to the user
- Projects without agents continue working exactly as today (backwards compatible)

## Capabilities

### New Capabilities
- `agent-definitions`: File-based agent definition format (markdown + frontmatter), filesystem read/write, and parsing into hierarchical tree structures
- `agent-team-ui`: Agents tab in ProjectConfigDialog with tree visualization, inline editor, and configurable agents directory path
- `agent-orchestration`: Integration with Claude Agent SDK's native `agents` option — translating the agent tree into nested `AgentDefinition` objects and routing sessions through the root agent

### Modified Capabilities

## Impact

- **ProjectConfigDialog.vue**: Expands from single-view to tabbed layout (General + Agents)
- **Project data model**: New `agentsPath` field on the `Project` type
- **queries.ts**: Modified to read agent definitions and pass `agents` option to SDK `query()` calls when a project has agents configured
- **Server utils**: New utility for reading/writing/parsing agent `.md` files from the configured directory
- **shared/types.ts**: New `AgentDefinition` type for the agent file format
- **API routes**: New endpoints for CRUD operations on agent files
- **Event stream rendering**: Frontend needs to group tool events by `agent_id` to show which sub-agent is working
