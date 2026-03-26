import { devServerManager } from "~~/server/features/dev-server/manager";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const session = await getStoredSession(id);
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: "Session not found" });
  }

  if (!session.projectId) {
    throw createError({ statusCode: 400, statusMessage: "Session has no project" });
  }

  const project = await getProject(session.projectId);
  if (!project?.devServer) {
    throw createError({ statusCode: 400, statusMessage: "Project has no dev server configured" });
  }

  const { command, basePort, repo } = project.devServer;

  let worktreePath: string;
  try {
    worktreePath = resolveWorktreePath(session, repo);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Cannot resolve worktree path" });
  }

  const status = await devServerManager.start(id, worktreePath, command, basePort);
  return status;
});
