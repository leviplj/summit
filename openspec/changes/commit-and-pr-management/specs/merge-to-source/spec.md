## ADDED Requirements

### Requirement: Merge session branch to source
The system SHALL allow users to merge the session worktree's branch into the source branch (the branch the worktree was created from). The merge is a local `git merge` operation run at the main repo root. The system SHALL require all changes to be committed before merging.

#### Scenario: Merge successfully
- **WHEN** user clicks "Merge into main" and all changes are committed
- **THEN** the system resolves the main repo root, runs `git merge <session-branch> --no-edit`, and returns success

#### Scenario: Merge with uncommitted changes
- **WHEN** user attempts to merge but the worktree has uncommitted changes
- **THEN** the merge button is disabled with a tooltip explaining changes must be committed first

#### Scenario: Merge conflict
- **WHEN** the source branch has diverged and the merge produces conflicts
- **THEN** the system returns the git error message and displays it in the UI

#### Scenario: Merge in a session without a worktree
- **WHEN** user attempts to merge in a session that has no `worktreePath`
- **THEN** the system returns an error indicating no worktree is available

### Requirement: Source branch detection
The system SHALL detect the source branch name (e.g., "main" or "master") by checking `origin/HEAD`, falling back to "main", then "master". The detected name is returned in the changes endpoint response and displayed in the merge button label.

#### Scenario: Merge button shows branch name
- **WHEN** the source branch is "main"
- **THEN** the merge button reads "Merge into main" and the tooltip says "Merge this branch into main"

### Requirement: Merge API endpoint
The system SHALL expose:
- `POST /api/sessions/[id]/git/merge` with body `{}`

The endpoint validates the session exists, has a worktree and branch. It resolves the main repo root via `git rev-parse --git-common-dir` and runs the merge there.
