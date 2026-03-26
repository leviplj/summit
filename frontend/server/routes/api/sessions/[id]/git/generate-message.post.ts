import { execFile } from "child_process";
import { promisify } from "util";
import { query } from "@anthropic-ai/claude-agent-sdk";

const exec = promisify(execFile);

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const session = await getStoredSession(id);
  if (!session) throw createError({ statusCode: 404, message: "Session not found" });
  if (!session.worktreePath) throw createError({ statusCode: 400, message: "No worktree for this session" });

  try {
    // Get the staged diff
    const { stdout: diff } = await exec(
      "git",
      ["diff", "--cached"],
      { cwd: session.worktreePath, maxBuffer: 1024 * 256 },
    );

    if (!diff.trim()) {
      throw createError({ statusCode: 400, message: "No staged changes to describe" });
    }

    // Truncate if too large
    const truncatedDiff = diff.length > 8000 ? diff.slice(0, 8000) + "\n... (truncated)" : diff;

    const prompt = `Write a concise git commit message (one line, max 72 chars) for this diff. Return ONLY the message, no quotes, no prefix, no explanation.\n\n${truncatedDiff}`;

    let message = "";
    const q = query({
      prompt,
      options: {
        maxTurns: 1,
        model: "haiku",
        allowedTools: [],
      },
    });

    for await (const event of q) {
      if (event.type === "result" && "result" in event) {
        message = (event as any).result;
        break;
      }
    }

    // Clean up: remove quotes, "commit message:" prefix, etc.
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
