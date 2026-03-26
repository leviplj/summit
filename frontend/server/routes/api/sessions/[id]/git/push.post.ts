export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const session = await getStoredSession(id);
  if (!session) throw createError({ statusCode: 404, message: "Session not found" });
  if (!session.worktreePath) throw createError({ statusCode: 400, message: "No worktree for this session" });
  if (!session.branch) throw createError({ statusCode: 400, message: "No branch for this session" });

  try {
    await pushBranch(session.worktreePath, session.branch);
    return { ok: true };
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.stderr || err.message });
  }
});
