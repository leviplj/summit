## ADDED Requirements

### Requirement: Project switcher in sidebar
The UI SHALL display a project switcher above the session list in the sidebar. The switcher shows the currently active project name and allows the user to select a different project or create a new one.

#### Scenario: Switch active project
- **WHEN** user selects a different project from the switcher
- **THEN** the session list updates to show only sessions for the selected project

#### Scenario: No projects exist
- **WHEN** user opens Summit and no projects have been created
- **THEN** the UI SHALL prompt the user to create their first project

### Requirement: Project configuration view
The UI SHALL provide a view for creating and editing projects. Users can set a project name and add/remove repos by specifying a name and local path for each.

#### Scenario: Create a new project
- **WHEN** user fills in a project name and at least one repo path, then submits
- **THEN** the project is created and becomes the active project

#### Scenario: Edit an existing project
- **WHEN** user opens project settings and modifies the repo list
- **THEN** changes are saved to the server

#### Scenario: Validate repo path
- **WHEN** user enters a repo path that is invalid
- **THEN** the UI shows an error message from the server validation

### Requirement: Per-repo branch badges
The header SHALL display one branch badge per repo in the active session's project, each showing the repo name and current branch.

#### Scenario: Single-repo session
- **WHEN** the active session's project has one repo "api" on branch "summit/abc/api"
- **THEN** one badge shows "api: summit/abc/api"

#### Scenario: Multi-repo session
- **WHEN** the active session's project has repos "api" and "web"
- **THEN** two badges appear, one per repo, each with its branch name

### Requirement: Changed files grouped by repo
The changed files panel SHALL group files under repo name headers when the session belongs to a multi-repo project.

#### Scenario: Multi-repo changed files
- **WHEN** changed files are loaded for a multi-repo session
- **THEN** files are displayed under collapsible repo name headers

#### Scenario: Single-repo changed files
- **WHEN** changed files are loaded for a single-repo session
- **THEN** files are displayed in a flat list without repo grouping (same as current behavior)
