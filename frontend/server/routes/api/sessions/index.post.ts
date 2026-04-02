export default defineEventHandler(async (event) => {
  const body = await readBody<{ id: string; title?: string; model?: string; projectId?: string }>(event);
  if (!body?.id) {
    throw createError({ statusCode: 400, message: "Missing id" });
  }

  let wtPath: string | null = null;
  let branch: string | null = null;
  let projectId: string | null = body.projectId || null;
  let worktrees: Record<string, string> = {};

  if (projectId) {
    const project = await getProject(projectId);
    if (!project) {
      throw createError({ statusCode: 400, message: "Project not found" });
    }
    worktrees = await createProjectWorktrees(body.id, project.repos);
    // For single-repo projects, set worktreePath for backward compat
    const repoNames = Object.keys(worktrees);
    if (repoNames.length === 1) {
      wtPath = worktrees[repoNames[0]];
      branch = `summit/${body.id}/${repoNames[0]}`;
    } else {
      // Parent folder
      wtPath = (await worktreePath(body.id));
      branch = null;
    }
  } else {
    // Legacy: no project, create single worktree from Summit's own repo
    wtPath = await createWorktree(body.id);
    branch = `summit/${body.id}`;
  }

  const session: StoredSession = {
    id: body.id,
    title: body.title || "New chat",
    model: body.model || null,
    provider: "claude-code",
    agentSessionId: null,
    projectId,
    worktreePath: wtPath,
    branch,
    worktrees,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveSession(session);
  return session;
});
