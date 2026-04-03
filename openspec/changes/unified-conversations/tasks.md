## 1. Types (summit-types)

- [x] 1.1 Add `Conversation` type with `id`, `role`, `status`, `messages`, `model?` fields
- [x] 1.2 Update `StoredSession`: replace `messages` + `teammates?` with `conversations: Conversation[]`
- [x] 1.3 Update `SessionListItem`: replace `messages` + `teammates?` with `conversations: Conversation[]`
- [x] 1.4 Remove `StoredTeammate` type
- [x] 1.5 Remove `agentId` from `ChatMessage`
- [x] 1.6 Rename event types: `teammate_status` → `conversation_status`, `teammate_message` → `conversation_message`, `teammate_done` → `conversation_done` in `AppEvent`
- [x] 1.7 Update `ExtensionAPI.queries.run()` opts: rename `agentId` → `conversationId`

## 2. Server — Session Storage & Migration

- [x] 2.1 Update `saveSession` to write `conversations[]` format (no top-level `messages`/`teammates`)
- [x] 2.2 ~~Add migration logic~~ Skipped — user will delete old sessions
- [x] 2.3 ~~Update `listSessions`~~ No migration needed
- [x] 2.4 Ensure new sessions are created with `conversations: [{ id: "lead", role: "lead", status: "idle", messages: [] }]`

## 3. Server — Event Bus & Interactions

- [x] 3.1 Update event emission in `eventBus.ts` to use `conversationId` instead of `agentId` on events
- [x] 3.2 Update `interactions.ts`: key pending ask-user by `sessionId:conversationId` uniformly (orchestrator uses `sessionId:lead`)
- [x] 3.3 Update `ask-user.post.ts` route: accept `conversationId` parameter instead of `askId`
- [x] 3.4 ~~Support deprecated `agentId`/`askId`~~ Clean break, no deprecation shim needed

## 4. Server — Query Manager

- [x] 4.1 Update `startQuery` to work with conversations (messages go to lead conversation)
- [x] 4.2 Update `runSubQuery` to use `conversationId` parameter instead of `agentId`
- [x] 4.3 Update user message persistence to append to `conversations[0].messages` instead of `session.messages`
- [x] 4.4 Clear non-lead conversations at query start (teammate conversations cleared per query)

## 5. Server — Session Routes

- [x] 5.1 Update `POST /api/sessions` to create session with lead conversation
- [x] 5.2 Update `PUT /api/sessions/{id}` to accept `conversations` instead of `messages` + `teammates`
- [x] 5.3 Update `GET /api/sessions` to return `conversations` in list items
- [x] 5.4 Update `GET /api/sessions/{id}` to return session with `conversations`

## 6. Server — Teams Extension

- [x] 6.1 Update `teamManager.ts`: use `conversationId` instead of `agentId` when calling `api.queries.run()`
- [x] 6.2 Update event emissions: `teammate_status` → `conversation_status`, `teammate_message` → `conversation_message`, `teammate_done` → `conversation_done`
- [x] 6.3 ~~Update `tools.ts`~~ Tool descriptions don't need renaming, they're user-facing
- [x] 6.4 ~~Update `createExtensionAPI.ts`~~ Types align directly, no wrapper needed

## 7. Frontend — Types & Composables

- [x] 7.1 Define `ClientConversation` type extending `Conversation` with `events`, `streamText`, `askUser` fields
- [x] 7.2 Update `ClientSession` type: replace `messages`, `events`, `teammates` with `conversations: ClientConversation[]`
- [x] 7.3 Add `activeConversationId` tracking per session in `useSessionStore`
- [x] 7.4 Add conversation management methods to session store: `getActiveConversation()`, `setActiveConversation()`, `addConversation()`, `clearTeammateConversations()`
- [x] 7.5 Remove `useTeamStore.ts` composable

## 8. Frontend — Event Handling (useChat)

- [x] 8.1 Unify `streamState` and `teammateStreamState` into single map keyed by conversationId
- [x] 8.2 Replace forked `handleEvent`/`handleTeammateEvent` with unified handler that routes by `conversationId`
- [x] 8.3 Update `team_created` handler to create `ClientConversation` objects in session store
- [x] 8.4 Update event handlers (`text`, `thinking`, `tool_use`, `tool_result`, `result`, `done`) to target conversation by ID
- [x] 8.5 Update `respondAskUser` to send `conversationId` instead of `teammateId`/`askId`
- [x] 8.6 Update session restore logic: convert persisted `conversations` to `ClientConversation` objects
- [x] 8.7 Clear non-lead conversations in UI when new query sent

## 9. Frontend — UI Components

- [x] 9.1 Update `index.vue`: computed `displayMessages`/`displayEvents`/`displayAskUser` to read from active `ClientConversation`
- [x] 9.2 Update `TeamTabBar.vue` to read from `session.conversations` instead of team store
- [x] 9.3 Conditionally render tab bar only when `conversations.length > 1`
- [x] 9.4 Update session switching logic: restore active conversation per session
- [x] 9.5 Remove all imports and references to `useTeamStore`
