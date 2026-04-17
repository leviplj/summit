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

  function sessionsForProject(projectId: string) {
    return computed(() => sessions.value.filter((s) => s.projectId === projectId));
  }

  return {
    sessions,
    loaded,
    loadSessions,
    createSession,
    deleteSession,
    sessionsForProject,
  };
}
