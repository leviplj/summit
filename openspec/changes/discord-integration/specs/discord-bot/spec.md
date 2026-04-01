## ADDED Requirements

### Requirement: Bot starts and stops with the Nuxt server
The Discord bot SHALL be implemented as a Nuxt server plugin that initializes a discord.js client on server startup and gracefully disconnects on shutdown. The bot SHALL only be active when `DISCORD_BOT_TOKEN` is configured.

#### Scenario: Bot starts with Summit
- **WHEN** the Nuxt server starts
- **AND** `DISCORD_BOT_TOKEN` environment variable is set
- **THEN** the discord.js client SHALL log in and become ready
- **AND** the bot SHALL listen for messages in the configured channel

#### Scenario: Bot disabled when no token
- **WHEN** the Nuxt server starts
- **AND** `DISCORD_BOT_TOKEN` is not set
- **THEN** no discord.js client SHALL be created
- **AND** Summit SHALL function normally without Discord features

#### Scenario: Bot shuts down with Summit
- **WHEN** the Nuxt server shuts down
- **THEN** the discord.js client SHALL disconnect gracefully

### Requirement: Channel messages create threads and sessions
When a user sends a message in the configured Discord channel, the bot SHALL create a Discord thread for the message, create a new Summit session, bind the thread to the session, and start a query with the message text.

#### Scenario: User sends a message in the channel
- **WHEN** a user sends "refactor auth to use JWT" in the configured channel
- **THEN** the bot SHALL create a thread titled "refactor auth to use JWT" (truncated to Discord's limit)
- **AND** the bot SHALL create a new Summit session
- **AND** the session SHALL store Discord metadata (threadId, channelId, guildId)
- **AND** the bot SHALL call `startQuery()` with the message text
- **AND** the bot SHALL post "On it." to the thread

#### Scenario: Bot ignores messages in other channels
- **WHEN** a user sends a message in a channel that is not the configured channel
- **THEN** the bot SHALL not respond

#### Scenario: Bot ignores its own messages
- **WHEN** the bot posts a message in the configured channel
- **THEN** the bot SHALL not create a thread for it

### Requirement: Agent results are posted to the thread
The bot SHALL subscribe to session events and post bookend messages to the Discord thread — query started, results, and errors. Intermediate events (thinking, tool use) SHALL NOT be posted.

#### Scenario: Agent completes successfully
- **WHEN** a query finishes with a `result` event
- **THEN** the bot SHALL post the result text to the Discord thread

#### Scenario: Agent encounters an error
- **WHEN** a query emits an `error` event
- **THEN** the bot SHALL post the error message to the Discord thread

### Requirement: ask_user questions are posted to the thread
When an agent asks a question during a Discord-initiated query, the question SHALL be posted to the thread. The user's reply in the thread SHALL resolve the pending ask_user.

#### Scenario: Agent asks a question
- **WHEN** a query emits an `ask_user` event during a Discord-initiated query
- **THEN** the bot SHALL post the question to the Discord thread

#### Scenario: User answers in thread
- **WHEN** the user replies in the thread while an `ask_user` is pending
- **THEN** the bot SHALL resolve the pending ask_user with the reply text
- **AND** the agent SHALL continue execution

### Requirement: Thread replies continue the session
When a user replies in a thread after the agent has finished (no pending query), the reply SHALL start a new query on the same session.

#### Scenario: Follow-up message in thread
- **WHEN** the agent has finished (session is idle)
- **AND** the user sends "now add tests for it" in the thread
- **THEN** the bot SHALL call `startQuery()` on the existing session with the new message
- **AND** the bot SHALL post "On it." to the thread

### Requirement: Thread-to-session mapping persists across restarts
The mapping between Discord threads and Summit sessions SHALL be recoverable after a server restart by reading Discord metadata from persisted session files.

#### Scenario: Server restarts
- **WHEN** Summit restarts
- **AND** a user replies in an existing thread
- **THEN** the bot SHALL look up the session by threadId from persisted sessions
- **AND** the bot SHALL resume normal operation on that session

### Requirement: Query source tracking
Each query SHALL track which channel initiated it (discord or web). ask_user and elicitation events SHALL be routed to the channel that started the current query.

#### Scenario: Discord-initiated query asks user
- **WHEN** a query was started from Discord
- **AND** the agent emits `ask_user`
- **THEN** the question SHALL be posted to the Discord thread (not held for SSE)

#### Scenario: Web-initiated query on Discord session asks user
- **WHEN** a session was originally created from Discord
- **BUT** the current query was started from the web UI
- **AND** the agent emits `ask_user`
- **THEN** the question SHALL be held for SSE (not posted to Discord)

## MODIFIED Requirements

### Requirement: Session metadata includes Discord binding
Sessions SHALL support an optional `discord` field containing `threadId`, `channelId`, and `guildId` to bind a session to a Discord thread.

#### Scenario: Discord session is saved
- **WHEN** a session created from Discord is saved to disk
- **THEN** the JSON SHALL include a `discord` object with threadId, channelId, and guildId

#### Scenario: Non-Discord session
- **WHEN** a session created from the web UI is saved
- **THEN** the JSON SHALL NOT include a `discord` field
