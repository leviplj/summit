## ADDED Requirements

### Requirement: Create worktrees for all repos in a project
When a session starts, the system SHALL create a git worktree for every repo in the session's project. Worktrees SHALL be organized as `worktrees/<session-id>/<repo-name>/` relative to Summit's root directory.

#### Scenario: Session created for a single-repo project
- **WHEN** a new session is created for a project with one repo named "api" at path "/home/user/api"
- **THEN** the system creates a git worktree at `worktrees/<session-id>/api/` branched from that repo's HEAD

#### Scenario: Session created for a multi-repo project
- **WHEN** a new session is created for a project with repos "api" and "web"
- **THEN** the system creates worktrees at `worktrees/<session-id>/api/` and `worktrees/<session-id>/web/`, each branched from their respective repo's HEAD

#### Scenario: Worktree branch naming
- **WHEN** worktrees are created for session "abc-123" and repo "api"
- **THEN** the branch name SHALL be `summit/abc-123/api` to avoid collisions across repos and sessions

### Requirement: Remove worktrees when a session is deleted
When a session is deleted, the system SHALL remove all worktrees created for that session and delete their associated branches.

#### Scenario: Delete session with multiple worktrees
- **WHEN** a session with worktrees for "api" and "web" is deleted
- **THEN** both worktrees are removed via `git worktree remove --force`, branches are deleted, and the `worktrees/<session-id>/` directory is cleaned up

#### Scenario: Worktree already missing
- **WHEN** a session is deleted but a worktree directory was already manually removed
- **THEN** the system SHALL still attempt cleanup (prune + branch delete) without failing

### Requirement: Store worktree mapping on the session
The session SHALL store a `worktrees` map of `{ [repoName]: worktreePath }` so that other components can locate each repo's worktree.

#### Scenario: Session worktree map
- **WHEN** a session is created for a project with repos "api" and "web"
- **THEN** the session's `worktrees` field contains `{ "api": "/abs/path/worktrees/<sid>/api", "web": "/abs/path/worktrees/<sid>/web" }`
