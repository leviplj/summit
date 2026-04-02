## Tasks

### 1. Session types and storage (done via provider-abstraction)
- [x] `channelMeta?: Record<string, unknown>` on `StoredSession` — Discord stores `{ discord: { threadId, channelId, guildId } }` here (provider-abstraction)
- [x] `source` field on `ActiveQuery` in `eventBus.ts` (provider-abstraction)
- [x] `source` parameter on `startQuery()` in `queryManager.ts` (provider-abstraction)

### 2. Add discord.js dependency
- [x] Run `bun add discord.js` in `frontend/`
- [x] Add `DISCORD_BOT_TOKEN` and `DISCORD_CHANNEL_ID` to `.env.example` with comments

### 3. Create Discord utility module
- [x] Create `frontend/server/utils/discord.ts`
- [x] Implement in-memory `threadToSession: Map<string, string>` (threadId → sessionId)
- [x] Implement `rebuildThreadMap()` that reads all sessions via `listSessions()` and populates the map from sessions with `channelMeta.discord` metadata
- [x] Implement `formatResultForDiscord(text: string): string` that truncates to 2000 chars with a "see Summit for full results" note
- [x] Implement `formatAskUserForDiscord(questions: AskUserQuestion[]): string` that formats questions as plain text

### 4. Create Discord bot server plugin
- [x] Create `frontend/server/plugins/discord.ts`
- [x] On startup: check for `DISCORD_BOT_TOKEN`, if missing log and return
- [x] Create discord.js `Client` with `GatewayIntentBits.Guilds`, `GatewayIntentBits.GuildMessages`, `GatewayIntentBits.MessageContent`
- [x] On `ready`: call `rebuildThreadMap()`, log bot username
- [x] On Nuxt `close` hook: call `client.destroy()`

### 5. Handle channel messages — create thread and session
- [x] On `messageCreate`: filter to configured channel, ignore bot's own messages, ignore thread messages
- [x] Create a new `StoredSession` with `channelMeta.discord` metadata (threadId, channelId, guildId)
- [x] Save session via `saveSession()`
- [x] Add to `threadToSession` map
- [x] Create Discord thread from the message (use `message.startThread()`)
- [x] Post "On it." to the thread
- [x] Call `startQuery(sessionId, message.content, "discord")`

### 6. Subscribe to session events and post bookends to Discord
- [x] After calling `startQuery()`, call `subscribe(sessionId, 0, listener)`
- [x] In the listener, handle:
  - `result` → post formatted result to thread
  - `error` → post error message to thread
  - `ask_user` → post formatted question to thread, store pending state for this thread
  - `done` → unsubscribe
- [x] Ignore all other event types (thinking, tool_use, etc.)

### 7. Handle thread replies — answer ask_user or continue session
- [x] On `messageCreate` in a thread: check if threadId is in `threadToSession` map
- [x] If there's a pending `ask_user` for this thread: call `resolveAskUser()` with the reply text mapped to the first question's answer
- [x] If session is idle (no active query): call `startQuery()` with the reply text as a follow-up, post "On it." to thread
- [x] If query is running but no pending ask_user: post "Still working on the previous request"

### 8. Cross-channel notifications for desktop interactions
- [x] eventBus exposes `onQueryInit()` hook — Discord plugin registers a listener (no coupling from queryManager to Discord)
- [x] Bot posts "Session continued from desktop." to the thread
- [x] Bot subscribes to the web-initiated query and on `result`/`done`, posts "Desktop: Done. {summary}" to thread
- [x] On `error`, posts "Desktop: Error. {message}" to thread

### 9. Handle elicitation gracefully in Discord
- [x] When an `elicitation` event fires during a Discord-initiated query, post to thread: "This step requires input in the Summit web UI (session: {sessionId})."
- [x] Do not attempt to resolve elicitation from Discord

### 10. Expose Discord bot client for cross-module access
- [x] `getDiscordClient()` / `getDiscordChannel()` exported from `discord.ts` util
- [x] Client singleton set by the plugin on startup, accessible to any module without importing the plugin

### 11. Discord sessions create proper worktrees
- [x] `handleChannelMessage` calls `createWorktree(sessionId)` and sets `worktreePath` and `branch` — same behavior as web UI without a project

### 12. Real-time session list updates via global SSE
- [x] `eventBus.ts`: added `GlobalEvent` type, `emitGlobal()`, and `onGlobal()` for app-level lifecycle events (`session_created`, `session_deleted`, `session_updated`)
- [x] `sessions.ts`: `saveSession()` emits `session_created` for new sessions; `deleteSessionFile()` emits `session_deleted` with `channelMeta` in event metadata
- [x] `eventBus.ts`: `initQuery()` emits `session_updated` so frontend knows to start streaming
- [x] `GET /api/events/stream`: global SSE endpoint that pushes `GlobalEvent`s to connected clients
- [x] `useGlobalEvents` composable: connects to global SSE, triggers session list refetch and auto-starts streaming for new active queries

### 13. Session deletion notifies Discord thread
- [x] Discord plugin listens for `session_deleted` global events via `onGlobal()`
- [x] `deleteSessionFile()` passes `channelMeta` in the event so the Discord plugin can resolve the thread ID without a reverse lookup
- [x] Posts "Session deleted from Summit." to the Discord thread
