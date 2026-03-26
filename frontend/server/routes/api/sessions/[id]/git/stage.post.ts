export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const session = await getStoredSession(id);
  if (!session) throw createError({ statusCode: 404, message: "Session not found" });
  if (!session.worktreePath) throw createError({ statusCode: 400, message: "No worktree for this session" });

  const body = await readBody<{ paths: string[] }>(event);
  if (!body.paths?.length) throw createError({ statusCode: 400, message: "No paths provided" });

  try {
    await stageFiles(session.worktreePath, body.paths);
    return { ok: true };
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.stderr || err.message });
  }
});
