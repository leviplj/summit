## ADDED Requirements

### Requirement: Projects displayed as collapsible folders
The sidebar SHALL display all projects as collapsible folder rows. Each folder row SHALL show a collapse/expand arrow, a folder icon, the project name, and a settings gear icon. Multiple folders SHALL be expandable simultaneously.

#### Scenario: All projects visible on load
- **WHEN** the sidebar loads with multiple projects
- **THEN** all projects are displayed as folder rows, all expanded by default

#### Scenario: Expand/collapse persistence
- **WHEN** the user collapses a project folder and reloads the page
- **THEN** the folder remains collapsed (state persisted to localStorage)

### Requirement: Folder expand/collapse toggle
Clicking the arrow icon or folder icon on a project row SHALL toggle that folder's expand/collapse state. When collapsed, the folder's sessions SHALL be hidden. When expanded, the folder's sessions SHALL be listed below the folder header, indented.

#### Scenario: Collapse a folder
- **WHEN** the user clicks the arrow or folder icon on an expanded project
- **THEN** the project's sessions are hidden and the arrow indicates collapsed state

#### Scenario: Expand a folder
- **WHEN** the user clicks the arrow or folder icon on a collapsed project
- **THEN** the project's sessions are shown and the arrow indicates expanded state

### Requirement: New chat via project name click
Clicking the project name text on a folder row SHALL create a new empty chat session associated with that project. The chat SHALL open in an empty state without sending any prompt.

#### Scenario: Click project name to create chat
- **WHEN** the user clicks the project name text on a folder row
- **THEN** a new session is created with that project's ID and the chat area shows an empty state ready for input

### Requirement: New chat via top + button with project picker
Clicking the top `+` button SHALL display a popover listing all projects. Selecting a project from the picker SHALL create a new empty chat in that project. If only one project exists, the picker SHALL be skipped and the chat created directly.

#### Scenario: Multiple projects — picker shown
- **WHEN** the user clicks `+` and there are multiple projects
- **THEN** a popover appears listing all project names

#### Scenario: Select project from picker
- **WHEN** the user selects a project from the picker popover
- **THEN** a new empty chat is created in that project and the popover closes

#### Scenario: Single project — skip picker
- **WHEN** the user clicks `+` and there is only one project
- **THEN** a new empty chat is created directly in that project without showing a picker

### Requirement: Sessions grouped by project
Sessions SHALL be grouped under their respective project folders. Sessions with `projectId: null` SHALL NOT be displayed in the sidebar.

#### Scenario: Sessions appear under their project
- **WHEN** the sidebar renders with sessions belonging to different projects
- **THEN** each session appears under its project's folder

#### Scenario: Ungrouped sessions hidden
- **WHEN** sessions exist with `projectId: null`
- **THEN** those sessions do not appear in the sidebar

### Requirement: Search across all projects
The search input SHALL filter sessions across all projects. Folders containing matching sessions SHALL be auto-expanded during search. When the search is cleared, folders SHALL return to their previous expand/collapse state.

#### Scenario: Search finds sessions in collapsed folder
- **WHEN** the user types a search query that matches sessions in a collapsed project folder
- **THEN** that folder auto-expands to show the matching sessions

#### Scenario: Clear search restores collapse state
- **WHEN** the user clears the search input
- **THEN** folders return to the expand/collapse state they had before the search began

### Requirement: Project settings access
Clicking the gear icon on a project folder row SHALL open the existing project configuration dialog for that project.

#### Scenario: Open project settings
- **WHEN** the user clicks the gear icon on a project folder row
- **THEN** the ProjectConfigDialog opens for that project

### Requirement: New project button
A "+ New project..." button SHALL appear at the bottom of the project folder list. Clicking it SHALL open the project creation dialog.

#### Scenario: Create new project
- **WHEN** the user clicks "+ New project..."
- **THEN** the ProjectConfigDialog opens in creation mode
