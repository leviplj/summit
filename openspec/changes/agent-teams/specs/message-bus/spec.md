## ADDED Requirements

### Requirement: Teammates can send messages to each other
The system SHALL provide a `send_message` MCP tool that delivers a message to another teammate's mailbox. The message SHALL include the sender ID, recipient ID, content string, and timestamp. If the recipient is currently blocked on `check_mailbox`, the message SHALL be delivered immediately by resolving the recipient's pending Promise.

#### Scenario: Send message to waiting teammate
- **WHEN** Backend teammate calls `send_message(to: "frontend", content: "GET /api/users returns {id, name, email}")`
- **AND** Frontend teammate is blocked on `check_mailbox`
- **THEN** Frontend's `check_mailbox` resolves immediately with the message

#### Scenario: Send message to busy teammate
- **WHEN** Backend teammate calls `send_message(to: "frontend", content: "endpoints ready")`
- **AND** Frontend teammate is NOT currently waiting on `check_mailbox`
- **THEN** the message SHALL be queued in Frontend's mailbox for later retrieval

### Requirement: Teammates can wait for messages
The system SHALL provide a `check_mailbox` MCP tool that blocks until a message arrives. If messages are already queued in the mailbox, it SHALL return the oldest message immediately (FIFO order). The tool SHALL accept an optional `from` parameter to filter messages by sender.

#### Scenario: Check mailbox with queued messages
- **WHEN** Frontend teammate calls `check_mailbox()`
- **AND** there are 2 messages in the queue
- **THEN** the oldest message SHALL be returned and removed from the queue

#### Scenario: Check mailbox with no messages
- **WHEN** Frontend teammate calls `check_mailbox()`
- **AND** the mailbox is empty
- **THEN** the tool SHALL block until a message is delivered

#### Scenario: Check mailbox filtered by sender
- **WHEN** Frontend teammate calls `check_mailbox(from: "backend")`
- **AND** there are messages from "qa" and "backend" in the queue
- **THEN** only the oldest message from "backend" SHALL be returned

### Requirement: Orchestrator can broadcast messages
The system SHALL provide a `broadcast` MCP tool to the orchestrator that sends a message to all active teammates simultaneously.

#### Scenario: Broadcast scope change
- **WHEN** Orchestrator calls `broadcast(content: "Scope changed: drop admin panel")`
- **AND** there are 3 active teammates
- **THEN** all 3 teammates SHALL receive the message in their mailboxes

### Requirement: Circular dependency detection prevents deadlocks
The system SHALL maintain a directed dependency graph tracking which teammates are waiting for which other teammates. Before a `check_mailbox` call blocks, the system SHALL check if adding the wait edge would create a cycle. If a cycle would be created, the tool SHALL return an error with the full cycle path and guidance to send results first.

#### Scenario: Simple circular dependency
- **WHEN** Frontend is waiting for Backend (Frontend → Backend edge exists)
- **AND** Backend calls `check_mailbox(from: "frontend")`
- **THEN** the tool SHALL return an error: "Circular dependency detected: backend → frontend → backend. Send your results to frontend first, then wait."

#### Scenario: Transitive circular dependency
- **WHEN** A waits for B, and B waits for C
- **AND** C calls `check_mailbox(from: "a")`
- **THEN** the tool SHALL return an error: "Circular dependency detected: c → a → b → c. Send your results to a first, then wait."

#### Scenario: Non-circular dependency allowed
- **WHEN** Frontend waits for Backend
- **AND** QA calls `check_mailbox(from: "backend")`
- **THEN** the tool SHALL block normally (no cycle exists)

### Requirement: Wait edges are cleaned up after message delivery
The system SHALL remove the wait edge from the dependency graph when a `check_mailbox` call resolves (either by immediate return or by message delivery).

#### Scenario: Edge removed after receive
- **WHEN** Frontend is blocked on `check_mailbox(from: "backend")` (edge: frontend → backend)
- **AND** Backend sends a message to Frontend
- **THEN** the frontend → backend edge SHALL be removed from the dependency graph

### Requirement: Message bus is scoped per team
Each team invocation SHALL have its own isolated message bus instance. Messages from one team SHALL NOT leak to another team.

#### Scenario: Isolated message buses
- **WHEN** two teams are running concurrently in different sessions
- **AND** teammate "backend" in team 1 sends a message
- **THEN** only teammates in team 1 SHALL receive it
