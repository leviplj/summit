## 1. Shared Types

- [ ] 1.1 Add `model: string | null` field to `StoredSession` in `frontend/shared/types.ts`
- [ ] 1.2 Add `model: string | null` field to `SessionListItem` in `frontend/shared/types.ts`

## 2. Server: Session Persistence

- [ ] 2.1 Update `POST /api/sessions` route (`frontend/server/routes/api/sessions/index.post.ts`) to accept optional `model` in the request body and store it on the new session (default `null`)
- [ ] 2.2 Update `PUT /api/sessions/[id]` route (`frontend/server/routes/api/sessions/[id]/index.put.ts`) to accept `model` in the request body and persist it to the session JSON
- [ ] 2.3 Update `GET /api/sessions` route (`frontend/server/routes/api/sessions/index.get.ts`) to include `model` in the `SessionListItem` response

## 3. Server: Pass Model to SDK

- [ ] 3.1 In `runQuery` in `frontend/server/utils/queries.ts`, spread `model` into the SDK `query()` options when `session.model` is non-null: `...(session.model ? { model: session.model } : {})`

## 4. Frontend: Model Constants

- [ ] 4.1 Create `frontend/app/constants/models.ts` with an `AVAILABLE_MODELS` array of `{ id: string, label: string }` entries for current Claude models (Haiku 4, Sonnet 4, Opus 4)

## 5. Frontend: Session Store Updates

- [ ] 5.1 Add `model: string | null` to `ClientSession` interface in `frontend/app/composables/useSessionStore.ts`
- [ ] 5.2 Populate `model` from `SessionListItem` in `loadSessions`
- [ ] 5.3 Add `updateModel(sessionId: string, model: string | null)` method that updates the local `ClientSession.model` and calls `PUT /api/sessions/[id]` with the new model
- [ ] 5.4 Set default `model` to `null` in `newSession`

## 6. Frontend: Model Selector Component

- [ ] 6.1 Create `ModelSelector.vue` component in `frontend/app/components/` — a combobox/dropdown showing available models from `AVAILABLE_MODELS`, with free-text input support for custom model names
- [ ] 6.2 Component accepts `modelValue: string | null` prop and emits `update:modelValue` for v-model binding
- [ ] 6.3 Display abbreviated model labels in the trigger button (e.g., "Sonnet 4" instead of the full identifier)

## 7. Frontend: Wire Up in Page

- [ ] 7.1 Import and place `ModelSelector` in the header of `frontend/app/pages/index.vue`, between the branch badge and the spacer
- [ ] 7.2 Bind `ModelSelector` v-model to `activeSession.model` and call `updateModel` on change
- [ ] 7.3 Ensure the selector is disabled while a query is loading (prevent mid-query model changes)
