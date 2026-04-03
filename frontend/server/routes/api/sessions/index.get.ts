import type { SessionListItem } from "summit-types";

export default defineEventHandler(async (event): Promise<SessionListItem[]> => {
  const query = getQuery(event);
  const projectFilter = query.projectId as string | undefined;

  const [sessions, activeIds] = await Promise.all([
    listSessions(),
    Promise.resolve(getActiveSessionIds()),
  ]);
  const activeSet = new Set(activeIds);

  let filtered = sessions;
  if (projectFilter) {
    filtered = sessions.filter((s) => s.projectId === projectFilter);
  }

  return filtered.map((s) => ({
    id: s.id,
    title: s.title,
    model: s.model || null,
    provider: s.provider || "claude-code",
    projectId: s.projectId || null,
    branch: s.branch || null,
    worktrees: s.worktrees || {},
    messages: s.messages,
    hasActiveQuery: activeSet.has(s.id),
  }));
});
