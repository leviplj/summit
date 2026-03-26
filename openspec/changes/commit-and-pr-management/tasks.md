## 1. Shared Types

- [x] 1.1 Add `uncommitted` and `staged` boolean fields to `FileChange` interface in `shared/types.ts`

## 2. Git Server Util

- [x] 2.1 Create `server/utils/git.ts` with `stageFiles`, `unstageFiles`, `createCommit`
- [x] 2.2 Add `getDefaultBranch` — detects main/master branch name
- [x] 2.3 Add `getMergeBase` — returns fork-point commit hash for session diff
- [x] 2.4 Add `getMainRepoRoot` — resolves main repo root from worktree via git-common-dir
- [x] 2.5 Add `mergeBranch` — merges session branch into source at main repo root

## 3. Git API Routes

- [x] 3.1 Create `POST /api/sessions/[id]/git/stage` — validates session + worktree, stages files
- [x] 3.2 Create `POST /api/sessions/[id]/git/unstage` — validates session + worktree, unstages files
- [x] 3.3 Create `POST /api/sessions/[id]/git/commit` — validates session + worktree + message, creates commit
- [x] 3.4 Create `POST /api/sessions/[id]/git/merge` — validates session + worktree + branch, merges to source

## 4. Changed Files Endpoint — Session Diff

- [x] 4.1 Diff against merge-base (full session diff: committed + uncommitted) instead of just `git status`
- [x] 4.2 Annotate each file with `uncommitted` and `staged` flags from `git status --porcelain`
- [x] 4.3 Include untracked files that appear in porcelain but not in merge-base diff
- [x] 4.4 Numstat against merge-base for accurate addition/deletion counts

## 5. Diff Endpoint — Session Diff

- [x] 5.1 Diff against merge-base instead of HEAD, showing full session change per file

## 6. Frontend: Unified Session Changes Panel

- [x] 6.1 Single file list showing all session changes (merge-base to working tree)
- [x] 6.2 Amber dot indicator on files with uncommitted changes
- [x] 6.3 Staging section (staged/unstaged with checkboxes) only when uncommitted files exist
- [x] 6.4 Stage All / Unstage All buttons
- [x] 6.5 Commit message textarea and Commit button (disabled when no staged files or empty message)
- [x] 6.6 Merge to Source button (disabled when uncommitted files exist)
- [x] 6.7 Success/error messages for commit and merge operations
- [x] 6.8 Merge button shows source branch name (e.g., "Merge into main")
- [x] 6.9 Source branch name returned from changes endpoint
- [x] 6.10 All git API routes return descriptive stderr error messages on failure

## 7. AI-Generated Commit Messages

- [x] 7.1 Create `POST /api/sessions/[id]/git/generate-message` endpoint using Claude Agent SDK
- [x] 7.2 Send staged diff (`git diff --cached`) to Haiku with `maxTurns: 1`, `allowedTools: []`
- [x] 7.3 Truncate diff to 8KB before sending to limit token usage
- [x] 7.4 Clean up response (strip quotes, prefixes)
- [x] 7.5 Add sparkles icon button in commit textarea to trigger generation
- [x] 7.6 Show spinner (Loader2) while generating, sparkles when idle
