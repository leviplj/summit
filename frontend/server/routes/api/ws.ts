import { query } from "@anthropic-ai/claude-agent-sdk";

interface PeerState {
  sessionId: string | null;
  activeQuery: ReturnType<typeof query> | null;
}

const peers = new Map<unknown, PeerState>();

export default defineWebSocketHandler({
  open(peer) {
    console.log("Client connected");
    peers.set(peer, { sessionId: null, activeQuery: null });
  },

  async message(peer, rawMsg) {
    const state = peers.get(peer);
    if (!state) return;

    let msg: { type: string; text?: string };
    try {
      msg = JSON.parse(typeof rawMsg === "string" ? rawMsg : rawMsg.text());
    } catch {
      return;
    }

    if (msg.type !== "chat" || !msg.text) return;

    if (state.activeQuery) {
      peer.send(JSON.stringify({ type: "error", text: "A request is already in progress." }));
      return;
    }

    const prompt = msg.text;
    console.log("Received prompt:", prompt);

    peer.send(JSON.stringify({ type: "start" }));

    let currentToolName: string | null = null;
    let currentToolInput = "";

    try {
      const q = query({
        prompt,
        options: {
          permissionMode: "bypassPermissions",
          includePartialMessages: true,
          cwd: process.cwd(),
          ...(state.sessionId ? { resume: state.sessionId } : {}),
        },
      });

      state.activeQuery = q;

      for await (const message of q) {
        switch (message.type) {
          case "system": {
            const data = (message as any).data ?? message;
            if (data.subtype === "init" || data.session_id) {
              const sid = data.session_id;
              if (sid && !state.sessionId) {
                state.sessionId = sid;
                console.log("Session started:", sid);
              }
              peer.send(JSON.stringify({
                type: "init",
                model: data.model,
                tools: Array.isArray(data.tools) ? data.tools.length : 0,
              }));
            }
            break;
          }

          case "stream_event": {
            const se = (message as any).event;
            if (!se) break;

            if (se.type === "content_block_start") {
              const cb = se.content_block;
              if (cb?.type === "thinking") {
                peer.send(JSON.stringify({ type: "thinking" }));
              } else if (cb?.type === "tool_use") {
                currentToolName = cb.name;
                currentToolInput = "";
              }
            } else if (se.type === "content_block_delta") {
              const delta = se.delta;
              if (delta?.type === "text_delta" && delta.text) {
                peer.send(JSON.stringify({ type: "text", text: delta.text }));
              } else if (delta?.type === "input_json_delta" && delta.partial_json) {
                currentToolInput += delta.partial_json;
              }
            } else if (se.type === "content_block_stop") {
              if (currentToolName) {
                let input: Record<string, any> = {};
                try { input = JSON.parse(currentToolInput); } catch {}
                peer.send(JSON.stringify({
                  type: "tool_use",
                  tool: currentToolName,
                  input,
                }));
                currentToolName = null;
                currentToolInput = "";
              }
            }
            break;
          }

          case "assistant": {
            const err = (message as any).error;
            if (err) {
              const content = (message as any).message?.content;
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === "text" && block.text) {
                    peer.send(JSON.stringify({ type: "error", text: block.text }));
                  }
                }
              }
            }
            break;
          }

          case "user": {
            const toolResult = (message as any).tool_use_result;
            if (toolResult) {
              const text = toolResult.stdout || toolResult.content || toolResult.error || "";
              peer.send(JSON.stringify({
                type: "tool_result",
                is_error: !!toolResult.is_error,
                content: String(text).slice(0, 300),
              }));
            }
            const content = (message as any).message?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === "tool_result") {
                  peer.send(JSON.stringify({
                    type: "tool_result",
                    is_error: block.is_error || false,
                    content: typeof block.content === "string" ? block.content.slice(0, 300) : "",
                  }));
                }
              }
            }
            break;
          }

          case "result": {
            const m = message as any;
            peer.send(JSON.stringify({
              type: "result",
              text: m.result,
              is_error: m.is_error,
              duration_ms: m.duration_ms,
              cost_usd: m.total_cost_usd,
              input_tokens: m.usage?.input_tokens,
              output_tokens: m.usage?.output_tokens,
            }));
            break;
          }
        }
      }
    } catch (err: any) {
      peer.send(JSON.stringify({ type: "error", text: err.message || String(err) }));
    }

    state.activeQuery = null;
    peer.send(JSON.stringify({ type: "done", code: 0 }));
  },

  close(peer) {
    console.log("Client disconnected");
    const state = peers.get(peer);
    if (state?.activeQuery) {
      state.activeQuery.close();
    }
    peers.delete(peer);
  },
});
