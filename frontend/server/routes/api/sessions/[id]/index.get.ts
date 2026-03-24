export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const session = await getStoredSession(id);
  if (!session) {
    throw createError({ statusCode: 404, message: "Session not found" });
  }
  return session;
});
