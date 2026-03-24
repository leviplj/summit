export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const afterParam = getQuery(event).after;
  const after = afterParam ? Number(afterParam) : 0;

  const aq = getActiveQuery(id);
  if (!aq) {
    // No active query — return 204 so client knows not to stream
    setResponseStatus(event, 204);
    return "";
  }

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      const send = (ev: StreamEvent) => {
        if (closed) return;
        controller.enqueue(`id: ${ev.id}\ndata: ${JSON.stringify(ev.data)}\n\n`);
        if (ev.data.type === "done") {
          close();
        }
      };

      const unsub = subscribe(id, after, send);
      if (!unsub) {
        // Query already done, all buffered events sent — close
        close();
        return;
      }

      event.node.req.on("close", () => {
        unsub();
        close();
      });
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
