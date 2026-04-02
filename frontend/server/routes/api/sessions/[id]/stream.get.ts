import { getActiveQuery, subscribe } from "~~/server/utils/eventBus";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const afterParam = getQuery(event).after;
  const after = afterParam ? Number(afterParam) : 0;

  const aq = getActiveQuery(id);
  if (!aq) {
    setResponseStatus(event, 204);
    return "";
  }

  const iterable = subscribe(id, after);
  if (!iterable) {
    setResponseStatus(event, 204);
    return "";
  }

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const iterator = iterable[Symbol.asyncIterator]();
  let done = false;

  const stream = new ReadableStream({
    async pull(controller) {
      const result = await iterator.next();
      if (result.done || done) {
        controller.close();
        return;
      }
      const ev = result.value;
      controller.enqueue(`id: ${ev.id}\ndata: ${JSON.stringify(ev.data)}\n\n`);
      if (ev.data.type === "done") {
        done = true;
        controller.close();
      }
    },
    cancel() {
      done = true;
      iterator.return?.();
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
