## Why

As users accumulate sessions, finding a previous conversation becomes difficult. The sidebar shows sessions ordered by recency with only titles visible. Users need a way to search through their session history by title or message content.

## What Changes

- Add a **search input** at the top of the sidebar session list
- Search filters sessions by title match (client-side for speed)
- Optionally support full-text search across message content (server-side)
- Highlight matching text in search results

## Capabilities

### New Capabilities
- `session-search`: Search/filter sessions by title and optionally by message content. Client-side title filtering with optional server-side full-text search. Search input in the sidebar with result highlighting.

### Modified Capabilities

_None — no existing specs to modify._

## Impact

- **Frontend**: Search input component in sidebar, filtering logic in session store
- **Server** (optional): Full-text search endpoint that scans session JSON files for message content matches
