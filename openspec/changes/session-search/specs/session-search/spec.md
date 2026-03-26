## ADDED Requirements

### Requirement: Search input in sidebar
The UI SHALL display a search input field at the top of the sidebar session list, above the list of sessions but below the "Chats" header. The input SHALL have placeholder text indicating its purpose (e.g., "Search sessions..."). The input SHALL be always visible when the sidebar is open.

#### Scenario: Search input is visible
- **WHEN** user opens Summit and the sidebar is visible
- **THEN** a search input appears above the session list

#### Scenario: Search input is empty by default
- **WHEN** user opens Summit
- **THEN** the search input is empty and all sessions are displayed

### Requirement: Client-side title filtering
The system SHALL filter the displayed session list in real time as the user types in the search input. Matching SHALL be case-insensitive substring matching against session titles. Only sessions whose title contains the search query SHALL be shown.

#### Scenario: Filter sessions by title
- **WHEN** user types "deploy" in the search input
- **THEN** only sessions whose title contains "deploy" (case-insensitive) are shown in the sidebar

#### Scenario: No matches
- **WHEN** user types a query that matches no session titles
- **THEN** the session list is empty and an "No matching sessions" message is displayed

#### Scenario: Clear search restores full list
- **WHEN** user clears the search input (backspace to empty or clear button)
- **THEN** all sessions are displayed again

#### Scenario: Filtering is instant
- **WHEN** user types in the search input
- **THEN** the session list updates on each keystroke with no perceptible delay (client-side only, no network requests)

### Requirement: Search result highlighting
When a search query is active, the matching portion of each session title SHALL be visually highlighted (e.g., bold or background color) so the user can see why each result matched.

#### Scenario: Highlight matching text
- **WHEN** user searches for "auth" and a session titled "Add OAuth flow" matches
- **THEN** the "auth" portion within "Add OAuth flow" is visually highlighted

#### Scenario: Multiple matches in one title
- **WHEN** user searches for "a" and a session title contains multiple "a" characters
- **THEN** all occurrences of "a" in the title are highlighted

### Requirement: Server-side full-text search across message content
The system SHALL support an optional server-side search that scans message content within session JSON files. This is triggered when the user opts in (e.g., via a toggle or modifier) since it requires a server round-trip and may be slower.

#### Scenario: Search message content
- **WHEN** user enables full-text search and types "useEffect"
- **THEN** the system sends a request to the server, which scans all session files for messages containing "useEffect", and returns matching session IDs with match context

#### Scenario: Server search returns sessions not matching title
- **WHEN** user searches for "database migration" with full-text enabled, and no session title contains that phrase but a message in session X does
- **THEN** session X appears in the results

#### Scenario: Server search combined with title search
- **WHEN** full-text search is enabled
- **THEN** results include sessions matching by title OR by message content (union of both)

### Requirement: Search API endpoint
The server SHALL expose a `GET /api/sessions/search?q=<query>` endpoint that performs case-insensitive substring search across all session message content. It SHALL return an array of matching session IDs along with a brief match context (e.g., snippet of the matching message).

#### Scenario: Search endpoint with matches
- **WHEN** a GET request is made to `/api/sessions/search?q=refactor`
- **THEN** the server scans all session JSON files, checks each message's content for "refactor", and returns `[{ sessionId: "...", snippet: "...refactor the auth module..." }]`

#### Scenario: Search endpoint with no matches
- **WHEN** a GET request is made to `/api/sessions/search?q=xyznonexistent`
- **THEN** the server returns an empty array

#### Scenario: Search endpoint with empty query
- **WHEN** a GET request is made to `/api/sessions/search?q=`
- **THEN** the server returns an empty array (no search performed)

### Requirement: Active session preserved during search
Searching and filtering SHALL NOT change the active (selected) session. If the active session is filtered out of the visible list, the chat area continues to show that session's messages.

#### Scenario: Active session hidden by filter
- **WHEN** user is viewing session A and types a search query that does not match session A's title
- **THEN** session A disappears from the sidebar list, but the chat area still shows session A's messages

#### Scenario: Clicking a filtered result switches session
- **WHEN** user clicks on a session in the filtered list
- **THEN** that session becomes the active session as normal
