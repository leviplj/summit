## Context

Summit currently operates on a single repository — the one it lives in. Every session creates a worktree from that single repo via `worktrees.ts`, and the SDK query uses `session.worktreePath` as `cwd`. Sessions, stored as JSON under `.summit/sessions/`, have no concept of which project they belong to.

The codebase is a Nuxt 4 app with:
- **Server utils**: `sessions.ts` (CRUD + file persistence), `worktrees.ts` (single-repo create/remove), `queries.ts` (SDK query execution)
- **Shared types**: `StoredSession`, `SessionListItem`, `AppEvent`
- **Frontend**: single-page `index.vue` with sidebar (session list), header (branch badge), and changed files panel

## Goals / Non-Goals

**Goals:**
- Users can define projects, each pointing to one or more local git repositories
- Sessions are scoped to a project; switching projects shows only that project's sessions
- Claude gets access to all repos in a project during a session via worktrees + `additionalDirectories`
- Changed files panel and branch badges reflect all repos in a session

**Non-Goals:**
- Remote repository cloning — repos must already exist locally
- Agent Teams orchestration (future enhancement)
- Per-repo permission controls
- Multi-user / collaboration support

## Decisions

### 1. Project storage: flat JSON files under `.summit/projects/`

Each project is stored as `.summit/projects/<id>.json`, matching the existing session storage pattern in `.summit/sessions/`. A new `projects.ts` server util mirrors `sessions.ts` structure (CRUD, file I/O, dir ensure).

**Alternatives considered:**
- SQLite: More powerful querying but adds a dependency and breaks the simple file-per-entity pattern already established
- Single `projects.json` file: Simpler but risks write conflicts and doesn't scale; per-file is consistent with sessions

### 2. Worktree layout: `worktrees/<session-id>/<repo-name>/`

Multi-repo worktrees nest under the session directory. Each repo gets its own subdirectory. Branch names become `summit/<session-id>/<repo-name>` to avoid collisions.

**Current state:** `worktrees/<session-id>/` is a single worktree with branch `summit/<session-id>`.

**Migration:** The `worktrees.ts` module gains a `createProjectWorktrees(sessionId, repos)` function that iterates repos and creates one worktree per entry. The existing single-repo `createWorktree` is kept for backward compatibility during migration but eventually removed.

**Alternatives considered:**
- `worktrees/<repo-name>/<session-id>/`: Groups by repo instead of session — harder to clean up all worktrees for a deleted session
- Worktrees inside each source repo: Avoids a central location but scatters state and complicates cleanup

### 3. SDK query execution: `cwd` = parent folder, `additionalDirectories` = each repo worktree

The SDK's `query()` options support `cwd` (primary working directory) and `additionalDirectories` (additional paths the agent can access). For multi-repo sessions:

- `cwd`: `worktrees/<session-id>/` (the parent folder containing all repo worktrees)
- `additionalDirectories`: `["worktrees/<session-id>/api/", "worktrees/<session-id>/web/", ...]`

This gives Claude visibility into all repos from a single conversation. For single-repo projects, `cwd` can point directly to the one repo worktree for simplicity.

**Alternatives considered:**
- Agent Teams (multi-process orchestration): CLI-only feature, not available via SDK
- Sub-agents with per-repo agents: Adds complexity; `additionalDirectories` is simpler and sufficient for now

### 4. Session type changes: add `projectId` and `worktrees` map

`StoredSession` gains:
- `projectId: string` — links to the project
- `worktrees: Record<string, string>` — maps repo name to absolute worktree path (replaces single `worktreePath`)

The existing `worktreePath` and `branch` fields are kept during migration. For project-based sessions, `worktreePath` becomes the parent folder and `branch` becomes null (individual branches are in the worktrees map or derived).

### 5. UI: project switcher as a dropdown above sessions list

A dropdown/select in the sidebar header above the session list. Selecting a project filters sessions and sets it as the "active project" (persisted in localStorage). A gear icon next to the dropdown opens the project config view.

**Alternatives considered:**
- Separate page/route for projects: Adds navigation complexity; a dropdown keeps the single-page feel
- Tabs: Doesn't scale well with many projects

### 6. Changed files: grouped response from API

The changes endpoint returns `Record<string, ChangedFile[]>` keyed by repo name instead of a flat array. The frontend renders collapsible sections per repo. For single-repo projects, only one group exists and headers can be hidden.

## Risks / Trade-offs

- **Breaking change to session creation**: Sessions now require a `projectId`. Existing sessions without one need migration or a "default" project. → Mitigation: Auto-create a default project pointing to Summit's own repo on first load if no projects exist, and assign orphan sessions to it.

- **Worktree proliferation**: Multi-repo projects multiply worktree count. A project with 5 repos and 10 sessions creates 50 worktrees. → Mitigation: Show worktree disk usage in UI; consider session auto-cleanup in future.

- **Path validation race condition**: A repo path may become invalid (deleted/moved) after project creation. → Mitigation: Validate on session creation too, not just project creation.

- **Large repos slow worktree creation**: Creating many worktrees for large repos could slow session start. → Mitigation: Create worktrees in parallel with `Promise.all`.

## Open Questions

- Should there be a limit on repos per project? (Lean toward no hard limit, rely on user judgment)
- Should the default project auto-creation happen server-side or client-side? (Lean server-side for cleaner UX)
