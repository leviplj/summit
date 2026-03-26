import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const query = getQuery(event);
  const filePath = query.path as string;

  if (!filePath) {
    throw createError({ statusCode: 400, statusMessage: "Missing path parameter" });
  }

  const session = await getStoredSession(id);
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: "Session not found" });
  }
  if (!session.worktreePath) {
    return { diff: "" };
  }

  try {
    let mergeBase: string;
    try {
      mergeBase = await getMergeBase(session.worktreePath);
    } catch {
      mergeBase = "HEAD";
    }

    // Diff from merge-base to working tree — shows the full session change for this file
    const { stdout } = await exec(
      "git",
      ["diff", mergeBase, "--", filePath],
      { cwd: session.worktreePath, maxBuffer: 1024 * 1024 },
    ).catch(() => ({ stdout: "" }));

    // If no diff (file might be untracked), show full content as additions
    if (!stdout) {
      const { stdout: content } = await exec(
        "git",
        ["diff", "--no-index", "--", "/dev/null", filePath],
        { cwd: session.worktreePath, maxBuffer: 1024 * 1024 },
      ).catch((err: any) => ({ stdout: err.stdout || "" }));
      return { diff: content };
    }

    return { diff: stdout };
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err.message });
  }
});
