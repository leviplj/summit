import type { ChatMessage, SessionStatus, SessionListItem, ElicitationPayload, AskUserQuestion } from "~~/shared/types";

export interface ClientSession {
  id: string;
  title: string;
  model: string | null;
  branch: string | null;
  messages: ChatMessage[];
  events: ToolEvent[];
  loading: boolean;
  status: SessionStatus;
  elicitation: ElicitationPayload | null;
  askUser: AskUserQuestion[] | null;
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
  const elicitation = computed(() => activeSession.value?.elicitation ?? null);
  const askUser = computed(() => activeSession.value?.askUser ?? null);

  async function loadSessions(): Promise<{ session: ClientSession; hasActiveQuery: boolean }[]> {
    try {
      const data = await $fetch<SessionListItem[]>("/api/sessions");
      if (data.length) {
        sessions.value = data.map((s) => ({
          id: s.id,
          title: s.title,
          model: s.model || null,
          branch: s.branch || null,
          messages: s.messages || [],
          events: [],
          loading: false,
          status: "idle" as SessionStatus,
          elicitation: null,
          askUser: null,
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
      model: null,
      branch: null,
      messages: [],
      events: [],
      loading: false,
      status: "idle",
      elicitation: null,
      askUser: null,
    };
    sessions.value.unshift(session);
    activeSessionId.value = id;

    try {
      const created = await $fetch<any>("/api/sessions", {
        method: "POST",
        body: { id, title: "New chat" },
      });
      if (created?.branch) {
        session.branch = created.branch;
      }
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

  function selectPrevSession() {
    const idx = sessions.value.findIndex((s) => s.id === activeSessionId.value);
    if (idx > 0) activeSessionId.value = sessions.value[idx - 1].id;
  }

  function selectNextSession() {
    const idx = sessions.value.findIndex((s) => s.id === activeSessionId.value);
    if (idx >= 0 && idx < sessions.value.length - 1) activeSessionId.value = sessions.value[idx + 1].id;
  }

  async function updateModel(sessionId: string, model: string | null) {
    const s = sessions.value.find((s) => s.id === sessionId);
    if (s) s.model = model;
    try {
      await $fetch(`/api/sessions/${sessionId}`, {
        method: "PUT",
        body: { model },
      });
    } catch {}
  }

  async function reloadSession(id: string) {
    try {
      const stored = await $fetch<any>(`/api/sessions/${id}`);
      const s = sessions.value.find((s) => s.id === id);
      if (s && stored) {
        s.title = stored.title;
        s.branch = stored.branch || null;
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
    elicitation,
    askUser,
    loadSessions,
    newSession,
    selectSession,
    selectPrevSession,
    selectNextSession,
    deleteSession,
    reloadSession,
    updateModel,
  };
}
