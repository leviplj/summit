<script setup lang="ts">
import { DEFAULT_MODEL_ID } from "~/constants/models";

interface Draft {
  projectId: string;
  title: string;
  model: string;
}

const { projects, loaded, loadProjects, createProject, deleteProject, reorderProjects } = useProjectStore();
const { sessions, loadSessions, createSession, updateSession } = useSessionStore();

const activeProjectId = ref<string | null>(null);
const activeSessionId = ref<string | null>(null);
const draft = ref<Draft | null>(null);

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

const draftProject = computed(() =>
  draft.value ? projects.value.find((p) => p.id === draft.value!.projectId) || null : null,
);

const sessionModel = computed({
  get: () => activeSession.value?.model ?? DEFAULT_MODEL_ID,
  set: (value: string) => {
    if (activeSession.value) {
      updateSession(activeSession.value.id, { model: value });
    }
  },
});

const draftModel = computed({
  get: () => draft.value?.model ?? DEFAULT_MODEL_ID,
  set: (value: string) => {
    if (draft.value) draft.value.model = value;
  },
});

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
  draft.value = null;
  activeSessionId.value = id || null;
}

function handleNewSession(projectId: string) {
  activeSessionId.value = null;
  const time = new Date().toTimeString().slice(0, 8).replace(/:/g, "-");
  draft.value = {
    projectId,
    title: `New session ${time}`,
    model: DEFAULT_MODEL_ID,
  };
}

async function handleReorder(ids: string[]) {
  const byId = new Map(projects.value.map((p) => [p.id, p]));
  projects.value = ids.map((id, i) => {
    const p = byId.get(id)!;
    return { ...p, order: i };
  });
  await reorderProjects(ids);
}

async function handleSessionSend(_text: string) {
  // TODO: wire to chat engine
}

async function handleDraftSend(_text: string) {
  if (!draft.value) return;
  const session = await createSession(draft.value.projectId, draft.value.title);
  if (draft.value.model !== DEFAULT_MODEL_ID) {
    await updateSession(session.id, { model: draft.value.model });
  }
  activeSessionId.value = session.id;
  draft.value = null;
  // TODO: send message to chat engine
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
      @new-session="handleNewSession"
      @reorder="handleReorder"
      @create="handleCreate"
    />

    <SessionDetail
      v-if="activeSession"
      :key="activeSession.id"
      v-model:model="sessionModel"
      :title="activeSession.title"
      :project-name="sessionProject?.name"
      @send="handleSessionSend"
    />
    <SessionDetail
      v-else-if="draft"
      key="draft"
      v-model:model="draftModel"
      :title="draft.title"
      :project-name="draftProject?.name"
      @send="handleDraftSend"
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
