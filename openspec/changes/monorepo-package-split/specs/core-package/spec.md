## ADDED Requirements

### Requirement: Core factory initialization
The `summit-core` package SHALL export a `createSummit(config)` function that returns an initialized instance containing all subsystems: events, queries, sessions, providers, extensions, worktrees, projects, and interactions.

#### Scenario: Initialize core with default config
- **WHEN** consumer calls `createSummit({ dataDir: ".summit" })`
- **THEN** the returned object provides access to all subsystems with methods matching the current internal APIs

#### Scenario: Initialize core with custom storage path
- **WHEN** consumer calls `createSummit({ dataDir: "/custom/path" })`
- **THEN** sessions, projects, and extensions are stored under the specified directory

### Requirement: Framework independence
The `summit-core` package SHALL have zero dependencies on Nuxt, Nitro, H3, or any web framework. It SHALL depend only on `summit-types`, `@anthropic-ai/claude-agent-sdk`, and Node.js built-ins.

#### Scenario: Import core without web framework
- **WHEN** a plain TypeScript project imports `summit-core`
- **THEN** it resolves without requiring any Nuxt/Nitro/H3 packages

### Requirement: Event bus subsystem
The core SHALL expose an event bus with publish/subscribe semantics, supporting per-session event streams, global event listeners, and stream holds for multi-agent coordination.

#### Scenario: Subscribe to session events
- **WHEN** a consumer subscribes to a session's event stream
- **THEN** it receives all events emitted for that session as an async iterable

#### Scenario: Hold and release stream
- **WHEN** a consumer calls `holdStream()` on an active query
- **THEN** the stream stays open until all holds are released

### Requirement: Query manager subsystem
The core SHALL expose a query manager that orchestrates provider queries, fires extension hooks, persists messages, and manages active query lifecycle.

#### Scenario: Start a query
- **WHEN** consumer calls `queries.start(sessionId, text, source)`
- **THEN** extension hooks fire, the provider runs, events stream, and messages persist

#### Scenario: Run a sub-query for teammates
- **WHEN** consumer calls `queries.run(sessionId, prompt, opts)` during an active query
- **THEN** a sub-query runs with a separate conversation ID and the parent stream is held

### Requirement: Provider registry subsystem
The core SHALL expose a provider registry that allows registering, listing, and retrieving agent providers by name.

#### Scenario: Register and retrieve a provider
- **WHEN** an extension registers a provider via `providers.register(provider)`
- **THEN** it is retrievable via `providers.get(name)` and listed via `providers.list()`

### Requirement: Extension system subsystem
The core SHALL load bundled extensions (claude-code, discord, teams) and discover user extensions from configurable paths, providing each with the full ExtensionAPI.

#### Scenario: Load bundled extensions on init
- **WHEN** core initializes
- **THEN** bundled extensions (claude-code, discord, teams) are loaded and active

#### Scenario: Discover user extensions
- **WHEN** core initializes with extension paths configured
- **THEN** extensions at those paths are discovered, loaded, and receive ExtensionAPI

### Requirement: Session storage subsystem
The core SHALL expose session CRUD operations with file-based JSON persistence under the configured data directory.

#### Scenario: Create and retrieve a session
- **WHEN** consumer creates a session via `sessions.create(data)`
- **THEN** it is persisted as JSON and retrievable via `sessions.get(id)`

### Requirement: Web adapter layer
The `summit-web` Nuxt app SHALL initialize core via a server plugin and expose a `useCore()` utility for route handlers to access core subsystems. Route handlers SHALL contain no business logic.

#### Scenario: Route handler delegates to core
- **WHEN** an HTTP request hits `POST /api/chat`
- **THEN** the route handler extracts parameters from the request and calls `core.queries.start()`, returning the result as an HTTP response

#### Scenario: Core available in all routes
- **WHEN** any server route calls `useCore()`
- **THEN** it receives the initialized core instance with all subsystems
