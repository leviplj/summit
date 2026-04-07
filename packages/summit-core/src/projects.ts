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
  return projects.sort((a, b) => a.name.localeCompare(b.name));
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