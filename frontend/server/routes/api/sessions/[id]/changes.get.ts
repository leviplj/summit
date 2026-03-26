import { execFile } from "child_process";
import { promisify } from "util";
import type { FileChange } from "~~/shared/types";

const exec = promisify(execFile);

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const session = await getStoredSession(id);
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: "Session not found" });
  }
  if (!session.worktreePath) {
    return { files: [] };
  }

  try {
    // Find the merge-base (where this worktree branched from)
    let mergeBase: string;
    let sourceBranch: string;
    try {
      mergeBase = await getMergeBase(session.worktreePath);
      sourceBranch = await getDefaultBranch(session.worktreePath);
    } catch {
      mergeBase = "HEAD";
      sourceBranch = "main";
    }

    // Full session diff: merge-base to working tree (committed + uncommitted)
    const { stdout: sessionNameStatus } = await exec(
      "git",
      ["diff", "--name-status", mergeBase],
      { cwd: session.worktreePath },
    ).catch(() => ({ stdout: "" }));

    const { stdout: sessionNumstat } = await exec(
      "git",
      ["diff", "--numstat", mergeBase],
      { cwd: session.worktreePath },
    ).catch(() => ({ stdout: "" }));

    // Uncommitted changes (to annotate which files need staging/committing)
    const { stdout: workingStatus } = await exec(
      "git",
      ["status", "--porcelain"],
      { cwd: session.worktreePath },
    ).catch(() => ({ stdout: "" }));

    // Parse numstat
    const statMap = new Map<string, { additions: number; deletions: number }>();
    for (const line of sessionNumstat.trim().split("\n")) {
      if (!line) continue;
      const parts = line.split("\t");
      if (parts.length < 3) continue;
      const [add, del, path] = parts;
      statMap.set(path, {
        additions: add === "-" ? 0 : parseInt(add, 10),
        deletions: del === "-" ? 0 : parseInt(del, 10),
      });
    }

    // Parse uncommitted files and their staging state
    const uncommittedMap = new Map<string, { staged: boolean }>();
    for (const line of workingStatus.trimEnd().split("\n")) {
      if (!line) continue;
      const indexStatus = line[0];
      const wtStatus = line[1];
      const path = line.slice(3);

      // If index has changes, the file is staged
      const isStaged = indexStatus !== " " && indexStatus !== "?";
      // If working tree has changes, there are unstaged modifications
      const hasUnstaged = wtStatus !== " " && wtStatus !== undefined;

      if (isStaged && !hasUnstaged) {
        uncommittedMap.set(path, { staged: true });
      } else if (isStaged && hasUnstaged) {
        // Partially staged — show as unstaged so user knows there's more to stage
        uncommittedMap.set(path, { staged: false });
      } else {
        uncommittedMap.set(path, { staged: false });
      }
    }

    // Build file list from full session diff
    const files: FileChange[] = [];
    for (const line of sessionNameStatus.trim().split("\n")) {
      if (!line) continue;
      const parts = line.split("\t");
      if (parts.length < 2) continue;
      const statusCode = parts[0];
      const path = parts[parts.length - 1]; // handles renames (R100\told\tnew)

      let status: FileChange["status"] = "modified";
      if (statusCode === "A") status = "added";
      else if (statusCode === "D") status = "deleted";
      else if (statusCode.startsWith("R")) status = "renamed";

      const stat = statMap.get(path) || { additions: 0, deletions: 0 };
      const uc = uncommittedMap.get(path);

      files.push({
        path,
        status,
        additions: stat.additions,
        deletions: stat.deletions,
        uncommitted: !!uc,
        staged: uc?.staged ?? false,
      });
    }

    // Also include untracked files (they appear in porcelain but not in diff against merge-base)
    for (const line of workingStatus.trimEnd().split("\n")) {
      if (!line) continue;
      if (line[0] !== "?" || line[1] !== "?") continue;
      const path = line.slice(3);
      if (files.some((f) => f.path === path)) continue;
      files.push({
        path,
        status: "added",
        additions: 0,
        deletions: 0,
        uncommitted: true,
        staged: false,
      });
    }

    return { files, sourceBranch };
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err.message });
  }
});
