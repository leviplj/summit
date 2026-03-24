import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);

export interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
}

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
    // Get changed files with status relative to the parent commit (where the worktree branched)
    const { stdout: nameStatus } = await exec(
      "git",
      ["diff", "--name-status", "HEAD~0...HEAD", "--diff-filter=ADMR"],
      { cwd: session.worktreePath },
    ).catch(() => ({ stdout: "" }));

    // Also get uncommitted changes (staged + unstaged)
    const { stdout: workingStatus } = await exec(
      "git",
      ["status", "--porcelain"],
      { cwd: session.worktreePath },
    );

    // Get numstat for additions/deletions
    const { stdout: numstat } = await exec(
      "git",
      ["diff", "HEAD", "--numstat"],
      { cwd: session.worktreePath },
    ).catch(() => ({ stdout: "" }));

    const statMap = new Map<string, { additions: number; deletions: number }>();
    for (const line of numstat.trim().split("\n")) {
      if (!line) continue;
      const [add, del, path] = line.split("\t");
      statMap.set(path, {
        additions: add === "-" ? 0 : parseInt(add, 10),
        deletions: del === "-" ? 0 : parseInt(del, 10),
      });
    }

    const files = new Map<string, FileChange>();

    // Parse working tree changes (uncommitted)
    for (const line of workingStatus.trimEnd().split("\n")) {
      if (!line) continue;
      const xy = line.slice(0, 2);
      const path = line.slice(3);
      let status: FileChange["status"] = "modified";
      if (xy.includes("A") || xy.includes("?")) status = "added";
      else if (xy.includes("D")) status = "deleted";
      else if (xy.includes("R")) status = "renamed";

      const stat = statMap.get(path) || { additions: 0, deletions: 0 };
      files.set(path, { path, status, ...stat });
    }

    return { files: Array.from(files.values()) };
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err.message });
  }
});
