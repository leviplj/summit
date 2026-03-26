## ADDED Requirements

### Requirement: Generate commit message from staged diff
The system SHALL provide an endpoint that generates a commit message by sending the staged diff to Claude Haiku. The endpoint uses the Claude Agent SDK's `query()` function with `maxTurns: 1`, `model: "haiku"`, and `allowedTools: []`.

#### Scenario: Generate message for staged changes
- **WHEN** user clicks the generate button and files are staged
- **THEN** the system reads `git diff --cached`, sends it to Haiku with a prompt requesting a concise one-line commit message, and returns the generated text

#### Scenario: Generate with no staged changes
- **WHEN** user clicks generate but nothing is staged
- **THEN** the system returns an error indicating no staged changes to describe

#### Scenario: Large diff truncation
- **WHEN** the staged diff exceeds 8KB
- **THEN** the system truncates it before sending to prevent excessive token usage

### Requirement: Generate button UI
The commit message textarea SHALL include a sparkles icon button that triggers message generation. While generating, the icon changes to a spinner. The generated message replaces the current textarea content.

#### Scenario: Loading state
- **WHEN** user clicks the generate button
- **THEN** the sparkles icon becomes a spinning loader until the response arrives

#### Scenario: Overwrite existing message
- **WHEN** the textarea already has text and user clicks generate
- **THEN** the generated message replaces the existing text

### Requirement: Generate message API endpoint
The system SHALL expose:
- `POST /api/sessions/[id]/git/generate-message` with body `{}`

Returns `{ message: string }`. The endpoint cleans up the response (strips quotes, "commit message:" prefix).
