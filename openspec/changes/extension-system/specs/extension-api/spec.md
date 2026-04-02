## ADDED Requirements

### Requirement: Extension factory function signature
An extension SHALL be a module with a default export of type `(api: ExtensionAPI) => void | Promise<void>`. The system SHALL call this function once at startup with an API object scoped to that extension.

#### Scenario: Synchronous extension loads successfully
- **WHEN** an extension module exports `default (api) => { api.log("loaded"); }`
- **THEN** the system calls the factory function and the extension is registered

#### Scenario: Async extension loads successfully
- **WHEN** an extension module exports `default async (api) => { await setup(); }`
- **THEN** the system awaits the factory function before proceeding to the next extension

### Requirement: Session access via API
The ExtensionAPI SHALL provide methods to read, create, save, and list sessions: `api.sessions.get(id)`, `api.sessions.save(session)`, `api.sessions.list()`.

#### Scenario: Extension reads a session
- **WHEN** an extension calls `api.sessions.get(sessionId)`
- **THEN** it receives the `StoredSession` object or `null` if not found

#### Scenario: Extension creates and saves a session
- **WHEN** an extension calls `api.sessions.save(session)` with a new session object
- **THEN** the session is persisted and a `session_created` global event is emitted

### Requirement: Event bus access via API
The ExtensionAPI SHALL expose event hooks: `api.events.onQueryInit(listener)`, `api.events.onGlobal(listener)`, `api.events.subscribe(sessionId, afterId, listener)`.

#### Scenario: Extension listens to query initialization
- **WHEN** an extension calls `api.events.onQueryInit(callback)`
- **THEN** the callback is invoked whenever a new query starts, receiving `(sessionId, source)`

#### Scenario: Extension subscribes to query events
- **WHEN** an extension calls `api.events.subscribe(sessionId, 0, callback)`
- **THEN** the callback receives all `StreamEvent` objects for that query

#### Scenario: Extension listens to global session lifecycle
- **WHEN** an extension calls `api.events.onGlobal(callback)`
- **THEN** the callback is invoked for `session_created`, `session_deleted`, and `session_updated` events

### Requirement: Query management via API
The ExtensionAPI SHALL provide `api.queries.start(sessionId, text, source)` and `api.queries.getActive(sessionId)` for managing queries.

#### Scenario: Extension starts a query
- **WHEN** an extension calls `api.queries.start(sessionId, "hello", "discord")`
- **THEN** a query is initiated for that session with the given source identifier

#### Scenario: Extension checks active query
- **WHEN** an extension calls `api.queries.getActive(sessionId)`
- **THEN** it receives the `ActiveQuery` object or `undefined`

### Requirement: Provider registration via API
The ExtensionAPI SHALL provide `api.providers.register(provider)` to register new `AgentProvider` implementations at startup.

#### Scenario: Extension registers a custom provider
- **WHEN** an extension calls `api.providers.register(myProvider)` where `myProvider` implements `AgentProvider`
- **THEN** the provider is available for session creation and appears in `listProviders()`

### Requirement: Interaction resolution via API
The ExtensionAPI SHALL provide `api.interactions.resolveAskUser(sessionId, response)` and `api.interactions.createPendingAskUser(sessionId, source)` for handling user interaction flows.

#### Scenario: Extension resolves an ask_user prompt
- **WHEN** an extension calls `api.interactions.resolveAskUser(sessionId, { question: answer })`
- **THEN** the pending ask_user for that session is resolved with the provided response

### Requirement: Worktree management via API
The ExtensionAPI SHALL provide `api.worktrees.create(sessionId)` for creating git worktrees.

#### Scenario: Extension creates a worktree for a new session
- **WHEN** an extension calls `api.worktrees.create(sessionId)`
- **THEN** a new git worktree is created and the path is returned

### Requirement: Shutdown hook registration
The ExtensionAPI SHALL provide `api.onShutdown(callback)` for extensions to register cleanup logic that runs when Summit shuts down.

#### Scenario: Extension registers shutdown cleanup
- **WHEN** an extension calls `api.onShutdown(() => client.destroy())`
- **THEN** the callback is invoked when the Nitro server closes

### Requirement: Scoped logging
The ExtensionAPI SHALL provide `api.log(message)` that prefixes log output with the extension name.

#### Scenario: Extension logs a message
- **WHEN** an extension calls `api.log("Bot ready")`
- **THEN** the console output shows `[ext:discord] Bot ready`
