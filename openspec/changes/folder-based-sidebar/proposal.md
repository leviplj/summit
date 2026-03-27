## Why

The current combobox project selector only shows one project at a time, requiring users to switch between projects to see their sessions. This makes multi-project workflows cumbersome — users can't see the state of all their projects at a glance. A folder-based sidebar shows all projects simultaneously with expand/collapse, matching the mental model of project folders containing session files.

## What Changes

- **Remove** the `ProjectSwitcher` combobox dropdown component
- **Remove** the `activeProjectId` concept from the project store (no longer needed — all projects are always visible)
- **Remove** the "All Sessions" view option
- **Add** collapsible project folder headers in the sidebar, each showing its sessions when expanded
- **Add** a project picker on the top `+` button (lists projects, creates empty chat in chosen one)
- **Modify** session creation: clicking a project folder name creates a new empty chat in that project; the `+` button offers a project picker as an alternative way to do the same
- **Modify** search to work across all projects (auto-expanding folders with matches)
- **Hide** sessions with `projectId: null` (they won't appear in the sidebar)

## Capabilities

### New Capabilities
- `folder-sidebar`: Collapsible project folders in the sidebar. Click zones: name → new chat in project, arrow/icon → toggle expand/collapse, gear → settings. Top `+` button opens a project picker. Multiple folders can be expanded simultaneously. Search works across all projects.

### Modified Capabilities

## Impact

- `frontend/app/components/ProjectSwitcher.vue` → deleted
- `frontend/app/components/ProjectFolder.vue` → new component
- `frontend/app/pages/index.vue` → sidebar refactored from flat list to grouped folders
- `frontend/app/composables/useProjectStore.ts` → `activeProjectId` removed
- `frontend/app/composables/useSessionStore.ts` → minor adjustments (grouping moves to component)
