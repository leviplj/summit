export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  await deleteSessionFile(id);
  return { ok: true };
});
