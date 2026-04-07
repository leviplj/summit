## Context

Summit is a monorepo with two packages: `summit-types` (shared types) and `frontend` (a Nuxt 4 app containing both the UI and all server-side orchestration logic). The server-side code in `frontend/server/` includes the event bus, query manager, provider registry, extension system, session storage, worktree management, and project CRUD — none of which depend on Nuxt or H3 concepts.

The current layout makes it impossible to use the orchestration engine without the Nuxt app, and mixes framework-specific HTTP handling with framework-agnostic business logic.

## Goals / Non-Goals

**Goals:**
- Extract orchestration logic into `summit-core` as a framework-agnostic TypeScript package
- Keep `summit-web` as a thin Nuxt adapter over core APIs
- Add optional OIDC auth to `summit-web` via env-based configuration
- Maintain identical external behavior (HTTP API, event formats, frontend UX)
- All three packages buildable and testable independently

**Non-Goals:**
- Rewriting business logic — this is a move + re-export, not a rewrite
- Changing the HTTP API contract or event schema
- Adding new features beyond OIDC toggle
- Supporting non-Nuxt frontends (that's a future benefit, not a goal now)

## Decisions

### 1. Core exposes a `createSummit()` factory

**Decision**: `summit-core` exports a single `createSummit(config)` factory that returns an object with all subsystems (events, queries, sessions, providers, extensions, worktrees, projects, interactions).

**Rationale**: A factory pattern lets the web layer initialize core once with config (storage paths, etc.) and pass subsystems to route handlers. It avoids global singletons (which make testing hard) and keeps the API surface explicit.

**Alternative considered**: Export individual modules — rejected because subsystems are interconnected (query manager needs event bus, extensions need everything) and initialization order matters.

### 2. Nuxt server routes become thin adapters

**Decision**: Each API route in `summit-web` imports from the core instance and translates H3 request/response to core calls. No business logic in routes.

**Rationale**: Routes are the only Nuxt-coupled code. Keeping them thin means swapping frameworks later is trivial — just rewrite the adapter layer.

### 3. OIDC as middleware with env-based toggle

**Decision**: A single Nuxt server middleware checks `SUMMIT_AUTH_ENABLED`. When false, it's a no-op. When true, it validates OIDC tokens using standard env vars (`SUMMIT_OIDC_ISSUER`, `SUMMIT_OIDC_CLIENT_ID`, `SUMMIT_OIDC_CLIENT_SECRET`).

**Rationale**: One deployable artifact for both local and remote use. No conditional builds, no separate packages. OIDC libraries are already lightweight and tree-shakeable.

**Alternative considered**: Separate `localweb`/`remoteweb` packages — rejected as unnecessary duplication for a middleware toggle.

### 4. Package directory layout

**Decision**:
```
packages/
  summit-types/     # existing, unchanged
  summit-core/      # new, extracted from frontend/server/
  summit-web/       # renamed from frontend/
```

**Rationale**: All packages under `packages/` with `summit-web` as the app entry point. Renaming `frontend/` to `packages/summit-web/` keeps the monorepo consistent.

### 5. Core has no HTTP or framework dependencies

**Decision**: `summit-core` depends only on `summit-types`, the Claude Agent SDK, and Node.js built-ins. No H3, no Nitro, no Nuxt imports.

**Rationale**: This is the whole point — framework independence. The web layer provides the HTTP transport.

### 6. Extension loader stays in core

**Decision**: The extension discovery and loading system (`loader.ts`, `createExtensionAPI.ts`) moves to core. Extensions like discord and teams are bundled in core.

**Rationale**: Extensions interact with the event bus and query manager, not HTTP routes. They're core functionality.

## Risks / Trade-offs

- **Import path churn** → One-time migration. Use find-and-replace across server routes. No runtime risk.
- **Nuxt auto-imports break** → Nuxt auto-imports from `server/utils/` won't work for code moved to core. Routes must explicitly import from `summit-core`. Mitigation: provide a Nuxt server plugin that initializes core and makes it available via `useCore()` composable.
- **Build complexity** → Three packages need coordinated builds. Mitigation: Bun workspaces handle this; `summit-core` builds first, then `summit-web`.
- **OIDC library size** → Adding OIDC deps to every install even when unused. Mitigation: OIDC deps are small; can lazy-import if needed.
