import { updateSession } from "summit-core";
import type { StoredSession } from "summit-types";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const body = await readBody<Partial<Pick<StoredSession, "title" | "model">>>(event);

  const updated = await updateSession(id, body);
  if (!updated) {
    throw createError({ statusCode: 404, message: "Session not found" });
  }
  return updated;
});
