import { execFile } from "child_process";
import { promisify } from "util";
import { query } from "@anthropic-ai/claude-agent-sdk";

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

    let message = "";
    const q = query({
      prompt,
      options: {
        maxTurns: 1,
        model: "haiku",
        allowedTools: [],
      },
    });

    for await (const ev of q) {
      if (ev.type === "result" && "result" in ev) {
        message = (ev as any).result;
        break;
      }
    }

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
