import type { AppEvent } from "~~/shared/types";
import type { ClientSession } from "./useSessionStore";

export type { SessionStatus } from "~~/shared/types";


export function useChat() {
  const store = useSessionStore();
  const { connect } = useStream();
  const model = ref("");
  const team = useTeamStore(() => store.activeSession.value);

  // Per-session streaming state (ephemeral, not persisted)
  const streamState = new Map<string, { msgId: string; text: string }>();

  function handleEvent(session: ClientSession, event: AppEvent) {
    // Route team-specific events to team store
    if (team.handleTeamEvent(event)) return;
    if (team.routeTeammateEvent(event)) return;

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
        session.status = event.tool === "AskUserQuestion" ? "ask_user" : "tool";
        session.events = session.events.filter((e) => e.type !== "thinking");
        if (event.tool !== "AskUserQuestion") {
          session.events.push({
            id: uid(),
            type: "tool_use",
            label: formatToolUse(event.tool as string, event.input as Record<string, any>),
          });
        }
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

      case "turn_done":
        // Orchestrator finished but teammates still active — keep stream open
        session.loading = false;
        session.status = "idle";
        session.events = [];
        session.askUser = null;
        session.askId = undefined;
        session.elicitation = null;
        // DON'T delete streamState or disconnect — teammate events still flowing
        store.reloadSession(session.id);
        break;

      case "done":
        session.loading = false;
        session.status = "idle";
        session.events = [];
        session.askUser = null;
        session.askId = undefined;
        session.elicitation = null;
        streamState.delete(session.id);
        store.reloadSession(session.id);
        break;

      case "ask_user":
        session.status = "ask_user";
        session.events = session.events.filter((e) => e.type !== "thinking");
        session.askUser = (event.questions as any[]) || [];
        session.askId = event.askId as string | undefined;
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
    if (!session) return;

    // Determine askId — from teammate tab or orchestrator session
    let askId: string | undefined;
    const activeTab = team.activeTab.value;
    if (activeTab?.askUser) {
      askId = activeTab.askId;
      activeTab.askUser = null;
      activeTab.askId = undefined;
      // Teammate question — don't change session status, the orchestrator may not be running
    } else if (session.askUser) {
      askId = session.askId;
      session.askUser = null;
      session.askId = undefined;
      session.status = "waiting";
    } else {
      return;
    }

    try {
      await $fetch(`/api/sessions/${session.id}/ask-user`, {
        method: "POST",
        body: { askId, answers },
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

    // Wait for server-side session creation (worktree setup) to complete
    await store.waitForCreation(session.id);

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

    // Only start a new stream if we don't already have one (teammates may keep it alive)
    if (!streamState.has(session.id)) {
      startStreaming(session);
    } else {
      // Stream is already connected — just reset the text accumulator for the new turn
      streamState.set(session.id, { msgId: uid(), text: "" });
    }
  }

  onMounted(async () => {
    const sessionsWithStatus = await store.loadSessions();
    for (const { session, hasActiveQuery, teamState } of sessionsWithStatus) {
      // Restore team state from server onto the session object
      if (teamState && teamState.teammates.length > 0) {
        session.teamActive = true;
        for (const t of teamState.teammates) {
          if (!session.teammates.find((tab) => tab.id === t.id)) {
            session.teammates.push({
              id: t.id,
              role: t.role,
              status: t.status,
              events: [],
              messages: [],
              streamText: "",
              askUser: null,
              costUsd: 0,
              outputTokens: 0,
            });
          }
        }
        if (!session.activeTabId) {
          session.activeTabId = "orchestrator";
        }
      }
      // Reconnect sessions that have active server-side queries
      if (hasActiveQuery) {
        session.loading = true;
        session.status = "waiting";
        startStreaming(session);
      }
    }
  });

  const sessionCost = computed(() => {
    const session = store.activeSession.value;
    if (!session) return null;
    let totalCost = 0;
    let totalTokens = 0;
    let hasCost = false;
    for (const m of session.messages) {
      if (m.meta?.cost_usd) { totalCost += m.meta.cost_usd; hasCost = true; }
      if (m.meta?.output_tokens) { totalTokens += m.meta.output_tokens; }
    }
    // Include teammate costs
    for (const t of session.teammates) {
      if (t.costUsd) { totalCost += t.costUsd; hasCost = true; }
      if (t.outputTokens) { totalTokens += t.outputTokens; }
    }
    return hasCost ? { totalCost, totalTokens } : null;
  });

  return {
    ...store,
    model,
    sessionCost,
    team,
    send,
    cancel,
    respondAskUser,
    respondElicitation,
  };
}
