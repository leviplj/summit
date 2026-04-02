## ADDED Requirements

### Requirement: Discover extensions from filesystem
The extension loader SHALL scan `.summit/extensions/` (relative to the project root) and `~/.summit/extensions/` (user home) for `.ts` and `.js` files. Each file is treated as a separate extension.

#### Scenario: Project-local extension discovered
- **WHEN** a file `.summit/extensions/slack.ts` exists
- **THEN** the loader includes it in the list of extensions to load

#### Scenario: Global user extension discovered
- **WHEN** a file `~/.summit/extensions/my-tool.ts` exists
- **THEN** the loader includes it in the list of extensions to load

#### Scenario: No extension directories exist
- **WHEN** neither `.summit/extensions/` nor `~/.summit/extensions/` exists
- **THEN** the loader proceeds without error, loading only bundled extensions

### Requirement: Load bundled extensions from server directory
The loader SHALL load bundled extensions from `frontend/server/extensions/*/index.ts`. These are first-party extensions that ship with Summit.

#### Scenario: Bundled Discord extension loaded
- **WHEN** `frontend/server/extensions/discord/index.ts` exists and exports a factory function
- **THEN** the loader loads it as a bundled extension

### Requirement: Extension loading order
The loader SHALL load extensions in this order: bundled extensions first, then project-local, then global. Within each group, files are loaded in alphabetical order.

#### Scenario: Bundled extensions load before user extensions
- **WHEN** both a bundled extension and a project-local extension exist
- **THEN** the bundled extension's factory is called before the project-local extension's factory

### Requirement: Graceful error handling on load failure
The loader SHALL catch errors from individual extensions and log a warning without preventing other extensions from loading.

#### Scenario: One extension throws during initialization
- **WHEN** extension `bad.ts` throws an error in its factory function
- **THEN** the error is logged as a warning and remaining extensions continue to load

#### Scenario: Extension file has syntax error
- **WHEN** an extension file cannot be imported due to a syntax error
- **THEN** the error is logged as a warning and remaining extensions continue to load

### Requirement: Extension naming
The loader SHALL derive the extension name from the filename (without extension) for bundled extensions using the directory name, and for discovered extensions using the filename. This name is used for scoped logging.

#### Scenario: Bundled extension naming
- **WHEN** loading from `frontend/server/extensions/discord/index.ts`
- **THEN** the extension name is `discord`

#### Scenario: User extension naming
- **WHEN** loading from `.summit/extensions/my-custom-tool.ts`
- **THEN** the extension name is `my-custom-tool`

### Requirement: Shutdown coordination
The loader SHALL collect all shutdown hooks registered by extensions and invoke them when Nitro's `close` hook fires. Shutdown hooks SHALL run concurrently via `Promise.allSettled`.

#### Scenario: Multiple extensions register shutdown hooks
- **WHEN** extensions A and B both register `api.onShutdown(cleanup)`
- **THEN** both cleanup functions are called during server shutdown, even if one throws
