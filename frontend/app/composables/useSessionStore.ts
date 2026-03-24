import type { ChatMessage, SessionStatus, SessionListItem } from "~~/shared/types";

export interface ClientSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  events: ToolEvent[];
  loading: boolean;
  status: SessionStatus;
}

export interface ToolEvent {
  id: string;
  type: "thinking" | "tool_use" | "tool_result";
  label: string;
  isError?: boolean;
}

let _id = 0;
const uid = () => String(++_id);

export { uid };

export function useSessionStore() {
  const sessions = ref<ClientSession[]>([]);
  const activeSessionId = ref("");
  const loaded = ref(false);

  const activeSession = computed(
    () => sessions.value.find((s) => s.id === activeSessionId.value),
  );
  const messages = computed(() => activeSession.value?.messages ?? []);
  const events = computed(() => activeSession.value?.events ?? []);
  const loading = computed(() => activeSession.value?.loading ?? false);

  async function loadSessions(): Promise<{ session: ClientSession; hasActiveQuery: boolean }[]> {
    try {
      const data = await $fetch<SessionListItem[]>("/api/sessions");
      if (data.length) {
        sessions.value = data.map((s) => ({
          id: s.id,
          title: s.title,
          messages: s.messages || [],
          events: [],
          loading: false,
          status: "idle" as SessionStatus,
        }));
        activeSessionId.value = sessions.value[0].id;
        loaded.value = true;

        return sessions.value.map((cs, i) => ({
          session: cs,
          hasActiveQuery: data[i].hasActiveQuery,
        }));
      }
    } catch {}

    await newSession();
    loaded.value = true;
    return [];
  }

  async function newSession() {
    const id = crypto.randomUUID();
    const session: ClientSession = {
      id,
      title: "New chat",
      messages: [],
      events: [],
      loading: false,
      status: "idle",
    };
    sessions.value.unshift(session);
    activeSessionId.value = id;

    try {
      await $fetch("/api/sessions", {
        method: "POST",
        body: { id, title: "New chat" },
      });
    } catch {}
  }

  function selectSession(id: string) {
    activeSessionId.value = id;
  }

  async function deleteSession(id: string) {
    const idx = sessions.value.findIndex((s) => s.id === id);
    if (idx === -1) return;
    sessions.value.splice(idx, 1);

    if (sessions.value.length === 0) {
      await newSession();
    } else if (activeSessionId.value === id) {
      activeSessionId.value = sessions.value[0].id;
    }

    try {
      await $fetch(`/api/sessions/${id}`, { method: "DELETE" });
    } catch {}
  }

  async function reloadSession(id: string) {
    try {
      const stored = await $fetch<any>(`/api/sessions/${id}`);
      const s = sessions.value.find((s) => s.id === id);
      if (s && stored) {
        s.title = stored.title;
        s.messages = stored.messages;
      }
    } catch {}
  }

  return {
    sessions,
    activeSessionId,
    activeSession,
    messages,
    events,
    loading,
    loaded,
    loadSessions,
    newSession,
    selectSession,
    deleteSession,
    reloadSession,
  };
}
