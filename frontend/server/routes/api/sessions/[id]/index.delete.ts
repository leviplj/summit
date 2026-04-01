export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;

  // Cancel any active query and dispose the team manager
  disposeSession(id);

  const session = await getStoredSession(id);

  if (session?.worktrees && Object.keys(session.worktrees).length > 0) {
    await removeProjectWorktrees(id, session.worktrees);
  } else {
    await removeWorktree(id);
  }

  await deleteSessionFile(id);
  return { ok: true };
});
