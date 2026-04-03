import { execFile } from "child_process";
import { promisify } from "util";
import type { FileChange } from "summit-types";

const exec = promisify(execFile);

async function getRepoChanges(worktreePath: string): Promise<{ files: FileChange[]; sourceBranch: string }> {
  let mergeBase: string;
  let sourceBranch: string;
  try {
    mergeBase = await getMergeBase(worktreePath);
    sourceBranch = await getDefaultBranch(worktreePath);
  } catch {
    mergeBase = "HEAD";
    sourceBranch = "main";
  }

  const { stdout: sessionNameStatus } = await exec(
    "git",
    ["diff", "--name-status", mergeBase],
    { cwd: worktreePath },
  ).catch(() => ({ stdout: "" }));

  const { stdout: sessionNumstat } = await exec(
    "git",
    ["diff", "--numstat", mergeBase],
    { cwd: worktreePath },
  ).catch(() => ({ stdout: "" }));

  const { stdout: workingStatus } = await exec(
    "git",
    ["status", "--porcelain"],
    { cwd: worktreePath },
  ).catch(() => ({ stdout: "" }));

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

  const uncommittedMap = new Map<string, { staged: boolean }>();
  for (const line of workingStatus.trimEnd().split("\n")) {
    if (!line) continue;
    const indexStatus = line[0];
    const wtStatus = line[1];
    const path = line.slice(3);

    const isStaged = indexStatus !== " " && indexStatus !== "?";
    const hasUnstaged = wtStatus !== " " && wtStatus !== undefined;

    if (isStaged && !hasUnstaged) {
      uncommittedMap.set(path, { staged: true });
    } else {
      uncommittedMap.set(path, { staged: false });
    }
  }

  const files: FileChange[] = [];
  for (const line of sessionNameStatus.trim().split("\n")) {
    if (!line) continue;
    const parts = line.split("\t");
    if (parts.length < 2) continue;
    const statusCode = parts[0];
    const path = parts[parts.length - 1];

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
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const session = await getStoredSession(id);
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: "Session not found" });
  }

  try {
    const worktrees = session.worktrees;
    const repoNames = worktrees ? Object.keys(worktrees) : [];
    const hasMultiRepo = repoNames.length > 1;

    if (hasMultiRepo) {
      const repoChanges: Record<string, FileChange[]> = {};
      let sourceBranch = "main";

      await Promise.all(
        Object.entries(worktrees).map(async ([repoName, wtPath]) => {
          const result = await getRepoChanges(wtPath);
          repoChanges[repoName] = result.files;
          sourceBranch = result.sourceBranch;
        }),
      );

      return { repoChanges, sourceBranch };
    }

    // Single-repo (project or legacy)
    const wtPath = repoNames.length === 1 ? worktrees[repoNames[0]] : session.worktreePath;
    if (!wtPath) {
      return { files: [], sourceBranch: "main" };
    }

    const result = await getRepoChanges(wtPath);
    return { files: result.files, sourceBranch: result.sourceBranch };
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err.message });
  }
});
