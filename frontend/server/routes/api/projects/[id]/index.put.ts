export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const project = await getProject(id);
  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const body = await readBody<{ name?: string; repos?: Array<{ name: string; path: string }> }>(event);

  if (body.name !== undefined) {
    if (!body.name.trim()) {
      throw createError({ statusCode: 400, message: "Project name cannot be empty" });
    }
    project.name = body.name.trim();
  }

  if (body.repos !== undefined) {
    if (!body.repos.length) {
      throw createError({ statusCode: 400, message: "At least one repo is required" });
    }
    validateRepoNames(body.repos);
    for (const repo of body.repos) {
      await validateRepoPath(repo.path);
    }
    project.repos = body.repos;
  }

  await saveProject(project);
  return project;
});
