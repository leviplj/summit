## Context

The sidebar currently uses a `ProjectSwitcher` combobox to select one project at a time, filtering the session list to that project's sessions. The `activeProjectId` in the project store controls which project is selected and persists to localStorage.

The sidebar lives in `index.vue` as an `<aside>` element. Sessions are listed as a flat list filtered by the active project. The `ProjectSwitcher.vue` component renders a dropdown with project options, an "All Sessions" option, and a "New project" button.

## Goals / Non-Goals

**Goals:**
- Replace the combobox with always-visible collapsible project folders
- Allow multiple folders to be expanded simultaneously
- Provide two ways to create a new chat: clicking a project name, or using the `+` button with a project picker
- Hide sessions without a project association

**Non-Goals:**
- Drag-and-drop to reorder projects or move sessions between projects
- Knowledge sharing across sessions/projects
- Nested sub-groups within projects
- Migrating existing ungrouped sessions

## Decisions

### 1. Component structure: single `ProjectFolder` component

Replace `ProjectSwitcher.vue` with a `ProjectFolder.vue` component that renders a single project's collapsible header row plus its session list.

The parent (`index.vue`) iterates over projects and renders one `ProjectFolder` per project. This keeps each folder self-contained while the parent owns the overall layout and shared state (search, session selection).

**Alternative considered:** Putting all folder logic inline in `index.vue` — rejected because it would bloat an already large page component.

### 2. Expand/collapse state: reactive map in `index.vue`

Store expand/collapse state as a `Record<string, boolean>` (projectId → expanded) in the page component. Default to all expanded. Persist to localStorage under `summit:expandedProjects`.

**Alternative considered:** Per-component local state — rejected because search needs to auto-expand folders with matches, which requires the parent to control expand state.

### 3. Project picker on `+` button: inline popover

When `+` is clicked, show a small popover/dropdown listing all projects. Clicking one creates a new empty chat in that project. If only one project exists, skip the picker and create directly.

Reuse the same popover pattern already used by `ProjectSwitcher` (click-outside to dismiss).

### 4. Click zones on folder header

The folder header row has three distinct click zones:
- **Project name text**: creates a new empty chat in that project
- **Arrow/folder icon area**: toggles expand/collapse
- **Gear icon**: opens project settings dialog

These are separate clickable elements within the row, each with its own event handler. The name text gets `cursor-pointer` and a subtle hover state to indicate it's interactive.

### 5. Session grouping: computed in the page component

Group sessions by `projectId` using a computed property in `index.vue`:

```
Record<string, ClientSession[]>  // projectId → sessions
```

Filter out sessions with `projectId: null` (they won't appear).

### 6. Search behavior: filter across all projects, auto-expand matches

When searching, filter sessions across all projects. Auto-expand any folder that contains matching sessions. When the search is cleared, restore the previous expand/collapse state.

Store a "pre-search" snapshot of expand state when search begins, restore it when search is cleared.

## Risks / Trade-offs

- **Many projects = long sidebar**: If a user has many projects, the sidebar could become crowded with all folders visible. Mitigated by collapse — users can collapse projects they're not actively using. Not a concern for the current expected usage.
- **Click zone confusion**: Three different click targets on one row could be confusing. Mitigated by clear hover states and cursor changes on each zone.
- **Orphaned sessions hidden**: Sessions with `projectId: null` silently disappear from the UI. Acceptable since the user explicitly chose to ignore them.
