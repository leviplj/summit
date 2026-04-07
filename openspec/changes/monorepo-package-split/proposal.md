## Why

The entire backend orchestration logic (event bus, query manager, providers, extensions, session storage) lives inside the Nuxt frontend app under `frontend/server/`. This couples the core engine to a specific web framework, making it impossible to reuse the orchestration layer independently (e.g., CLI tool, different frontend, or headless deployment). Splitting into focused packages enables independent evolution, testability, and deployment flexibility.

## What Changes

- Extract framework-agnostic orchestration logic from `frontend/server/` into a new `summit-core` package (event bus, query manager, providers, extensions, sessions, worktrees, interactions, projects)
- Rename `frontend/` to `summit-web/` (or move to `packages/summit-web/`) — the Nuxt app becomes a thin adapter over core
- Add optional OIDC authentication to `summit-web` via configuration (env vars), eliminating the need for separate local/remote apps
- `summit-types` remains as-is, providing shared type definitions
- Server routes in the web package become thin HTTP adapters that delegate to core APIs

## Capabilities

### New Capabilities
- `core-package`: Framework-agnostic orchestration engine exposing programmatic APIs for event bus, query management, providers, extensions, sessions, worktrees, and projects
- `optional-oidc`: Configurable OIDC authentication in the web package, enabled/disabled via environment variables

### Modified Capabilities

## Impact

- **Code movement**: `frontend/server/utils/`, `frontend/server/providers/`, `frontend/server/extensions/` move to `packages/summit-core/`
- **Import paths**: All server-side imports change from relative paths to `summit-core` package imports
- **Package structure**: Monorepo goes from 2 packages to 3 (`summit-types`, `summit-core`, `summit-web`)
- **Dependencies**: `summit-core` depends on `summit-types`; `summit-web` depends on both
- **No API changes**: HTTP endpoints, event formats, and frontend behavior remain identical
- **No breaking changes for extensions**: Extension API surface stays the same, just provided by core instead of the Nuxt server
