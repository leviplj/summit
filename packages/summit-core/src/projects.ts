import type { Project } from "summit-types";
import { createJsonStore } from "./storage";
import { join } from "path";
import { getStorePath } from "./config";

let store: ReturnType<typeof createJsonStore<Project>> | null = null;

function getStore() {
  if (!store) {
    store = createJsonStore<Project>(join(getStorePath(), "projects"));
  }
  return store;
}

export async function listProjects(): Promise<Project[]> {
  const projects = await getStore().list();
  return projects.sort((a, b) => {
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });
}

export async function getProject(id: string): Promise<Project | null> {
  return getStore().get(id);
}

export async function saveProject(project: Project): Promise<void> {
  project.updatedAt = new Date().toISOString();
  await getStore().save(project);
}

export async function deleteProject(id: string): Promise<void> {
  await getStore().remove(id);
}

export async function reorderProjects(ids: string[]): Promise<void> {
  const all = await getStore().list();
  const byId = new Map(all.map((p) => [p.id, p]));
  const now = new Date().toISOString();
  await Promise.all(
    ids.map(async (id, index) => {
      const project = byId.get(id);
      if (!project) return;
      project.order = index;
      project.updatedAt = now;
      await getStore().save(project);
    }),
  );
}
