## Context

Summit is a full-stack orchestration platform for Claude Code sessions built on Nuxt 4. Currently, each session is an independent Claude Code instance with its own worktree, conversation, and event stream. Projects group sessions by repository set but provide no coordination between them.

The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) natively supports subagents via the `agents` option on `query()`, where each agent gets its own tools, model, MCP servers, and prompt. The SDK handles spawning subagents as tool calls from the parent, and supports parallel tool calls (meaning parallel agent invocations). Events from subagents carry `agent_id` and `agent_type` fields.

The current `ProjectConfigDialog` is a single-view dialog with project name and repositories. The `Project` type has: `id`, `name`, `repos`, `createdAt`, `updatedAt`.

## Goals / Non-Goals

**Goals:**
- Users can define agent teams as markdown files with frontmatter, editable both via Summit's UI and directly in the filesystem
- Agent hierarchy is expressed via `parent` references in flat files, reconstructed into a tree at read time
- Sessions in projects with agents automatically use the SDK's native `agents` option, with the root agent as the entry point
- The UI for agent management lives inside a new "Agents" tab in the ProjectConfigDialog
- Agent teams are backwards-compatible — projects without agents work exactly as before

**Non-Goals:**
- Drag-and-drop reordering of agents in the tree (future enhancement)
- Live status indicators showing which agent is active during a session (future enhancement)
- Visual grouping of events by `agent_id` in the chat stream (future enhancement — events will flow as they do today, but with agent metadata attached)
- Custom tool restrictions per agent via the UI (can be set in the file directly)
- Agent templates or presets

## Decisions

### 1. Agent file format: Markdown with YAML frontmatter

Agent definitions are stored as `.md` files with YAML frontmatter for structured fields and markdown body for instructions (the agent's prompt).

```markdown
---
name: Backend
parent: architect
model: sonnet
repos:
  - api
---

You are a backend specialist. Always write tests.
```

**Why over JSON/YAML-only:** Markdown is natural for writing prompts (the body), and frontmatter handles the structured fields cleanly. Files are human-readable, git-diffable, and can be edited in any text editor.

**Why `parent` reference over directory nesting:** Flat files with `parent` pointers are simpler to manage — renames don't require moving directories, the tree is reconstructed in memory, and the filesystem stays clean. This is the standard pattern for serializing trees into flat storage (like threaded comments or org charts).

**Alternatives considered:**
- Single YAML manifest: cleaner structure but separates instructions from config, two files to keep in sync
- Directory nesting: intuitive but awkward for deeper trees, renames require directory moves

### 2. Configurable agents directory path on the Agents tab

The `Project` type gains an `agentsPath: string | null` field. This path is displayed and editable at the top of the Agents tab in ProjectConfigDialog. When null, agents are disabled for the project.

**Why user-configurable:** Projects can have multiple repos, and the agent team is a project-level concern — it doesn't belong to any single repo. Users may want to store agents in a specific repo's `.claude/agents/`, in a shared config repo, or anywhere else.

**Why on the Agents tab, not General:** The agents directory is an agents concern. Keeping it on the Agents tab makes the feature self-contained.

### 3. SDK native `agents` option for orchestration

When a project has agents, Summit reads the files, builds the hierarchy tree, and translates it into the SDK's `agents: Record<string, AgentDefinition>` option passed to `query()`. The root agent's instructions become the `systemPrompt.append`, and all descendants are nested under `agents`.

**Why SDK-native over Summit-managed orchestration:** The SDK already handles subagent spawning, parallel execution, and result collection. Building our own orchestration layer would duplicate this complexity. SDK subagents also naturally share the same process and worktree.

**Trade-off:** Less visibility into subagent activity compared to managing separate sessions. The event stream is a single stream, and subagent events are identified only by `agent_id` metadata. This is acceptable for v1 — visual grouping by agent can be added later.

### 4. Shared worktree for all agents in a team

All agents in a team share the same worktree(s) as the session. No per-agent branch isolation.

**Why:** The orchestrator decides what to delegate and when. Agents working on the same codebase need to see each other's changes, especially when working in parallel. Isolation would require merge coordination that adds complexity without clear benefit for the coordinated-team use case.

**Risk:** Parallel agents could create conflicting edits. → Mitigation: The orchestrator agent's instructions should guide it to assign non-overlapping areas. The `repos` field on each agent hints at scope, and instructions can further constrain file paths.

### 5. AskUserQuestion routing through parent agents

When a subagent needs user input, the SDK's event stream carries the question with `agent_id`. However, in the orchestration model, the parent agent should intercept and contextualize these questions before they reach the user.

**How:** The root agent's instructions explicitly tell it to relay sub-agent questions with added context. The SDK naturally supports this — when a subagent's tool call returns, the parent sees the result and can act on it, including asking the user via its own AskUserQuestion call.

### 6. Tabbed ProjectConfigDialog

The dialog gains a tab bar with "General" (existing content) and "Agents" (new). The Agents tab uses a split layout: tree on the left, editor on the right. The dialog width expands when on the Agents tab to accommodate the split view.

## Risks / Trade-offs

- **SDK `agents` nesting depth**: The SDK's `AgentDefinition` type includes an `agents` field but deep nesting behavior is undocumented. → Mitigation: Test with 2-3 levels. Most practical teams will be 2 levels (orchestrator + specialists).
- **File watching**: Changes made directly to agent files won't auto-refresh in the UI. → Mitigation: Read files on dialog open. File watching can be added later if needed.
- **Circular parent references**: A file could reference a parent that references it back. → Mitigation: Detect cycles during tree construction and report an error.
- **Orphaned agents**: An agent could reference a parent that doesn't exist. → Mitigation: Treat orphaned agents as root-level, show a warning in the UI.
- **Large agent teams**: The SDK passes all agent definitions in memory. → Mitigation: Practical teams will be small (3-8 agents). Not a real concern.
