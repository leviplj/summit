## ADDED Requirements

### Requirement: Tabbed ProjectConfigDialog
The ProjectConfigDialog SHALL display a tab bar with "General" and "Agents" tabs. The General tab SHALL contain the existing project name and repositories configuration. Selecting a tab SHALL switch the dialog content to the corresponding view.

#### Scenario: Dialog opens on General tab
- **WHEN** user opens the ProjectConfigDialog
- **THEN** the General tab is active and shows the existing project name and repositories form

#### Scenario: Switch to Agents tab
- **WHEN** user clicks the "Agents" tab
- **THEN** the dialog content switches to the agents management view

### Requirement: Agents directory configuration
The Agents tab SHALL display an editable text input for the agents directory path at the top. This path determines where agent files are read from and saved to. The field SHALL be part of the project configuration and persisted when the project is saved.

#### Scenario: Set agents directory
- **WHEN** user enters `/path/to/.claude/agents` in the agents directory field and saves the project
- **THEN** the project stores this path and uses it for reading/writing agent files

#### Scenario: No agents directory configured
- **WHEN** the agents directory field is empty
- **THEN** the agents tree section shows an empty state indicating no directory is configured

### Requirement: Agent tree visualization
The Agents tab SHALL display a tree view on the left side showing all agents organized by their parent-child hierarchy. Root agents SHALL appear at the top level, with children indented below their parents. The root agent SHALL be visually distinguished (e.g., a marker or icon).

#### Scenario: Display agent tree
- **WHEN** the agents directory contains agents with hierarchy architect → [backend, frontend] and backend → [db]
- **THEN** the tree displays architect at top level with backend and frontend as children, and db as a child of backend

#### Scenario: Empty tree
- **WHEN** the agents directory has no agent files
- **THEN** the tree area shows an empty state with a prompt to create the first agent

### Requirement: Agent editor panel
The Agents tab SHALL display an editor panel on the right side when an agent is selected from the tree. The editor SHALL contain fields for: name (text input), parent (dropdown of other agents plus "— root —" option), model (dropdown), repos (checkboxes from project repos), and instructions (textarea). The editor SHALL have Save and Delete buttons.

#### Scenario: Select agent for editing
- **WHEN** user clicks "Backend" in the agent tree
- **THEN** the editor panel shows Backend's name, parent, model, repos, and instructions

#### Scenario: Save agent changes
- **WHEN** user modifies the Backend agent's instructions and clicks Save
- **THEN** the system writes the updated `backend.md` file to the agents directory and refreshes the tree

#### Scenario: Delete agent
- **WHEN** user clicks Delete on the Backend agent and confirms
- **THEN** the system removes `backend.md` from the agents directory and refreshes the tree

### Requirement: Add new agent
The Agents tab SHALL provide an "Add Agent" button below the tree. Clicking it SHALL open the editor panel with empty fields, defaulting parent to "— root —".

#### Scenario: Create new agent
- **WHEN** user clicks "Add Agent", fills in name "Frontend" with parent "architect" and instructions, then clicks Save
- **THEN** the system writes `frontend.md` to the agents directory and adds it to the tree under architect
