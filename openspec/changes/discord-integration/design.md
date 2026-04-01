## Context

Summit is a Nuxt 3 app (Vue 3 frontend + Nuxt server backend) that provides a web UI for interacting with Claude agents via the Agent SDK. Currently it runs on localhost — no remote access.

The server already has a well-structured event system: `queries.ts` runs `query()` calls, emits `AppEvent`s via an `emit()` function, and the web UI consumes these via SSE (`subscribe()`). Interactive flows (ask_user, elicitation) use a Promise-based pattern where the agent blocks mid-execution until the user responds.

Sessions are persisted as JSON files in `.summit/sessions/`. Each session stores messages, team state, worktree paths, and metadata.

The goal is to add a Discord bot that acts as a second input/output channel for the same session system — not a separate product, but another way to reach the existing backend.

## Goals / Non-Goals

**Goals:**
- Send a message in a Discord channel, have Summit create a session and run a query
- Each request gets its own Discord thread mapped to a Summit session
- ask_user questions route to whichever channel (Discord or web) initiated the current query
- Sessions started from Discord are fully visible and interactive in the web UI
- Desktop interactions on Discord-originated sessions post brief notes to the thread

**Non-Goals:**
- Rich embeds, buttons, or slash commands (plain text messages for now)
- Multi-server or multi-channel support
- Offline queuing (if Summit is off, bot is off)
- Streaming intermediate events to Discord (thinking, tool use)
- Elicitation support in Discord (too complex for text-only — web UI only)

## Decisions

### 1. Bot lives inside the Nuxt process as a server plugin

**Decision**: The Discord bot is a Nuxt server plugin (`frontend/server/plugins/discord.ts`) that initializes a discord.js `Client` on startup. It calls `startQuery()` and `subscribe()` directly — no HTTP in between.

**Alternatives considered**:
- *Separate process calling Summit's REST API*: Would work, but adds deployment complexity, requires auth between bot and server, and can't easily hook into the Promise-based ask_user flow. Rejected.
- *Cloudflare Worker / Lambda*: Would need Summit exposed to the internet. Rejected — defeats the "runs locally" model.

**Rationale**: The bot is architecturally identical to the SSE stream handler — just another consumer of `emit()` events and producer of `startQuery()` calls. Keeping it in-process means zero additional infrastructure and direct access to all server utils.

### 2. Event subscription for push-based delivery

**Decision**: The existing `subscribe()` function in `queries.ts` already supports push-based event delivery — it takes a listener callback and replays missed events. The Discord bot uses this directly, filtering to bookend events only.

The bot subscribes when it starts a query and the listener posts to Discord:
- `result` → post result text to thread
- `error` → post error to thread
- `ask_user` → post question to thread
- `done` → unsubscribe

No changes to `subscribe()` needed — it already does what we want.

### 3. Query source tracking for ask_user routing

**Decision**: Add an optional `source` parameter to `startQuery()` that gets passed through to `runQuery()`. The source is stored on the `ActiveQuery` object so event consumers can check it.

```typescript
interface ActiveQuery {
  events: StreamEvent[];
  done: boolean;
  listeners: Set<(event: StreamEvent) => void>;
  source?: "discord" | "web";  // NEW
}
```

The Discord bot sets `source: "discord"` when calling `startQuery()`. The ask_user handler checks: if source is `"discord"`, the bot's event listener handles it (posts to thread, waits for reply, resolves the pending ask_user). If source is `"web"` or unset, the existing SSE flow handles it.

**Key insight**: ask_user routing is per-query, not per-session. A Discord-created session can have web-initiated queries and vice versa. This enables seamless channel switching.

### 4. Thread-to-session mapping

**Decision**: Two-layer mapping:

1. **In-memory `Map<threadId, sessionId>`** — fast lookups when the bot receives thread replies. Built on startup by scanning persisted sessions.
2. **Persisted in session JSON** — `discord?: { threadId, channelId, guildId }` field on `StoredSession`. Survives restarts.

On startup, the bot reads all sessions via `listSessions()`, finds ones with `discord` metadata, and rebuilds the in-memory map. This avoids a separate persistence layer.

**Alternatives considered**:
- *Separate mapping file*: Unnecessary duplication — the session already knows its Discord binding.
- *Database*: Overkill for what's essentially a key-value lookup.

### 5. Cross-channel notifications

**Decision**: When `startQuery()` is called with `source: "web"` on a session that has `discord` metadata, the Discord bot posts a brief note to the thread: "Session continued from desktop." When that query finishes, it posts "Desktop: Done. {summary}."

This is implemented as a secondary listener: the bot subscribes to ALL queries on sessions with Discord metadata, not just Discord-initiated ones. For web-initiated queries, it only posts the cross-channel notes (not ask_user, since those go to the web UI).

### 6. Bot ignores its own messages and non-configured channels

**Decision**: The bot filters messages by:
- `message.author.id !== client.user.id` (ignore own messages)
- `message.channel.id === configuredChannelId` (only listen in one channel)
- For thread replies: `message.channel.isThread()` and thread is in the mapping

This keeps the bot focused and prevents loops.

### 7. Graceful degradation when no bot token

**Decision**: The server plugin checks for `DISCORD_BOT_TOKEN` on startup. If not set, it logs a message and returns — no client created, no errors. Summit works exactly as before. This is a zero-config default.

## Risks / Trade-offs

**[Discord rate limits]** → Discord has rate limits on message sending (~5 messages per 5 seconds per channel). For normal usage this is fine. If an agent produces rapid-fire results or errors, messages could be throttled. Mitigation: batch rapid events and post once, or accept the slight delay.

**[Long-running queries]** → Discord has a 2000-character message limit. Agent results can be long. Mitigation: truncate to 2000 chars with a note "Full results available in Summit web UI."

**[Thread reply attribution]** → If multiple people have access to the Discord channel, anyone could reply in a thread. The bot will treat any reply as a valid answer. Mitigation: acceptable for personal use. Could add user filtering later.

**[Restart during active query]** → If Summit restarts while a Discord-initiated query is running, the query is lost. The thread remains but the session shows the last completed state. Mitigation: user can send a follow-up in the thread to start a new query. Same behavior as web UI on restart.

**[No elicitation in Discord]** → Elicitations use structured schemas (forms with fields). These can't easily be rendered as Discord text messages. Mitigation: if an elicitation fires during a Discord-initiated query, post a message saying "This requires input in the Summit web UI" with the session URL/ID.
