export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;

  const session = await getStoredSession(id);
  if (!session) {
    throw createError({ statusCode: 404, message: "Session not found" });
  }

  const cancelled = cancelQuery(id);
  if (!cancelled) {
    throw createError({ statusCode: 409, message: "No active query to cancel" });
  }

  return { ok: true };
});
