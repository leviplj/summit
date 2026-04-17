<script setup lang="ts">
const { projects, loaded, loadProjects, createProject, deleteProject, reorderProjects } = useProjectStore();
const { sessions, loadSessions } = useSessionStore();

const activeProjectId = ref<string | null>(null);
const activeSessionId = ref<string | null>(null);

const activeProject = computed(() =>
  projects.value.find((p) => p.id === activeProjectId.value) || null,
);

const activeSession = computed(() =>
  sessions.value.find((s) => s.id === activeSessionId.value) || null,
);

const sessionProject = computed(() =>
  activeSession.value
    ? projects.value.find((p) => p.id === activeSession.value!.projectId) || null
    : null,
);

onMounted(() => {
  loadProjects();
  loadSessions();
});

async function handleCreate(payload: { name: string; icon: string; repos: Array<{ name: string; path: string }> }) {
  const project = await createProject(payload);
  activeProjectId.value = project.id;
}

async function handleDelete(id: string) {
  await deleteProject(id);
  if (activeProjectId.value === id) activeProjectId.value = null;
}

function handleSelectSession(id: string) {
  activeSessionId.value = id || null;
}

async function handleReorder(ids: string[]) {
  const byId = new Map(projects.value.map((p) => [p.id, p]));
  projects.value = ids.map((id, i) => {
    const p = byId.get(id)!;
    return { ...p, order: i };
  });
  await reorderProjects(ids);
}
</script>

<template>
  <div class="flex h-screen bg-background text-foreground">
    <Sidebar
      :projects="projects"
      :loaded="loaded"
      :active-id="activeProjectId"
      :active-session-id="activeSessionId"
      @select="activeProjectId = $event"
      @delete="handleDelete"
      @select-session="handleSelectSession"
      @reorder="handleReorder"
      @create="handleCreate"
    />

    <SessionDetail
      v-if="activeSession"
      :session="activeSession"
      :project="sessionProject"
    />
    <main v-else class="flex-1 flex items-center justify-center text-muted-foreground">
      <div v-if="activeProject" class="text-center">
        <p class="text-sm">Selected project:</p>
        <p class="font-medium text-foreground">{{ activeProject.name }}</p>
      </div>
      <p v-else class="text-sm">Select a project to get started</p>
    </main>
  </div>
</template>
