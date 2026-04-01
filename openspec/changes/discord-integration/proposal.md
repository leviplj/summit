## Why

Summit runs locally — to interact with it, you need to be at the machine. If you're away from your desk (on your phone, on the train), you can't kick off work or respond to agent questions. Adding a Discord integration lets you message Summit from anywhere, then pick up the full session on the desktop when you arrive.

## What Changes

- **Discord bot as a Nuxt server plugin**: A discord.js client starts with the Nuxt server and shuts down with it. No separate process, no tunnel — the bot lives inside Summit and calls `startQuery()` directly.
- **Channel → thread workflow**: When you send a message in a designated Discord channel, the bot creates a thread, creates a Summit session, and starts a query. All responses flow back into that thread.
- **Bookend messaging**: Discord threads show a sparse summary — "On it", questions, results, errors. The full event stream (thinking, tool calls, file edits) stays in the Summit web UI.
- **ask_user routing**: When the agent asks a question, it's posted to whatever channel initiated the current query (Discord thread or web UI). Routing is per-query, not per-session, so you can seamlessly switch.
- **Follow-up in threads**: Replying in a thread after the agent finishes starts a new query on the same session. The thread becomes a full conversation.
- **Cross-channel notifications**: When someone interacts with a Discord-originated session from the web UI, a small note is posted to the thread so watchers know something is happening.
- **Session metadata**: Sessions store Discord metadata (threadId, channelId, guildId) so the mapping survives restarts.

## Capabilities

### New Capabilities
- `discord-bot`: Discord.js client as a Nuxt server plugin. Listens to channel messages, creates threads, manages thread↔session mapping. Handles message routing between Discord and Summit's query system.
- `cross-channel-sync`: Notifications posted to Discord threads when sessions are interacted with from the web UI. Ensures Discord threads serve as a complete audit trail regardless of where interactions happen.

### Modified Capabilities
- `queries`: Event subscription mechanism so the Discord bot can listen to session events. Source tracking on queries to route ask_user/elicitation to the correct channel.
- `sessions`: Discord metadata persisted in session storage.

## Impact

- **New dependency**: `discord.js` — the standard Discord bot library.
- **Server plugin (`frontend/server/plugins/discord.ts`)**: New — initializes bot client, registers event handlers, manages lifecycle.
- **Server util (`frontend/server/utils/discord.ts`)**: New — thread↔session map, message formatting, event-to-Discord translation.
- **Queries (`frontend/server/utils/queries.ts`)**: Modified — add event subscription/callback mechanism, add `source` tracking to queries, route ask_user based on source.
- **Sessions (`frontend/server/utils/sessions.ts`)**: Modified — persist Discord metadata in session JSON.
- **Types (`frontend/shared/types.ts`)**: Modified — add Discord metadata to session type, add source field to query options.
- **Config**: Bot token and channel ID via environment variables (`DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID`).

## Non-goals

- **Slash commands**: We're using plain channel messages, not Discord slash commands. Simpler to start with — can add later.
- **Rich embeds**: Plain text messages for now. Fancy formatting can come later.
- **Multi-server support**: One Discord server, one channel. Enough for personal use.
- **Bot when Summit is offline**: No queuing or deferred execution. If Summit isn't running, the bot is offline.
