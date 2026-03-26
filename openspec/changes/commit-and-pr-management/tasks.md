## 1. Shared Types

- [ ] 1.1 Add `staged: boolean` field to `FileChange` interface (in `changes.get.ts` and `ChangedFiles.vue`)
- [ ] 1.2 Add `CommitResult` type: `{ ok: boolean, hash?: string, error?: string }`
- [ ] 1.3 Add `PullRequestResult` type: `{ ok: boolean, url?: string, error?: string }`

## 2. Git Server Util

- [ ] 2.1 Create `server/utils/git.ts` with `stageFiles(worktreePath: string, paths: string[]): Promise<void>` — runs `git add` for the given paths
- [ ] 2.2 Add `unstageFiles(worktreePath: string, paths: string[]): Promise<void>` — runs `git reset HEAD --` for the given paths
- [ ] 2.3 Add `createCommit(worktreePath: string, message: string): Promise<string>` — runs `git commit -m`, returns short commit hash
- [ ] 2.4 Add `pushBranch(worktreePath: string, branch: string): Promise<void>` — runs `git push -u origin <branch>`
- [ ] 2.5 Add `createPullRequest(worktreePath: string, title: string, body: string): Promise<string>` — runs `gh pr create`, returns PR URL
- [ ] 2.6 Add `checkGhAvailable(): Promise<boolean>` — runs `gh auth status` and returns whether `gh` is installed and authenticated
- [ ] 2.7 Add `getBranchCommitCount(worktreePath: string): Promise<number>` — runs `git rev-list --count HEAD ^<merge-base>` to determine how many commits the branch has ahead of its parent

## 3. Git API Routes

- [ ] 3.1 Create `POST /api/sessions/[id]/git/stage.post.ts` — validates session + worktree, calls `stageFiles`, returns `{ ok: true }`
- [ ] 3.2 Create `POST /api/sessions/[id]/git/unstage.post.ts` — validates session + worktree, calls `unstageFiles`, returns `{ ok: true }`
- [ ] 3.3 Create `POST /api/sessions/[id]/git/commit.post.ts` — validates session + worktree + message not empty, calls `createCommit`, returns `{ ok: true, hash }`
- [ ] 3.4 Create `POST /api/sessions/[id]/git/push.post.ts` — validates session + worktree, calls `pushBranch`, returns `{ ok: true }`
- [ ] 3.5 Create `POST /api/sessions/[id]/git/pull-request.post.ts` — validates session + worktree + title not empty, checks `gh` availability, calls `pushBranch` then `createPullRequest`, returns `{ ok: true, url }`

## 4. Changed Files Endpoint Update

- [ ] 4.1 Update `changes.get.ts` to parse `git status --porcelain` index vs working-tree columns separately, producing entries with `staged: true` or `staged: false`
- [ ] 4.2 Handle partially staged files by emitting two entries (one staged, one unstaged) for the same path
- [ ] 4.3 Include numstat data for both staged (`git diff --cached --numstat`) and unstaged (`git diff --numstat`) changes

## 5. Frontend: Commit Panel in ChangedFiles

- [ ] 5.1 Update `ChangedFiles.vue` to group files under "Staged" and "Unstaged" section headers
- [ ] 5.2 Add a checkbox per file that calls the stage or unstage API on toggle
- [ ] 5.3 Add "Stage All" button in the unstaged section header and "Unstage All" button in the staged section header
- [ ] 5.4 Add commit message text input below the staged files section
- [ ] 5.5 Add "Commit" button that calls the commit API and refreshes the file list on success
- [ ] 5.6 Disable the commit button when no files are staged, message is empty, or a query is active

## 6. Frontend: PR Creation Dialog

- [ ] 6.1 Create `PullRequestDialog.vue` component with title input, body textarea, and submit/cancel buttons
- [ ] 6.2 Pre-fill the title field with the latest commit message (fetched from session or passed as prop)
- [ ] 6.3 On submit: show loading state, call the pull-request API, display the resulting PR URL as a link on success
- [ ] 6.4 Display error messages in the dialog on failure with a retry option
- [ ] 6.5 Add close behavior: Escape key, click outside, and close button

## 7. Frontend: Create PR Button

- [ ] 7.1 Add "Create PR" button in the `ChangedFiles.vue` panel header
- [ ] 7.2 Conditionally show the button only when the session branch has commits (check via an API call or new endpoint that returns commit count)
- [ ] 7.3 Wire the button to open the `PullRequestDialog.vue` modal

## 8. Error Handling

- [ ] 8.1 All git API routes return descriptive error messages from git/gh stderr on failure
- [ ] 8.2 The PR endpoint returns a specific error message when `gh` is not installed, including install instructions
- [ ] 8.3 The UI displays error messages inline (commit panel) or in the dialog (PR creation) with clear user-facing text
