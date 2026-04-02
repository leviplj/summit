import { startQuery } from "~~/server/utils/queryManager";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ text: string; sessionId: string }>(event);
  if (!body?.text || !body?.sessionId) {
    throw createError({ statusCode: 400, message: "Missing text or sessionId" });
  }

  const session = await getStoredSession(body.sessionId);
  if (!session) {
    throw createError({ statusCode: 404, message: "Session not found" });
  }

  // Start query in background — does not block
  await startQuery(body.sessionId, body.text);

  return { ok: true };
});
