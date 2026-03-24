export default defineEventHandler(async (event) => {
  const body = await readBody<{ id: string; title?: string }>(event);
  if (!body?.id) {
    throw createError({ statusCode: 400, message: "Missing id" });
  }

  const session: StoredSession = {
    id: body.id,
    title: body.title || "New chat",
    agentSessionId: null,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveSession(session);
  return session;
});
