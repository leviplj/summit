## ADDED Requirements

### Requirement: AgentProvider interface
The system SHALL define an `AgentProvider` interface that every AI provider implements. The interface SHALL include:
- `name: string` — unique provider identifier
- `models: ProviderModel[]` — available models with id, label, and optional default flag
- `supports(capability: ProviderCapability): boolean` — capability check
- `runQuery(ctx: QueryContext, hooks: InteractionHooks): QueryResult` — streaming agent session
- `complete(prompt: string, model?: string): Promise<string>` — one-shot text completion

#### Scenario: Provider implements all required methods
- **WHEN** a new provider module is created
- **THEN** it MUST implement all methods on the `AgentProvider` interface to be registered

### Requirement: QueryContext is provider-agnostic
The system SHALL define a `QueryContext` type containing only plain data — no SDK types. It SHALL include: `prompt`, `cwd`, `additionalDirs`, `systemPromptSuffix`, `model`, `resumeSessionId`, `abortSignal`, and optional `mcpServers` and `allowedTools` fields.

#### Scenario: QueryContext carries no SDK imports
- **WHEN** the query manager builds a `QueryContext`
- **THEN** the object SHALL contain only primitive types, strings, arrays, and plain objects — no SDK class instances or SDK-specific types

### Requirement: QueryResult streams AppEvents
The system SHALL define a `QueryResult` type with:
- `stream: AsyncIterable<AppEvent>` — the provider translates its raw events into `AppEvent` internally
- `getSessionId(): string | null` — provider session ID for resume support
- `getAssistantText(): string` — accumulated assistant text after stream ends
- `getAssistantMeta(): object | null` — accumulated metadata (cost, tokens, duration)

#### Scenario: Query manager consumes stream without SDK knowledge
- **WHEN** the query manager iterates `result.stream`
- **THEN** it receives `AppEvent` objects and SHALL NOT need any SDK-specific logic to process them

### Requirement: InteractionHooks for user input
The system SHALL define `InteractionHooks` with callbacks `onAskUser` and `onElicitation` that the provider invokes when the agent needs user input. The provider awaits the result without knowing how it's resolved.

#### Scenario: Provider blocks on ask_user
- **WHEN** the agent triggers an `AskUserQuestion` tool call
- **THEN** the provider calls `hooks.onAskUser(questions)` and awaits the returned Promise before continuing the agent session

### Requirement: ProviderCapability declaration
The system SHALL define a `ProviderCapability` type with values: `"resume"`, `"elicitation"`, `"ask_user"`, `"tool_streaming"`, `"mcp_tools"`, `"system_prompt"`. Providers declare which capabilities they support via `supports()`.

#### Scenario: UI gates features by capability
- **WHEN** the frontend fetches provider info from `GET /api/providers`
- **THEN** it SHALL receive a `capabilities` array and hide UI features the active provider does not support

### Requirement: Provider registry
The system SHALL maintain a `Map<string, AgentProvider>` registry with `getProvider(name: string): AgentProvider` and `listProviders(): AgentProvider[]`. Providers register at module load time.

#### Scenario: Get provider by name
- **WHEN** `getProvider("claude-code")` is called
- **THEN** it SHALL return the registered Claude Code provider instance

#### Scenario: Unknown provider throws
- **WHEN** `getProvider("nonexistent")` is called
- **THEN** it SHALL throw an error with the unknown provider name

### Requirement: Providers API endpoint
The system SHALL expose `GET /api/providers` returning an array of `{ name, models, capabilities }` for each registered provider.

#### Scenario: Frontend fetches available providers
- **WHEN** the frontend calls `GET /api/providers`
- **THEN** it SHALL receive a JSON array with at least the `claude-code` provider, its models, and its capabilities

### Requirement: Session stores provider
`StoredSession` SHALL include a `provider: string` field defaulting to `"claude-code"`. Sessions without the field SHALL be treated as `"claude-code"` for backwards compatibility.

#### Scenario: New session gets default provider
- **WHEN** a session is created without specifying a provider
- **THEN** the session's `provider` field SHALL be `"claude-code"`

#### Scenario: Legacy sessions without provider field
- **WHEN** a session JSON file lacks a `provider` field
- **THEN** the system SHALL treat it as `"claude-code"` without error

### Requirement: Session stores channel metadata
`StoredSession` SHALL include an optional `channelMeta?: Record<string, unknown>` field for channel-specific metadata (e.g., Discord thread IDs). The session store SHALL persist and return this field without interpreting its contents.

#### Scenario: Discord stores thread metadata
- **WHEN** the Discord channel creates a session with `channelMeta: { discord: { threadId, channelId, guildId } }`
- **THEN** the session store SHALL persist and return this metadata on subsequent reads
