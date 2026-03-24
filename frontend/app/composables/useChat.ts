export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  meta?: { duration_ms?: number; cost_usd?: number; output_tokens?: number };
}

export interface ToolEvent {
  id: string;
  type: "thinking" | "tool_use" | "tool_result";
  label: string;
  isError?: boolean;
}

export type SessionStatus = "idle" | "waiting" | "thinking" | "streaming" | "tool" | "error";

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  events: ToolEvent[];
  loading: boolean;
  status: SessionStatus;
}

function formatToolUse(tool: string, input?: Record<string, any>): string {
  if (!input) return `Using ${tool}`;
  switch (tool) {
    case "Read":
      return `Reading ${input.file_path || "file"}`;
    case "Write":
      return `Writing ${input.file_path || "file"}`;
    case "Edit":
      return `Editing ${input.file_path || "file"}`;
    case "Bash":
      return `$ ${input.command || "command"}`;
    case "Glob":
      return `Searching files: ${input.pattern || ""}`;
    case "Grep":
      return `Searching for: ${input.pattern || ""}`;
    case "WebFetch":
      return `Fetching ${input.url || "URL"}`;
    case "WebSearch":
      return `Searching: ${input.query || ""}`;
    default: {
      const s = input.file_path || input.command || input.pattern || input.query || "";
      return s ? `${tool}: ${s}` : `Using ${tool}`;
    }
  }
}

let _id = 0;
const uid = () => String(++_id);

export function useChat() {
  const sessions = ref<ChatSession[]>([]);
  const activeSessionId = ref("");
  const model = ref("");
  const loaded = ref(false);

  const activeSession = computed(
    () => sessions.value.find((s) => s.id === activeSessionId.value),
  );
  const messages = computed(() => activeSession.value?.messages ?? []);
  const events = computed(() => activeSession.value?.events ?? []);
  const loading = computed(() => activeSession.value?.loading ?? false);

  const streamState = new Map<string, { currentId: string; assistantText: string }>();

  async function loadSessions() {
    try {
      const data = await $fetch<any[]>("/api/sessions");
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
      } else {
        await newSession();
      }
    } catch {
      await newSession();
    }
    loaded.value = true;
  }

  async function newSession() {
    const id = crypto.randomUUID();
    const session: ChatSession = {
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

  function handleEvent(session: ChatSession, msg: Record<string, any>) {
    const state = streamState.get(session.id)!;

    switch (msg.type) {
      case "init":
        if (msg.model) model.value = msg.model;
        break;

      case "thinking":
        session.status = "thinking";
        session.events.push({ id: uid(), type: "thinking", label: "Thinking" });
        break;

      case "tool_use":
        session.status = "tool";
        session.events = session.events.filter((e) => e.type !== "thinking");
        session.events.push({
          id: uid(),
          type: "tool_use",
          label: formatToolUse(msg.tool, msg.input),
        });
        break;

      case "tool_result":
        session.events.push({
          id: uid(),
          type: "tool_result",
          label: msg.content || (msg.is_error ? "Error" : "Done"),
          isError: msg.is_error,
        });
        break;

      case "text":
        session.status = "streaming";
        session.events = session.events.filter((e) => e.type !== "thinking");
        state.assistantText += msg.text;
        {
          const existing = session.messages.find((m) => m.id === state.currentId);
          if (existing) {
            existing.content = state.assistantText;
          } else {
            session.messages.push({
              id: state.currentId,
              role: "assistant",
              content: state.assistantText,
            });
          }
        }
        break;

      case "result":
        if (!msg.is_error && msg.text) {
          const m = session.messages.find((m) => m.id === state.currentId);
          if (m) {
            m.content = msg.text;
            m.meta = {
              duration_ms: msg.duration_ms,
              cost_usd: msg.cost_usd,
              output_tokens: msg.output_tokens,
            };
          }
        }
        session.loading = false;
        session.status = "idle";
        session.events = [];
        break;

      case "done":
        session.loading = false;
        session.status = "idle";
        session.events = [];
        break;

      case "error":
        session.events = session.events.filter((e) => e.type !== "thinking");
        session.messages.push({ id: uid(), role: "error", content: msg.text });
        session.loading = false;
        session.status = "error";
        break;
    }
  }

  async function send(text: string) {
    const session = activeSession.value;
    if (!session || !text.trim() || session.loading) return;

    session.messages.push({ id: uid(), role: "user", content: text });
    session.loading = true;
    session.status = "waiting";
    session.events = [];

    if (session.messages.filter((m) => m.role === "user").length === 1) {
      session.title = text.length > 40 ? text.slice(0, 40) + "…" : text;
    }

    const currentId = uid();
    streamState.set(session.id, { currentId, assistantText: "" });

    const controller = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sessionId: session.id }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            handleEvent(session, JSON.parse(line.slice(6)));
          } catch {}
        }
      }

      if (buffer.startsWith("data: ")) {
        try {
          handleEvent(session, JSON.parse(buffer.slice(6)));
        } catch {}
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        session.messages.push({ id: uid(), role: "error", content: err.message });
        session.status = "error";
      } else {
        session.status = "idle";
      }
      session.loading = false;
      session.events = [];
    }

    streamState.delete(session.id);
  }

  onMounted(loadSessions);

  return {
    sessions,
    activeSessionId,
    activeSession,
    messages,
    events,
    loading,
    loaded,
    model,
    send,
    newSession,
    selectSession,
    deleteSession,
  };
}
