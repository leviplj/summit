## ADDED Requirements

### Requirement: Stage files
The system SHALL allow users to stage one or more files in the session worktree by path. Staging runs `git add` for the specified paths. The system SHALL reject paths that are outside the worktree or do not exist.

#### Scenario: Stage a single file
- **WHEN** user stages the file `src/index.ts` in the session worktree
- **THEN** the system runs `git add src/index.ts` in the worktree and the file appears as staged in subsequent status queries

#### Scenario: Stage multiple files
- **WHEN** user stages `["src/a.ts", "src/b.ts"]`
- **THEN** both files are added to the git index

#### Scenario: Stage all changed files
- **WHEN** user stages with the path `["."]`
- **THEN** all changed files in the worktree are staged

#### Scenario: Stage in a session without a worktree
- **WHEN** user attempts to stage files in a session that has no `worktreePath`
- **THEN** the system returns an error indicating no worktree is available

### Requirement: Unstage files
The system SHALL allow users to unstage one or more files in the session worktree by path. Unstaging runs `git reset HEAD` for the specified paths.

#### Scenario: Unstage a single file
- **WHEN** user unstages `src/index.ts`
- **THEN** the system runs `git reset HEAD -- src/index.ts` and the file moves from staged to unstaged in subsequent status queries

#### Scenario: Unstage all files
- **WHEN** user unstages with the path `["."]`
- **THEN** all staged files are returned to unstaged state

### Requirement: Create a commit
The system SHALL allow users to create a commit in the session worktree with a provided commit message. The commit operates on whatever is currently staged in the git index. The system SHALL reject empty commit messages and SHALL return an error if there are no staged changes.

#### Scenario: Commit staged changes
- **WHEN** user has staged files and submits commit message "Add login form"
- **THEN** the system runs `git commit -m "Add login form"` in the worktree and returns success with the new commit hash

#### Scenario: Commit with no staged changes
- **WHEN** user submits a commit message but no files are staged
- **THEN** the system returns an error indicating there is nothing to commit

#### Scenario: Commit with empty message
- **WHEN** user submits an empty or whitespace-only commit message
- **THEN** the system returns a validation error before attempting the git operation

#### Scenario: Commit while a query is active
- **WHEN** user attempts to commit while Claude is actively running a query in the session
- **THEN** the UI SHALL disable the commit button; the server MAY reject the request with an error

### Requirement: Changed files with staging state
The changed files endpoint SHALL return staging state for each file. Each file entry includes a `staged` boolean field. Files that are partially staged (some hunks staged, others not) SHALL appear as two entries: one staged and one unstaged.

#### Scenario: Mixed staged and unstaged files
- **WHEN** user has staged `src/a.ts` and has unstaged changes in `src/b.ts`
- **THEN** the changes endpoint returns `src/a.ts` with `staged: true` and `src/b.ts` with `staged: false`

#### Scenario: Partially staged file
- **WHEN** `src/c.ts` has some hunks staged and others not
- **THEN** the changes endpoint returns two entries for `src/c.ts`: one with `staged: true` and one with `staged: false`

#### Scenario: No changes at all
- **WHEN** the worktree has no staged or unstaged changes
- **THEN** the changes endpoint returns an empty file list

### Requirement: Commit panel UI
The changed files panel SHALL display files grouped under "Staged" and "Unstaged" section headers. Each file has a checkbox that toggles its staging state. Below the staged files section, a commit message text input and "Commit" button are shown. The commit button is disabled when there are no staged files or the message is empty.

#### Scenario: Stage a file via checkbox
- **WHEN** user clicks the checkbox next to an unstaged file
- **THEN** the file is staged via the API and moves to the "Staged" section

#### Scenario: Unstage a file via checkbox
- **WHEN** user clicks the checkbox next to a staged file
- **THEN** the file is unstaged via the API and moves to the "Unstaged" section

#### Scenario: Submit a commit
- **WHEN** user has staged files, types a commit message, and clicks "Commit"
- **THEN** the commit is created via the API, the commit message input is cleared, and the file list refreshes to reflect the new state

#### Scenario: Commit button disabled states
- **WHEN** there are no staged files, OR the commit message is empty, OR a query is active
- **THEN** the commit button is visually disabled and not clickable

### Requirement: Stage all / unstage all
The UI SHALL provide "Stage All" and "Unstage All" buttons for bulk operations when there are unstaged or staged files respectively.

#### Scenario: Stage all
- **WHEN** user clicks "Stage All" and there are unstaged files
- **THEN** all unstaged files move to the staged section

#### Scenario: Unstage all
- **WHEN** user clicks "Unstage All" and there are staged files
- **THEN** all staged files move to the unstaged section

### Requirement: API endpoints for git operations
The system SHALL expose the following endpoints:
- `POST /api/sessions/[id]/git/stage` with body `{ paths: string[] }` — stages the specified files
- `POST /api/sessions/[id]/git/unstage` with body `{ paths: string[] }` — unstages the specified files
- `POST /api/sessions/[id]/git/commit` with body `{ message: string }` — creates a commit

All endpoints SHALL validate that the session exists and has a worktree. All endpoints SHALL return the git command output or error message.

#### Scenario: Stage endpoint success
- **WHEN** `POST /api/sessions/abc/git/stage` is called with `{ paths: ["src/index.ts"] }`
- **THEN** the system returns `{ ok: true }` after successfully staging

#### Scenario: Stage endpoint with invalid session
- **WHEN** `POST /api/sessions/nonexistent/git/stage` is called
- **THEN** the system returns a 404 error

#### Scenario: Commit endpoint success
- **WHEN** `POST /api/sessions/abc/git/commit` is called with `{ message: "Fix bug" }`
- **THEN** the system returns `{ ok: true, hash: "<short-hash>" }` after successfully committing

#### Scenario: Commit endpoint with nothing staged
- **WHEN** `POST /api/sessions/abc/git/commit` is called but nothing is staged
- **THEN** the system returns an error with a descriptive message
