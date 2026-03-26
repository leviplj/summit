## ADDED Requirements

### Requirement: Select a model for a session
The UI SHALL display a model selector dropdown that allows the user to choose which Claude model to use. The selected model is associated with the session and used for all queries in that session.

#### Scenario: Select model before first message
- **WHEN** user opens a new session and selects "claude-sonnet-4-20250514" from the model dropdown before sending a message
- **THEN** the selected model is stored on the session and all subsequent queries in that session use "claude-sonnet-4-20250514"

#### Scenario: Select model after messages exist
- **WHEN** user changes the model mid-session to "claude-haiku-4-20250514"
- **THEN** subsequent queries use the newly selected model, and previous messages are unaffected

#### Scenario: Default model when none selected
- **WHEN** user creates a new session without explicitly choosing a model
- **THEN** the system uses a sensible default model (e.g., "claude-sonnet-4-20250514") and the dropdown reflects this default

### Requirement: Persist model on the session
The selected model SHALL be stored on `StoredSession` and persisted to disk so that it survives server restarts and page reloads.

#### Scenario: Model survives page reload
- **WHEN** user selects "claude-opus-4-20250514" for a session and reloads the page
- **THEN** the session still shows "claude-opus-4-20250514" as the selected model

#### Scenario: Model persisted to session JSON
- **WHEN** a session has a model set
- **THEN** the session JSON file on disk includes the `model` field with the selected model identifier

### Requirement: Pass model to SDK query
The server SHALL pass the selected model to the Agent SDK `query()` call via the `model` option so that the correct Claude model processes the request.

#### Scenario: Query with explicit model
- **WHEN** a query is started for a session with model set to "claude-haiku-4-20250514"
- **THEN** the SDK `query()` call includes `model: "claude-haiku-4-20250514"` in its options

#### Scenario: Query with no model set
- **WHEN** a query is started for a session that has no model set (null)
- **THEN** the SDK `query()` call omits the `model` option, allowing the SDK to use its default

### Requirement: Display active model
The UI SHALL show the currently active model name. The model shown in the sidebar footer (already displaying `model` from the SDK init event) continues to reflect the model actually used by the SDK for the active session.

#### Scenario: Model displayed in sidebar
- **WHEN** a session is active and has received at least one response
- **THEN** the sidebar footer displays the model identifier returned by the SDK (e.g., "claude-sonnet-4-20250514")

#### Scenario: Model selector reflects session model
- **WHEN** user switches between sessions with different models
- **THEN** the model selector dropdown updates to show each session's configured model

### Requirement: Available model options
The model selector SHALL present a predefined list of available Claude models. The list is hardcoded in the frontend and can be updated in future releases.

#### Scenario: Dropdown shows available models
- **WHEN** user opens the model selector dropdown
- **THEN** the dropdown lists available models such as "claude-sonnet-4-20250514", "claude-haiku-4-20250514", and "claude-opus-4-20250514"

#### Scenario: Custom model entry
- **WHEN** a user needs a model not in the predefined list
- **THEN** the dropdown allows typing a custom model identifier (free-text input with suggestions)
