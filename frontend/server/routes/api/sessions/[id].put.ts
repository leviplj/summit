export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const body = await readBody<{ title?: string; messages?: any[]; agentSessionId?: string }>(event);

  const session = await getStoredSession(id);
  if (!session) {
    throw createError({ statusCode: 404, message: "Session not found" });
  }

  if (body.title !== undefined) session.title = body.title;
  if (body.messages !== undefined) session.messages = body.messages;
  if (body.agentSessionId !== undefined) session.agentSessionId = body.agentSessionId;

  await saveSession(session);
  return session;
});
