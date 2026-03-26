export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const project = await getProject(id);
  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }
  return project;
});
