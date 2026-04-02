## ADDED Requirements

### Requirement: Implements AgentProvider interface
The Claude Code provider SHALL implement the full `AgentProvider` interface and register itself in the provider registry under the name `"claude-code"`.

#### Scenario: Provider is available at startup
- **WHEN** the server starts
- **THEN** `getProvider("claude-code")` SHALL return a valid `AgentProvider` instance

### Requirement: runQuery translates SDK events to AppEvent
`runQuery()` SHALL call the Claude Agent SDK `query()` function, iterate the raw message stream, and yield `AppEvent` objects via `AsyncIterable`. The translation logic (current `agentEvents.ts`) SHALL live inside the provider module.

#### Scenario: SDK system message becomes init event
- **WHEN** the SDK emits a `system` message with `session_id` and `model`
- **THEN** the provider SHALL yield `{ type: "init", sessionId, model, tools }` as an `AppEvent`

#### Scenario: SDK stream_event becomes text/tool events
- **WHEN** the SDK emits `stream_event` messages with content block deltas
- **THEN** the provider SHALL yield appropriate `thinking`, `text`, `tool_use`, and `tool_result` AppEvents

#### Scenario: SDK result message becomes result event
- **WHEN** the SDK emits a `result` message
- **THEN** the provider SHALL yield `{ type: "result", text, is_error, duration_ms, cost_usd, input_tokens, output_tokens }` and update internal state for `getAssistantText()` and `getAssistantMeta()`

### Requirement: runQuery handles AskUser via InteractionHooks
The provider SHALL configure the SDK's `canUseTool` callback to intercept `AskUserQuestion` tool calls. When intercepted, it SHALL call `hooks.onAskUser(questions)`, await the response, and return the answers to the SDK as `updatedInput`.

#### Scenario: AskUser blocks until resolved
- **WHEN** the SDK triggers an `AskUserQuestion` tool call
- **THEN** the provider SHALL call `hooks.onAskUser()` and the SDK query SHALL pause until the Promise resolves

### Requirement: runQuery handles elicitation via InteractionHooks
The provider SHALL configure the SDK's `onElicitation` callback to delegate to `hooks.onElicitation()`, passing `serverName`, `message`, and `requestedSchema`. The result SHALL be returned to the SDK.

#### Scenario: Elicitation delegates to hooks
- **WHEN** the SDK triggers an elicitation callback
- **THEN** the provider SHALL call `hooks.onElicitation()` and return the resolved `{ action, content? }` to the SDK

### Requirement: runQuery configures SDK options from QueryContext
The provider SHALL map `QueryContext` fields to Claude Agent SDK options:
- `prompt` → SDK `prompt`
- `cwd` → SDK `cwd`
- `additionalDirs` → SDK `additionalDirectories`
- `systemPromptSuffix` → SDK `systemPrompt.append` with preset `"claude_code"`
- `model` → SDK `model`
- `resumeSessionId` → SDK `resume`
- `abortSignal` → SDK `abortController`
- `mcpServers` → SDK `mcpServers`
- `allowedTools` → SDK `allowedTools`
- Always: `permissionMode: "bypassPermissions"`, `allowDangerouslySkipPermissions: true`, `includePartialMessages: true`

#### Scenario: Resume uses existing session ID
- **WHEN** `QueryContext.resumeSessionId` is set
- **THEN** the SDK SHALL be called with `resume: resumeSessionId`

#### Scenario: Model passes through
- **WHEN** `QueryContext.model` is `"claude-sonnet-4-6"`
- **THEN** the SDK SHALL be called with `model: "claude-sonnet-4-6"`

### Requirement: complete provides one-shot generation
`complete()` SHALL call the Claude Agent SDK `query()` with `maxTurns: 1`, `allowedTools: []`, and the given prompt. It SHALL return the result text as a string.

#### Scenario: Commit message generation
- **WHEN** `provider.complete(prompt, "haiku")` is called
- **THEN** it SHALL return the SDK's result text without streaming or tool execution

### Requirement: Models list
The provider SHALL declare its available models including at minimum: Opus 4.6, Sonnet 4.6, Haiku 4.5, and legacy models (Opus 4.5, 4.1, 4; Sonnet 4.5, 4). The default model SHALL be indicated.

#### Scenario: Models returned via API
- **WHEN** `GET /api/providers` is called
- **THEN** the claude-code provider entry SHALL include the full models array with `id`, `label`, and `default` fields

### Requirement: All capabilities supported
The Claude Code provider SHALL return `true` for all `ProviderCapability` values: `"resume"`, `"elicitation"`, `"ask_user"`, `"tool_streaming"`, `"mcp_tools"`, `"system_prompt"`.

#### Scenario: All capabilities reported
- **WHEN** the frontend checks provider capabilities
- **THEN** the claude-code provider SHALL report support for all defined capabilities

### Requirement: System prompt construction
The provider module SHALL include a `buildSystemPrompt(session)` function that constructs the system prompt suffix from session data (worktree listing, safety instructions). This replaces the inline template string currently in `queries.ts`.

#### Scenario: Prompt includes repo listing
- **WHEN** a session has `worktrees: { "api": "/path/api", "web": "/path/web" }`
- **THEN** the system prompt suffix SHALL list both repos with their paths

### Requirement: SDK is only imported within this module
The `@anthropic-ai/claude-agent-sdk` package SHALL only be imported within `server/providers/claude-code/`. No other server module SHALL import it directly.

#### Scenario: SDK import is contained
- **WHEN** searching the codebase for `@anthropic-ai/claude-agent-sdk` imports
- **THEN** matches SHALL only be found in files under `server/providers/claude-code/`
