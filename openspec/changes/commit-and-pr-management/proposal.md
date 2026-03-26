## Why

After Claude makes changes in a session's worktree, users need a way to commit those changes and create pull requests without leaving Summit. Currently there's no way to persist or share the work done in a session beyond the worktree itself.

## What Changes

- Add a **commit panel** in the UI that shows staged/unstaged changes with the ability to stage files, write a commit message, and commit
- Add a **PR creation flow** that pushes the session branch to the remote and creates a GitHub pull request via the GitHub API or `gh` CLI
- Add server-side endpoints for git operations: stage, unstage, commit, push, and PR creation
- Show commit history for the session's branch in the changed files panel

## Capabilities

### New Capabilities
- `git-commit`: Stage/unstage files and create commits in the session worktree. Includes server endpoints for `git add`, `git reset`, `git commit` operations and UI for commit message entry.
- `pull-request-creation`: Push the session branch to origin and create a pull request. Includes branch push, PR title/body form, and integration with GitHub API.

### Modified Capabilities

_None — no existing specs to modify._

## Impact

- **Server**: New API routes for git stage/unstage/commit/push/PR operations, new `git.ts` server util
- **Frontend**: Commit panel component, PR creation dialog, updates to changed files panel to show staging state
- **Dependencies**: May need `gh` CLI or GitHub API token configuration
