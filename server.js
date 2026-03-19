import { spawn } from "bun";
import { join } from "path";

const PORT = process.env.PORT || 3000;

function serveStatic(pathname) {
  try {
    const filePath = join(import.meta.dir, "public", pathname === "/" ? "index.html" : pathname);
    const file = Bun.file(filePath);
    return new Response(file);
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

const server = Bun.serve({
  port: PORT,

  fetch(req, server) {
    const url = new URL(req.url);

    // Upgrade WebSocket requests
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Serve static files
    return serveStatic(url.pathname);
  },

  websocket: {
    open(ws) {
      console.log("Client connected");
      ws.data = { activeProcess: null, sessionId: null };
    },

    async message(ws, data) {
      const msg = JSON.parse(data);

      if (msg.type !== "chat") return;

      if (ws.data.activeProcess) {
        ws.send(JSON.stringify({ type: "error", text: "A request is already in progress." }));
        return;
      }

      const prompt = msg.text;
      console.log("Received prompt:", prompt);

      // Unset CLAUDECODE to avoid nesting detection
      const env = { ...process.env };
      delete env.CLAUDECODE;

      const cmd = ["claude", "-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages", "--dangerously-skip-permissions"];
      if (ws.data.sessionId) {
        cmd.push("--resume", ws.data.sessionId);
      }
      cmd.push(prompt);

      const claude = spawn({
        cmd,
        env,
        stdout: "pipe",
        stderr: "pipe",
      });

      ws.data.activeProcess = claude;
      let currentToolName = null;
      let currentToolInput = "";
      ws.send(JSON.stringify({ type: "start" }));

      // Read streaming output
      const reader = claude.stdout.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop(); // keep incomplete line

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);

              if (event.type === "system") {
                if (event.subtype === "init") {
                  if (event.session_id && !ws.data.sessionId) {
                    ws.data.sessionId = event.session_id;
                    console.log("Session started:", event.session_id);
                  }
                  ws.send(JSON.stringify({
                    type: "init",
                    model: event.model,
                    tools: event.tools?.length || 0,
                  }));
                }

              } else if (event.type === "stream_event") {
                const se = event.event;

                if (se.type === "content_block_start") {
                  if (se.content_block?.type === "thinking") {
                    ws.send(JSON.stringify({ type: "thinking" }));
                  } else if (se.content_block?.type === "tool_use") {
                    currentToolName = se.content_block.name;
                    currentToolInput = "";
                  }

                } else if (se.type === "content_block_delta") {
                  const delta = se.delta;
                  if (delta?.type === "text_delta" && delta.text) {
                    ws.send(JSON.stringify({ type: "text", text: delta.text }));
                  } else if (delta?.type === "input_json_delta" && delta.partial_json) {
                    currentToolInput += delta.partial_json;
                  }

                } else if (se.type === "content_block_stop") {
                  if (currentToolName) {
                    let input = {};
                    try { input = JSON.parse(currentToolInput); } catch {}
                    ws.send(JSON.stringify({
                      type: "tool_use",
                      tool: currentToolName,
                      input,
                    }));
                    currentToolName = null;
                    currentToolInput = "";
                  }
                }

              } else if (event.type === "assistant") {
                // tool_use and text blocks are already handled via stream_event deltas.
                // Only handle errors here (synthetic messages from content filter, etc.)
                const content = event.message?.content;
                if (content) {
                  for (const block of content) {
                    if (block.type === "text" && block.text) {
                      if (event.error || block.text.startsWith("API Error")) {
                        ws.send(JSON.stringify({ type: "error", text: block.text }));
                      }
                    }
                  }
                }

              } else if (event.type === "user") {
                // Tool results — show outcome
                const content = event.message?.content;
                if (Array.isArray(content)) {
                  for (const block of content) {
                    if (block.type === "tool_result") {
                      ws.send(JSON.stringify({
                        type: "tool_result",
                        is_error: block.is_error || false,
                        content: typeof block.content === "string"
                          ? block.content.slice(0, 300)
                          : "",
                      }));
                    }
                  }
                }
                // Also check top-level tool_use_result
                if (event.tool_use_result) {
                  const r = event.tool_use_result;
                  const text = typeof r === "string" ? r
                    : r.stdout || r.content || r.error || "";
                  ws.send(JSON.stringify({
                    type: "tool_result",
                    is_error: !!r.is_error,
                    content: String(text).slice(0, 300),
                  }));
                }

              } else if (event.type === "result") {
                ws.send(JSON.stringify({
                  type: "result",
                  text: event.result,
                  is_error: event.is_error,
                  duration_ms: event.duration_ms,
                  cost_usd: event.total_cost_usd,
                  input_tokens: event.usage?.input_tokens,
                  output_tokens: event.usage?.output_tokens,
                  cache_read_tokens: event.usage?.cache_read_input_tokens,
                }));
              }
            } catch {
              // skip unparseable lines
            }
          }
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", text: err.message }));
      }

      const exitCode = await claude.exited;
      ws.data.activeProcess = null;
      ws.send(JSON.stringify({ type: "done", code: exitCode }));
    },

    close(ws) {
      console.log("Client disconnected");
      if (ws.data.activeProcess) {
        ws.data.activeProcess.kill();
        ws.data.activeProcess = null;
      }
    },
  },
});

console.log(`Summit running at http://localhost:${PORT}`);
