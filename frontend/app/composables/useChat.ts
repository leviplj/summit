import type { AppEvent } from "~~/shared/types";
import type { ClientSession } from "./useSessionStore";

export type { SessionStatus } from "~~/shared/types";

const TOOL_LABELS: Record<string, (input: Record<string, any>) => string> = {
  Read: (i) => `Reading ${i.file_path || "file"}`,
  Write: (i) => `Writing ${i.file_path || "file"}`,
  Edit: (i) => `Editing ${i.file_path || "file"}`,
  Bash: (i) => `$ ${i.command || "command"}`,
  Glob: (i) => `Searching files: ${i.pattern || ""}`,
  Grep: (i) => `Searching for: ${i.pattern || ""}`,
  WebFetch: (i) => `Fetching ${i.url || "URL"}`,
  WebSearch: (i) => `Searching: ${i.query || ""}`,
};

function formatToolUse(tool: string, input?: Record<string, any>): string {
  if (!input) return `Using ${tool}`;
  const fn = TOOL_LABELS[tool];
  if (fn) return fn(input);
  const s = input.file_path || input.command || input.pattern || input.query || "";
  return s ? `${tool}: ${s}` : `Using ${tool}`;
}

export function useChat() {
  const store = useSessionStore();
  const { connect } = useStream();
  const model = ref("");

  // Per-session streaming state (ephemeral, not persisted)
  const streamState = new Map<string, { msgId: string; text: string }>();

  function handleEvent(session: ClientSession, event: AppEvent) {
    const state = streamState.get(session.id);

    switch (event.type) {
      case "init":
        if (event.model) model.value = event.model as string;
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
          label: formatToolUse(event.tool as string, event.input as Record<string, any>),
        });
        break;

      case "tool_result":
        session.events.push({
          id: uid(),
          type: "tool_result",
          label: (event.content as string) || (event.is_error ? "Error" : "Done"),
          isError: event.is_error as boolean,
        });
        break;

      case "text":
        if (!state) break;
        session.status = "streaming";
        session.events = session.events.filter((e) => e.type !== "thinking");
        state.text += event.text as string;
        {
          const existing = session.messages.find((m) => m.id === state.msgId);
          if (existing) {
            existing.content = state.text;
          } else {
            session.messages.push({ id: state.msgId, role: "assistant", content: state.text });
          }
        }
        break;

      case "result":
        if (!state) break;
        if (!event.is_error && event.text) {
          const m = session.messages.find((m) => m.id === state.msgId);
          if (m) {
            m.content = event.text as string;
            m.meta = {
              duration_ms: event.duration_ms as number,
              cost_usd: event.cost_usd as number,
              output_tokens: event.output_tokens as number,
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
        session.askUser = null;
        session.elicitation = null;
        streamState.delete(session.id);
        store.reloadSession(session.id);
        break;

      case "ask_user":
        session.status = "elicitation";
        session.events = session.events.filter((e) => e.type !== "thinking");
        session.askUser = (event.questions as any[]) || [];
        break;

      case "elicitation":
        session.status = "elicitation";
        session.events = session.events.filter((e) => e.type !== "thinking");
        session.elicitation = {
          id: event.elicitationId as string,
          serverName: event.serverName as string,
          message: event.message as string,
          schema: event.schema as Record<string, unknown> | undefined,
        };
        break;

      case "cancelled":
        session.loading = false;
        session.status = "idle";
        session.events = [];
        break;

      case "error":
        session.events = session.events.filter((e) => e.type !== "thinking");
        session.messages.push({ id: uid(), role: "error", content: event.text as string });
        session.loading = false;
        session.status = "error";
        break;
    }
  }

  function startStreaming(session: ClientSession, afterId = 0) {
    if (!streamState.has(session.id)) {
      streamState.set(session.id, { msgId: uid(), text: "" });
    }

    connect(
      session.id,
      afterId,
      (event) => handleEvent(session, event),
      () => {
        // Stream ended cleanly
        if (session.loading) {
          session.loading = false;
          session.status = "idle";
        }
        streamState.delete(session.id);
      },
      (lastId) => {
        // Disconnected — reconnect if still loading
        if (session.loading) {
          setTimeout(() => startStreaming(session, lastId + 1), 1000);
        } else {
          streamState.delete(session.id);
        }
      },
    );
  }

  async function respondAskUser(answers: Record<string, string>) {
    const session = store.activeSession.value;
    if (!session?.askUser) return;

    session.askUser = null;
    session.status = "waiting";

    try {
      await $fetch(`/api/sessions/${session.id}/ask-user`, {
        method: "POST",
        body: { answers },
      });
    } catch (err: any) {
      session.messages.push({ id: uid(), role: "error", content: err.message });
      session.loading = false;
      session.status = "error";
    }
  }

  async function respondElicitation(action: "accept" | "decline", content?: Record<string, unknown>) {
    const session = store.activeSession.value;
    if (!session?.elicitation) return;

    const elicitationId = session.elicitation.id;
    session.elicitation = null;
    session.status = "waiting";

    try {
      await $fetch(`/api/sessions/${session.id}/elicitation`, {
        method: "POST",
        body: { elicitationId, action, content },
      });
    } catch (err: any) {
      session.messages.push({ id: uid(), role: "error", content: err.message });
      session.loading = false;
      session.status = "error";
    }
  }

  async function cancel() {
    const session = store.activeSession.value;
    if (!session || !session.loading) return;
    try {
      await $fetch(`/api/sessions/${session.id}/cancel`, { method: "POST" });
    } catch {}
  }

  async function send(text: string) {
    if (!text.trim()) return;
    if (!store.activeSession.value) {
      await store.newSession();
    }
    const session = store.activeSession.value;
    if (!session || session.loading) return;

    session.messages.push({ id: uid(), role: "user", content: text });
    session.loading = true;
    session.status = "waiting";
    session.events = [];

    if (session.messages.filter((m) => m.role === "user").length === 1) {
      session.title = text.length > 40 ? text.slice(0, 40) + "…" : text;
    }

    try {
      await $fetch("/api/chat", {
        method: "POST",
        body: { text, sessionId: session.id },
      });
    } catch (err: any) {
      session.messages.push({ id: uid(), role: "error", content: err.message });
      session.loading = false;
      session.status = "error";
      return;
    }

    startStreaming(session);
  }

  onMounted(async () => {
    const sessionsWithStatus = await store.loadSessions();
    // Only reconnect sessions that actually have active server-side queries
    for (const { session, hasActiveQuery } of sessionsWithStatus) {
      if (hasActiveQuery) {
        session.loading = true;
        session.status = "waiting";
        startStreaming(session);
      }
    }
  });

  const sessionCost = computed(() => {
    const msgs = store.activeSession.value?.messages;
    if (!msgs) return null;
    let totalCost = 0;
    let totalTokens = 0;
    let hasCost = false;
    for (const m of msgs) {
      if (m.meta?.cost_usd) { totalCost += m.meta.cost_usd; hasCost = true; }
      if (m.meta?.output_tokens) { totalTokens += m.meta.output_tokens; }
    }
    return hasCost ? { totalCost, totalTokens } : null;
  });

  return {
    ...store,
    model,
    sessionCost,
    send,
    cancel,
    respondAskUser,
    respondElicitation,
  };
}
