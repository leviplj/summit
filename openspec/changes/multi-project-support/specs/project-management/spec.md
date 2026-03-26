## ADDED Requirements

### Requirement: Create a project
The system SHALL allow users to create a named project with one or more local git repository paths. Each repo entry has a `name` (unique within the project) and a `path` (absolute local filesystem path). The system SHALL validate that each path exists and is a git repository before persisting.

#### Scenario: Create project with single repo
- **WHEN** user submits a new project with name "my-api" and one repo `{ name: "api", path: "/home/user/projects/api" }`
- **THEN** the system creates and persists the project with a generated ID, returning the full project object

#### Scenario: Create project with multiple repos
- **WHEN** user submits a new project with name "fullstack" and repos `[{ name: "api", path: "/home/user/api" }, { name: "web", path: "/home/user/web" }]`
- **THEN** the system creates and persists the project with both repos listed

#### Scenario: Reject invalid repo path
- **WHEN** user submits a project with a repo path that does not exist or is not a git repository
- **THEN** the system SHALL return an error indicating which path is invalid and SHALL NOT create the project

#### Scenario: Reject duplicate repo names within a project
- **WHEN** user submits a project where two repos share the same name
- **THEN** the system SHALL return a validation error

### Requirement: List all projects
The system SHALL return all persisted projects ordered by name.

#### Scenario: List projects
- **WHEN** user requests the project list
- **THEN** the system returns all projects with their IDs, names, and repo lists

#### Scenario: No projects exist
- **WHEN** user requests the project list and none have been created
- **THEN** the system returns an empty array

### Requirement: Update a project
The system SHALL allow users to update a project's name and repo list. The same validations as creation apply (valid git paths, unique repo names).

#### Scenario: Rename a project
- **WHEN** user updates project "old-name" to "new-name"
- **THEN** the system persists the name change

#### Scenario: Add a repo to an existing project
- **WHEN** user updates a project to include an additional repo entry
- **THEN** the system persists the updated repo list

#### Scenario: Remove a repo from an existing project
- **WHEN** user updates a project to remove a repo entry
- **THEN** the system persists the updated repo list without the removed repo

### Requirement: Delete a project
The system SHALL allow users to delete a project by ID. Deleting a project SHALL NOT delete any active sessions or their worktrees — those are cleaned up independently.

#### Scenario: Delete an existing project
- **WHEN** user deletes a project that exists
- **THEN** the project is removed from persistence and no longer appears in the list

#### Scenario: Delete a non-existent project
- **WHEN** user attempts to delete a project ID that does not exist
- **THEN** the system returns a 404 error

### Requirement: Project persistence
Projects SHALL be persisted to disk under `.summit/projects/` as individual JSON files (`<project-id>.json`). The system SHALL survive server restarts without data loss.

#### Scenario: Projects survive restart
- **WHEN** a project is created and the server restarts
- **THEN** the project is still returned by the list endpoint
