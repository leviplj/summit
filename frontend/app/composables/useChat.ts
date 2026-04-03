import type { AppEvent } from "summit-types";
import type { ClientSession, ClientConversation } from "./useSessionStore";

export type { SessionStatus } from "summit-types";

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

  // Per-conversation streaming state keyed by "sessionId:conversationId"
  const streamState = new Map<string, { msgId: string; text: string }>();

  function streamKey(sessionId: string, conversationId: string = "lead"): string {
    return `${sessionId}:${conversationId}`;
  }

  function getSession(id: string): ClientSession | undefined {
    return store.sessions.value.find((s: ClientSession) => s.id === id);
  }

  function handleEvent(session: ClientSession, event: AppEvent) {
    // Team lifecycle: team_created creates conversation tabs
    if (event.type === "team_created") {
      const roster = event.teammates as Array<{ id: string; role: string }>;
      for (const t of roster) {
        store.ensureConversation(session.id, t.id, t.role);
      }
      // Set active conversation to lead (orchestrator view)
      if (session.activeConversationId === "lead") {
        session.activeConversationId = "lead";
      }
      return;
    }

    // Conversation lifecycle events
    if (event.type === "conversation_status") {
      const conv = store.ensureConversation(
        session.id,
        event.conversationId as string,
        event.conversationRole as string,
      );
      if (conv) conv.status = event.status as ClientConversation["status"];
      return;
    }

    if (event.type === "conversation_done") {
      const conv = store.ensureConversation(
        session.id,
        event.conversationId as string,
        event.conversationRole as string,
      );
      if (conv) conv.status = "done";
      return;
    }

    if (event.type === "conversation_message") {
      const from = event.from as string;
      const to = event.to as string;
      const content = event.content as string;
      for (const id of [from, to]) {
        const conv = session.conversations.find((c) => c.id === id);
        if (conv) {
          conv.messages.push({
            id: uid(),
            role: "assistant",
            content: `**${from}** → **${to}**: ${content}`,
          });
        }
      }
      return;
    }

    // Determine target conversation
    const conversationId = (event.conversationId as string) || "lead";
    const conv = store.ensureConversation(session.id, conversationId);
    if (!conv) return;

    const isLead = conversationId === "lead";
    const sk = streamKey(session.id, conversationId);
    const state = streamState.get(sk);

    switch (event.type) {
      case "init":
        if (event.model) model.value = event.model as string;
        break;

      case "thinking":
        if (isLead) session.status = "thinking";
        conv.events.push({ id: uid(), type: "thinking", label: "Thinking" });
        break;

      case "tool_use":
        if (isLead) session.status = event.tool === "AskUserQuestion" ? "ask_user" : "tool";
        conv.events = conv.events.filter((e) => e.type !== "thinking");
        if (event.tool !== "AskUserQuestion") {
          conv.events.push({
            id: uid(),
            type: "tool_use",
            label: formatToolUse(event.tool as string, event.input as Record<string, any>),
          });
        }
        break;

      case "tool_result":
        conv.events.push({
          id: uid(),
          type: "tool_result",
          label: (event.content as string) || (event.is_error ? "Error" : "Done"),
          isError: event.is_error as boolean,
        });
        break;

      case "text": {
        if (!state) break;
        if (isLead) session.status = "streaming";
        conv.events = conv.events.filter((e) => e.type !== "thinking");
        state.text += event.text as string;
        conv.streamText = state.text;
        const existing = conv.messages.find((m) => m.id === state.msgId);
        if (existing) {
          existing.content = state.text;
        } else {
          conv.messages.push({ id: state.msgId, role: "assistant", content: state.text });
        }
        break;
      }

      case "result":
        if (!state) break;
        if (!event.is_error && event.text) {
          const m = conv.messages.find((m) => m.id === state.msgId);
          if (m) {
            m.content = event.text as string;
            m.meta = {
              duration_ms: event.duration_ms as number,
              cost_usd: event.cost_usd as number,
              output_tokens: event.output_tokens as number,
            };
          }
        }
        if (isLead) {
          session.loading = false;
          session.status = "idle";
        }
        conv.events = [];
        break;

      case "turn_done":
        // Orchestrator finished but teammates may still be active
        session.loading = false;
        session.status = "idle";
        conv.events = [];
        streamState.delete(sk);
        break;

      case "done":
        if (isLead) {
          session.loading = false;
          session.status = "idle";
          session.elicitation = null;
          // Clear all stream state for this session
          for (const key of streamState.keys()) {
            if (key.startsWith(`${session.id}:`)) streamState.delete(key);
          }
          store.reloadSession(session.id);
        } else {
          conv.events = [];
          streamState.delete(sk);
        }
        break;

      case "ask_user":
        session.status = "ask_user";
        conv.events = conv.events.filter((e) => e.type !== "thinking");
        conv.askUser = (event.questions as any[]) || [];
        break;

      case "elicitation":
        if (isLead) {
          session.status = "elicitation";
          conv.events = conv.events.filter((e) => e.type !== "thinking");
          session.elicitation = {
            id: event.elicitationId as string,
            serverName: event.serverName as string,
            message: event.message as string,
            schema: event.schema as Record<string, unknown> | undefined,
          };
        }
        break;

      case "cancelled":
        if (isLead) {
          session.loading = false;
          session.status = "idle";
        }
        conv.events = [];
        break;

      case "error":
        conv.events = conv.events.filter((e) => e.type !== "thinking");
        conv.messages.push({ id: uid(), role: "error", content: event.text as string });
        if (isLead) {
          session.loading = false;
          session.status = "error";
        }
        break;
    }
  }

  function startStreaming(sessionId: string, afterId = 0) {
    const sk = streamKey(sessionId, "lead");
    if (!streamState.has(sk)) {
      streamState.set(sk, { msgId: uid(), text: "" });
    }

    connect(
      sessionId,
      afterId,
      (event) => {
        const session = getSession(sessionId);
        if (!session) return;

        // Ensure stream state exists for conversation-scoped events
        const conversationId = (event.conversationId as string) || "lead";
        const csk = streamKey(sessionId, conversationId);
        if (!streamState.has(csk) && conversationId !== "lead") {
          streamState.set(csk, { msgId: uid(), text: "" });
        }

        handleEvent(session, event);
      },
      () => {
        const session = getSession(sessionId);
        if (session?.loading) {
          session.loading = false;
          session.status = "idle";
        }
        for (const key of streamState.keys()) {
          if (key.startsWith(`${sessionId}:`)) streamState.delete(key);
        }
      },
      (lastId) => {
        const session = getSession(sessionId);
        if (session?.loading) {
          setTimeout(() => startStreaming(sessionId, lastId + 1), 1000);
        } else {
          for (const key of streamState.keys()) {
            if (key.startsWith(`${sessionId}:`)) streamState.delete(key);
          }
        }
      },
    );
  }

  async function respondAskUser(answers: Record<string, string>, conversationId?: string) {
    const session = store.activeSession.value;
    if (!session) return;

    const conv = store.getConversation(session.id, conversationId || "lead");
    if (!conv?.askUser) return;
    conv.askUser = null;

    // If no other conversation still needs input, clear the session-level status
    const anyAskUser = session.conversations.some((c) => c.askUser);
    if (!anyAskUser) {
      session.status = "waiting";
    }

    try {
      await $fetch(`/api/sessions/${session.id}/ask-user`, {
        method: "POST",
        body: { answers, ...(conversationId ? { conversationId } : {}) },
      });
    } catch (err: any) {
      const lead = store.getConversation(session.id, "lead");
      if (lead) lead.messages.push({ id: uid(), role: "error", content: err.message });
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
      const lead = store.getConversation(session.id, "lead");
      if (lead) lead.messages.push({ id: uid(), role: "error", content: err.message });
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

    await store.waitForCreation(session.id);

    // Clear teammate conversations from prior query
    store.clearTeammateConversations(session.id);

    const lead = session.conversations.find((c) => c.id === "lead");
    if (!lead) return;

    lead.messages.push({ id: uid(), role: "user", content: text });
    session.loading = true;
    session.status = "waiting";
    lead.events = [];

    if (lead.messages.filter((m) => m.role === "user").length === 1) {
      session.title = text.length > 40 ? text.slice(0, 40) + "…" : text;
    }

    try {
      await $fetch("/api/chat", {
        method: "POST",
        body: { text, sessionId: session.id },
      });
    } catch (err: any) {
      lead.messages.push({ id: uid(), role: "error", content: err.message });
      session.loading = false;
      session.status = "error";
      return;
    }

    startStreaming(session.id);
  }

  onMounted(async () => {
    const sessionsWithStatus = await store.loadSessions();
    for (const { session, hasActiveQuery } of sessionsWithStatus) {
      if (hasActiveQuery) {
        session.loading = true;
        session.status = "waiting";
        startStreaming(session.id);
      }
    }
  });

  useGlobalEvents(async () => {
    const sessionsWithStatus = await store.loadSessions();
    for (const { session, hasActiveQuery } of sessionsWithStatus) {
      if (hasActiveQuery && !streamState.has(streamKey(session.id, "lead"))) {
        session.loading = true;
        session.status = "waiting";
        startStreaming(session.id);
      }
    }
  });

  const sessionCost = computed(() => {
    const convs = store.activeSession.value?.conversations;
    if (!convs) return null;
    let totalCost = 0;
    let totalTokens = 0;
    let hasCost = false;
    for (const conv of convs) {
      for (const m of conv.messages) {
        if (m.meta?.cost_usd) { totalCost += m.meta.cost_usd; hasCost = true; }
        if (m.meta?.output_tokens) { totalTokens += m.meta.output_tokens; }
      }
    }
    return hasCost ? { totalCost, totalTokens } : null;
  });

  function selectSession(id: string) {
    store.selectSession(id);
  }

  return {
    ...store,
    selectSession,
    model,
    sessionCost,
    send,
    cancel,
    respondAskUser,
    respondElicitation,
  };
}
