## Context

Summit integrations (Discord bot, provider registration) are implemented as Nitro plugins that directly import internal modules (`eventBus`, `queryManager`, `sessions`, `interactions`, `worktrees`). The Discord plugin (`server/plugins/discord.ts`) is the most complex integration — it uses ~10 internal APIs to bridge Discord threads with Summit sessions. There is no formal contract between integrations and core, making it fragile and hard to extend.

The existing internal APIs already form natural extension points:
- **Event bus**: `onQueryInit()`, `onGlobal()`, `subscribe()`, `emit()`
- **Query management**: `startQuery()`, `getActiveQuery()`
- **Sessions**: `getStoredSession()`, `saveSession()`, `listSessions()`
- **Providers**: `registerProvider()`, `listProviders()`
- **Interactions**: `resolveAskUser()`, `createPendingAskUser()`
- **Worktrees**: `createWorktree()`

## Goals / Non-Goals

**Goals:**
- Define an `ExtensionAPI` interface derived from what Discord actually needs
- Build an extension loader with file-based discovery
- Refactor Discord from Nitro plugin to extension, proving the API works
- Keep extensions simple: a single function that receives the API object

**Non-Goals:**
- Sandboxing or permission model for extensions (v1 runs in-process, full trust)
- Hot-reloading extensions at runtime (restart required)
- Extension marketplace or registry
- Breaking changes to existing HTTP APIs or frontend
- Extension-to-extension communication or dependency resolution

## Decisions

### 1. Extension shape: factory function, not class

Extensions export a default factory function `(api: ExtensionAPI) => void | Promise<void>`. No base class, no decorators, no manifest file.

**Why over classes**: Functions are simpler, require no inheritance, and match pi-mono's proven pattern. The API object is the entire contract — extensions don't need to implement an interface, they just call methods on the API.

**Alternative considered**: Class-based with lifecycle methods (`onInit`, `onShutdown`). Rejected because it adds ceremony without benefit — shutdown hooks can be registered via `api.onShutdown()`.

### 2. Discovery from filesystem directories

Extensions are `.ts` files discovered from two locations:
1. `.summit/extensions/` — project-local extensions
2. `~/.summit/extensions/` — global user extensions

Loaded via dynamic `import()` after transpilation with `bun`.

**Why over package-based**: File-based discovery has zero configuration. Drop a file, restart, it works. Package-based (npm) adds dependency management complexity that isn't needed for v1.

**Alternative considered**: Config file listing extensions. Rejected because it adds a manual step — file presence is the config.

### 3. Bundled extensions live in-tree

Discord stays in `frontend/server/extensions/discord/` as a "bundled extension" that ships with Summit. It's loaded through the same ExtensionAPI as user extensions but doesn't require file discovery.

**Why**: Keeps Discord as a first-class integration while proving the extension API. User extensions in `.summit/extensions/` use the same API.

### 4. ExtensionAPI wraps existing internals

The API object is a facade over existing modules — it doesn't replace them. Internal code continues to import `eventBus`, `sessions`, etc. directly. The API adds:
- Namespaced access (`api.sessions.get()`, `api.events.onQueryInit()`)
- Lifecycle management (`api.onShutdown()` for cleanup)
- Logging scoped to the extension (`api.log()`)

**Why over exposing raw modules**: A facade provides a stable contract. Internals can be refactored without breaking extensions. It also allows adding extension-scoped behavior (e.g., auto-cleanup on shutdown).

### 5. Bootstrap via single Nitro plugin

One Nitro plugin (`server/plugins/extensions.ts`) replaces the current `register-providers.ts` and `discord.ts` plugins. It:
1. Loads bundled extensions from `server/extensions/`
2. Discovers user extensions from `.summit/extensions/` and `~/.summit/extensions/`
3. Creates an `ExtensionAPI` instance per extension
4. Calls each extension's factory function
5. Registers shutdown hooks via Nitro's `close` hook

**Why single plugin**: Extension loading order matters (providers before channels). A single plugin controls the sequence.

## Risks / Trade-offs

- **[No sandboxing]** → Extensions run with full access to the Node process. Mitigation: v1 targets developer-authored extensions, not untrusted third-party code. Sandboxing can be added later.
- **[API stability]** → The ExtensionAPI becomes a public contract. Mitigation: Start minimal (only what Discord needs), mark as unstable/experimental, expand based on real extension requests.
- **[Startup errors]** → A broken extension could crash Summit. Mitigation: Wrap each extension load in try/catch, log errors, continue loading others.
- **[Dynamic import complexity]** → `.ts` files need transpilation. Mitigation: Use bun's native TypeScript support via `import()`. Falls back to requiring pre-compiled `.js` files.
