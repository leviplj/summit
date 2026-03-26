import { execFile } from "child_process";
import { promisify } from "util";
import { dirname } from "path";

const exec = promisify(execFile);

export async function stageFiles(worktreePath: string, paths: string[]): Promise<void> {
  await exec("git", ["add", "--", ...paths], { cwd: worktreePath });
}

export async function unstageFiles(worktreePath: string, paths: string[]): Promise<void> {
  await exec("git", ["reset", "HEAD", "--", ...paths], { cwd: worktreePath });
}

export async function createCommit(worktreePath: string, message: string): Promise<string> {
  const { stdout } = await exec("git", ["commit", "-m", message], { cwd: worktreePath });
  const match = stdout.match(/\[[\w/]+ ([a-f0-9]+)\]/);
  return match?.[1] ?? "unknown";
}

export async function getDefaultBranch(cwd: string): Promise<string> {
  try {
    const { stdout } = await exec("git", ["rev-parse", "--abbrev-ref", "origin/HEAD"], { cwd });
    return stdout.trim().replace("origin/", "");
  } catch {
    try {
      await exec("git", ["rev-parse", "--verify", "main"], { cwd });
      return "main";
    } catch {
      return "master";
    }
  }
}

export async function getMergeBase(worktreePath: string): Promise<string> {
  const defaultBranch = await getDefaultBranch(worktreePath);
  const { stdout } = await exec("git", ["merge-base", "HEAD", defaultBranch], { cwd: worktreePath });
  return stdout.trim();
}

export async function getMainRepoRoot(worktreePath: string): Promise<string> {
  const { stdout } = await exec(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    { cwd: worktreePath },
  );
  // --git-common-dir returns /path/to/main-repo/.git — parent is the repo root
  return dirname(stdout.trim());
}

export async function mergeBranch(worktreePath: string, branch: string): Promise<void> {
  const repoRoot = await getMainRepoRoot(worktreePath);
  await exec("git", ["merge", branch, "--no-edit"], { cwd: repoRoot });
}

export function resolveWorktreePath(
  session: { worktreePath: string | null; worktrees: Record<string, string> },
  repoName?: string,
): string {
  if (repoName && session.worktrees?.[repoName]) {
    return session.worktrees[repoName];
  }
  // Single-repo or legacy: fall back to worktreePath
  if (session.worktreePath) return session.worktreePath;
  throw new Error("No worktree for this session");
}
