import { onGlobal } from "~~/server/utils/eventBus";

export default defineEventHandler(async (event) => {
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

      const unsub = onGlobal((ev) => {
        if (closed) return;
        controller.enqueue(`data: ${JSON.stringify(ev)}\n\n`);
      });

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
