## Why

Sessions currently store chat history in two parallel structures: `messages[]` for the orchestrator and `teammates[]` (each with their own `messages[]`) for team agents. This duplication ripples through every layer — types, event routing, server utils, frontend composables, and UI logic — requiring forked code paths for what is fundamentally the same operation: managing a chat history with an agent.

Unifying these into a single `conversations[]` array eliminates the duplication and makes the "main chat" and "teammate chat" structurally identical, differing only in behavioral rules.

## What Changes

- **BREAKING**: `StoredSession.messages` and `StoredSession.teammates` replaced by `StoredSession.conversations[]`
- **BREAKING**: `StoredTeammate` type removed, replaced by `Conversation` type
- **BREAKING**: `ChatMessage.agentId` removed — messages belong to their conversation
- **BREAKING**: `AppEvent` events carry `conversationId` instead of `agentId`
- Team-specific event types (`team_created`, `teammate_status`, `teammate_message`, `teammate_done`) renamed to use "conversation" terminology
- `useTeamStore` composable merged into session/conversation management within `useSessionStore`
- Frontend event routing unified — no more forked orchestrator vs teammate handlers
- Query manager's `runSubQuery` unified with `runQuery`, both targeting a conversation
- Ask-user/elicitation interactions keyed uniformly by `sessionId:conversationId`
- Backward-compatible migration reads old `messages[]` + `teammates[]` format into `conversations[]`
- Tab bar only shown when `conversations.length > 1`
- Teammate conversations cleared per new query (preserves current behavior)

## Capabilities

### New Capabilities
- `conversation-model`: Defines the Conversation type, session-conversation relationship, lifecycle rules, and persistence format
- `conversation-events`: Defines how events are scoped to conversations, routing rules, and stream management
- `conversation-frontend`: Defines frontend state management for conversations, tab switching, and display logic

### Modified Capabilities

## Impact

- **Types**: `summit-types` package — Conversation type added, StoredSession restructured, StoredTeammate removed, ChatMessage simplified, AppEvent updated
- **Server utils**: `sessions.ts`, `eventBus.ts`, `queryManager.ts`, `interactions.ts` — all updated to work with conversations
- **Server routes**: Session CRUD routes updated for new shape, ask-user route uses conversationId
- **Frontend composables**: `useSessionStore.ts` absorbs team state, `useTeamStore.ts` removed, `useChat.ts` event routing unified
- **Frontend UI**: `index.vue` simplified (no forked display logic), `TeamTabBar.vue` updated to use conversations
- **Teams extension**: `teamManager.ts`, `tools.ts` use conversationId instead of agentId
- **Existing session files**: Migration needed for `.summit/sessions/*.json`
- **Extension API**: `queries.run()` opts rename `agentId` → `conversationId`
