export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  const session = await getStoredSession(id);
  if (!session) throw createError({ statusCode: 404, message: "Session not found" });

  const body = await readBody<{ repo?: string }>(event);

  try {
    const worktrees = session.worktrees;
    const hasMultiRepo = worktrees && Object.keys(worktrees).length > 0;

    if (hasMultiRepo) {
      if (body.repo) {
        // Merge a single repo
        const wtPath = worktrees[body.repo];
        if (!wtPath) throw createError({ statusCode: 400, message: `Unknown repo: ${body.repo}` });
        const branch = `summit/${session.id}/${body.repo}`;
        await mergeBranch(wtPath, branch);
      } else {
        // Merge all repos
        for (const [repoName, wtPath] of Object.entries(worktrees)) {
          const branch = `summit/${session.id}/${repoName}`;
          await mergeBranch(wtPath, branch);
        }
      }
    } else {
      if (!session.worktreePath) throw createError({ statusCode: 400, message: "No worktree for this session" });
      if (!session.branch) throw createError({ statusCode: 400, message: "No branch for this session" });
      await mergeBranch(session.worktreePath, session.branch);
    }

    return { ok: true };
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw createError({ statusCode: 500, message: err.stderr || err.message });
  }
});
