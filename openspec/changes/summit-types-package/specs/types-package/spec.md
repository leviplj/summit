## ADDED Requirements

### Requirement: Types package exists at packages/summit-types
The system SHALL have a `packages/summit-types` directory containing a `package.json` with name `summit-types`, a `tsconfig.json`, and a `src/index.ts` entry point. The package SHALL contain only type definitions — no runtime code.

#### Scenario: Package structure
- **WHEN** a developer inspects `packages/summit-types/`
- **THEN** it contains `package.json`, `tsconfig.json`, and `src/index.ts`
- **THEN** `package.json` has `"name": "summit-types"` and `"exports": { ".": "./src/index.ts" }`

### Requirement: All shared types exported from summit-types
The package SHALL export all types needed by extension authors: `StoredSession`, `ChatMessage`, `ChatMessageMeta`, `AppEvent`, `AskUserQuestion`, `AskUserOption`, `ElicitationPayload`, `SessionStatus`, `SessionListItem`, `Project`, `FileChange`, `ExtensionAPI`, `ExtensionFactory`, `AgentProvider`, `ProviderModel`, `ProviderCapability`, `QueryContext`, `InteractionHooks`, `ElicitationRequest`, `ElicitationResult`, `QueryResult`, `ToolDefinition`, `ActiveQuery` (public), `StreamEvent`, `GlobalEvent`.

#### Scenario: Extension author imports types
- **WHEN** an extension author writes `import type { ExtensionAPI, ExtensionFactory, StoredSession } from "summit-types"`
- **THEN** TypeScript resolves all types with full autocomplete and type checking

#### Scenario: All types available from single import
- **WHEN** an extension author imports from `"summit-types"`
- **THEN** all public types are available without deep import paths

### Requirement: Bun workspace configuration
The root `package.json` SHALL declare `"workspaces": ["packages/*", "frontend"]`. The `frontend/package.json` SHALL declare `"summit-types": "workspace:*"` as a dependency.

#### Scenario: Workspace linking
- **WHEN** `bun install` is run at the project root
- **THEN** `summit-types` is linked into `frontend/node_modules/summit-types`
- **THEN** imports of `summit-types` resolve within the Nuxt app

### Requirement: Existing imports continue to work
The original type files (`frontend/shared/types.ts`, `frontend/server/extensions/types.ts`, `frontend/server/providers/types.ts`) SHALL re-export all types from `summit-types` so existing code continues to compile without changes.

#### Scenario: Backwards compatibility
- **WHEN** existing code imports from `~~/shared/types`
- **THEN** it receives the same types as before (re-exported from `summit-types`)

### Requirement: All frontend imports migrated
All files in `frontend/` that import types from the original locations SHALL be updated to import from `summit-types` directly.

#### Scenario: No stale imports remain
- **WHEN** the migration is complete
- **THEN** the original type files contain only re-exports from `summit-types`
- **THEN** all consumer files import from `summit-types`
