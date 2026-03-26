## ADDED Requirements

### Requirement: Stage files
The system SHALL allow users to stage one or more files in the session worktree by path. Staging runs `git add` for the specified paths.

#### Scenario: Stage a single file
- **WHEN** user stages the file `src/index.ts` in the session worktree
- **THEN** the system runs `git add src/index.ts` in the worktree and the file appears as staged in subsequent status queries

#### Scenario: Stage multiple files
- **WHEN** user stages `["src/a.ts", "src/b.ts"]`
- **THEN** both files are added to the git index

#### Scenario: Stage in a session without a worktree
- **WHEN** user attempts to stage files in a session that has no `worktreePath`
- **THEN** the system returns an error indicating no worktree is available

### Requirement: Unstage files
The system SHALL allow users to unstage one or more files in the session worktree by path. Unstaging runs `git reset HEAD` for the specified paths.

#### Scenario: Unstage a single file
- **WHEN** user unstages `src/index.ts`
- **THEN** the system runs `git reset HEAD -- src/index.ts` and the file moves from staged to unstaged

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

### Requirement: Session-level changed files
The changed files endpoint SHALL return all files changed since the worktree branched from the source (diff against merge-base), not just uncommitted changes. Each file includes `uncommitted: boolean` (has uncommitted modifications) and `staged: boolean` (uncommitted changes are in the index). The response also includes `sourceBranch` (the detected default branch name).

#### Scenario: Files persist after commit
- **WHEN** user commits all staged changes
- **THEN** the changed files panel still shows all session files (they are now committed but still differ from the source branch)

#### Scenario: Uncommitted indicator
- **WHEN** a file has been modified but not committed
- **THEN** the file appears with `uncommitted: true` and an amber dot in the UI

#### Scenario: No changes
- **WHEN** the worktree has no changes relative to the source branch
- **THEN** the changes endpoint returns an empty file list

### Requirement: Commit panel UI
The changed files panel SHALL display a commit section when uncommitted files exist. The section shows staged and unstaged groups with checkboxes, "Stage All" / "Unstage All" buttons, a commit message textarea, and a "Commit" button disabled when no files are staged or message is empty.

#### Scenario: Stage a file via checkbox
- **WHEN** user clicks the checkbox next to an unstaged file
- **THEN** the file is staged via the API and appears in the staged group

#### Scenario: Submit a commit
- **WHEN** user has staged files, types a commit message, and clicks "Commit"
- **THEN** the commit is created, the message input is cleared, and the file list refreshes

### Requirement: API endpoints for git operations
The system SHALL expose:
- `POST /api/sessions/[id]/git/stage` with body `{ paths: string[] }`
- `POST /api/sessions/[id]/git/unstage` with body `{ paths: string[] }`
- `POST /api/sessions/[id]/git/commit` with body `{ message: string }`

All endpoints validate the session exists and has a worktree. All return descriptive git error messages on failure.
