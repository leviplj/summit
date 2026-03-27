## ADDED Requirements

### Requirement: Translate agent tree to SDK agents option
The system SHALL translate the agent hierarchy into the Claude Agent SDK's `agents: Record<string, AgentDefinition>` option when starting a query for a session whose project has agents defined. Each agent's instructions SHALL become the `prompt` field, `model` SHALL map directly, and child agents SHALL be nested via the `agents` field on their parent's definition.

#### Scenario: Two-level hierarchy
- **WHEN** project has agents: architect (root) with children backend and frontend
- **THEN** the `query()` call includes `agents: { backend: { prompt, model, ... }, frontend: { prompt, model, ... } }` and the architect's instructions are appended to the system prompt

#### Scenario: Three-level hierarchy
- **WHEN** project has agents: architect → backend → db
- **THEN** the `query()` call includes `agents: { backend: { prompt, model, agents: { db: { prompt, model } } } }` with architect's instructions in the system prompt

#### Scenario: Project without agents
- **WHEN** a project has no agents configured (no agentsPath or empty directory)
- **THEN** the `query()` call proceeds without the `agents` option, preserving current behavior

### Requirement: Root agent as session entry point
When a project has agents, the session SHALL use the root agent as the entry point. The root agent's instructions SHALL be appended to the existing system prompt. The user's messages SHALL be sent to the root agent, which decides when and how to delegate to sub-agents.

#### Scenario: User sends message to agent team
- **WHEN** user sends "Fix the login bug" in a session with an agent team
- **THEN** the root agent receives the message and can choose to handle it directly or delegate to sub-agents

### Requirement: Agent repos scope in system prompt
When an agent has a `repos` field defined, the system SHALL include this scope information in the agent's prompt so the agent knows which repositories it should focus on.

#### Scenario: Agent with repos constraint
- **WHEN** backend agent has `repos: [api]` and the project has repos api and web
- **THEN** the backend agent's prompt includes information about which repos it should focus on

### Requirement: Shared worktree
All agents in a team SHALL share the same worktree(s) as the session. The system SHALL NOT create per-agent branches or worktrees.

#### Scenario: Multiple agents working on same repo
- **WHEN** backend and frontend agents both modify files in the shared worktree
- **THEN** both agents see each other's changes in real time through the shared filesystem

### Requirement: Project agentsPath field
The `Project` type SHALL include an `agentsPath: string | null` field. When set, sessions for this project SHALL read agent definitions from this path. When null, no agents are used.

#### Scenario: Save project with agentsPath
- **WHEN** user sets agents directory to `/code/api/.claude/agents` and saves the project
- **THEN** the project's `agentsPath` field is persisted as `/code/api/.claude/agents`

#### Scenario: Project API includes agentsPath
- **WHEN** creating or updating a project via API with an `agentsPath` value
- **THEN** the field is validated (directory exists or can be created) and stored on the project
