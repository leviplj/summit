## Why

When working in a Summit session, users often need to preview a running application — a web app, API server, or docs site. Currently, there's no way to start a dev server in a session's worktree and access it from the browser. VS Code users can rely on automatic port forwarding, but anyone using vim, ssh, or other editors has no solution. Since Summit is already accessible from the host browser, it's the natural place to proxy dev server traffic.

## What Changes

- Add a `devServer` configuration to projects: a shell command (e.g. `npm run dev`) and a base port number
- Summit manages dev server processes per session: start, stop, track status
- Summit reverse-proxies requests at `/preview/<session-id>/` to the session's dev server running inside the worktree
- UI shows a "Preview" button in the header when a dev server is available, with start/stop controls and a link to the proxied URL
- Built as an isolated feature module under `server/features/dev-server/` with its own routes, utils, and types

## Capabilities

### New Capabilities
- `dev-server-lifecycle`: Start and stop a dev server process in a session's worktree. Assign unique ports from the project's base port. Track process state (starting, running, stopped, error). Clean up on session deletion.
- `dev-server-proxy`: Reverse-proxy HTTP requests from `/preview/<session-id>/` to the session's dev server port on localhost. Handle WebSocket upgrades for HMR/live-reload. Rewrite paths so the app works under the prefix.
- `dev-server-ui`: Preview button in the session header, start/stop controls, status indicator (running/stopped/starting), and a clickable link to open the preview. Server log output viewable in the UI.

### Modified Capabilities
- `project-management`: Project config gains an optional `devServer` field with `command` and `basePort`.
- `project-ui`: Project config dialog gains dev server settings fields.

## Impact

- **Server**: New `server/features/dev-server/` directory with process management, proxy handler, and API routes
- **Shared types**: `Project` gains optional `devServer` config, new `DevServerStatus` type
- **Frontend**: New preview button component, updated project config dialog, dev server log viewer
- **Project config**: Optional `devServer: { command: string, basePort: number }` field added to Project
