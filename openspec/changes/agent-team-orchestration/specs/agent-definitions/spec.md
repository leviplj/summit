## ADDED Requirements

### Requirement: Agent file format
The system SHALL store agent definitions as markdown files with YAML frontmatter. The frontmatter MUST support the fields: `name` (string, required), `parent` (string, optional — references another agent's filename without extension), `model` (string, optional), and `repos` (array of strings, optional — subset of project repo names). The markdown body after the frontmatter SHALL be the agent's instructions (prompt).

#### Scenario: Valid agent file with all fields
- **WHEN** a file `backend.md` exists with frontmatter `name: Backend`, `parent: architect`, `model: sonnet`, `repos: [api]` and a markdown body with instructions
- **THEN** the system parses it into an agent definition with all fields populated and the body as the instructions string

#### Scenario: Minimal agent file
- **WHEN** a file `lead.md` exists with only `name: Lead` in frontmatter and a markdown body
- **THEN** the system parses it as a root agent (no parent) with default model and access to all project repos

#### Scenario: File without valid frontmatter
- **WHEN** a markdown file exists without YAML frontmatter or with malformed frontmatter
- **THEN** the system ignores the file and does not include it in the agent tree

### Requirement: Hierarchy from parent references
The system SHALL reconstruct an agent tree from flat files by following `parent` references. The `parent` field value MUST match the filename (without `.md` extension) of another agent file in the same directory. An agent without a `parent` field SHALL be treated as a root agent.

#### Scenario: Three-level hierarchy
- **WHEN** agents directory contains `architect.md` (no parent), `backend.md` (parent: architect), and `db.md` (parent: backend)
- **THEN** the system builds a tree: architect → backend → db

#### Scenario: Multiple children under one parent
- **WHEN** `backend.md` and `frontend.md` both have `parent: architect`
- **THEN** both appear as children of architect in the tree

#### Scenario: Circular parent reference
- **WHEN** `a.md` has `parent: b` and `b.md` has `parent: a`
- **THEN** the system detects the cycle and reports an error, excluding the cyclic agents from the tree

#### Scenario: Orphaned agent (parent not found)
- **WHEN** `backend.md` has `parent: nonexistent` and no `nonexistent.md` exists
- **THEN** the system treats `backend` as a root-level agent and surfaces a warning

### Requirement: Read agents from directory
The system SHALL read all `.md` files from a given directory path and parse them into agent definitions. The system SHALL NOT recurse into subdirectories.

#### Scenario: Read agents from configured path
- **WHEN** the agents directory path is `/path/to/.claude/agents` and contains `architect.md` and `backend.md`
- **THEN** the system returns both parsed agent definitions

#### Scenario: Empty or nonexistent directory
- **WHEN** the agents directory path does not exist or contains no `.md` files
- **THEN** the system returns an empty agent list without error

### Requirement: Write agent to directory
The system SHALL write agent definitions as `.md` files to the configured directory. The filename MUST be derived from the agent name in kebab-case. When updating an existing agent whose name has changed, the system SHALL rename the file accordingly.

#### Scenario: Save new agent
- **WHEN** user creates an agent named "Backend API" with instructions
- **THEN** the system writes `backend-api.md` to the agents directory with proper frontmatter and body

#### Scenario: Delete agent
- **WHEN** user deletes an agent
- **THEN** the system removes the corresponding `.md` file from the agents directory

#### Scenario: Delete agent with children
- **WHEN** user deletes an agent that has children referencing it as parent
- **THEN** the system removes the agent file and updates children to become root-level agents (removing their `parent` field)
