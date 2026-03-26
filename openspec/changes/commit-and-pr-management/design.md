## Context

Summit shows changed files in a session's worktree via the `ChangedFiles.vue` panel and diff viewer. Each session has a `worktreePath` and `branch` created via `worktrees.ts`. The codebase is a Nuxt 4 app with Nitro server, using `execFile` for git commands.

## Goals / Non-Goals

**Goals:**
- Users can stage/unstage files, commit, and merge back to the source branch from the UI
- The changed files panel shows all session changes (not just uncommitted), so the "big picture" is never lost after committing
- Users can auto-generate commit messages using Claude

**Non-Goals:**
- Interactive rebase, cherry-pick, or other advanced git operations
- Push to remote / PR creation (may be added later)
- Multi-remote support
- Commit signing

## Decisions

### 1. Git operations: new `git.ts` server util

A new `server/utils/git.ts` module encapsulates all git operations, keeping `worktrees.ts` focused on lifecycle.

Functions:
- `stageFiles(worktreePath, paths)` — runs `git add`
- `unstageFiles(worktreePath, paths)` — runs `git reset HEAD`
- `createCommit(worktreePath, message)` — runs `git commit -m`
- `getDefaultBranch(cwd)` — detects main/master via `origin/HEAD` or fallback
- `getMergeBase(worktreePath)` — `git merge-base HEAD <defaultBranch>`
- `getMainRepoRoot(worktreePath)` — resolves via `git rev-parse --git-common-dir`
- `mergeBranch(worktreePath, branch)` — merges session branch into source at main repo root

### 2. API routes: nested under `/api/sessions/[id]/git/`

Endpoints:
- `POST .../git/stage` — body: `{ paths: string[] }`
- `POST .../git/unstage` — body: `{ paths: string[] }`
- `POST .../git/commit` — body: `{ message: string }`
- `POST .../git/merge` — body: `{}`
- `POST .../git/generate-message` — body: `{}`

All validate session exists and has a `worktreePath`. Return git stderr on failure.

### 3. Session-level diff (merge-base approach)

The changed files panel previously showed only `git status --porcelain` (uncommitted changes). After committing, the panel went empty — losing the "big picture" of what the session changed.

Now `changes.get.ts` diffs against the merge-base (the commit where the worktree branched from the source). This shows all session changes (committed + uncommitted). Each file is annotated with `uncommitted: boolean` and `staged: boolean` from `git status --porcelain`.

The `diff.get.ts` endpoint also diffs against merge-base, so clicking a file always shows the full session change.

The response also includes `sourceBranch` (detected default branch name) so the UI can show "Merge into main" rather than a generic label.

**Alternatives considered:**
- Two views (session diff + uncommitted): Adds cognitive overhead with mode switching. A single unified list with subtle indicators is simpler.

### 4. Merge to source branch (replaces PR creation)

Originally the design called for `gh pr create` for PR creation, which tied Summit to GitHub and required `gh` CLI installation. Instead, merge is a local `git merge` operation from the main repo root.

Flow: `getMainRepoRoot(worktreePath)` → `git merge <branch> --no-edit` at that root.

The merge button is disabled when uncommitted changes exist (user must commit first). Shows the actual source branch name: "Merge into main".

**Alternatives considered:**
- PR via `gh` CLI: Creates external dependency, doesn't work without GitHub, slower. Local merge is simpler and works everywhere.
- PR via GitHub API: Requires token management.

### 5. AI-generated commit messages

Uses the Claude Agent SDK's `query()` function with `model: "haiku"`, `maxTurns: 1`, and `allowedTools: []` (no tools). Sends the staged diff (`git diff --cached`) as the prompt and asks for a one-line commit message.

Haiku is fast and cheap — appropriate for a small utility prompt. The diff is truncated to 8KB to avoid excessive token usage.

The UI shows a sparkles icon in the commit textarea that becomes a spinner while generating.

**Alternatives considered:**
- Heuristic parsing of diff: Too generic ("Update server.py"). Can't understand semantic meaning.
- Full agent query: Overkill, slow, expensive. A single Haiku turn is sufficient.

### 6. UI: unified session changes panel

`ChangedFiles.vue` has three logical sections:

1. **File list** — All files changed in the session (merge-base to working tree). Uncommitted files have an amber dot. Clicking any file shows the full session diff.
2. **Staging & commit** — Only visible when uncommitted files exist. Shows staged/unstaged groups with checkboxes, Stage All / Unstage All, commit message textarea with generate button, and Commit button.
3. **Merge** — Always visible when there are session changes. Disabled until all changes are committed.

## Risks / Trade-offs

- **Merge conflicts**: If the source branch has advanced, merge may fail. The git error message is shown in the UI.
- **Concurrent git operations**: Commit button is disabled while a query is active. Stage/unstage are safe during queries.
- **Large diffs**: The generate-message endpoint truncates to 8KB. Very large sessions may get less accurate messages.
