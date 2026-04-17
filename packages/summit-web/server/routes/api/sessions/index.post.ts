import { saveSession } from "summit-core";
import type { StoredSession } from "summit-types";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ title?: string; projectId?: string | null }>(event);
  if (!body?.projectId) {
    throw createError({ statusCode: 400, message: "Missing projectId" });
  }

  const date = new Date();
  const now = date.toISOString();
  const time = date.toTimeString().slice(0, 8).replace(/:/g, "-");
  const session: StoredSession = {
    id: crypto.randomUUID(),
    title: body.title?.trim() || `New session ${time}`,
    model: null,
    provider: "claude-code",
    agentSessionId: null,
    projectId: body.projectId,
    worktreePath: null,
    branch: null,
    worktrees: {},
    conversations: [],
    createdAt: now,
    updatedAt: now,
  };

  await saveSession(session);
  return session;
});
