<script setup lang="ts">
interface Draft {
  projectId: string;
  provider: string;
  title: string;
  model: string;
}

const DEFAULT_PROVIDER = "claude-code";

const { projects, loaded, loadProjects, createProject, deleteProject, reorderProjects } = useProjectStore();
const { sessions, loadSessions, createSession, updateSession, sendMessage } = useSessionStore();
const { loadProviders, modelsFor, defaultModelFor } = useProviderStore();

const activeProjectId = ref<string | null>(null);
const activeSessionId = ref<string | null>(null);
const draft = ref<Draft | null>(null);
const pendingSessionIds = useState<Set<string>>("pendingSessionIds", () => new Set());

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

const activeMessages = computed(() => {
  if (!activeSession.value) return [];
  return activeSession.value.conversations.find((c) => c.id === "lead")?.messages ?? [];
});

const activePending = computed(() =>
  activeSession.value ? pendingSessionIds.value.has(activeSession.value.id) : false,
);

const sessionModels = computed(() =>
  activeSession.value ? modelsFor(activeSession.value.provider) : [],
);

const draftModels = computed(() =>
  draft.value ? modelsFor(draft.value.provider) : [],
);

const sessionModel = computed({
  get: () => {
    if (!activeSession.value) return "";
    return activeSession.value.model ?? defaultModelFor(activeSession.value.provider) ?? "";
  },
  set: (value: string) => {
    if (activeSession.value) {
      updateSession(activeSession.value.id, { model: value });
    }
  },
});

const draftModel = computed({
  get: () => draft.value?.model ?? "",
  set: (value: string) => {
    if (draft.value) draft.value.model = value;
  },
});

onMounted(() => {
  loadProjects();
  loadSessions();
  loadProviders();
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
  const provider = DEFAULT_PROVIDER;
  draft.value = {
    projectId,
    provider,
    title: `New session ${time}`,
    model: defaultModelFor(provider) ?? "",
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

async function runSend(sessionId: string, prompt: string) {
  const next = new Set(pendingSessionIds.value);
  next.add(sessionId);
  pendingSessionIds.value = next;
  try {
    await sendMessage(sessionId, prompt);
  } finally {
    const done = new Set(pendingSessionIds.value);
    done.delete(sessionId);
    pendingSessionIds.value = done;
  }
}

async function handleSessionSend(text: string) {
  if (!activeSession.value) return;
  await runSend(activeSession.value.id, text);
}

async function handleDraftSend(text: string) {
  if (!draft.value) return;
  const session = await createSession(draft.value.projectId, draft.value.title);
  const providerDefault = defaultModelFor(draft.value.provider);
  if (draft.value.model && draft.value.model !== providerDefault) {
    await updateSession(session.id, { model: draft.value.model });
  }
  activeSessionId.value = session.id;
  draft.value = null;
  await runSend(session.id, text);
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
      :messages="activeMessages"
      :pending="activePending"
      :models="sessionModels"
      @send="handleSessionSend"
    />
    <SessionDetail
      v-else-if="draft"
      key="draft"
      v-model:model="draftModel"
      :title="draft.title"
      :project-name="draftProject?.name"
      :messages="[]"
      :models="draftModels"
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
