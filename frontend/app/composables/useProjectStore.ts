import type { Project } from "~~/shared/types";

export function useProjectStore() {
  const projects = ref<Project[]>([]);
  const activeProjectId = ref<string | null>(null);
  const loaded = ref(false);

  const activeProject = computed(() =>
    projects.value.find((p) => p.id === activeProjectId.value) || null,
  );

  async function loadProjects() {
    try {
      const data = await $fetch<Project[]>("/api/projects");
      projects.value = data;

      // Restore from localStorage
      const stored = localStorage.getItem("summit:activeProjectId");
      if (stored && data.some((p) => p.id === stored)) {
        activeProjectId.value = stored;
      } else if (data.length > 0) {
        activeProjectId.value = data[0].id;
      }

      loaded.value = true;
    } catch {
      loaded.value = true;
    }
  }

  function setActiveProject(id: string) {
    activeProjectId.value = id;
    localStorage.setItem("summit:activeProjectId", id);
  }

  async function createProject(name: string, repos: Array<{ name: string; path: string }>, devServer?: { command: string; basePort: number; repo?: string }) {
    const project = await $fetch<Project>("/api/projects", {
      method: "POST",
      body: { name, repos, devServer },
    });
    projects.value.push(project);
    setActiveProject(project.id);
    return project;
  }

  async function updateProject(id: string, data: { name?: string; repos?: Array<{ name: string; path: string }>; devServer?: { command: string; basePort: number; repo?: string } | null }) {
    const updated = await $fetch<Project>(`/api/projects/${id}`, {
      method: "PUT",
      body: data,
    });
    const idx = projects.value.findIndex((p) => p.id === id);
    if (idx >= 0) projects.value[idx] = updated;
    return updated;
  }

  async function deleteProject(id: string) {
    await $fetch(`/api/projects/${id}`, { method: "DELETE" });
    projects.value = projects.value.filter((p) => p.id !== id);
    if (activeProjectId.value === id) {
      activeProjectId.value = projects.value[0]?.id || null;
      if (activeProjectId.value) {
        localStorage.setItem("summit:activeProjectId", activeProjectId.value);
      } else {
        localStorage.removeItem("summit:activeProjectId");
      }
    }
  }

  return {
    projects,
    activeProjectId,
    activeProject,
    loaded,
    loadProjects,
    setActiveProject,
    createProject,
    updateProject,
    deleteProject,
  };
}
