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
  const messages = ref<ChatMessage[]>([]);
  const events = ref<ToolEvent[]>([]);
  const loading = ref(false);
  const model = ref("");

  let ws: WebSocket | null = null;
  let currentId = "";
  let assistantText = "";

  function connect() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${location.host}/api/ws`);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      switch (msg.type) {
        case "init":
          if (msg.model) model.value = msg.model;
          break;

        case "start":
          assistantText = "";
          currentId = uid();
          events.value = [];
          break;

        case "thinking":
          events.value.push({ id: uid(), type: "thinking", label: "Thinking" });
          break;

        case "tool_use":
          // Remove thinking indicator
          events.value = events.value.filter((e) => e.type !== "thinking");
          events.value.push({
            id: uid(),
            type: "tool_use",
            label: formatToolUse(msg.tool, msg.input),
          });
          break;

        case "tool_result":
          events.value.push({
            id: uid(),
            type: "tool_result",
            label: msg.content || (msg.is_error ? "Error" : "Done"),
            isError: msg.is_error,
          });
          break;

        case "text":
          // Remove thinking indicator on first text
          events.value = events.value.filter((e) => e.type !== "thinking");
          assistantText += msg.text;
          // Upsert assistant message
          const existing = messages.value.find((m) => m.id === currentId);
          if (existing) {
            existing.content = assistantText;
          } else {
            messages.value.push({
              id: currentId,
              role: "assistant",
              content: assistantText,
            });
          }
          break;

        case "result":
          if (!msg.is_error && msg.text) {
            const m = messages.value.find((m) => m.id === currentId);
            if (m) {
              m.content = msg.text;
              m.meta = {
                duration_ms: msg.duration_ms,
                cost_usd: msg.cost_usd,
                output_tokens: msg.output_tokens,
              };
            }
          }
          loading.value = false;
          events.value = [];
          break;

        case "done":
          loading.value = false;
          events.value = [];
          break;

        case "error":
          events.value = events.value.filter((e) => e.type !== "thinking");
          messages.value.push({ id: uid(), role: "error", content: msg.text });
          loading.value = false;
          break;
      }
    };

    ws.onclose = () => setTimeout(connect, 1000);
  }

  function send(text: string) {
    if (!text.trim() || !ws || loading.value) return;
    messages.value.push({ id: uid(), role: "user", content: text });
    ws.send(JSON.stringify({ type: "chat", text }));
    loading.value = true;
  }

  onMounted(connect);

  return { messages, events, loading, model, send };
}
