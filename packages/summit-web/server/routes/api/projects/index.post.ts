import { saveProject } from "summit-core";
import type { Project } from "summit-types";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name: string; repos: Array<{ name: string; path: string }> }>(event);
  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, message: "Missing project name" });
  }
  if (!body.repos?.length) {
    throw createError({ statusCode: 400, message: "At least one repo is required" });
  }

  const project: Project = {
    id: crypto.randomUUID(),
    name: body.name.trim(),
    repos: body.repos,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveProject(project);
  return project;
});
