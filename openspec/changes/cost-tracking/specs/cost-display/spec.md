## ADDED Requirements

### Requirement: Display per-message cost on assistant messages
The system SHALL display token usage and cost in USD on each assistant message that has cost metadata. The display SHALL appear as a compact line below the message content showing duration, token count, and cost.

#### Scenario: Assistant message with full cost metadata
- **WHEN** an assistant message has `meta.duration_ms`, `meta.output_tokens`, and `meta.cost_usd` populated
- **THEN** the message displays a metadata line showing duration (e.g., "3.2s"), token count (e.g., "1,204 tokens"), and cost (e.g., "$0.0312")

#### Scenario: Assistant message with partial cost metadata
- **WHEN** an assistant message has only some meta fields populated (e.g., `duration_ms` and `output_tokens` but no `cost_usd`)
- **THEN** the message displays only the available fields, omitting missing ones

#### Scenario: Assistant message with no cost metadata
- **WHEN** an assistant message has no `meta` field or all meta fields are undefined
- **THEN** no metadata line is displayed on the message

#### Scenario: Cost formatting precision
- **WHEN** cost is displayed
- **THEN** cost SHALL be formatted to 4 decimal places (e.g., "$0.0042"), and token counts SHALL use locale-aware number formatting with commas (e.g., "1,204 tokens")

### Requirement: Display session cost totals
The system SHALL display aggregate cost totals for the active session. The total is computed by summing `cost_usd` across all assistant messages in the session that have cost metadata.

#### Scenario: Session with multiple assistant messages
- **WHEN** a session has 3 assistant messages with costs $0.01, $0.02, and $0.03
- **THEN** the session cost total displays "$0.06"

#### Scenario: Session with no cost data
- **WHEN** a session has no assistant messages with cost metadata
- **THEN** no session cost total is displayed (the cost area is hidden, not shown as "$0.00")

#### Scenario: Session cost total location
- **WHEN** the active session has cost data
- **THEN** the session cost total SHALL be displayed in the sidebar footer area (near the model name) or in the session header, visible without scrolling

#### Scenario: Session total includes only the active session
- **WHEN** the user switches between sessions
- **THEN** the session cost total updates to reflect only the newly active session's messages

### Requirement: Session total token count
The system SHALL display the total output tokens for the active session alongside the cost total, computed by summing `output_tokens` across all assistant messages.

#### Scenario: Session token total
- **WHEN** a session has assistant messages with 500, 1200, and 800 output tokens
- **THEN** the session total displays "2,500 tokens"

### Requirement: Cost metadata captured from SDK responses
The system SHALL capture `cost_usd`, `output_tokens`, and `duration_ms` from the SDK `result` event and persist them on the assistant message's `meta` field in the stored session.

#### Scenario: SDK result event contains cost data
- **WHEN** the SDK emits a `result` event with `total_cost_usd: 0.05`, `usage.output_tokens: 2000`, and `duration_ms: 4500`
- **THEN** the assistant message is persisted with `meta: { cost_usd: 0.05, output_tokens: 2000, duration_ms: 4500 }`

#### Scenario: SDK result event with missing cost fields
- **WHEN** the SDK emits a `result` event without `total_cost_usd`
- **THEN** the assistant message's `meta.cost_usd` is undefined; other available fields are still captured

### Requirement: Real-time cost update during streaming
The system SHALL update the session cost total after each query completes (when the `result` event arrives), without requiring a page reload.

#### Scenario: Cost updates after query finishes
- **WHEN** a query finishes streaming and the `result` event arrives with cost metadata
- **THEN** the session cost total in the sidebar/header updates immediately to include the new message's cost
