## 1. Data Model & Types

- [ ] 1.1 Add `agentsPath: string | null` field to the `Project` interface in `shared/types.ts`
- [ ] 1.2 Add `AgentFile` interface to `shared/types.ts` with fields: `filename`, `name`, `parent`, `model`, `repos`, `instructions`

## 2. Agent File Parser

- [ ] 2.1 Create `frontend/server/utils/agents.ts` with functions to parse markdown+frontmatter into `AgentFile` objects and serialize back to markdown
- [ ] 2.2 Add `readAgents(dirPath)` function that reads all `.md` files from a directory and returns parsed agent definitions
- [ ] 2.3 Add `buildAgentTree(agents)` function that reconstructs hierarchy from flat agents using `parent` references, detecting cycles and orphans
- [ ] 2.4 Add `writeAgent(dirPath, agent)` and `deleteAgent(dirPath, filename)` functions for file CRUD
- [ ] 2.5 Add `toSdkAgents(tree, projectRepos)` function that translates the agent tree into the SDK's nested `agents: Record<string, AgentDefinition>` format

## 3. API Routes

- [ ] 3.1 Add `GET /api/projects/:id/agents` endpoint that reads agents from the project's `agentsPath` and returns the parsed tree
- [ ] 3.2 Add `POST /api/projects/:id/agents` endpoint to create a new agent file
- [ ] 3.3 Add `PUT /api/projects/:id/agents/:filename` endpoint to update an agent file
- [ ] 3.4 Add `DELETE /api/projects/:id/agents/:filename` endpoint to delete an agent file (updating children to become roots)
- [ ] 3.5 Update project create/update API routes to accept and persist `agentsPath`

## 4. Query Integration

- [ ] 4.1 Modify `runQuery` in `queries.ts` to read agent definitions when the session's project has an `agentsPath`
- [ ] 4.2 Pass the root agent's instructions as `systemPrompt.append` and descendants as the `agents` option to `query()`
- [ ] 4.3 Append repo scope information to each agent's prompt based on its `repos` field

## 5. ProjectConfigDialog — Tabbed Layout

- [ ] 5.1 Refactor `ProjectConfigDialog.vue` to use a tab bar with "General" and "Agents" tabs
- [ ] 5.2 Move existing project name and repositories form into the General tab content
- [ ] 5.3 Widen the dialog when the Agents tab is active to accommodate the split layout

## 6. Agents Tab UI

- [ ] 6.1 Add agents directory path input at the top of the Agents tab
- [ ] 6.2 Build the agent tree component (left panel) showing hierarchy with indentation and root marker
- [ ] 6.3 Build the agent editor component (right panel) with name, parent dropdown, model dropdown, repos checkboxes, and instructions textarea
- [ ] 6.4 Wire tree selection to editor — clicking an agent loads it into the editor
- [ ] 6.5 Add "Add Agent" button below tree that opens editor with empty/default fields
- [ ] 6.6 Wire Save button to POST/PUT API and refresh tree on success
- [ ] 6.7 Wire Delete button to DELETE API with confirmation, refresh tree on success
- [ ] 6.8 Add empty state for when no agents directory is configured or directory is empty
