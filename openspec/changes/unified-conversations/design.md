## Context

Summit sessions currently maintain two parallel structures for chat history:
1. `StoredSession.messages[]` — the orchestrator's (lead) messages
2. `StoredSession.teammates[]` — each with their own `messages[]`, `status`, `role`, and `id`

This split propagates through the entire stack: the frontend has `useSessionStore` for orchestrator state and `useTeamStore` for teammate state, event routing forks on `agentId` presence, the query manager has `startQuery` vs `runSubQuery`, and interactions are keyed differently for orchestrator vs teammates.

The teams feature was built as an extension layered on top of the existing session model. Now that it's proven, it's time to make conversations a first-class concept in the session model itself.

## Goals / Non-Goals

**Goals:**
- Single `conversations[]` array replaces both `messages[]` and `teammates[]` on StoredSession
- One code path for event routing, state management, and persistence regardless of orchestrator vs teammate
- Backward-compatible migration for existing session files
- Preserve all current functionality (team spawning, inter-agent messaging, ask-user scoping)

**Non-Goals:**
- Accumulated teammate history across queries (cleared per query, same as today)
- Changes to the MessageBus or inter-agent communication protocol (only rename agentId → conversationId)
- Changes to the provider interface or how Claude Code SDK is invoked
- Multi-session or cross-session conversation features
- Changes to the extension loader or extension discovery

## Decisions

### 1. Conversation as the unit of chat history

Every chat interaction belongs to a `Conversation`. A session always has at least one conversation with `id: "lead"`. Teammates are conversations with generated IDs.

**Alternative considered:** Keep messages flat on the session with `conversationId` on each message. Rejected because grouping messages by conversation is the natural access pattern — you always want "all messages for this conversation," never "all messages across all conversations."

### 2. Lead conversation created at session creation time

When a session is created, it gets a single conversation `{ id: "lead", role: "lead", status: "idle", messages: [] }`. This is always `conversations[0]`.

**Alternative considered:** Lazy-create the lead on first message. Rejected because it adds null-checking complexity for no benefit — every session needs a lead.

### 3. Teammate conversations cleared on new query

When a new query starts, all non-lead conversations are removed. This matches current behavior where teammates are ephemeral per query.

**Alternative considered:** Keeping teammate conversations and letting the orchestrator decide whether to re-spawn or resume. Deferred — the data model supports this naturally, but the behavioral complexity isn't warranted yet.

### 4. Events carry `conversationId` instead of `agentId`

All `AppEvent` objects that are scoped to a conversation carry `conversationId: string`. Events without `conversationId` are session-level (e.g., `team_created`). The lead conversation's events use `conversationId: "lead"` (or omit it — the absence of `conversationId` implies lead, for backward compat during transition).

**Alternative considered:** Always require `conversationId` on every event. Rejected because session-level events (done, cancelled) don't belong to a conversation.

### 5. Merge useTeamStore into useSessionStore

The `useTeamStore` composable is eliminated. Session store manages `conversations` as part of session state. The `ClientSession` type gains `conversations: ClientConversation[]` where `ClientConversation` extends `Conversation` with ephemeral fields (`events`, `streamText`, `askUser`).

**Alternative considered:** Create a separate `useConversationStore`. Rejected because conversations are owned by sessions — a separate store creates the same coordination problem we're trying to eliminate.

### 6. Extension API rename: agentId → conversationId

`queries.run()` options rename `agentId` to `conversationId`. The teams extension passes the conversation ID it created. This is the only breaking change to the extension API.

### 7. Migration strategy: read-time conversion

When loading a session file, check for the old format (`messages` array at root + optional `teammates` array). If found, convert to `conversations[]` in memory. Save in the new format on next write. No batch migration needed.

**Alternative considered:** One-time migration script. Rejected because read-time conversion is simpler, requires no coordination, and sessions are updated frequently enough that they'll migrate naturally.

## Risks / Trade-offs

- **[Breaking change for extensions]** → Extensions using `agentId` in `queries.run()` will break. Mitigation: accept both `agentId` and `conversationId` during a transition period, log deprecation warning for `agentId`.

- **[Session file format change]** → Old Summit versions can't read new format. Mitigation: read-time migration handles old→new; we don't need new→old since Summit is not distributed.

- **[Lead conversation special-casing]** → The lead is still behaviorally special (spawns teammates, has resume capability). Risk that "unification" just moves the if-statements. Mitigation: the special behavior lives in the teams extension and query manager, not in the data model or state management — the structural unification is still valuable.

- **[Large diff]** → This touches types, server utils, routes, composables, and UI. Mitigation: implement in phases (types → server → frontend) with tests at each phase boundary.
