## 1. Shared Types

- [x] 1.1 Add `Project` type: `{ id: string, name: string, repos: Array<{ name: string, path: string }>, createdAt: string, updatedAt: string }`
- [x] 1.2 Add `projectId: string` and `worktrees: Record<string, string>` fields to `StoredSession`
- [x] 1.3 Add `projectId` to `SessionListItem`

## 2. Project Persistence

- [x] 2.1 Create `server/utils/projects.ts` with CRUD operations (create, list, get, update, delete) using `.summit/projects/<id>.json` file storage
- [x] 2.2 Add repo path validation: check path exists and is a git repo (`git rev-parse --git-dir`)
- [x] 2.3 Add duplicate repo name validation within a project

## 3. Project API Routes

- [x] 3.1 `GET /api/projects` — list all projects
- [x] 3.2 `POST /api/projects` — create a project (validate name + repos)
- [x] 3.3 `GET /api/projects/[id]` — get a single project
- [x] 3.4 `PUT /api/projects/[id]` — update a project
- [x] 3.5 `DELETE /api/projects/[id]` — delete a project

## 4. Multi-Repo Worktrees

- [x] 4.1 Add `createProjectWorktrees(sessionId, repos)` to `worktrees.ts` — creates `worktrees/<session-id>/<repo-name>/` for each repo with branch `summit/<session-id>/<repo-name>`
- [x] 4.2 Add `removeProjectWorktrees(sessionId, worktrees)` to `worktrees.ts` — removes all worktrees for a session and cleans up branches
- [x] 4.3 Update session creation (`POST /api/sessions`) to accept `projectId`, look up the project, and call `createProjectWorktrees`
- [x] 4.4 Update session deletion to call `removeProjectWorktrees` using the session's worktrees map

## 5. Query Execution

- [x] 5.1 Update `runQuery` in `queries.ts` to set `cwd` to `worktrees/<session-id>/` and `additionalDirectories` to the list of repo worktree paths from the session's `worktrees` map
- [x] 5.2 Handle single-repo case: set `cwd` directly to the one repo worktree for backward compatibility

## 6. Changed Files (Multi-Repo)

- [x] 6.1 Update `changes.get.ts` to iterate all worktrees in the session, run `git status`/`git diff` per repo, and return results grouped by repo name as `Record<string, ChangedFile[]>`
- [x] 6.2 Update `diff.get.ts` to accept a `repo` query parameter and look up the correct worktree path

## 7. Frontend: Project Store

- [x] 7.1 Create `useProjectStore.ts` composable — fetches projects, tracks active project (persisted to localStorage), provides CRUD methods
- [x] 7.2 Wire session list filtering by active project's ID

## 8. Frontend: Project Switcher

- [x] 8.1 Add project dropdown component in the sidebar above the session list
- [x] 8.2 Show active project name, list all projects on click, option to create new project
- [x] 8.3 On project switch, filter sessions and update localStorage

## 9. Frontend: Project Configuration

- [x] 9.1 Create project config dialog/view for creating and editing projects
- [x] 9.2 Form fields: project name, dynamic list of repos (name + path), add/remove buttons
- [x] 9.3 Display server validation errors (invalid path, duplicate names)

## 10. Frontend: Multi-Repo UI Updates

- [x] 10.1 Update header to show one branch badge per repo in the active session
- [x] 10.2 Update `ChangedFiles.vue` to group files under collapsible repo headers
- [x] 10.3 Hide repo grouping for single-repo projects (flat list, same as current)

## 11. Migration

- [x] 11.1 On server startup, if no projects exist, auto-create a default project pointing to Summit's own repo
- [x] 11.2 Assign existing sessions without `projectId` to the default project
