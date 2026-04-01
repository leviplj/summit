import type { AppEvent, TeammateStatus } from "~~/shared/types";
import type { ClientSession } from "./useSessionStore";

export function useTeamStore(getSession: () => ClientSession | undefined) {

  const teammates = computed(() => getSession()?.teammates ?? []);
  const activeTabId = computed(() => getSession()?.activeTabId ?? null);
  const teamActive = computed(() => getSession()?.teamActive ?? false);

  const activeTab = computed(() => {
    const s = getSession();
    if (!s || !s.activeTabId || s.activeTabId === "orchestrator") return null;
    return s.teammates.find((t) => t.id === s.activeTabId) ?? null;
  });

  function handleTeamEvent(event: AppEvent): boolean {
    const session = getSession();
    if (!session) return false;

    switch (event.type) {
      case "team_created": {
        session.teamActive = true;
        const teamList = event.teammates as Array<{ id: string; role: string; status: TeammateStatus }>;
        for (const t of teamList) {
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
        if (!session.activeTabId && session.teammates.length > 0) {
          session.activeTabId = "orchestrator";
        }
        return true;
      }

      case "teammate_status": {
        const tab = session.teammates.find((t) => t.id === event.teammateId);
        if (tab) {
          tab.status = event.status as TeammateStatus;
        }
        return true;
      }

      case "teammate_message": {
        const tab = session.teammates.find((t) => t.id === event.teammateId);
        if (tab) {
          const direction = event.direction as string;
          const otherName = direction === "sent"
            ? (event.toName as string)
            : (event.fromName as string);
          const prefix = direction === "sent" ? `→ ${otherName}` : `← ${otherName}`;
          tab.messages.push({
            id: uid() + Math.random(),
            role: "assistant",
            content: `**${prefix}:** ${event.content as string}`,
          });
        }
        return true;
      }

      case "teammate_done": {
        const tab = session.teammates.find((t) => t.id === event.teammateId);
        if (tab) {
          tab.status = "done";
          tab.messages.push({
            id: uid(),
            role: "assistant",
            content: `**Done:** ${event.summary as string}`,
          });
        }
        return true;
      }

      default:
        return false;
    }
  }

  function routeTeammateEvent(event: AppEvent): boolean {
    const session = getSession();
    if (!session || !session.teamActive || !event.teammateId) return false;

    const tab = session.teammates.find((t) => t.id === event.teammateId);
    if (!tab) return false;

    switch (event.type) {
      case "thinking":
        tab.status = "working";
        tab.events.push({ id: uid(), type: "thinking", label: "Thinking" });
        break;

      case "tool_use": {
        tab.status = "working";
        // Keep only the last few completed tool pairs + any in-progress items
        const MAX_EVENTS = 10;
        if (tab.events.length > MAX_EVENTS) {
          tab.events = tab.events.slice(-MAX_EVENTS);
        }
        tab.events = tab.events.filter((e) => e.type !== "thinking");
        tab.events.push({
          id: uid(),
          type: "tool_use",
          label: formatToolUse(event.tool as string, event.input as Record<string, any>),
          toolUseId: event.toolUseId as string | undefined,
        });
        break;
      }

      case "tool_result": {
        const toolUseId = event.toolUseId as string | undefined;
        const match = toolUseId ? tab.events.find((e) => e.toolUseId === toolUseId && e.type === "tool_use") : null;
        if (match) {
          match.done = true;
          match.isError = event.is_error as boolean;
        }
        const content = event.content as string;
        if (event.is_error || (content && content !== "Done" && !match)) {
          tab.events.push({
            id: uid(),
            type: "tool_result",
            label: content || "Error",
            isError: event.is_error as boolean,
          });
        }
        break;
      }

      case "text":
        tab.streamText += event.text as string;
        break;

      case "result":
        if (!event.is_error && event.text) {
          tab.messages.push({
            id: uid(),
            role: "assistant",
            content: event.text as string,
          });
        }
        if (event.cost_usd) tab.costUsd += event.cost_usd as number;
        if (event.output_tokens) tab.outputTokens += event.output_tokens as number;
        tab.streamText = "";
        tab.events = [];
        break;

      case "ask_user":
        tab.askUser = (event.questions as any[]) || [];
        tab.askId = event.askId as string | undefined;
        break;

      case "error":
        tab.messages.push({
          id: uid(),
          role: "error",
          content: event.text as string,
        });
        tab.status = "error";
        break;

      default:
        return false;
    }

    return true;
  }

  function selectTab(id: string) {
    const session = getSession();
    if (session) session.activeTabId = id;
  }

  function reset() {
    const session = getSession();
    if (!session) return;
    session.teammates = [];
    session.activeTabId = null;
    session.teamActive = false;
  }

  return {
    teammates,
    activeTabId,
    teamActive,
    activeTab,
    handleTeamEvent,
    routeTeammateEvent,
    selectTab,
    reset,
  };
}
