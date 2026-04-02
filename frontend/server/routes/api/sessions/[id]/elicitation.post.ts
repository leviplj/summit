import { resolveElicitation } from "~~/server/utils/interactions";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const body = await readBody<{
    elicitationId: string;
    action: "accept" | "decline";
    content?: Record<string, unknown>;
  }>(event);

  if (!body?.elicitationId || !body.action) {
    throw createError({ statusCode: 400, statusMessage: "Missing elicitationId or action" });
  }

  const resolved = resolveElicitation(body.elicitationId, {
    action: body.action,
    ...(body.content ? { content: body.content } : {}),
  });

  if (!resolved) {
    throw createError({ statusCode: 404, statusMessage: "No pending elicitation found" });
  }

  return { ok: true };
});
