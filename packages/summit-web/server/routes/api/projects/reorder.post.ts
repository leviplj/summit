import { reorderProjects } from "summit-core";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ ids: string[] }>(event);
  if (!Array.isArray(body?.ids)) {
    throw createError({ statusCode: 400, message: "Missing ids array" });
  }
  await reorderProjects(body.ids);
  return { ok: true };
});
