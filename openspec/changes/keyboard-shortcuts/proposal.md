## Why

Power users need keyboard shortcuts for common actions to maintain flow. Currently all interactions require mouse clicks — creating new sessions, switching between sessions, toggling panels, and focusing the input all lack keyboard shortcuts.

## What Changes

- Add global keyboard shortcuts for common actions:
  - `Cmd/Ctrl+N`: New session
  - `Cmd/Ctrl+[/]`: Navigate between sessions
  - `Cmd/Ctrl+Shift+E`: Toggle changed files panel
  - `Cmd/Ctrl+B`: Toggle sidebar
  - `/` or `Cmd/Ctrl+L`: Focus chat input
  - `Escape`: Close panels/dialogs
- Add a keyboard shortcut help overlay (accessible via `?` or `Cmd/Ctrl+/`)

## Capabilities

### New Capabilities
- `keyboard-shortcuts`: Global keyboard shortcut system with common actions (new session, navigate sessions, toggle panels, focus input) and a help overlay showing all available shortcuts.

### Modified Capabilities

_None — no existing specs to modify._

## Impact

- **Frontend**: New keyboard event handler composable, shortcut help dialog component, updates to `index.vue` for shortcut bindings
