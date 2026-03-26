## Context

Summit currently shows changed files in a session's worktree via the `ChangedFiles.vue` panel and diff viewer, but there is no way to stage files, create commits, or push/PR from the UI. Users must leave Summit to use git CLI or another tool to persist their work.

The codebase is a Nuxt 4 app with:
- **Server utils**: `sessions.ts` (CRUD + file persistence), `worktrees.ts` (single-repo create/remove), `queries.ts` (SDK query execution)
- **Shared types**: `StoredSession`, `SessionListItem`, `FileChange`, `AppEvent`
- **Frontend**: `ChangedFiles.vue` (file list + inline diff viewer), session sidebar, header with branch badge
- **API routes**: REST endpoints under `/api/sessions/[id]/` for session CRUD, streaming, changed files, and diffs

Each session already has a `worktreePath` and `branch` — all git operations for commit/PR happen inside that worktree.

## Goals / Non-Goals

**Goals:**
- Users can stage and unstage individual files in the session worktree from the changed files panel
- Users can write a commit message and create a commit from the UI
- Users can push the session branch to origin and create a GitHub pull request with a title and body
- The changed files panel reflects staging state (staged vs unstaged) in real time

**Non-Goals:**
- Interactive rebase, cherry-pick, or other advanced git operations
- Amending previous commits
- Multi-remote support (only `origin`)
- GitLab / Bitbucket PR creation — GitHub only for now
- Commit signing (GPG/SSH)

## Decisions

### 1. Git operations: new `git.ts` server util

A new `server/utils/git.ts` module encapsulates all git operations (stage, unstage, commit, push, PR creation). This keeps `worktrees.ts` focused on worktree lifecycle and avoids bloating existing files.

Functions:
- `stageFiles(worktreePath, paths)` — runs `git add` for the given paths
- `unstageFiles(worktreePath, paths)` — runs `git reset HEAD` for the given paths
- `createCommit(worktreePath, message)` — runs `git commit -m`
- `getStatusWithStaging(worktreePath)` — runs `git status --porcelain` and parses into staged/unstaged categories
- `pushBranch(worktreePath, branch)` — runs `git push -u origin <branch>`
- `createPullRequest(repoPath, branch, title, body)` — runs `gh pr create` from the worktree

**Alternatives considered:**
- Adding functions to `worktrees.ts`: Mixes lifecycle concerns with operational concerns; separate module is cleaner
- Using a git library (isomorphic-git, simple-git): Adds a dependency; `execFile` is already the established pattern and keeps things consistent

### 2. API routes: nested under `/api/sessions/[id]/git/`

New endpoints:
- `POST /api/sessions/[id]/git/stage` — body: `{ paths: string[] }`
- `POST /api/sessions/[id]/git/unstage` — body: `{ paths: string[] }`
- `POST /api/sessions/[id]/git/commit` — body: `{ message: string }`
- `POST /api/sessions/[id]/git/push` — body: `{}`
- `POST /api/sessions/[id]/git/pull-request` — body: `{ title: string, body: string }`

All endpoints validate the session exists and has a `worktreePath`. They use the session's worktree as the `cwd` for git commands.

**Alternatives considered:**
- Top-level `/api/git/` routes with session ID in the body: Breaks the existing pattern where session-scoped operations are nested under `/api/sessions/[id]/`
- Single `/api/sessions/[id]/git` endpoint with an `action` field: Less RESTful, harder to reason about

### 3. Changed files: extend to show staging state

The existing `changes.get.ts` endpoint is updated to return staging state per file. Each `FileChange` gains a `staged: boolean` field. The `git status --porcelain` output already encodes this: the first column is the index (staged) status and the second is the working tree (unstaged) status.

A file that is partially staged (some hunks staged, some not) appears twice — once as staged, once as unstaged — matching standard git behavior.

**Alternatives considered:**
- Separate endpoints for staged vs unstaged: Doubles the requests needed; a single response with a flag is simpler
- A `stagingState: "staged" | "unstaged" | "partial"` enum: Over-complicates; splitting into two entries for partial staging is more intuitive and matches how git itself reports

### 4. UI: commit panel integrated into ChangedFiles

Rather than a separate component, the commit flow is integrated into `ChangedFiles.vue`:
- Each file gets a checkbox for staging/unstaging
- A "Staged" / "Unstaged" grouping header separates the file list
- A commit message input and "Commit" button appear below the staged files section
- After committing, the file list refreshes automatically

This keeps the existing single-panel UX and avoids navigation complexity.

**Alternatives considered:**
- Separate `CommitPanel.vue` component: Adds another panel to manage; the changed files panel is the natural home for staging/commit
- Modal dialog for commit: Adds extra clicks; inline is faster

### 5. UI: PR creation as a dialog

PR creation is a modal dialog triggered from a "Create PR" button in the changed files panel header (visible only when there are commits to push). The dialog has fields for PR title (pre-filled from the latest commit message), body (markdown textarea), and a submit button.

The flow: push the branch to origin first, then create the PR via `gh pr create`. Both steps are shown with progress/status in the dialog.

**Alternatives considered:**
- Inline PR form in the changed files panel: Too much UI crammed into the narrow panel; a dialog gives more space for the markdown body editor
- Two separate buttons (push, then PR): Users almost always want both; combining into one flow reduces friction

### 6. GitHub CLI (`gh`) for PR creation

PR creation uses the `gh` CLI tool, which is commonly available in development environments and handles authentication, repo detection, and the GitHub API. The worktree's git remote is used to determine the repository.

The server validates that `gh` is available before attempting PR creation and returns a clear error if it is not installed or not authenticated.

**Alternatives considered:**
- Direct GitHub REST API calls: Requires storing/managing GitHub tokens, detecting the repo owner/name from the remote URL, and handling pagination — `gh` abstracts all of this
- Octokit SDK: Adds a Node dependency and still requires token management

## Risks / Trade-offs

- **`gh` CLI dependency**: PR creation fails if `gh` is not installed or authenticated. -> Mitigation: Check for `gh` availability on the push/PR endpoint and return a descriptive error. Show the error in the UI with guidance ("Install gh and run `gh auth login`").

- **Large commits with many files**: Staging/unstaging many files one-by-one could be slow. -> Mitigation: Support bulk stage/unstage (the API accepts an array of paths) and add "Stage All" / "Unstage All" buttons.

- **Push failures (no remote, auth issues, force-push needed)**: Various git push failures are possible. -> Mitigation: Return the git error message verbatim in the API response and display it in the UI. Do not attempt force push automatically.

- **Concurrent git operations**: If Claude is actively writing files while the user stages/commits, there could be race conditions. -> Mitigation: Disable the commit button while a query is active (the session status is already tracked). Stage/unstage are safe during active queries since they only affect the index.

## Open Questions

- Should we show commit history for the session branch in the changed files panel? (Lean toward yes in a follow-up change, not in this one)
- Should the PR body textarea support a markdown preview? (Lean toward yes, using the existing markdown renderer)
