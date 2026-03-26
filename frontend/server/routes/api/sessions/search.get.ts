export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const q = String(query.q || "").toLowerCase().trim();
  if (!q) return [];

  const sessions = await listSessions();
  const results: { sessionId: string; snippet: string }[] = [];

  for (const session of sessions) {
    for (const msg of session.messages) {
      const idx = msg.content.toLowerCase().indexOf(q);
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(msg.content.length, idx + q.length + 40);
        const snippet = (start > 0 ? "…" : "") + msg.content.slice(start, end) + (end < msg.content.length ? "…" : "");
        results.push({ sessionId: session.id, snippet });
        break;
      }
    }
  }

  return results;
});
