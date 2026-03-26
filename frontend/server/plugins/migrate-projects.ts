import { execFile } from "child_process";
import { promisify } from "util";

const exec = promisify(execFile);

export default defineNitroPlugin(async () => {
  try {
    const projects = await listProjects();
    if (projects.length > 0) return;

    // Auto-create a default project pointing to Summit's own repo
    let repoRoot: string;
    try {
      const { stdout } = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: process.cwd() });
      repoRoot = stdout.trim();
    } catch {
      return;
    }

    const repoName = repoRoot.split("/").pop() || "default";
    const defaultProject: Project = {
      id: crypto.randomUUID(),
      name: repoName,
      repos: [{ name: repoName, path: repoRoot }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveProject(defaultProject);

    // Assign existing sessions without projectId to the default project
    const sessions = await listSessions();
    for (const session of sessions) {
      if (!session.projectId) {
        session.projectId = defaultProject.id;
        // Migrate legacy worktree to worktrees map
        if (session.worktreePath && !session.worktrees) {
          session.worktrees = { [repoName]: session.worktreePath };
        }
        if (!session.worktrees) {
          session.worktrees = {};
        }
        await saveSession(session);
      }
    }

    console.log(`[summit] Created default project "${repoName}" and migrated ${sessions.length} session(s)`);
  } catch (err) {
    console.error("[summit] Migration error:", err);
  }
});
