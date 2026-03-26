## 1. Keyboard Shortcuts Composable

- [ ] 1.1 Create `frontend/app/composables/useKeyboardShortcuts.ts` with platform detection (`isMac` boolean from `navigator.platform`), a shortcut definition array type (`{ key: string, modifiers: string[], description: string, category: string, requiresNoFocus: boolean, action: () => void }`), and the `useKeyboardShortcuts` function signature accepting reactive refs for `sidebarOpen`, `changesOpen`, and callback functions for `newSession`, `selectPrevSession`, `selectNextSession`, `focusInput`
- [ ] 1.2 Implement the global `keydown` event listener in `onMounted` / `onUnmounted` that iterates the shortcut definitions, matches `e.key` + modifier state (`e.metaKey` on Mac, `e.ctrlKey` elsewhere), checks the `requiresNoFocus` guard against `document.activeElement`, calls `e.preventDefault()` on match, and invokes the action
- [ ] 1.3 Define all shortcut entries: `Cmd/Ctrl+N` (new session), `Cmd/Ctrl+[` (previous session), `Cmd/Ctrl+]` (next session), `Cmd/Ctrl+Shift+E` (toggle changes panel), `Cmd/Ctrl+B` (toggle sidebar), `/` (focus input, requiresNoFocus), `Cmd/Ctrl+L` (focus input), `Escape` (close panels in priority order), `?` (toggle help overlay, requiresNoFocus), `Cmd/Ctrl+/` (toggle help overlay)
- [ ] 1.4 Return `helpOpen` ref and `shortcuts` array (for the help overlay to render) from the composable

## 2. Session Navigation Helpers

- [ ] 2.1 Add `selectPrevSession` and `selectNextSession` functions to `useSessionStore.ts` that find the current session index and call `selectSession` with the adjacent session ID, no-op at list boundaries

## 3. Help Overlay Component

- [ ] 3.1 Create `frontend/app/components/KeyboardShortcutsHelp.vue` that accepts a `shortcuts` prop (array of shortcut definitions) and emits a `close` event
- [ ] 3.2 Render a modal with semi-transparent backdrop (`bg-black/50`), centered card (`bg-card border-border`), title "Keyboard Shortcuts", and a close button
- [ ] 3.3 Group shortcuts by `category` and render each group with a category header (`text-muted-foreground`) and a list of rows showing the key combination (using `<kbd>` styled elements with platform-appropriate modifier label) and the description
- [ ] 3.4 Close the overlay on backdrop click and on `Escape` (handled by the composable's Escape priority logic)

## 4. Wire Into Main Page

- [ ] 4.1 In `index.vue`, import and call `useKeyboardShortcuts`, passing `sidebarOpen`, `changesOpen`, `changedFilesRef`, `newSession`, `selectPrevSession`, `selectNextSession`, and a `focusInput` callback that focuses the chat textarea
- [ ] 4.2 Add a template ref on the chat textarea so `focusInput` can call `.focus()` on it
- [ ] 4.3 Render `<KeyboardShortcutsHelp>` conditionally with `v-if="helpOpen"` and wire `@close="helpOpen = false"`
- [ ] 4.4 Ensure the changed files panel refreshes on open (call `changedFilesRef?.refresh()` when `changesOpen` toggles to true via shortcut), matching the existing click behavior
