import type { StoredSession } from "summit-types";
import { createJsonStore } from "./storage";
import { join } from "path";
import { getStorePath } from "./config";

let store: ReturnType<typeof createJsonStore<StoredSession>> | null = null;

function getStore() {
  if (!store) {
    store = createJsonStore<StoredSession>(join(getStorePath(), "sessions"));
  }
  return store;
}

export async function listSessions(projectId?: string): Promise<StoredSession[]> {
  const sessions = await getStore().list();
  const filtered = projectId ? sessions.filter((s) => s.projectId === projectId) : sessions;
  return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getSession(id: string): Promise<StoredSession | null> {
  return getStore().get(id);
}

export async function saveSession(session: StoredSession): Promise<void> {
  session.updatedAt = new Date().toISOString();
  await getStore().save(session);
}

export async function deleteSession(id: string): Promise<void> {
  await getStore().remove(id);
}
