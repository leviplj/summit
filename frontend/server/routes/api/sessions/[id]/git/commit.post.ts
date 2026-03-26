export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const session = await getStoredSession(id);
  if (!session) throw createError({ statusCode: 404, message: "Session not found" });

  const body = await readBody<{ message: string; repo?: string }>(event);
  if (!body.message?.trim()) throw createError({ statusCode: 400, message: "Commit message is required" });

  try {
    const wtPath = resolveWorktreePath(session, body.repo);
    const hash = await createCommit(wtPath, body.message.trim());
    return { ok: true, hash };
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.stderr || err.message });
  }
});
