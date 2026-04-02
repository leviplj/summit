## Why

Summit's integrations (Discord, providers) are hard-coded as Nitro plugins that import internal utilities directly. Adding a new channel (Slack, Telegram) or provider means writing a Nitro plugin with deep knowledge of Summit internals. An extension system formalizes the existing integration patterns — proven by Discord — into a stable API that makes integrations portable, discoverable, and user-installable.

## What Changes

- New `ExtensionAPI` interface exposing session lifecycle, query events, provider registration, and session management — derived from what the Discord plugin already uses
- Extension loader that discovers `.ts` files from `.summit/extensions/` (project-local) and `~/.summit/extensions/` (global)
- A bootstrap Nitro plugin that initializes the extension system at startup
- Discord refactored from a Nitro plugin into the first extension, validating the API surface
- Exported types package so extension authors get autocomplete

## Capabilities

### New Capabilities
- `extension-api`: The core ExtensionAPI interface and types — registerChannel, registerProvider, session CRUD, event hooks, query management, shutdown hooks
- `extension-loader`: Discovery, loading, and lifecycle management of extensions from file system directories

### Modified Capabilities

_(none — no existing spec-level requirements change)_

## Impact

- **Code**: `frontend/server/plugins/discord.ts` moves to `.summit/extensions/discord.ts` (or stays in-tree as a bundled extension). New files: `frontend/server/extensions/` directory with loader, API implementation, and types.
- **APIs**: No public HTTP API changes. New internal `ExtensionAPI` interface.
- **Dependencies**: No new external dependencies. Extension loader uses dynamic `import()`.
- **Systems**: Extensions run in the same process as Summit — no sandboxing in v1. Extensions that fail to load log a warning but don't crash the server.
