export default defineEventHandler(async (event) => {
  const body = await readBody<{ name: string; repos: Array<{ name: string; path: string }>; devServer?: { command: string; basePort: number; repo?: string } }>(event);
  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, message: "Missing project name" });
  }
  if (!body.repos?.length) {
    throw createError({ statusCode: 400, message: "At least one repo is required" });
  }

  validateRepoNames(body.repos);
  for (const repo of body.repos) {
    await validateRepoPath(repo.path);
  }

  const project: Project = {
    id: crypto.randomUUID(),
    name: body.name.trim(),
    repos: body.repos,
    ...(body.devServer ? { devServer: body.devServer } : {}),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveProject(project);
  return project;
});
