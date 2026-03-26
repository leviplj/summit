## Context

Summit is a Nuxt 4 + Vue + TypeScript web chat UI for the Claude Code Agent SDK. Currently, the SDK's `query()` call does not specify a `model` option, so the SDK uses whatever its default model is. The frontend already displays the model name returned by the SDK's `init` event in the sidebar footer (via a `model` ref in `useChat.ts`), but users have no way to choose which model to use.

The codebase structure:
- **Server utils**: `sessions.ts` (CRUD + file persistence), `worktrees.ts` (git worktree management), `queries.ts` (SDK query execution with `runQuery`)
- **Shared types**: `StoredSession`, `SessionListItem`, `AppEvent` in `shared/types.ts`
- **Frontend composables**: `useSessionStore.ts` (session state), `useChat.ts` (chat orchestration with `model` ref)
- **Frontend page**: `index.vue` (single-page app with sidebar, header, chat area)

## Goals / Non-Goals

**Goals:**
- Users can select a Claude model per session from a dropdown in the header
- The selected model is persisted on the session and passed to the SDK on every query
- The dropdown shows a predefined set of models with the ability to type a custom model name
- Switching sessions updates the dropdown to reflect each session's model

**Non-Goals:**
- Dynamic model discovery from the API (hardcoded list is sufficient for now)
- Model-specific pricing or token limit display
- Organization-level model restrictions or policies
- Per-message model selection (model is per-session)

## Decisions

### 1. Model field on `StoredSession`: optional string, default null

Add `model: string | null` to `StoredSession` in `shared/types.ts`. When `null`, the SDK uses its own default. This keeps existing sessions backward-compatible — sessions created before this change have no `model` field in their JSON and will be read as `null`.

**Alternatives considered:**
- Required field with a hardcoded default: Forces a migration for existing sessions and couples Summit to a specific default that may change on the SDK side
- Separate model persistence (localStorage or dedicated file): Splits session state across two locations, complicating data consistency

### 2. Pass `model` to SDK `query()` via options spread

In `queries.ts`, the `runQuery` function already constructs an `options` object for `query()`. Add `...(session.model ? { model: session.model } : {})` to conditionally include the model. This uses the SDK's built-in `model` option.

**Current code** (relevant section of `runQuery`):
```ts
const q = query({
  prompt: text,
  options: {
    cwd: session.worktreePath || process.cwd(),
    ...
  },
});
```

The `model` option is spread into `options` only when non-null. When `null`, the SDK uses its default — no behavioral change for existing sessions.

**Alternatives considered:**
- Environment variable override: Not per-session, defeats the purpose
- Separate server endpoint to set model: Over-engineered; the session PUT route already exists for updating session fields

### 3. Model selector: combobox in the header bar

Place a model selector dropdown/combobox in the header, between the branch badge and the spacer. This keeps it visible but unobtrusive. The combobox uses the existing shadcn/radix-vue primitives already in the project.

The component shows:
- A compact display of the current model name (abbreviated, e.g., "Sonnet 4" instead of the full identifier)
- A dropdown with predefined model options
- Free-text input for custom model names

**Alternatives considered:**
- Sidebar footer: Already shows the SDK-reported model; adding a selector there is cramped and conflates "what was used" with "what to use next"
- Modal/dialog: Too heavy for a simple selection
- Per-message selector: Too granular; the SDK resumes sessions with the same model, so per-session is the right granularity

### 4. Predefined model list: hardcoded constant in the frontend

Define a `AVAILABLE_MODELS` constant in a shared location (e.g., a new `~/constants/models.ts` or inline in the component). Each entry has:
- `id`: Full model identifier string (e.g., `"claude-sonnet-4-20250514"`)
- `label`: Human-readable display name (e.g., `"Sonnet 4"`)

The list is updated manually when new models are released. This avoids an API dependency and keeps the feature simple.

**Alternatives considered:**
- Fetch from Anthropic API: Requires an API key with model-listing permissions, adds latency, and may expose models the user doesn't have access to
- Server-side config file: Adds complexity for minimal benefit; the list changes rarely

### 5. Update session model via existing PUT route

The session update route (`PUT /api/sessions/[id]`) already exists. Extend it to accept `model` in the body. The frontend calls this when the user selects a different model. The composable stores the model on `ClientSession` locally and syncs to the server.

**Alternatives considered:**
- Dedicated `PATCH /api/sessions/[id]/model` route: Over-specific; the existing PUT route is designed for session field updates
- Only send model with chat messages: Would require the chat endpoint to also handle model updates and wouldn't persist the selection before the first message

### 6. Client-side model tracking: add `model` to `ClientSession`

Add `model: string | null` to `ClientSession` in `useSessionStore.ts`. Populate it from the server response on session load. When the user changes the model, update it locally and call the PUT endpoint. The `useChat.ts` composable already has a `model` ref for displaying the SDK's reported model — this is separate from the per-session configured model.

**Alternatives considered:**
- Reuse the existing `model` ref in `useChat.ts`: That ref tracks what the SDK *reported*, not what the user *selected*. Conflating them causes confusion when the SDK reports a different model than was requested (e.g., fallback).

## Risks / Trade-offs

- **Model name drift**: If Anthropic changes model identifiers, hardcoded values become stale. Mitigation: The free-text input allows users to type any model name, and updating the constant is a one-line change.

- **SDK model option compatibility**: The `model` option must be supported by the Agent SDK's `query()` function. If the SDK doesn't support it or changes the option name, the feature breaks silently (SDK ignores unknown options). Mitigation: Verify the SDK supports the `model` option before implementation.

- **No validation of model access**: The user may select a model they don't have API access to, resulting in an SDK error at query time. Mitigation: Surface SDK errors clearly in the UI (already handled by the error event flow). Future enhancement could validate model access.

## Open Questions

- Should the model selector also appear in the "new session" flow, or only after a session is created? (Lean toward showing it immediately in the header, defaulting to the last-used model.)
