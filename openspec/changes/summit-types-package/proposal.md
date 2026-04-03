## Why

Extension authors writing `.summit/extensions/*.ts` files have no way to import Summit's types. The `ExtensionAPI`, `StoredSession`, `AppEvent`, and provider types are buried in the Nuxt app's internal paths (`~~/server/extensions/types`, `~~/shared/types`) which aren't resolvable from external files. This means every user extension treats `api` as `any`.

## What Changes

- Create a `packages/summit-types` package containing all public types needed by extension authors
- Move shared types (StoredSession, AppEvent, ChatMessage, AskUserQuestion, etc.) from `frontend/shared/types.ts` to the package
- Move ExtensionAPI and ExtensionFactory from `frontend/server/extensions/types.ts` to the package
- Move provider types (AgentProvider, QueryContext, InteractionHooks, QueryResult) to the package
- Move event bus types (ActiveQuery, StreamEvent, GlobalEvent) to the package
- Set up bun workspaces in the root `package.json` to link the package
- Update all imports in `frontend/` to use `summit-types` instead of relative/alias paths
- Keep backwards-compatible re-exports in original files during migration

## Capabilities

### New Capabilities
- `types-package`: Standalone types-only package at `packages/summit-types` that extension authors can import for full TypeScript support

### Modified Capabilities

## Impact

- Root `package.json` gains `workspaces` configuration
- All server files importing from `~~/shared/types`, `~~/server/extensions/types`, and `~~/server/providers/types` will be updated to import from `summit-types`
- `frontend/package.json` gains a workspace dependency on `summit-types`
- No runtime behavior changes — this is purely a type reorganization
