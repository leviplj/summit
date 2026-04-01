## Tasks

### 1. Add Discord metadata to session types and storage
- [ ] Add optional `discord?: { threadId: string; channelId: string; guildId: string }` to `StoredSession` in `shared/types.ts`
- [ ] Add `source?: "discord" | "web"` to `ActiveQuery` interface in `queries.ts`
- [ ] Add optional `source` parameter to `startQuery()` signature and store it on the `ActiveQuery`

### 2. Add discord.js dependency
- [ ] Run `bun add discord.js` in `frontend/`
- [ ] Add `DISCORD_BOT_TOKEN` and `DISCORD_CHANNEL_ID` to `.env.example` with comments

### 3. Create Discord utility module
- [ ] Create `frontend/server/utils/discord.ts`
- [ ] Implement in-memory `threadToSession: Map<string, string>` (threadId → sessionId)
- [ ] Implement `rebuildThreadMap()` that reads all sessions via `listSessions()` and populates the map from sessions with `discord` metadata
- [ ] Implement `formatResultForDiscord(text: string): string` that truncates to 2000 chars with a "see Summit for full results" note
- [ ] Implement `formatAskUserForDiscord(questions: AskUserQuestion[]): string` that formats questions as plain text

### 4. Create Discord bot server plugin
- [ ] Create `frontend/server/plugins/discord.ts`
- [ ] On startup: check for `DISCORD_BOT_TOKEN`, if missing log and return
- [ ] Create discord.js `Client` with `GatewayIntentBits.Guilds`, `GatewayIntentBits.GuildMessages`, `GatewayIntentBits.MessageContent`
- [ ] On `ready`: call `rebuildThreadMap()`, log bot username
- [ ] On Nuxt `close` hook: call `client.destroy()`

### 5. Handle channel messages — create thread and session
- [ ] On `messageCreate`: filter to configured channel, ignore bot's own messages, ignore thread messages
- [ ] Create a new `StoredSession` with `discord` metadata (threadId, channelId, guildId)
- [ ] Save session via `saveSession()`
- [ ] Add to `threadToSession` map
- [ ] Create Discord thread from the message (use `message.startThread()`)
- [ ] Post "On it." to the thread
- [ ] Call `startQuery(sessionId, message.content, "discord")`

### 6. Subscribe to session events and post bookends to Discord
- [ ] After calling `startQuery()`, call `subscribe(sessionId, 0, listener)`
- [ ] In the listener, handle:
  - `result` → post formatted result to thread
  - `error` → post error message to thread
  - `ask_user` → post formatted question to thread, store pending state for this thread
  - `done` → unsubscribe
- [ ] Ignore all other event types (thinking, tool_use, etc.)

### 7. Handle thread replies — answer ask_user or continue session
- [ ] On `messageCreate` in a thread: check if threadId is in `threadToSession` map
- [ ] If there's a pending `ask_user` for this thread: call `resolveAskUser()` with the reply text mapped to the first question's answer
- [ ] If session is idle (no active query): call `startQuery()` with the reply text as a follow-up, post "On it." to thread
- [ ] If query is running but no pending ask_user: ignore (or post "Still working on the previous request")

### 8. Cross-channel notifications for desktop interactions
- [ ] In `startQuery()`, after creating the ActiveQuery: if session has `discord` metadata and source is `"web"`, emit a synthetic event or directly notify the Discord bot
- [ ] Bot posts "Session continued from desktop." to the thread
- [ ] Bot subscribes to the web-initiated query and on `result`/`done`, posts "Desktop: Done. {summary}" to thread
- [ ] On `error`, posts "Desktop: Error. {message}" to thread

### 9. Handle elicitation gracefully in Discord
- [ ] When an `elicitation` event fires during a Discord-initiated query, post to thread: "This step requires input in the Summit web UI (session: {sessionId})."
- [ ] Do not attempt to resolve elicitation from Discord

### 10. Expose Discord bot client for cross-module access
- [ ] Export the discord.js `Client` instance (or a wrapper) from the plugin so that `queries.ts` or other modules can check if Discord is available and post cross-channel notifications
- [ ] Use a simple module-level export from `discord.ts` util (e.g., `getDiscordClient()` / `getDiscordChannel()`)
