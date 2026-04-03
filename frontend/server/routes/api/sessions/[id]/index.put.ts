export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const body = await readBody<{ title?: string; conversations?: any[]; agentSessionId?: string; model?: string | null }>(event);

  const session = await getStoredSession(id);
  if (!session) {
    throw createError({ statusCode: 404, message: "Session not found" });
  }

  if (body.title !== undefined) session.title = body.title;
  if (body.conversations !== undefined) session.conversations = body.conversations;
  if (body.agentSessionId !== undefined) session.agentSessionId = body.agentSessionId;
  if (body.model !== undefined) session.model = body.model;

  await saveSession(session);
  return session;
});
