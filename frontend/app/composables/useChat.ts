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

  let sessionId: string | null = null;
  let currentId = "";
  let assistantText = "";
  let controller: AbortController | null = null;

  function handleEvent(msg: Record<string, any>) {
    switch (msg.type) {
      case "session":
        sessionId = msg.sessionId;
        break;

      case "init":
        if (msg.model) model.value = msg.model;
        break;

      case "thinking":
        events.value.push({ id: uid(), type: "thinking", label: "Thinking" });
        break;

      case "tool_use":
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
        events.value = events.value.filter((e) => e.type !== "thinking");
        assistantText += msg.text;
        {
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
  }

  async function send(text: string) {
    if (!text.trim() || loading.value) return;

    messages.value.push({ id: uid(), role: "user", content: text });
    loading.value = true;
    assistantText = "";
    currentId = uid();
    events.value = [];

    controller = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sessionId }),
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
            const data = JSON.parse(line.slice(6));
            handleEvent(data);
          } catch {}
        }
      }

      // Process remaining buffer
      if (buffer.startsWith("data: ")) {
        try {
          handleEvent(JSON.parse(buffer.slice(6)));
        } catch {}
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        messages.value.push({ id: uid(), role: "error", content: err.message });
      }
      loading.value = false;
      events.value = [];
    }

    controller = null;
  }

  return { messages, events, loading, model, send };
}
