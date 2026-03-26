import { devServerManager } from "~~/server/features/dev-server/manager";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const session = await getStoredSession(id);

  // Stop dev server before removing worktree to avoid file locking
  await devServerManager.stop(id);

  if (session?.worktrees && Object.keys(session.worktrees).length > 0) {
    await removeProjectWorktrees(id, session.worktrees);
  } else {
    await removeWorktree(id);
  }

  await deleteSessionFile(id);
  return { ok: true };
});
