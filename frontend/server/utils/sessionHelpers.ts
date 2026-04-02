import type { StoredSession } from "~~/shared/types";

export function getSessionCwd(session: StoredSession): string {
  const wts = session.worktrees;
  if (wts && Object.keys(wts).length > 0) {
    const entries = Object.values(wts);
    if (entries.length === 1) return entries[0]!;
    return session.worktreePath || process.cwd();
  }
  return session.worktreePath || process.cwd();
}

export function getSessionAdditionalDirs(session: StoredSession): string[] {
  const wts = session.worktrees;
  if (wts && Object.keys(wts).length > 1) {
    return Object.values(wts);
  }
  return [];
}
