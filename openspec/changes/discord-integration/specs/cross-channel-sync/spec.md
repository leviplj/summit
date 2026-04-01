## ADDED Requirements

### Requirement: Desktop interactions are noted in Discord threads
When a query is started from the web UI on a session that has Discord metadata, the bot SHALL post a notification to the Discord thread so watchers know the session is being interacted with elsewhere.

#### Scenario: User continues session from desktop
- **WHEN** a session has Discord metadata (threadId)
- **AND** a query is started from the web UI with text "fix the edge case in token expiry"
- **THEN** the bot SHALL post a message like "Session continued from desktop." to the Discord thread

#### Scenario: Desktop query completes
- **WHEN** a desktop-initiated query on a Discord session completes with a result
- **THEN** the bot SHALL post a brief note to the Discord thread summarizing what happened (e.g., "Desktop: Done. Fixed expiry check in auth.ts.")

#### Scenario: No Discord metadata
- **WHEN** a query is started from the web UI on a session with no Discord metadata
- **THEN** no Discord notification SHALL be sent
