export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;

  // Prefer live team state from the in-memory team manager
  const live = getTeamState(id);
  if (live) return live;

  // Fall back to persisted team state
  const session = await getStoredSession(id);
  return session?.teamState || { teammates: [], messages: [] };
});
