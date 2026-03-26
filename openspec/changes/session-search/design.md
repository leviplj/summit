## Context

Summit is a Nuxt 4 + Vue + TypeScript web chat UI for Claude Code. The sidebar in `index.vue` displays a flat list of sessions from `useSessionStore`, which holds a `sessions` ref array of `ClientSession` objects. Sessions are persisted as JSON files under `.summit/sessions/` via `sessions.ts` server util. There is currently no search or filtering capability — sessions are listed by recency and users must scroll to find older conversations.

The codebase uses:
- **Server utils**: `sessions.ts` (CRUD + file persistence), `worktrees.ts`, `queries.ts`
- **Shared types**: `StoredSession`, `SessionListItem`, `ChatMessage`
- **Frontend**: single-page `index.vue` with sidebar session list, `useSessionStore.ts` composable, `useChat.ts` composable
- **Styling**: Tailwind CSS with CSS custom property theming (bg-background, text-foreground, etc.)

## Goals / Non-Goals

**Goals:**
- Users can quickly find sessions by typing a search query in the sidebar
- Title filtering is instant (client-side, no server round-trip)
- Matching text is highlighted in search results
- Optional full-text search across message content for deeper searches (server-side)

**Non-Goals:**
- Fuzzy/typo-tolerant matching (simple substring is sufficient)
- Search indexing or caching (session count is expected to be manageable with file scanning)
- Regex or advanced query syntax
- Searching within tool events or metadata

## Decisions

### 1. Search state lives in `useSessionStore`

The search query string and filtered sessions computed property are added directly to `useSessionStore.ts`. This keeps the filtering logic co-located with the session data rather than scattering it across components.

A new `searchQuery` ref and a `filteredSessions` computed property are added. The sidebar template binds to `filteredSessions` instead of `sessions`. When `searchQuery` is empty, `filteredSessions` returns the full list.

**Alternatives considered:**
- Separate `useSessionSearch` composable: Adds indirection for a small amount of logic. The filtering is tightly coupled to the sessions array, so co-location is simpler.
- Component-local state in `index.vue`: Would work but makes the logic harder to reuse or test independently.

### 2. Client-side title filtering with case-insensitive substring match

Filtering is done purely in the computed property using `String.includes()` after lowercasing both the query and each title. This is O(n) over the session list per keystroke, which is negligible for the expected session counts (hundreds, not thousands).

No debouncing is needed because the operation is synchronous and fast. The template re-renders reactively via Vue's computed property system.

**Alternatives considered:**
- Debounced filtering: Unnecessary overhead for a synchronous in-memory filter
- Fuzzy matching (e.g., fuse.js): Adds a dependency for minimal benefit; substring matching is what users expect from a filter input

### 3. Highlight component for matching text

A small inline utility (either a component or a render function) splits the session title into segments: non-matching text and matching text. Matching segments are wrapped in a `<mark>` or `<span>` with a highlight class. This is rendered inside the existing session button in the sidebar.

The highlight is purely presentational and uses Tailwind classes (e.g., `bg-yellow-200/30 text-yellow-200` in dark mode, `bg-yellow-300/40 text-yellow-900` in light mode) via the existing CSS custom property theme system.

**Alternatives considered:**
- `v-html` with regex replace: Works but introduces XSS risk if not carefully escaped. A component-based approach is safer.
- No highlighting: Functional but less usable — users can't quickly scan why each result matched.

### 4. Full-text search via a new server endpoint

A `GET /api/sessions/search?q=<query>` endpoint reads all session JSON files, scans each message's `content` field for the query string (case-insensitive), and returns matching session IDs with a brief snippet. This follows the same pattern as `listSessions()` in `sessions.ts`: read all files, filter, return results.

The endpoint is called on-demand from the client when the user enables full-text search (via a toggle button next to the search input). Results are merged with client-side title matches (union).

**Alternatives considered:**
- Always search messages on every keystroke (server-side): Too slow and expensive for real-time filtering
- SQLite full-text search index: Adds a dependency and breaks the simple JSON file storage pattern
- Streaming/chunked search: Over-engineered for the expected data volume

### 5. Full-text search toggle in the UI

A small toggle icon/button adjacent to the search input lets users opt into full-text search. When off (default), only client-side title filtering is active. When on, a server request is made after the user stops typing (debounced at ~300ms) to find message content matches.

This two-tier approach keeps the common case (title search) fast while still allowing deep search when needed.

**Alternatives considered:**
- Always-on full-text search: Slower default experience with server round-trips on every keystroke
- Separate search mode/dialog: Adds UI complexity; an inline toggle keeps the interface simple
- Search button that triggers server search on click: Less discoverable than a toggle

### 6. Active session is not changed by search

Filtering the sidebar list does not alter `activeSessionId`. If the currently active session is filtered out, it simply disappears from the sidebar but remains displayed in the chat area. This avoids disruptive session switching while the user is typing a search query.

**Alternatives considered:**
- Auto-select first filtered result: Disruptive — the user might be reading the current session while searching
- Disable search when a session has an active query: Too restrictive

## Risks / Trade-offs

- **Full-text search performance**: Scanning all session JSON files on each server search request could be slow with many large sessions. Mitigation: This is opt-in and debounced. If it becomes a problem, a future enhancement could add a lightweight search index.

- **Highlight edge cases**: Unicode, emoji, or special characters in session titles could cause issues with naive string splitting. Mitigation: Use `String.indexOf()` with lowercased strings rather than regex to avoid special character escaping issues.

- **Search input takes sidebar space**: The search input reduces the visible area for sessions in the sidebar. Mitigation: The input is compact (single line) and the trade-off is worthwhile for discoverability.

## Open Questions

_None — the scope is well-defined and the approach is straightforward._
