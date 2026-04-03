import type { ChatMessage, SessionStatus, SessionListItem, ElicitationPayload, AskUserQuestion, Conversation } from "summit-types";

export interface ClientConversation {
  id: string;
  role: string;
  status: Conversation["status"];
  messages: ChatMessage[];
  model?: string;
  events: ToolEvent[];
  streamText: string;
  askUser: AskUserQuestion[] | null;
}

export interface ClientSession {
  id: string;
  title: string;
  model: string | null;
  projectId: string | null;
  branch: string | null;
  worktrees: Record<string, string>;
  conversations: ClientConversation[];
  activeConversationId: string;
  loading: boolean;
  status: SessionStatus;
  elicitation: ElicitationPayload | null;
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

function toClientConversation(c: Conversation): ClientConversation {
  return {
    id: c.id,
    role: c.role,
    status: c.status,
    messages: c.messages || [],
    model: c.model,
    events: [],
    streamText: "",
    askUser: null,
  };
}

function toClientConversations(conversations: Conversation[]): ClientConversation[] {
  if (!conversations?.length) {
    return [toClientConversation({ id: "lead", role: "lead", status: "idle", messages: [] })];
  }
  return conversations.map(toClientConversation);
}

// Tracks pending session creation so callers can await it
const pendingCreation = new Map<string, Promise<void>>();

export function useSessionStore() {
  const sessions = ref<ClientSession[]>([]);
  const activeSessionId = ref("");
  const loaded = ref(false);
  const searchQuery = ref("");
  const fullTextEnabled = ref(false);
  const fullTextResults = ref<{ sessionId: string; snippet: string }[]>([]);

  const activeSession = computed(
    () => sessions.value.find((s) => s.id === activeSessionId.value),
  );
  const filteredSessions = computed(() => {
    const q = searchQuery.value.toLowerCase().trim();
    if (!q) return sessions.value;
    const fullTextIds = new Set(fullTextResults.value.map((r) => r.sessionId));
    return sessions.value.filter(
      (s) => s.title.toLowerCase().includes(q) || (fullTextEnabled.value && fullTextIds.has(s.id)),
    );
  });

  // Active conversation for the current session
  const activeConversation = computed((): ClientConversation | undefined => {
    const session = activeSession.value;
    if (!session) return undefined;
    const id = session.activeConversationId;
    return session.conversations.find((c) => c.id === id) ?? session.conversations[0];
  });

  const messages = computed(() => activeConversation.value?.messages ?? []);
  const events = computed(() => activeConversation.value?.events ?? []);
  const loading = computed(() => activeSession.value?.loading ?? false);
  const elicitation = computed(() => activeSession.value?.elicitation ?? null);
  const askUser = computed(() => activeConversation.value?.askUser ?? null);

  function getConversation(sessionId: string, conversationId: string): ClientConversation | undefined {
    const session = sessions.value.find((s) => s.id === sessionId);
    if (!session) return undefined;
    return session.conversations.find((c) => c.id === conversationId);
  }

  function ensureConversation(sessionId: string, conversationId: string, role?: string): ClientConversation | undefined {
    const session = sessions.value.find((s) => s.id === sessionId);
    if (!session) return undefined;
    let conv = session.conversations.find((c) => c.id === conversationId);
    if (!conv) {
      conv = {
        id: conversationId,
        role: role ?? conversationId,
        status: "working",
        messages: [],
        events: [],
        streamText: "",
        askUser: null,
      };
      session.conversations.push(conv);
    }
    return conv;
  }

  function clearTeammateConversations(sessionId: string) {
    const session = sessions.value.find((s) => s.id === sessionId);
    if (!session) return;
    session.conversations = session.conversations.filter((c) => c.id === "lead");
    session.activeConversationId = "lead";
  }

  async function loadSessions(): Promise<{ session: ClientSession; hasActiveQuery: boolean }[]> {
    try {
      const data = await $fetch<SessionListItem[]>("/api/sessions");
      if (data.length) {
        const existingById = new Map(sessions.value.map((s) => [s.id, s]));

        sessions.value = data.map((s) => {
          const existing = existingById.get(s.id);
          if (existing) {
            // Merge server data into existing session, preserving ephemeral client state
            existing.title = s.title;
            existing.model = s.model || null;
            existing.projectId = s.projectId || null;
            existing.branch = s.branch || null;
            existing.worktrees = s.worktrees || {};
            // Only update conversations from server if client has no live state
            if (!existing.loading && existing.status === "idle") {
              existing.conversations = toClientConversations(s.conversations);
            }
            return existing;
          }
          return {
            id: s.id,
            title: s.title,
            model: s.model || null,
            projectId: s.projectId || null,
            branch: s.branch || null,
            worktrees: s.worktrees || {},
            conversations: toClientConversations(s.conversations),
            activeConversationId: "lead",
            loading: false,
            status: "idle" as SessionStatus,
            elicitation: null,
          };
        });

        if (!activeSessionId.value) {
          activeSessionId.value = sessions.value[0].id;
        }
        loaded.value = true;

        return sessions.value.map((cs, i) => ({
          session: cs,
          hasActiveQuery: data[i].hasActiveQuery,
        }));
      }
    } catch {}

    loaded.value = true;
    return [];
  }

  async function newSession(projectId?: string | null) {
    const id = crypto.randomUUID();
    const session: ClientSession = {
      id,
      title: "New chat",
      model: null,
      projectId: projectId || null,
      branch: null,
      worktrees: {},
      conversations: [{ id: "lead", role: "lead", status: "idle", messages: [], events: [], streamText: "", askUser: null }],
      activeConversationId: "lead",
      loading: false,
      status: "idle",
      elicitation: null,
    };
    sessions.value.unshift(session);
    activeSessionId.value = id;

    const creation = (async () => {
      try {
        const created = await $fetch<any>("/api/sessions", {
          method: "POST",
          body: { id, title: "New chat", projectId: projectId || undefined },
        });
        if (created?.branch) {
          session.branch = created.branch;
        }
        if (created?.worktrees) {
          session.worktrees = created.worktrees;
        }
        if (created?.projectId) {
          session.projectId = created.projectId;
        }
      } catch {}
    })();
    pendingCreation.set(id, creation);
    await creation;
    pendingCreation.delete(id);
  }

  function selectSession(id: string) {
    activeSessionId.value = id;
  }

  async function deleteSession(id: string, projectId?: string | null) {
    const idx = sessions.value.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const deletedSession = sessions.value[idx];
    sessions.value.splice(idx, 1);

    if (activeSessionId.value === id) {
      const pid = projectId !== undefined ? projectId : deletedSession.projectId;
      const sameProjSessions = pid
        ? sessions.value.filter((s) => s.projectId === pid)
        : sessions.value;
      activeSessionId.value = sameProjSessions.length > 0 ? sameProjSessions[0].id : "";
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

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  async function searchFullText(query: string) {
    if (!query.trim()) { fullTextResults.value = []; return; }
    try {
      const results = await $fetch<{ sessionId: string; snippet: string }[]>(
        `/api/sessions/search`, { params: { q: query } },
      );
      fullTextResults.value = results;
    } catch { fullTextResults.value = []; }
  }

  watch(searchQuery, (q) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    if (!fullTextEnabled.value || !q.trim()) { fullTextResults.value = []; return; }
    searchTimeout = setTimeout(() => searchFullText(q), 300);
  });

  watch(fullTextEnabled, (enabled) => {
    if (enabled && searchQuery.value.trim()) searchFullText(searchQuery.value);
    else fullTextResults.value = [];
  });

  async function reloadSession(id: string) {
    try {
      const s = sessions.value.find((s) => s.id === id);
      // Persist conversations to server before reloading
      if (s && s.conversations.length > 0) {
        const storable = s.conversations.map((c) => ({
          id: c.id,
          role: c.role,
          status: c.status,
          messages: c.messages,
          model: c.model,
        }));
        await $fetch(`/api/sessions/${id}`, {
          method: "PUT",
          body: { conversations: storable },
        });
      }
      const stored = await $fetch<any>(`/api/sessions/${id}`);
      if (s && stored) {
        s.title = stored.title;
        s.branch = stored.branch || null;
        s.worktrees = stored.worktrees || {};
        // Merge stored conversations — keep client ephemeral state for live conversations
        const storedConvs: Conversation[] = stored.conversations || [];
        for (const sc of storedConvs) {
          const existing = s.conversations.find((c) => c.id === sc.id);
          if (existing) {
            existing.messages = sc.messages;
            existing.status = sc.status;
          }
        }
      }
    } catch {}
  }

  async function waitForCreation(sessionId: string) {
    const p = pendingCreation.get(sessionId);
    if (p) await p;
  }

  return {
    sessions,
    filteredSessions,
    activeSessionId,
    activeSession,
    activeConversation,
    searchQuery,
    fullTextEnabled,
    fullTextResults,
    messages,
    events,
    loading,
    loaded,
    elicitation,
    askUser,
    getConversation,
    ensureConversation,
    clearTeammateConversations,
    loadSessions,
    newSession,
    selectSession,
    selectPrevSession,
    selectNextSession,
    deleteSession,
    reloadSession,
    updateModel,
    waitForCreation,
  };
}
