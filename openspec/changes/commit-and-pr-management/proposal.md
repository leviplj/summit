## Why

After Claude makes changes in a session's worktree, users need a way to commit those changes and merge them back to the source branch without leaving Summit. Currently there's no way to persist or share the work done in a session beyond the worktree itself.

## What Changes

- The changed files panel shows the **full session diff** (all changes since the worktree branched, both committed and uncommitted) instead of just uncommitted changes
- Add **staging, committing, and merging** inline in the changed files panel — stage/unstage files, write a commit message, and commit
- Add a **merge to source branch** button that merges the session branch back into the branch it was created from
- Add **AI-generated commit messages** using the Claude SDK to analyze the staged diff and produce a concise message
- No external dependencies (no `gh` CLI, no GitHub API) — merge is a local git operation

## Capabilities

### New Capabilities
- `git-commit`: Stage/unstage files and create commits in the session worktree. Includes server endpoints for `git add`, `git reset`, `git commit` and inline UI for staging and commit message entry.
- `merge-to-source`: Merge the session branch into the source branch. Detects the default branch, resolves the main repo root from the worktree, and runs `git merge`.
- `generate-commit-message`: Auto-generate a commit message from the staged diff using Claude Haiku via the Agent SDK.

### Modified Capabilities
- `session-changes`: The changed files panel now shows the full session diff (merge-base to working tree) instead of just uncommitted changes. Files persist after commits. Uncommitted files are annotated with an indicator. The diff endpoint also diffs against merge-base.

## Impact

- **Server**: New `git.ts` server util, new API routes under `/api/sessions/[id]/git/`, updated `changes.get.ts` and `diff.get.ts` to diff against merge-base
- **Frontend**: Updated `ChangedFiles.vue` with staging checkboxes, commit section, merge button, and generate-message button
- **Dependencies**: Uses `@anthropic-ai/claude-agent-sdk` (already installed) for commit message generation
