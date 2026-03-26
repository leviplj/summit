import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { rm, mkdir } from "fs/promises";

const exec = promisify(execFile);

// Store worktrees outside any repo so the AI model cannot infer
// the parent repo path from the worktree's absolute path.
const WORKTREES_BASE = join('/workspaces/summit', ".summit", "worktrees");

let _repoRoot: string | null = null;
async function getRepoRoot(): Promise<string> {
  if (_repoRoot) return _repoRoot;
  const { stdout } = await exec("git", ["rev-parse", "--show-toplevel"], {
    cwd: process.cwd(),
  });
  _repoRoot = stdout.trim();
  return _repoRoot;
}

function branchName(sessionId: string) {
  return `summit/${sessionId}`;
}

export async function worktreePath(sessionId: string): Promise<string> {
  return join(WORKTREES_BASE, sessionId);
}

export async function createWorktree(sessionId: string): Promise<string> {
  const root = await getRepoRoot();
  const path = join(WORKTREES_BASE, sessionId);
  const branch = branchName(sessionId);

  await mkdir(WORKTREES_BASE, { recursive: true });
  await exec("git", ["worktree", "add", "-b", branch, path, "HEAD"], {
    cwd: root,
  });

  return path;
}

export async function removeWorktree(sessionId: string): Promise<void> {
  const root = await getRepoRoot();
  const path = join(WORKTREES_BASE, sessionId);
  const branch = branchName(sessionId);

  try {
    await exec("git", ["worktree", "remove", path, "--force"], { cwd: root });
  } catch {
    await rm(path, { recursive: true, force: true });
    try {
      await exec("git", ["worktree", "prune"], { cwd: root });
    } catch {}
  }

  try {
    await exec("git", ["branch", "-D", branch], { cwd: root });
  } catch {}
}

export async function createProjectWorktrees(
  sessionId: string,
  repos: Array<{ name: string; path: string }>,
): Promise<Record<string, string>> {
  const sessionDir = join(WORKTREES_BASE, sessionId);
  await mkdir(sessionDir, { recursive: true });

  const worktrees: Record<string, string> = {};

  await Promise.all(
    repos.map(async (repo) => {
      const wtPath = join(sessionDir, repo.name);
      const branch = `summit/${sessionId}/${repo.name}`;

      await exec("git", ["worktree", "add", "-b", branch, wtPath, "HEAD"], {
        cwd: repo.path,
      });

      worktrees[repo.name] = wtPath;
    }),
  );

  return worktrees;
}

export async function removeProjectWorktrees(
  sessionId: string,
  worktrees: Record<string, string>,
): Promise<void> {
  await Promise.all(
    Object.entries(worktrees).map(async ([repoName, wtPath]) => {
      const branch = `summit/${sessionId}/${repoName}`;

      // Find the source repo by looking at the worktree's git common dir
      let sourceRepo: string | undefined;
      try {
        const { stdout } = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: wtPath });
        const { dirname } = await import("path");
        sourceRepo = dirname(stdout.trim());
      } catch {}

      try {
        await exec("git", ["worktree", "remove", wtPath, "--force"], { cwd: sourceRepo || wtPath });
      } catch {
        await rm(wtPath, { recursive: true, force: true });
        if (sourceRepo) {
          try {
            await exec("git", ["worktree", "prune"], { cwd: sourceRepo });
          } catch {}
        }
      }

      if (sourceRepo) {
        try {
          await exec("git", ["branch", "-D", branch], { cwd: sourceRepo });
        } catch {}
      }
    }),
  );

  // Clean up the session directory
  const sessionDir = join(WORKTREES_BASE, sessionId);
  try {
    await rm(sessionDir, { recursive: true, force: true });
  } catch {}
}
