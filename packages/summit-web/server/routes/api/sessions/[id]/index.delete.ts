import { deleteSession } from "summit-core";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  await deleteSession(id);
  return { ok: true };
});
