import type { SessionListItem } from "~~/shared/types";

export default defineEventHandler(async (): Promise<SessionListItem[]> => {
  const [sessions, activeIds] = await Promise.all([
    listSessions(),
    Promise.resolve(getActiveSessionIds()),
  ]);
  const activeSet = new Set(activeIds);
  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    model: s.model || null,
    branch: s.branch || null,
    messages: s.messages,
    hasActiveQuery: activeSet.has(s.id),
  }));
});
