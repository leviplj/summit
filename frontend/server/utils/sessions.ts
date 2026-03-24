import { readFile, writeFile, readdir, unlink, mkdir } from "fs/promises";
import { join } from "path";
import type { StoredSession } from "~~/shared/types";

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
  session.updatedAt = new Date().toISOString();
  await writeFile(sessionPath(session.id), JSON.stringify(session, null, 2));
}

export async function deleteSessionFile(id: string): Promise<void> {
  validateId(id);
  try {
    await unlink(sessionPath(id));
  } catch {}
}
