export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const body = await readBody<{ askId?: string; answers: Record<string, string> }>(event);

  if (!body?.answers || typeof body.answers !== "object") {
    throw createError({ statusCode: 400, statusMessage: "Missing answers" });
  }

  // Use the unique askId if provided, fall back to sessionId for backwards compat
  const resolveKey = body.askId || id;
  const resolved = resolveAskUser(resolveKey, body.answers);
  if (!resolved) {
    throw createError({ statusCode: 404, statusMessage: "No pending question found" });
  }

  return { ok: true };
});
