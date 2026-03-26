## ADDED Requirements

### Requirement: Register global keyboard shortcuts
The system SHALL register global keyboard event listeners that respond to shortcut key combinations regardless of which element has focus, except when the user is typing in a text input, textarea, or contenteditable element.

#### Scenario: Shortcut ignored while typing in chat input
- **WHEN** the user presses `/` while the chat textarea is focused
- **THEN** the character is inserted into the textarea and no shortcut action fires

#### Scenario: Shortcut fires when no input is focused
- **WHEN** the user presses `/` while no text input element is focused
- **THEN** the chat input is focused

### Requirement: Create new session shortcut
The system SHALL create a new session when the user presses `Cmd+N` (macOS) or `Ctrl+N` (other platforms).

#### Scenario: New session via keyboard
- **WHEN** the user presses `Cmd+N` or `Ctrl+N`
- **THEN** a new session is created and becomes active, identical to clicking the "New chat" button

### Requirement: Navigate between sessions
The system SHALL navigate to the previous session when the user presses `Cmd+[` (macOS) or `Ctrl+[` (other platforms), and to the next session when the user presses `Cmd+]` or `Ctrl+]`.

#### Scenario: Navigate to previous session
- **WHEN** the user presses `Cmd+[` or `Ctrl+[` and the active session is not the first in the list
- **THEN** the previous session in the sidebar list becomes active

#### Scenario: Navigate to next session
- **WHEN** the user presses `Cmd+]` or `Ctrl+]` and the active session is not the last in the list
- **THEN** the next session in the sidebar list becomes active

#### Scenario: No-op at list boundary
- **WHEN** the user presses `Cmd+[` or `Ctrl+[` and the active session is already the first in the list
- **THEN** nothing happens (no wrap-around)

### Requirement: Toggle changed files panel shortcut
The system SHALL toggle the changed files panel when the user presses `Cmd+Shift+E` (macOS) or `Ctrl+Shift+E` (other platforms).

#### Scenario: Open changed files panel via keyboard
- **WHEN** the user presses `Cmd+Shift+E` or `Ctrl+Shift+E` and the panel is closed
- **THEN** the changed files panel opens and refreshes its file list

#### Scenario: Close changed files panel via keyboard
- **WHEN** the user presses `Cmd+Shift+E` or `Ctrl+Shift+E` and the panel is open
- **THEN** the changed files panel closes

### Requirement: Toggle sidebar shortcut
The system SHALL toggle the sidebar when the user presses `Cmd+B` (macOS) or `Ctrl+B` (other platforms).

#### Scenario: Toggle sidebar via keyboard
- **WHEN** the user presses `Cmd+B` or `Ctrl+B`
- **THEN** the sidebar visibility toggles (open becomes closed, closed becomes open)

### Requirement: Focus chat input shortcut
The system SHALL focus the chat input textarea when the user presses `/` (without modifier, only when no text input is focused) or `Cmd+L` / `Ctrl+L`.

#### Scenario: Focus input with slash
- **WHEN** the user presses `/` and no text input, textarea, or contenteditable element is focused
- **THEN** the chat textarea receives focus without inserting the `/` character

#### Scenario: Focus input with Cmd+L
- **WHEN** the user presses `Cmd+L` or `Ctrl+L`
- **THEN** the chat textarea receives focus

### Requirement: Close panels with Escape
The system SHALL close open panels and overlays when the user presses `Escape`. If multiple closeable elements are open, they close in order: help overlay first, then changed files panel, then sidebar.

#### Scenario: Close help overlay with Escape
- **WHEN** the user presses `Escape` and the keyboard shortcut help overlay is open
- **THEN** the help overlay closes

#### Scenario: Close changed files panel with Escape
- **WHEN** the user presses `Escape` and the help overlay is not open but the changed files panel is open
- **THEN** the changed files panel closes

#### Scenario: Nothing to close
- **WHEN** the user presses `Escape` and no panels or overlays are open
- **THEN** nothing happens

### Requirement: Keyboard shortcut help overlay
The system SHALL display a help overlay listing all available keyboard shortcuts when the user presses `?` (without modifier, only when no text input is focused) or `Cmd+/` / `Ctrl+/`. The overlay SHALL close on `Escape` or by pressing the trigger shortcut again.

#### Scenario: Open help overlay
- **WHEN** the user presses `?` and no text input is focused
- **THEN** a modal overlay appears listing all shortcuts grouped by category (Navigation, Panels, General)

#### Scenario: Toggle help overlay off
- **WHEN** the user presses `?` or `Cmd+/` / `Ctrl+/` and the help overlay is already open
- **THEN** the help overlay closes

#### Scenario: Help overlay content
- **WHEN** the help overlay is displayed
- **THEN** it shows all registered shortcuts with their key combinations and descriptions, with platform-appropriate modifier labels (showing "Cmd" on macOS, "Ctrl" on other platforms)

### Requirement: Prevent default browser behavior
The system SHALL call `preventDefault()` on keyboard events that match registered shortcuts to prevent conflicting browser default actions (e.g., `Cmd+N` opening a new browser window, `Cmd+L` focusing the browser address bar).

#### Scenario: Cmd+N does not open new browser window
- **WHEN** the user presses `Cmd+N` or `Ctrl+N`
- **THEN** the browser's default "new window" action is suppressed and a new Summit session is created instead
