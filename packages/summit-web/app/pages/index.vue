<script setup lang="ts">
const { projects, loaded, loadProjects, createProject, deleteProject } = useProjectStore();
const { sessions, loadSessions } = useSessionStore();

const activeProjectId = ref<string | null>(null);
const activeSessionId = ref<string | null>(null);

const activeProject = computed(() =>
  projects.value.find((p) => p.id === activeProjectId.value) || null,
);

const activeSession = computed(() =>
  sessions.value.find((s) => s.id === activeSessionId.value) || null,
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
      @create="handleCreate"
    />

    <main class="flex-1 flex items-center justify-center text-muted-foreground">
      <div v-if="activeSession" class="text-center">
        <p class="text-sm">Session:</p>
        <p class="font-medium text-foreground">{{ activeSession.title }}</p>
      </div>
      <div v-else-if="activeProject" class="text-center">
        <p class="text-sm">Selected project:</p>
        <p class="font-medium text-foreground">{{ activeProject.name }}</p>
      </div>
      <p v-else class="text-sm">Select a project to get started</p>
    </main>
  </div>
</template>
