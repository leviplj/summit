## ADDED Requirements

### Requirement: Sessions belong to a project
Every session SHALL have a `projectId` linking it to a project. Session creation SHALL require a valid project ID.

#### Scenario: Create session with project
- **WHEN** user creates a new session with `projectId: "proj-123"`
- **THEN** the session is created with that project ID stored, and worktrees are created for all repos in the project

#### Scenario: Create session with invalid project
- **WHEN** user attempts to create a session with a project ID that does not exist
- **THEN** the system returns an error and does not create the session

### Requirement: Session list filtered by project
The session list endpoint SHALL accept an optional `projectId` query parameter. When provided, only sessions belonging to that project are returned.

#### Scenario: List sessions for a specific project
- **WHEN** user requests sessions with `projectId=proj-123`
- **THEN** only sessions belonging to project "proj-123" are returned

#### Scenario: List sessions without project filter
- **WHEN** user requests sessions without a project filter
- **THEN** all sessions are returned regardless of project

### Requirement: Query execution targets multi-repo workspace
When executing a query for a session, the system SHALL set `cwd` to the session's parent worktree folder (`worktrees/<session-id>/`) and pass each individual repo worktree path via `additionalDirectories` in the SDK options.

#### Scenario: Single-repo project query
- **WHEN** a query runs for a session whose project has one repo "api"
- **THEN** `cwd` is set to `worktrees/<session-id>/` and `additionalDirectories` contains `["worktrees/<session-id>/api/"]`

#### Scenario: Multi-repo project query
- **WHEN** a query runs for a session whose project has repos "api" and "web"
- **THEN** `cwd` is set to `worktrees/<session-id>/` and `additionalDirectories` contains paths to both repo worktrees

### Requirement: Changed files span all repos
The changed files endpoint SHALL aggregate changes across all repo worktrees in the session, returning results grouped by repo name.

#### Scenario: Changes in multiple repos
- **WHEN** the user requests changed files for a session with repos "api" and "web", and both have modifications
- **THEN** the response includes changes grouped as `{ "api": [...files], "web": [...files] }`

#### Scenario: Changes in only one repo
- **WHEN** only the "api" repo has changes
- **THEN** the response includes `{ "api": [...files], "web": [] }`
