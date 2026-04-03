## Context

Summit's types are spread across three internal files that use Nuxt path aliases (`~~/shared/types`, `~~/server/extensions/types`, `~~/server/providers/types`). User extensions in `.summit/extensions/` can't resolve these aliases, so they have no type safety. Bundled extensions (Discord, claude-code) work because they're inside the Nuxt app.

## Goals / Non-Goals

**Goals:**
- Extension authors get full TypeScript autocomplete by importing from `summit-types`
- All public types consolidated in one package with a flat export surface
- Bun workspaces link the package for local development
- Zero runtime code — types only

**Non-Goals:**
- Publishing to npm (can be done later, not needed for local extensions)
- Restructuring the entire app into a full monorepo (core extraction deferred)
- Moving runtime code into the package

## Decisions

### 1. Package location: `packages/summit-types/`

Place the package at `packages/summit-types/` with the root `package.json` declaring `workspaces: ["packages/*", "frontend"]`. This sets up the monorepo structure for future packages without over-committing now.

**Alternative**: Ship a `.d.ts` file into `.summit/extensions/`. Rejected because it requires manual syncing when types change, and doesn't compose with npm tooling.

### 2. Types-only with `exports` field

The package uses TypeScript source directly — no build step. The `package.json` uses:
```json
{
  "name": "summit-types",
  "exports": { ".": "./src/index.ts" },
  "types": "./src/index.ts"
}
```

Bun and TypeScript resolve `.ts` sources natively via workspaces. If we ever publish to npm, we add a `tsc` build step at that point.

**Alternative**: Pre-built `.d.ts` files. Rejected because it adds a build step for zero benefit during local development.

### 3. Flat re-export surface

All types exported from a single `src/index.ts`. No deep import paths (`summit-types/providers`, etc.). Extension authors write:
```typescript
import type { ExtensionAPI, StoredSession, AppEvent } from "summit-types";
```

### 4. Migrate imports incrementally

Original files (`frontend/shared/types.ts`, `frontend/server/extensions/types.ts`, `frontend/server/providers/types.ts`) become re-exports from `summit-types`. This means existing imports continue to work during migration. Migrate all imports in one pass, then the re-export files become thin shims.

### 5. Event bus types split: public vs internal

`ActiveQuery` has internal fields (the `EventStream` instance). Export a public-facing `ActiveQuery` with only `done`, `source`, `sessionId`. The internal `ActiveQuery` with `stream` stays in `eventBus.ts`.

## Risks / Trade-offs

- **Bun workspace resolution** — Bun handles workspace linking well, but Nuxt's bundler (Nitro/Vite) also needs to resolve `summit-types`. Mitigated by using `"summit-types": "workspace:*"` in `frontend/package.json` dependencies.
- **Type drift** — If someone adds types to the old locations instead of the package, they won't be available to extensions. Mitigated by making old files re-export from the package (any new types must go in the package).
