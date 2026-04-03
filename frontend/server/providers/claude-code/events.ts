import type { AppEvent } from "summit-types";

export interface AgentStreamState {
  currentToolName: string | null;
  currentToolInput: string;
  assistantText: string;
  assistantMeta: { duration_ms?: number; cost_usd?: number; output_tokens?: number } | null;
}

export function createStreamState(): AgentStreamState {
  return {
    currentToolName: null,
    currentToolInput: "",
    assistantText: "",
    assistantMeta: null,
  };
}

/**
 * Translate a raw SDK message into zero or more app-level events.
 * Mutates `state` to track multi-message tool input accumulation and text.
 */
export function translateMessage(message: any, state: AgentStreamState): AppEvent[] {
  const events: AppEvent[] = [];
  switch (message.type) {
    case "system": {
      const data = message.data ?? message;
      if (data.subtype === "init" || data.session_id) {
        events.push({
          type: "init",
          sessionId: data.session_id ?? null,
          model: data.model,
          tools: Array.isArray(data.tools) ? data.tools.length : 0,
        });
      }
      break;
    }

    case "stream_event": {
      const se = message.event;
      if (!se) break;

      if (se.type === "content_block_start") {
        const cb = se.content_block;
        if (cb?.type === "thinking") {
          events.push({ type: "thinking" });
        } else if (cb?.type === "tool_use") {
          state.currentToolName = cb.name;
          state.currentToolInput = "";
        }
      } else if (se.type === "content_block_delta") {
        const delta = se.delta;
        if (delta?.type === "text_delta" && delta.text) {
          state.assistantText += delta.text;
          events.push({ type: "text", text: delta.text });
        } else if (delta?.type === "input_json_delta" && delta.partial_json) {
          state.currentToolInput += delta.partial_json;
        }
      } else if (se.type === "content_block_stop") {
        if (state.currentToolName) {
          let input: Record<string, any> = {};
          try { input = JSON.parse(state.currentToolInput); } catch {}
          events.push({ type: "tool_use", tool: state.currentToolName, input });
          state.currentToolName = null;
          state.currentToolInput = "";
        }
      }
      break;
    }

    case "assistant": {
      if (message.error) {
        const content = message.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              events.push({ type: "error", text: block.text });
            }
          }
        }
      }
      break;
    }

    case "user": {
      const toolResult = message.tool_use_result;
      if (toolResult) {
        const text = toolResult.stdout || toolResult.content || toolResult.error || "";
        events.push({
          type: "tool_result",
          is_error: !!toolResult.is_error,
          content: String(text).slice(0, 300),
        });
      }
      const content = message.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "tool_result") {
            events.push({
              type: "tool_result",
              is_error: block.is_error || false,
              content: typeof block.content === "string" ? block.content.slice(0, 300) : "",
            });
          }
        }
      }
      break;
    }

    case "result": {
      if (!message.is_error && message.result) {
        state.assistantText = message.result;
        state.assistantMeta = {
          duration_ms: message.duration_ms,
          cost_usd: message.total_cost_usd,
          output_tokens: message.usage?.output_tokens,
        };
      }
      events.push({
        type: "result",
        text: message.result,
        is_error: message.is_error,
        duration_ms: message.duration_ms,
        cost_usd: message.total_cost_usd,
        input_tokens: message.usage?.input_tokens,
        output_tokens: message.usage?.output_tokens,
      });
      break;
    }
  }

  return events;
}
