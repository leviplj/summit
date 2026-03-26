export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  await deleteProjectFile(id);
  return { ok: true };
});
