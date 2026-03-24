import { query } from "@anthropic-ai/claude-agent-sdk";

const sessions = new Map<string, string>(); // clientId -> agentSessionId

export default defineEventHandler(async (event) => {
  const body = await readBody<{ text: string; sessionId?: string }>(event);
  if (!body?.text) {
    throw createError({ statusCode: 400, message: "Missing text" });
  }

  const clientSessionId = body.sessionId;
  const agentSessionId = clientSessionId ? sessions.get(clientSessionId) : undefined;

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      let currentToolName: string | null = null;
      let currentToolInput = "";

      try {
        const q = query({
          prompt: body.text,
          options: {
            permissionMode: "bypassPermissions",
            includePartialMessages: true,
            cwd: process.cwd(),
            ...(agentSessionId ? { resume: agentSessionId } : {}),
          },
        });

        for await (const message of q) {
          switch (message.type) {
            case "system": {
              const data = (message as any).data ?? message;
              if (data.subtype === "init" || data.session_id) {
                const sid = data.session_id;
                if (sid && clientSessionId) {
                  sessions.set(clientSessionId, sid);
                } else if (sid) {
                  // Send session ID to client so it can resume
                  const newClientId = crypto.randomUUID();
                  sessions.set(newClientId, sid);
                  send({ type: "session", sessionId: newClientId });
                }
                send({
                  type: "init",
                  model: data.model,
                  tools: Array.isArray(data.tools) ? data.tools.length : 0,
                });
              }
              break;
            }

            case "stream_event": {
              const se = (message as any).event;
              if (!se) break;

              if (se.type === "content_block_start") {
                const cb = se.content_block;
                if (cb?.type === "thinking") {
                  send({ type: "thinking" });
                } else if (cb?.type === "tool_use") {
                  currentToolName = cb.name;
                  currentToolInput = "";
                }
              } else if (se.type === "content_block_delta") {
                const delta = se.delta;
                if (delta?.type === "text_delta" && delta.text) {
                  send({ type: "text", text: delta.text });
                } else if (delta?.type === "input_json_delta" && delta.partial_json) {
                  currentToolInput += delta.partial_json;
                }
              } else if (se.type === "content_block_stop") {
                if (currentToolName) {
                  let input: Record<string, any> = {};
                  try { input = JSON.parse(currentToolInput); } catch {}
                  send({ type: "tool_use", tool: currentToolName, input });
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
                      send({ type: "error", text: block.text });
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
                send({
                  type: "tool_result",
                  is_error: !!toolResult.is_error,
                  content: String(text).slice(0, 300),
                });
              }
              const content = (message as any).message?.content;
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === "tool_result") {
                    send({
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
              const m = message as any;
              send({
                type: "result",
                text: m.result,
                is_error: m.is_error,
                duration_ms: m.duration_ms,
                cost_usd: m.total_cost_usd,
                input_tokens: m.usage?.input_tokens,
                output_tokens: m.usage?.output_tokens,
              });
              break;
            }
          }
        }
      } catch (err: any) {
        send({ type: "error", text: err.message || String(err) });
      }

      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
