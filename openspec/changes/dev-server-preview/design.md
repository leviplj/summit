## Context

Summit is a Nuxt 4 app that manages coding sessions, each with its own git worktree. Projects define which repos a session operates on. The app runs inside a devcontainer (or any remote environment) and is accessed via browser. There is currently no mechanism to run or preview application servers from session worktrees.

The feature module pattern (`server/features/dev-server/`) is new — this is the first feature built with explicit isolation from core code. It should serve as a template for future features.

## Goals / Non-Goals

**Goals:**
- Users can configure a dev server command and base port per project
- One click to start/stop a dev server for the active session
- Preview accessible at a Summit URL without external port forwarding
- WebSocket support for HMR/live-reload
- Server logs visible in the UI
- Clean process cleanup on session delete

**Non-Goals:**
- Multiple dev servers per session (one server per session is sufficient)
- HTTPS termination (Summit itself handles that if needed)
- Custom domain routing or subdomains
- Persistent server state across Summit restarts (servers are ephemeral)
- A generic plugin framework (just clean isolation for now)

## Decisions

### 1. Feature module structure: `server/features/dev-server/`

All dev-server code lives under `frontend/server/features/dev-server/`:
- `manager.ts` — process lifecycle (spawn, kill, track state, port assignment)
- `proxy.ts` — HTTP/WebSocket reverse proxy handler
- `types.ts` — feature-specific types (re-exported to shared as needed)

API routes live under `frontend/server/routes/api/sessions/[id]/dev-server/` since they're session-scoped operations (start, stop, status, logs).

The proxy catch-all route lives at `frontend/server/routes/preview/[...path].ts` to handle all preview traffic.

**Why not a plugin system:** We have exactly one feature to build. Designing an abstract plugin API from a single use case would likely produce the wrong abstraction. Instead, we build with clean boundaries and extract a pattern later if warranted.

### 2. Port assignment: base port + session index

Each project has a `basePort` (default: 3100). When a dev server starts, it gets assigned `basePort + N` where N is the lowest available offset. The manager tracks which ports are in use.

The port is passed to the dev server process via the `PORT` environment variable (the most common convention). The full command becomes: `PORT=<assigned_port> <command>` run in the session's worktree directory.

**Alternatives considered:**
- Random high ports: Harder to predict, no advantage
- User-specified per-session ports: Unnecessary complexity; auto-assignment is sufficient

### 3. Reverse proxy at `/preview/<session-id>/`

A Nitro catch-all route at `/preview/[sessionId]/[...path]` proxies requests to `localhost:<port>`. This uses `http-proxy` (or Node's built-in `http` module) to forward requests, including WebSocket upgrade for HMR.

Path rewriting: the `/preview/<session-id>/` prefix is stripped before forwarding. The dev server sees requests at `/`. For apps that need to know their base path, the `BASE_URL` environment variable is set to `/preview/<session-id>/`.

**Why session ID in the URL (not a short alias):** Session IDs are already used throughout the API. No ambiguity, no lookup table needed.

### 4. Process management: spawn with cleanup guarantees

The manager uses `child_process.spawn` with:
- `cwd` set to the session's worktree (single-repo) or first repo worktree (multi-repo, configurable later)
- `env` includes `PORT` and `BASE_URL`
- `shell: true` so the command can be a full shell expression (e.g. `npm run dev`)
- stdout/stderr captured in a rolling buffer (last 500 lines) for the log viewer

Process states: `stopped` → `starting` → `running` → `stopped` (or `error`). The `starting` → `running` transition happens when the manager detects the port is accepting connections (polled briefly after spawn).

Cleanup happens in three places:
1. Explicit stop via API
2. Session deletion (existing `deleteSession` calls a cleanup hook)
3. Summit server shutdown (process exit handler kills all managed children)

### 5. Project config extension: optional `devServer` field

```typescript
interface ProjectDevServer {
  command: string;    // e.g. "npm run dev", "cargo run"
  basePort: number;   // e.g. 3100
}
```

Added as an optional field on `Project`. The project config dialog gets a collapsible "Dev Server" section. If not configured, no preview button appears.

### 6. UI: preview button and log viewer

- **Header**: A "Preview" button appears next to the changes toggle when the project has a dev server configured. Shows status (stopped/starting/running). Click to start if stopped, opens preview URL if running. A small dropdown offers stop and "View logs".
- **Log viewer**: A panel (similar to changed files) that shows the rolling stdout/stderr output. Auto-scrolls. Can be toggled independently.

The preview URL opens in a new tab: `<summit-host>/preview/<session-id>/`.

## Risks / Trade-offs

- **Port exhaustion with many sessions**: If many sessions have dev servers running, ports accumulate. Mitigation: limit concurrent dev servers (e.g. 10), show warning, auto-stop idle servers in future.

- **Dev server startup detection is heuristic**: Polling the port works for most servers but some may take a while. Mitigation: generous timeout (30s), show "starting" state in UI, user can click to retry.

- **Path rewriting may break some apps**: Single-page apps with hardcoded asset paths may not work behind a prefix. Mitigation: set `BASE_URL` env var; document that apps should respect it. Most modern frameworks (Vite, Next, etc.) handle this.

- **WebSocket proxy complexity**: HMR WebSockets need proper upgrade handling. Mitigation: use established proxy patterns; test with Vite HMR specifically since that's the most common case.

- **Process zombies**: If Summit crashes, child processes may survive. Mitigation: use process groups (`detached: false`), add a startup cleanup that kills orphaned processes on known ports.

## Open Questions

- Should multi-repo projects allow specifying which repo to run the dev server in? (Lean toward adding a `repo` field to `ProjectDevServer` that defaults to the first repo)
- Should there be a way to configure additional env vars beyond PORT and BASE_URL? (Lean toward not now, add later if needed)
