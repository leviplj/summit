export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const body = await readBody<{ answers: Record<string, string> }>(event);

  if (!body?.answers || typeof body.answers !== "object") {
    throw createError({ statusCode: 400, statusMessage: "Missing answers" });
  }

  const resolved = resolveAskUser(id, body.answers);
  if (!resolved) {
    throw createError({ statusCode: 404, statusMessage: "No pending question found" });
  }

  return { ok: true };
});
