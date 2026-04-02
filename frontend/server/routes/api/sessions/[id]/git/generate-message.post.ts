import { execFile } from "child_process";
import { promisify } from "util";
import { getProvider } from "~~/server/providers/registry";

const exec = promisify(execFile);

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const session = await getStoredSession(id);
  if (!session) throw createError({ statusCode: 404, message: "Session not found" });

  const body = await readBody<{ repo?: string }>(event);

  try {
    const wtPath = resolveWorktreePath(session, body?.repo);

    const { stdout: diff } = await exec(
      "git",
      ["diff", "--cached"],
      { cwd: wtPath, maxBuffer: 1024 * 256 },
    );

    if (!diff.trim()) {
      throw createError({ statusCode: 400, message: "No staged changes to describe" });
    }

    const truncatedDiff = diff.length > 8000 ? diff.slice(0, 8000) + "\n... (truncated)" : diff;

    const prompt = `Write a concise git commit message (one line, max 72 chars) for this diff. Return ONLY the message, no quotes, no prefix, no explanation.\n\n${truncatedDiff}`;

    const provider = getProvider(session.provider ?? "claude-code");
    let message = await provider.complete(prompt, "haiku");

    message = message.trim().replace(/^["']|["']$/g, "").replace(/^(commit message:?\s*)/i, "").trim();

    if (!message) {
      throw createError({ statusCode: 500, message: "Failed to generate message" });
    }

    return { message };
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw createError({ statusCode: 500, message: err.stderr || err.message });
  }
});
