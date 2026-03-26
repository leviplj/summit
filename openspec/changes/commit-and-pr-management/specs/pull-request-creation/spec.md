## ADDED Requirements

### Requirement: Push branch to origin
The system SHALL allow users to push the session worktree's branch to the `origin` remote. The push uses `git push -u origin <branch>` to set up tracking. The system SHALL return an error if the push fails (e.g., no remote configured, authentication failure, rejected push).

#### Scenario: Push a branch with commits
- **WHEN** user pushes a session branch that has local commits not yet on the remote
- **THEN** the system runs `git push -u origin <branch>` in the worktree and returns success

#### Scenario: Push with no remote configured
- **WHEN** user pushes but the worktree's source repo has no `origin` remote
- **THEN** the system returns an error indicating no remote is configured

#### Scenario: Push with authentication failure
- **WHEN** the push fails due to authentication (e.g., expired token, no SSH key)
- **THEN** the system returns the git error message so the user can diagnose the issue

#### Scenario: Push when already up to date
- **WHEN** the remote already has all the local commits
- **THEN** the system returns success (push is a no-op)

#### Scenario: Push in a session without a worktree
- **WHEN** user attempts to push in a session that has no `worktreePath`
- **THEN** the system returns an error indicating no worktree is available

### Requirement: Create a pull request
The system SHALL allow users to create a GitHub pull request from the session branch. PR creation uses the `gh` CLI tool (`gh pr create`) executed in the session worktree. The user provides a title and body. The system SHALL validate that `gh` is available and authenticated before attempting PR creation.

#### Scenario: Create PR successfully
- **WHEN** user submits PR title "Add login form" and body "Implements the login form component" after the branch has been pushed
- **THEN** the system runs `gh pr create --title "..." --body "..."` in the worktree and returns the PR URL

#### Scenario: Create PR when `gh` is not installed
- **WHEN** user attempts to create a PR but `gh` CLI is not available on the system
- **THEN** the system returns an error with message indicating `gh` must be installed

#### Scenario: Create PR when `gh` is not authenticated
- **WHEN** `gh` is installed but the user has not run `gh auth login`
- **THEN** the system returns the `gh` error message indicating authentication is needed

#### Scenario: Create PR when branch not pushed
- **WHEN** user attempts to create a PR but the branch has not been pushed to origin
- **THEN** the system returns an error indicating the branch must be pushed first (or the push-then-PR flow handles this automatically)

#### Scenario: Create PR with empty title
- **WHEN** user submits an empty PR title
- **THEN** the system returns a validation error before calling `gh`

### Requirement: PR creation dialog
The UI SHALL provide a modal dialog for creating a pull request. The dialog is triggered from a "Create PR" button in the changed files panel header. The dialog contains fields for PR title (pre-filled with the latest commit message), PR body (markdown textarea), and a submit button.

#### Scenario: Open PR dialog
- **WHEN** user clicks "Create PR" in the changed files panel
- **THEN** a modal dialog opens with the title pre-filled from the latest commit message and an empty body textarea

#### Scenario: Submit PR
- **WHEN** user fills in the title and body and clicks "Create Pull Request"
- **THEN** the dialog shows a progress indicator, the branch is pushed (if not already), the PR is created, and the dialog shows the resulting PR URL as a clickable link

#### Scenario: PR creation error
- **WHEN** PR creation fails for any reason (push failure, `gh` error, network issue)
- **THEN** the dialog shows the error message and allows the user to retry

#### Scenario: Close dialog
- **WHEN** user dismisses the dialog (Escape key, click outside, or close button)
- **THEN** the dialog closes without creating a PR

### Requirement: Create PR button visibility
The "Create PR" button SHALL only be visible when the session has at least one commit on its branch (i.e., the branch has diverged from its parent). The button is hidden when there are no commits yet.

#### Scenario: Branch with commits
- **WHEN** the session branch has commits ahead of the base
- **THEN** the "Create PR" button is visible in the changed files panel header

#### Scenario: Branch with no commits
- **WHEN** the session branch has no commits (freshly created worktree)
- **THEN** the "Create PR" button is not shown

### Requirement: Push and PR API endpoints
The system SHALL expose the following endpoints:
- `POST /api/sessions/[id]/git/push` with body `{}` — pushes the session branch to origin
- `POST /api/sessions/[id]/git/pull-request` with body `{ title: string, body: string }` — creates a GitHub PR via `gh`

Both endpoints validate the session exists and has a worktree.

#### Scenario: Push endpoint success
- **WHEN** `POST /api/sessions/abc/git/push` is called
- **THEN** the system pushes the branch and returns `{ ok: true }`

#### Scenario: PR endpoint success
- **WHEN** `POST /api/sessions/abc/git/pull-request` is called with `{ title: "Fix bug", body: "Details here" }`
- **THEN** the system creates the PR and returns `{ ok: true, url: "https://github.com/owner/repo/pull/123" }`

#### Scenario: PR endpoint when `gh` unavailable
- **WHEN** `POST /api/sessions/abc/git/pull-request` is called but `gh` is not found
- **THEN** the system returns a 500 error with message "gh CLI is not installed. Install it from https://cli.github.com and run `gh auth login`."

### Requirement: `gh` availability check
The push/PR endpoint SHALL verify that the `gh` CLI is installed and authenticated before attempting PR creation. This is done by running `gh auth status` and checking the exit code.

#### Scenario: `gh` is available and authenticated
- **WHEN** `gh auth status` succeeds
- **THEN** the system proceeds with PR creation

#### Scenario: `gh` is not available
- **WHEN** `gh` is not found in PATH
- **THEN** the system returns an error before attempting PR creation
