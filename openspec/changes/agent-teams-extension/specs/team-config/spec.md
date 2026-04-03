## ADDED Requirements

### Requirement: TeamConfig on Project type
The `Project` interface SHALL include an optional `team: TeamConfig | null` field. `TeamConfig` SHALL contain `orchestratorPrompt: string` and `teammates: Array<{ role: string; prompt: string; model?: string }>`.

#### Scenario: Project with team config
- **WHEN** a project has `team: { orchestratorPrompt: "...", teammates: [{ role: "backend", prompt: "..." }] }`
- **THEN** sessions in this project activate team mode

#### Scenario: Project without team config
- **WHEN** a project has `team: null` or no `team` field
- **THEN** sessions work as normal single-agent sessions

### Requirement: Team config persistence
Team configuration SHALL be persisted as part of the Project data and editable via the project API.

#### Scenario: Save team config
- **WHEN** a project is updated with a `team` field via `PUT /api/projects/:id`
- **THEN** the team config is persisted and available on subsequent reads

### Requirement: Backwards compatibility
Projects without team configuration SHALL behave identically to before this change. No existing API contracts or UI behavior SHALL change.

#### Scenario: Existing project unchanged
- **WHEN** a project created before this change is loaded
- **THEN** it has no `team` field and works exactly as before
