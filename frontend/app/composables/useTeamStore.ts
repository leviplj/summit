import type { AppEvent, TeammateStatus } from "~~/shared/types";
import type { ToolEvent } from "./useSessionStore";

export interface TeammateTab {
  id: string;
  role: string;
  status: TeammateStatus;
  events: ToolEvent[];
  messages: Array<{ id: string; role: "assistant" | "error"; content: string }>;
  streamText: string;
  askUser: any[] | null;
}

export function useTeamStore() {
  const teammates = ref<TeammateTab[]>([]);
  const activeTabId = ref<string | null>(null);
  const teamActive = ref(false);

  function handleTeamEvent(event: AppEvent): boolean {
    switch (event.type) {
      case "team_created": {
        teamActive.value = true;
        const teamList = event.teammates as Array<{ id: string; role: string; status: TeammateStatus }>;
        for (const t of teamList) {
          if (!teammates.value.find((tab) => tab.id === t.id)) {
            teammates.value.push({
              id: t.id,
              role: t.role,
              status: t.status,
              events: [],
              messages: [],
              streamText: "",
              askUser: null,
            });
          }
        }
        // Auto-select first teammate if no tab selected
        if (!activeTabId.value && teammates.value.length > 0) {
          activeTabId.value = "orchestrator";
        }
        return true;
      }

      case "teammate_status": {
        const tab = teammates.value.find((t) => t.id === event.teammateId);
        if (tab) {
          tab.status = event.status as TeammateStatus;
        }
        return true;
      }

      case "teammate_message": {
        // Add to both sender and recipient tabs
        const tab = teammates.value.find((t) => t.id === event.teammateId);
        if (tab) {
          const direction = event.direction as string;
          const otherName = direction === "sent"
            ? (event.toName as string)
            : (event.fromName as string);
          const prefix = direction === "sent" ? `→ ${otherName}` : `← ${otherName}`;
          tab.messages.push({
            id: String(Date.now()) + Math.random(),
            role: "assistant",
            content: `**${prefix}:** ${event.content as string}`,
          });
        }
        return true;
      }

      case "teammate_done": {
        const tab = teammates.value.find((t) => t.id === event.teammateId);
        if (tab) {
          tab.status = "done";
          tab.messages.push({
            id: String(Date.now()),
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

  /**
   * Route a regular event (thinking, tool_use, text, etc.) to the correct teammate tab.
   * Returns true if the event was routed to a teammate, false if it's for the orchestrator.
   */
  function routeTeammateEvent(event: AppEvent): boolean {
    if (!teamActive.value || !event.teammateId) return false;

    const tab = teammates.value.find((t) => t.id === event.teammateId);
    if (!tab) return false;

    switch (event.type) {
      case "thinking":
        tab.status = "working";
        tab.events.push({ id: String(Date.now()), type: "thinking", label: "Thinking" });
        break;

      case "tool_use":
        tab.status = "working";
        tab.events = tab.events.filter((e) => e.type !== "thinking");
        tab.events.push({
          id: String(Date.now()),
          type: "tool_use",
          label: `${event.tool}: ${(event.input as any)?.file_path || (event.input as any)?.command || ""}`,
        });
        break;

      case "tool_result":
        tab.events.push({
          id: String(Date.now()),
          type: "tool_result",
          label: (event.content as string) || "Done",
          isError: event.is_error as boolean,
        });
        break;

      case "text":
        tab.streamText += event.text as string;
        break;

      case "result":
        if (!event.is_error && event.text) {
          tab.messages.push({
            id: String(Date.now()),
            role: "assistant",
            content: event.text as string,
          });
        }
        tab.streamText = "";
        tab.events = [];
        break;

      case "ask_user":
        tab.askUser = (event.questions as any[]) || [];
        break;

      case "error":
        tab.messages.push({
          id: String(Date.now()),
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
    activeTabId.value = id;
  }

  function reset() {
    teammates.value = [];
    activeTabId.value = null;
    teamActive.value = false;
  }

  const activeTab = computed(() => {
    if (activeTabId.value === "orchestrator" || !activeTabId.value) return null;
    return teammates.value.find((t) => t.id === activeTabId.value) ?? null;
  });

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
