## Context

Summit is a single-page Nuxt 4 chat UI. The main page (`index.vue`) manages all interactive state locally with `ref()`: `sidebarOpen`, `changesOpen`, and the `input` textarea. Session management (create, select, delete, navigate) lives in the `useSessionStore` composable returned through `useChat`. There are no existing keyboard shortcuts beyond `Enter` to send a message (handled inline on the textarea's `@keydown`).

The codebase follows a composable-per-concern pattern: `useSessionStore` for session CRUD, `useChat` for messaging + streaming, `useTheme` for dark/light mode. Components are flat under `app/components/`.

## Goals / Non-Goals

**Goals:**
- All shortcuts from the proposal are wired up and functional
- Shortcuts do not fire when the user is typing in an input field (except modifier-key combos like Cmd+N which always fire)
- A help overlay shows all available shortcuts
- Browser defaults are suppressed for conflicting shortcuts

**Non-Goals:**
- User-customizable key bindings (future enhancement)
- Vim-style modal key bindings
- Shortcut recording/macro system
- Per-session or per-context shortcut overrides

## Decisions

### 1. New `useKeyboardShortcuts` composable for shortcut registration and dispatch

A single composable owns the global `keydown` listener (attached to `document` via `onMounted` / `onUnmounted`). It accepts a map of shortcut definitions and the reactive refs it needs to mutate (`sidebarOpen`, `changesOpen`, etc.). The composable returns a `helpOpen` ref for the overlay.

**Why a composable, not a directive or plugin:**
- Consistent with the existing pattern (`useTheme`, `useSessionStore`, `useChat`)
- Composable has direct access to the reactive state it needs to toggle
- A directive would require per-element binding which doesn't fit global shortcuts
- A Nuxt plugin would work but adds indirection; a composable called from `index.vue` is simpler and more explicit

**Alternatives considered:**
- VueUse `useMagicKeys`: Adds a dependency for something that's ~40 lines of code. Not worth it for a small, well-scoped feature.
- Inline `@keydown` on `<div class="flex h-screen">`: Would work but mixes shortcut logic into the template. A composable keeps it separated.

### 2. Shortcut definitions as a static array, not a registry

Shortcuts are defined as a plain array of objects: `{ key, modifiers, description, category, action }`. There's no dynamic registration API. The array is defined inside the composable.

**Why static:**
- The set of shortcuts is fixed and known at compile time
- No components need to register their own shortcuts
- The same array drives both event dispatch and the help overlay content
- Simpler than a pub/sub registry

**Alternatives considered:**
- Dynamic registry with `registerShortcut()` / `unregisterShortcut()`: Over-engineered for a fixed set of 7-8 shortcuts. Could be added later if components need to register contextual shortcuts.

### 3. Input-focus guard: skip unmodified key shortcuts when a text element is focused

For single-key shortcuts (`/`, `?`, `Escape`), the handler checks if the active element is a `<input>`, `<textarea>`, or has `contenteditable`. If so, the shortcut is skipped (the character goes to the input normally). Modifier-key shortcuts (`Cmd+N`, `Cmd+B`, etc.) always fire regardless of focus, since those key combos are not used for text input.

**Implementation:** Each shortcut definition has a `requiresNoFocus` boolean. If true, the handler skips it when a text element is focused. Modifier shortcuts have `requiresNoFocus: false`.

**Alternatives considered:**
- Always check focus for all shortcuts: Would prevent `Cmd+N` from working when the chat input is focused, which is a bad UX.
- Use `e.target` instead of `document.activeElement`: Both work, but `activeElement` is more reliable for detecting focus state at the time of the event.

### 4. Escape key closes in priority order using a layered check

The Escape handler checks closeable elements in order: (1) help overlay, (2) changed files panel, (3) sidebar. It closes only the first one found open. This avoids closing everything at once and gives the user incremental control.

**Implementation:** The `Escape` action is a single function that checks `helpOpen`, then `changesOpen`, then `sidebarOpen`, returning after the first toggle. This is not a stack — it's a fixed priority order.

**Alternatives considered:**
- A stack-based close queue: Over-engineered. There are only 3 closeable surfaces with a clear priority order.
- Close all at once: Poor UX — user expects Escape to dismiss one thing at a time.

### 5. Help overlay as a new `KeyboardShortcutsHelp.vue` component

A modal overlay component that receives the shortcut definitions array as a prop and renders them grouped by category. Uses a semi-transparent backdrop. Closed via Escape or clicking the backdrop.

**Why a separate component:**
- Keeps `index.vue` clean (it just renders `<KeyboardShortcutsHelp v-if="helpOpen" />`)
- The component is purely presentational — it receives data and emits a close event
- Consistent with existing component pattern (e.g., `ChangedFiles.vue`, `ElicitationForm.vue`)

**Styling:** Follows the existing design system: `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground` for categories. No new design tokens needed.

### 6. Platform detection for modifier key labels

The composable detects macOS via `navigator.platform` (or `navigator.userAgentData.platform` where available) and uses "Cmd" on macOS, "Ctrl" elsewhere. This affects both event matching (checking `e.metaKey` vs `e.ctrlKey`) and display labels in the help overlay.

**Implementation:** A simple `isMac` boolean computed once on mount. The shortcut definitions reference a generic `mod` modifier, and the handler checks `e.metaKey` on Mac, `e.ctrlKey` elsewhere.

**Alternatives considered:**
- Show both "Cmd/Ctrl" in the help overlay: Cluttered. Users know their platform.
- Only support Cmd on Mac and ignore Ctrl: Would break for Mac users who habitually use Ctrl.

## Risks / Trade-offs

- **Browser shortcut conflicts**: `Cmd+N` (new window), `Cmd+L` (address bar), `Cmd+B` (bold in some contexts), and `Cmd+[`/`]` (back/forward) are all browser defaults. Calling `preventDefault()` suppresses them, which may surprise users who expect browser behavior. This is acceptable because Summit is a full-screen app where these browser shortcuts are not useful.

- **Modifier key on Linux**: Linux uses Ctrl for these shortcuts, which may conflict with terminal emulator pass-through if Summit is embedded. Current scope is browser-only, so this is acceptable.

- **No persistence of panel state**: Shortcuts toggle refs that reset on page reload. This is consistent with current behavior (sidebar starts open, changes panel starts closed) and not a regression.

## Open Questions

- Should `Cmd+W` close the active session (matching browser tab-close semantics)? Omitted for now to avoid accidentally destroying sessions, but could be added later with a confirmation step.
