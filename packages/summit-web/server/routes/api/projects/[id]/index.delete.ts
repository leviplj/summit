import { deleteProject } from "summit-core";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  await deleteProject(id);
  return { ok: true };
});
