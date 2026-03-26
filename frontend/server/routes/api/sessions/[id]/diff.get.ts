import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const query = getQuery(event);
  const filePath = query.path as string;
  const repoName = query.repo as string | undefined;

  if (!filePath) {
    throw createError({ statusCode: 400, statusMessage: "Missing path parameter" });
  }

  const session = await getStoredSession(id);
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: "Session not found" });
  }

  // Resolve the correct worktree path
  let cwd: string | null = null;
  if (repoName && session.worktrees?.[repoName]) {
    cwd = session.worktrees[repoName];
  } else {
    cwd = session.worktreePath;
  }

  if (!cwd) {
    return { diff: "" };
  }

  try {
    let mergeBase: string;
    try {
      mergeBase = await getMergeBase(cwd);
    } catch {
      mergeBase = "HEAD";
    }

    const { stdout } = await exec(
      "git",
      ["diff", mergeBase, "--", filePath],
      { cwd, maxBuffer: 1024 * 1024 },
    ).catch(() => ({ stdout: "" }));

    if (!stdout) {
      const { stdout: content } = await exec(
        "git",
        ["diff", "--no-index", "--", "/dev/null", filePath],
        { cwd, maxBuffer: 1024 * 1024 },
      ).catch((err: any) => ({ stdout: err.stdout || "" }));
      return { diff: content };
    }

    return { diff: stdout };
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err.message });
  }
});
