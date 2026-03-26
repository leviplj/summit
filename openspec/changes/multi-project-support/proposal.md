## Why

Summit currently operates on a single repository — the one it lives in. Real-world development involves multiple repositories (API, frontend, infrastructure) that often need coordinated changes. Users need to point Summit at any project on their machine and have sessions scoped to that project's repos, with Claude able to read and modify code across all of them in a single conversation.

## What Changes

- Add a **Project** entity: a named collection of one or more local git repository paths
- Add server-side project CRUD (create, read, update, delete) with persistence
- **BREAKING**: Sessions are now scoped to a project. Each session stores a `projectId` and creates worktrees for all repos in that project
- Worktree creation changes from single-repo (`worktrees/<session-id>/`) to multi-repo (`worktrees/<session-id>/<repo-name>/`)
- SDK query execution uses the session's parent worktree folder as `cwd` with `additionalDirectories` pointing to each repo worktree
- UI adds a project switcher for selecting/managing the active project
- UI adds a project configuration view for adding/editing repo paths
- Changed files panel groups changes by repository
- Header branch badge shows one branch per repo

## Capabilities

### New Capabilities
- `project-management`: CRUD operations for projects (create, list, update, delete). Each project has a name and a list of repos with name + local path. Persisted to disk.
- `multi-repo-worktrees`: Creating and removing worktrees for all repos in a project when a session starts/ends. Worktrees organized as `worktrees/<session-id>/<repo-name>/`.
- `project-scoped-sessions`: Sessions belong to a project. Query execution targets the project's worktree workspace with access to all repos via `cwd` + `additionalDirectories`.
- `project-ui`: Project switcher in the sidebar, project configuration view for managing repos, per-repo branch badges, and changed files grouped by repo.

### Modified Capabilities

_None — no existing specs to modify._

## Impact

- **Server**: New `projects.ts` server util, new API routes for project CRUD, modified session creation/deletion to handle multi-repo worktrees, modified query execution for multi-repo `cwd`/`additionalDirectories`
- **Shared types**: New `Project` type, `StoredSession` gains `projectId` and `worktrees` map
- **Frontend**: New project switcher component, project config component, modified sidebar, modified changed files panel, modified header
- **Data**: New `.summit/projects/` storage directory, migration path for existing single-repo sessions
