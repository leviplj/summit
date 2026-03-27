## 1. Simplify project store

- [ ] 1.1 Remove `activeProjectId`, `activeProject`, `setActiveProject`, and related localStorage logic from `useProjectStore.ts`
- [ ] 1.2 Update any references to `activeProjectId` / `activeProject` in `index.vue` and other consumers

## 2. Create ProjectFolder component

- [ ] 2.1 Create `ProjectFolder.vue` with collapsible header row (arrow, folder icon, project name, gear icon) and slotted session list
- [ ] 2.2 Implement distinct click zones: name text → emit `new-chat`, arrow/icon → toggle expand/collapse, gear → emit `edit`
- [ ] 2.3 Add attention badge indicator (cyan dot) for projects with sessions needing input

## 3. Refactor sidebar in index.vue

- [ ] 3.1 Remove `ProjectSwitcher` usage and import from `index.vue`
- [ ] 3.2 Add session grouping computed: `Record<string, ClientSession[]>` grouped by `projectId`, excluding `null`
- [ ] 3.3 Add expand/collapse state as `Record<string, boolean>` with localStorage persistence (`summit:expandedProjects`)
- [ ] 3.4 Render project folders with `ProjectFolder` component, passing grouped sessions and expand state
- [ ] 3.5 Add "+ New project..." button at the bottom of the folder list

## 4. Project picker on + button

- [ ] 4.1 Replace the current "New chat" `+` button with a popover that lists projects
- [ ] 4.2 Skip picker and create directly when only one project exists
- [ ] 4.3 Wire selection to create a new empty session with the chosen `projectId`

## 5. Search integration

- [ ] 5.1 Make search filter sessions across all projects
- [ ] 5.2 Auto-expand folders containing matching sessions during search
- [ ] 5.3 Restore previous expand/collapse state when search is cleared

## 6. Cleanup

- [ ] 6.1 Delete `ProjectSwitcher.vue`
- [ ] 6.2 Remove `projectFilteredSessions` computed and any remaining `activeProjectId` references
