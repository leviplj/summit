import type { Project } from "summit-types";

export function useProjectStore() {
  const projects = useState<Project[]>("projects", () => []);
  const loaded = useState("projects:loaded", () => false);

  async function loadProjects() {
    if (loaded.value) return;
    try {
      projects.value = await $fetch<Project[]>("/api/projects");
      loaded.value = true;
    } catch {
      loaded.value = true;
    }
  }

  async function createProject(input: { name: string; icon?: string; repos: Array<{ name: string; path: string }> }) {
    const project = await $fetch<Project>("/api/projects", {
      method: "POST",
      body: input,
    });
    projects.value.push(project);
    return project;
  }

  async function deleteProject(id: string) {
    await $fetch(`/api/projects/${id}`, { method: "DELETE" });
    projects.value = projects.value.filter((p) => p.id !== id);
  }

  async function reorderProjects(ids: string[]) {
    await $fetch("/api/projects/reorder", {
      method: "POST",
      body: { ids },
    });
  }

  return {
    projects,
    loaded,
    loadProjects,
    createProject,
    deleteProject,
    reorderProjects,
  };
}
