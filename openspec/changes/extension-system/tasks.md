## 1. ExtensionAPI Types

- [x] 1.1 Create `frontend/server/extensions/types.ts` with `ExtensionAPI` interface and `ExtensionFactory` type. Namespaces: `sessions`, `events`, `queries`, `providers`, `interactions`, `worktrees`. Plus top-level `log()` and `onShutdown()`.

## 2. ExtensionAPI Implementation

- [x] 2.1 Create `frontend/server/extensions/createExtensionAPI.ts` — factory that takes an extension name and returns an `ExtensionAPI` instance. Each method delegates to existing internal modules (`eventBus`, `sessions`, `queryManager`, `registry`, `interactions`, `worktrees`). Collects shutdown hooks.

## 3. Extension Loader

- [x] 3.1 Create `frontend/server/extensions/loader.ts` — `discoverExtensions()` scans bundled (`server/extensions/*/index.ts`), project-local (`.summit/extensions/*.ts`), and global (`~/.summit/extensions/*.ts`) directories. Returns array of `{ name, path }`.
- [x] 3.2 Add `loadExtensions()` function that imports each discovered module, creates a scoped `ExtensionAPI`, calls the factory, and catches/logs errors per-extension. Returns collected shutdown hooks.

## 4. Bootstrap Plugin

- [x] 4.1 Create `frontend/server/plugins/extensions.ts` — Nitro plugin that calls `loadExtensions()` at startup and wires shutdown hooks to `nitro.hooks.hook("close", ...)`.
- [x] 4.2 Remove `frontend/server/plugins/register-providers.ts` — provider registration moves into a bundled extension or into the bootstrap plugin directly.

## 5. Refactor Discord to Extension

- [x] 5.1 Create `frontend/server/extensions/discord/index.ts` — move Discord integration logic from `server/plugins/discord.ts` into an extension factory function that uses `ExtensionAPI` instead of direct imports.
- [x] 5.2 Update Discord utils (`server/utils/discord.ts`) — keep as-is since they're Discord-specific helpers, not core internals. The extension imports them directly.
- [x] 5.3 Delete `frontend/server/plugins/discord.ts` after the extension version is working.

## 6. Provider Registration as Extension

- [x] 6.1 Create `frontend/server/extensions/claude-code/index.ts` — bundled extension that calls `api.providers.register(claudeCodeProvider)`. Replaces the old `register-providers.ts` plugin.

## 7. Verification

- [x] 7.1 Start Summit with Discord env vars and verify Discord bot connects and responds to messages in threads (same behavior as before).
- [x] 7.2 Start Summit without Discord env vars and verify it starts cleanly with no errors.
- [x] 7.3 Drop a test extension into `.summit/extensions/` and verify it loads, logs via `api.log()`, and its shutdown hook fires on server close.
