import { readFile, writeFile, readdir, unlink, mkdir } from "fs/promises";
import { join } from "path";
import type { StoredSession } from "~~/shared/types";
import { emitGlobal } from "./eventBus";

export type { StoredSession };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSIONS_DIR = join(process.cwd(), ".summit", "sessions");

let dirEnsured = false;
async function ensureDir() {
  if (dirEnsured) return;
  await mkdir(SESSIONS_DIR, { recursive: true });
  dirEnsured = true;
}

function validateId(id: string): void {
  if (!UUID_RE.test(id)) {
    throw createError({ statusCode: 400, message: "Invalid session ID" });
  }
}

function sessionPath(id: string) {
  return join(SESSIONS_DIR, `${id}.json`);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path, { flag: "r" });
    return true;
  } catch {
    return false;
  }
}

export async function listSessions(): Promise<StoredSession[]> {
  await ensureDir();
  const files = await readdir(SESSIONS_DIR);
  const sessions = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        try {
          const data = await readFile(join(SESSIONS_DIR, f), "utf-8");
          return JSON.parse(data) as StoredSession;
        } catch {
          return null;
        }
      }),
  );
  return sessions
    .filter((s): s is StoredSession => s !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getStoredSession(id: string): Promise<StoredSession | null> {
  validateId(id);
  try {
    const data = await readFile(sessionPath(id), "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  validateId(session.id);
  await ensureDir();
  const path = sessionPath(session.id);
  const isNew = !await fileExists(path);
  session.updatedAt = new Date().toISOString();
  await writeFile(path, JSON.stringify(session, null, 2));
  if (isNew) {
    emitGlobal({ type: "session_created", sessionId: session.id });
  }
}

export async function deleteSessionFile(id: string, meta?: Record<string, unknown>): Promise<void> {
  validateId(id);
  try {
    await unlink(sessionPath(id));
    emitGlobal({ type: "session_deleted", sessionId: id, meta });
  } catch {}
}
