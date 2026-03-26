## 1. Session Store: Search State and Filtering

- [ ] 1.1 Add `searchQuery` ref (default `""`) to `useSessionStore.ts`
- [ ] 1.2 Add `filteredSessions` computed property that filters `sessions` by case-insensitive substring match of `searchQuery` against each session's `title`; returns full list when query is empty
- [ ] 1.3 Export `searchQuery` and `filteredSessions` from the composable return object

## 2. Sidebar: Search Input

- [ ] 2.1 Add a search input element in the sidebar of `index.vue`, between the "Chats" header row and the `<nav>` session list
- [ ] 2.2 Bind the input to `searchQuery` with `v-model`
- [ ] 2.3 Style the input to match existing sidebar aesthetics (compact, border-input, bg-secondary, text-sm, rounded)
- [ ] 2.4 Add a clear button (X icon) that appears when `searchQuery` is non-empty, resetting it to `""`

## 3. Sidebar: Use Filtered Sessions

- [ ] 3.1 Update the `v-for` in the sidebar session list to iterate over `filteredSessions` instead of `sessions`
- [ ] 3.2 Add an empty state message ("No matching sessions") shown when `filteredSessions` is empty and `searchQuery` is non-empty

## 4. Search Result Highlighting

- [ ] 4.1 Create a `HighlightMatch` component (or inline render function) that accepts `text` and `query` props, splits the text into matching/non-matching segments, and wraps matches in a `<mark>` element with highlight styling
- [ ] 4.2 Replace the plain `{{ s.title }}` text in the sidebar session button with the `HighlightMatch` component, passing `s.title` and `searchQuery`
- [ ] 4.3 When `searchQuery` is empty, render the title as plain text (no highlight wrapper needed)

## 5. Server: Full-Text Search Endpoint

- [ ] 5.1 Add a `searchSessions(query: string)` function to `sessions.ts` server util that reads all session JSON files, searches each message's `content` field for a case-insensitive substring match, and returns an array of `{ sessionId: string, snippet: string }` (snippet = ~80 chars around the first match)
- [ ] 5.2 Create a `GET /api/sessions/search` route (`frontend/server/routes/api/sessions/search.get.ts`) that reads the `q` query parameter, calls `searchSessions`, and returns the results; returns empty array if `q` is empty

## 6. Frontend: Full-Text Search Integration

- [ ] 6.1 Add a `fullTextEnabled` ref (default `false`) to `useSessionStore.ts`
- [ ] 6.2 Add a `fullTextResults` ref holding the server response (array of `{ sessionId, snippet }`)
- [ ] 6.3 Add an async `searchFullText(query: string)` function that calls `GET /api/sessions/search?q=<query>` and populates `fullTextResults`
- [ ] 6.4 Add a debounced watcher on `searchQuery` that triggers `searchFullText` when `fullTextEnabled` is true and query is non-empty (300ms debounce); clears `fullTextResults` when query is empty
- [ ] 6.5 Update `filteredSessions` to include sessions whose ID appears in `fullTextResults` (union with title matches) when `fullTextEnabled` is true
- [ ] 6.6 Export `fullTextEnabled` and `fullTextResults` from the composable

## 7. Sidebar: Full-Text Toggle and Indicators

- [ ] 7.1 Add a toggle button (e.g., a message/document icon) next to the search input that toggles `fullTextEnabled`
- [ ] 7.2 Style the toggle to indicate active state (e.g., highlighted icon color when enabled)
- [ ] 7.3 When a session appears in results only due to full-text match (not title match), show a small indicator or the match snippet below the title in the sidebar entry
