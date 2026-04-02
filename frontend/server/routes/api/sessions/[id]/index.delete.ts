export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const session = await getStoredSession(id);

  if (session?.worktrees && Object.keys(session.worktrees).length > 0) {
    await removeProjectWorktrees(id, session.worktrees);
  } else {
    await removeWorktree(id);
  }

  await deleteSessionFile(id, session?.channelMeta);
  return { ok: true };
});
