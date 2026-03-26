## 1. Shared Types

- [x] 1.1 Add `DevServerConfig` to `Project` type: `devServer?: { command: string; basePort: number; repo?: string }`
- [x] 1.2 Add `DevServerStatus` type: `{ sessionId: string; status: "stopped" | "starting" | "running" | "error"; port: number | null; error?: string }`
- [x] 1.3 Add `"dev_server"` to `AppEvent` type union for real-time status updates

## 2. Dev Server Manager (`server/features/dev-server/manager.ts`)

- [x] 2.1 Create `DevServerManager` class with `Map<sessionId, DevServerInstance>` tracking running processes
- [x] 2.2 Implement `start(sessionId, worktreePath, command, basePort)`: spawn process with `PORT` and `BASE_URL` env vars, `shell: true`, `cwd` set to worktree
- [x] 2.3 Implement port assignment: find lowest available port starting from `basePort` by checking the active instances map
- [x] 2.4 Implement startup detection: poll `localhost:<port>` with TCP connect attempts, transition from `starting` → `running` on success, `error` after 30s timeout
- [x] 2.5 Implement `stop(sessionId)`: kill process tree (SIGTERM, then SIGKILL after 5s), clean up state
- [x] 2.6 Implement `getStatus(sessionId)`: return current `DevServerStatus`
- [x] 2.7 Capture stdout/stderr into a rolling buffer (last 500 lines) per instance
- [x] 2.8 Implement `getLogs(sessionId)`: return captured log lines
- [x] 2.9 Add process exit handler: on Summit shutdown, kill all managed child processes
- [x] 2.10 Export a singleton instance of the manager

## 3. Dev Server API Routes (`server/routes/api/sessions/[id]/dev-server/`)

- [x] 3.1 `POST /api/sessions/[id]/dev-server/start` — look up session + project, resolve worktree path, call manager.start. Return status.
- [x] 3.2 `POST /api/sessions/[id]/dev-server/stop` — call manager.stop. Return status.
- [x] 3.3 `GET /api/sessions/[id]/dev-server/status` — return current dev server status for the session
- [x] 3.4 `GET /api/sessions/[id]/dev-server/logs` — return captured log lines

## 4. Reverse Proxy (`server/routes/preview/[sessionId]/[...path].ts`)

- [x] 4.1 Create catch-all route that looks up the session's dev server port from the manager
- [x] 4.2 Proxy HTTP requests: strip `/preview/<sessionId>/` prefix, forward to `localhost:<port>`, pipe response back
- [x] 4.3 Handle WebSocket upgrade requests for HMR/live-reload support
- [x] 4.4 Return 502 if dev server is not running or port is not assigned
- [x] 4.5 Set appropriate proxy headers (`X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`)

## 5. Session Cleanup Integration

- [x] 5.1 Update session deletion (`DELETE /api/sessions/[id]`) to call `manager.stop(sessionId)` before removing the session
- [x] 5.2 Ensure dev server is stopped before worktree removal to avoid file locking issues

## 6. Project Config Extension

- [x] 6.1 Update `ProjectConfigDialog.vue` to add a collapsible "Dev Server" section with command and base port fields
- [x] 6.2 Update `PUT /api/projects/[id]` to accept and persist `devServer` config
- [x] 6.3 Update `POST /api/projects` to accept optional `devServer` config

## 7. Frontend: Preview Button & Controls

- [x] 7.1 Create `DevServerButton.vue` component: shows in header when project has `devServer` configured
- [x] 7.2 Display server status (stopped/starting/running/error) with colored indicator
- [x] 7.3 Click to start if stopped, click to open preview URL in new tab if running
- [x] 7.4 Dropdown menu with: "Open preview", "Stop server", "View logs"
- [x] 7.5 Poll `/api/sessions/[id]/dev-server/status` while status is `starting` to detect when server is ready
- [x] 7.6 Add `DevServerButton` to the header in `index.vue` next to the changes toggle

## 8. Frontend: Log Viewer

- [x] 8.1 Create `DevServerLogs.vue` panel component (similar to ChangedFiles panel)
- [x] 8.2 Fetch logs from `/api/sessions/[id]/dev-server/logs`, auto-refresh while server is running
- [x] 8.3 Auto-scroll to bottom, monospace font, color stderr lines differently
- [x] 8.4 Add toggle for log panel in `index.vue` (accessible from DevServerButton dropdown)
