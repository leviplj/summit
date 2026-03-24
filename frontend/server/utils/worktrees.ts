import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { rm } from "fs/promises";

const exec = promisify(execFile);

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
  const root = await getRepoRoot();
  return join(root, "worktrees", sessionId);
}

export async function createWorktree(sessionId: string): Promise<string> {
  const root = await getRepoRoot();
  const path = join(root, "worktrees", sessionId);
  const branch = branchName(sessionId);

  await exec("git", ["worktree", "add", "-b", branch, path, "HEAD"], {
    cwd: root,
  });

  return path;
}

export async function removeWorktree(sessionId: string): Promise<void> {
  const root = await getRepoRoot();
  const path = join(root, "worktrees", sessionId);
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
