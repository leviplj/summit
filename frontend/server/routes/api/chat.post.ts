import { query } from "@anthropic-ai/claude-agent-sdk";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ text: string; sessionId: string }>(event);
  if (!body?.text || !body?.sessionId) {
    throw createError({ statusCode: 400, message: "Missing text or sessionId" });
  }

  const session = await getStoredSession(body.sessionId);
  if (!session) {
    throw createError({ statusCode: 404, message: "Session not found" });
  }

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
      let assistantText = "";
      let assistantMeta: any = null;
      const errorMessages: typeof session.messages = [];

      try {
        const q = query({
          prompt: body.text,
          options: {
            permissionMode: "bypassPermissions",
            includePartialMessages: true,
            cwd: process.cwd(),
            ...(session.agentSessionId ? { resume: session.agentSessionId } : {}),
          },
        });

        for await (const message of q) {
          switch (message.type) {
            case "system": {
              const data = (message as any).data ?? message;
              if (data.subtype === "init" || data.session_id) {
                const sid = data.session_id;
                if (sid && !session.agentSessionId) {
                  session.agentSessionId = sid;
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
                  assistantText += delta.text;
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
                      errorMessages.push({ id: String(Date.now()), role: "error", content: block.text });
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
              if (!m.is_error && m.result) {
                assistantText = m.result;
                assistantMeta = {
                  duration_ms: m.duration_ms,
                  cost_usd: m.total_cost_usd,
                  output_tokens: m.usage?.output_tokens,
                };
              }
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
        errorMessages.push({ id: String(Date.now()), role: "error", content: err.message || String(err) });
      }

      // Persist messages
      session.messages.push({ id: String(Date.now() - 1), role: "user", content: body.text });
      if (assistantText) {
        session.messages.push({
          id: String(Date.now()),
          role: "assistant",
          content: assistantText,
          ...(assistantMeta ? { meta: assistantMeta } : {}),
        });
      }
      session.messages.push(...errorMessages);

      if (session.messages.filter((m) => m.role === "user").length === 1) {
        session.title = body.text.length > 40 ? body.text.slice(0, 40) + "…" : body.text;
      }

      await saveSession(session);

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
