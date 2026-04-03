## 1. Package Setup

- [x] 1.1 Create `packages/summit-types/package.json` with name `summit-types`, exports pointing to `./src/index.ts`, and `tsconfig.json`
- [x] 1.2 Add `"workspaces": ["packages/*", "frontend"]` to root `package.json`
- [x] 1.3 Add `"summit-types": "workspace:*"` to `frontend/package.json` dependencies
- [x] 1.4 Run `bun install` to link the workspace

## 2. Create Types Package Source

- [x] 2.1 Create `packages/summit-types/src/index.ts` with all shared types from `frontend/shared/types.ts` (StoredSession, ChatMessage, ChatMessageMeta, AppEvent, AskUserQuestion, AskUserOption, ElicitationPayload, SessionStatus, SessionListItem, Project, FileChange)
- [x] 2.2 Add ExtensionAPI, ExtensionFactory types (from `frontend/server/extensions/types.ts`) to the package — inline the referenced types (no internal imports)
- [x] 2.3 Add provider types (AgentProvider, ProviderModel, ProviderCapability, QueryContext, InteractionHooks, ElicitationRequest, ElicitationResult, QueryResult, ToolDefinition) to the package
- [x] 2.4 Add event bus public types (StreamEvent, GlobalEvent, and a public ActiveQuery with only `done`, `source`, `sessionId` fields) to the package

## 3. Update Original Files to Re-export

- [x] 3.1 Replace `frontend/shared/types.ts` contents with re-exports from `summit-types`
- [x] 3.2 Replace `frontend/server/extensions/types.ts` contents with re-exports from `summit-types`
- [x] 3.3 Replace `frontend/server/providers/types.ts` contents with re-exports from `summit-types`

## 4. Migrate Frontend App Imports

- [x] 4.1 Update all `app/` imports (composables, pages, components) from `~~/shared/types` to `summit-types`
- [x] 4.2 Update all `server/utils/` imports from `~~/shared/types` and `~~/server/providers/types` to `summit-types`
- [x] 4.3 Update all `server/extensions/` imports from `~~/shared/types`, `../types`, and `~~/server/providers/types` to `summit-types`
- [x] 4.4 Update all `server/providers/` imports from `~~/shared/types` and `../types` to `summit-types`
- [x] 4.5 Update all `server/routes/` imports from `~~/shared/types` to `summit-types`

## 5. Verification

- [x] 5.1 Build passes with no TypeScript errors
- [x] 5.2 Original type files contain only re-exports (no standalone definitions)
