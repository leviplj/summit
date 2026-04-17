import type { StoredSession } from "summit-types";

export function useSessionStore() {
  const sessions = useState<StoredSession[]>("sessions", () => []);
  const loaded = useState("sessions:loaded", () => false);

  async function loadSessions() {
    try {
      sessions.value = await $fetch<StoredSession[]>("/api/sessions");
    } finally {
      loaded.value = true;
    }
  }

  async function createSession(projectId: string, title?: string) {
    const session = await $fetch<StoredSession>("/api/sessions", {
      method: "POST",
      body: { projectId, title },
    });
    sessions.value.unshift(session);
    return session;
  }

  async function deleteSession(id: string) {
    await $fetch(`/api/sessions/${id}`, { method: "DELETE" });
    sessions.value = sessions.value.filter((s) => s.id !== id);
  }

  async function updateSession(id: string, patch: Partial<Pick<StoredSession, "title" | "model">>) {
    const updated = await $fetch<StoredSession>(`/api/sessions/${id}`, {
      method: "PUT",
      body: patch,
    });
    const idx = sessions.value.findIndex((s) => s.id === id);
    if (idx >= 0) sessions.value[idx] = updated;
    return updated;
  }

  async function sendMessage(id: string, prompt: string) {
    const { session } = await $fetch<{ session: StoredSession }>(`/api/sessions/${id}/chat`, {
      method: "POST",
      body: { prompt },
    });
    const idx = sessions.value.findIndex((s) => s.id === id);
    if (idx >= 0) sessions.value[idx] = session;
    return session;
  }

  function sessionsForProject(projectId: string) {
    return computed(() => sessions.value.filter((s) => s.projectId === projectId));
  }

  return {
    sessions,
    loaded,
    loadSessions,
    createSession,
    deleteSession,
    updateSession,
    sendMessage,
    sessionsForProject,
  };
}
