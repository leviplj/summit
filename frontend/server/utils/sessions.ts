import { readFile, writeFile, readdir, unlink, mkdir } from "fs/promises";
import { join } from "path";

const SESSIONS_DIR = join(process.cwd(), ".summit", "sessions");

export interface StoredSession {
  id: string;
  title: string;
  agentSessionId: string | null;
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "error";
    content: string;
    meta?: { duration_ms?: number; cost_usd?: number; output_tokens?: number };
  }>;
  createdAt: string;
  updatedAt: string;
}

async function ensureDir() {
  await mkdir(SESSIONS_DIR, { recursive: true });
}

function sessionPath(id: string) {
  return join(SESSIONS_DIR, `${id}.json`);
}

export async function listSessions(): Promise<StoredSession[]> {
  await ensureDir();
  const files = await readdir(SESSIONS_DIR);
  const sessions: StoredSession[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const data = await readFile(join(SESSIONS_DIR, f), "utf-8");
      sessions.push(JSON.parse(data));
    } catch {}
  }
  sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return sessions;
}

export async function getStoredSession(id: string): Promise<StoredSession | null> {
  try {
    const data = await readFile(sessionPath(id), "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await ensureDir();
  session.updatedAt = new Date().toISOString();
  await writeFile(sessionPath(session.id), JSON.stringify(session, null, 2));
}

export async function deleteSessionFile(id: string): Promise<void> {
  try {
    await unlink(sessionPath(id));
  } catch {}
}
