export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const session = await getStoredSession(id);
  if (!session) throw createError({ statusCode: 404, message: "Session not found" });
  if (!session.worktreePath) throw createError({ statusCode: 400, message: "No worktree for this session" });

  const body = await readBody<{ message: string }>(event);
  if (!body.message?.trim()) throw createError({ statusCode: 400, message: "Commit message is required" });

  try {
    const hash = await createCommit(session.worktreePath, body.message.trim());
    return { ok: true, hash };
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.stderr || err.message });
  }
});
