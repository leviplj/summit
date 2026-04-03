<script setup lang="ts">
import { Plus, SendHorizontal, Square, Trash2, GitBranch, FileCode, Sun, Moon, Monitor, Search, X, MessageSquareText, FolderGit2, Pencil } from "lucide-vue-next";
import type { SessionStatus, Project } from "summit-types";
import ChatMessage from "~/components/ChatMessage.vue";
import ElicitationForm from "~/components/ElicitationForm.vue";
import AskUserQuestions from "~/components/AskUserQuestions.vue";
import ChangedFiles from "~/components/ChangedFiles.vue";
import ModelSelector from "~/components/ModelSelector.vue";
import KeyboardShortcutsHelp from "~/components/KeyboardShortcutsHelp.vue";
import HighlightMatch from "~/components/HighlightMatch.vue";
import ProjectSwitcher from "~/components/ProjectSwitcher.vue";
import ProjectConfigDialog from "~/components/ProjectConfigDialog.vue";
import TeamTabBar from "~/components/TeamTabBar.vue";

const statusConfig: Record<SessionStatus, { color: string; pulse: boolean; label: string }> = {
  idle: { color: "bg-zinc-500", pulse: false, label: "Idle" },
  waiting: { color: "bg-yellow-400", pulse: true, label: "Waiting…" },
  thinking: { color: "bg-purple-400", pulse: true, label: "Thinking…" },
  streaming: { color: "bg-blue-400", pulse: true, label: "Responding…" },
  tool: { color: "bg-orange-400", pulse: true, label: "Running tool…" },
  elicitation: { color: "bg-amber-400", pulse: true, label: "Needs input" },
  ask_user: { color: "bg-cyan-400", pulse: true, label: "Needs your input" },
  error: { color: "bg-red-400", pulse: false, label: "Error" },
};

const {
  sessions,
  activeSessionId,
  activeSession,
  activeConversation,
  messages,
  events,
  loading,
  loaded,
  model,
  elicitation,
  askUser,
  send,
  respondAskUser,
  respondElicitation,
  cancel,
  updateModel,
  sessionCost,
  searchQuery,
  filteredSessions,
  fullTextEnabled,
  fullTextResults,
  newSession,
  selectSession,
  selectPrevSession,
  selectNextSession,
  deleteSession,
} = useChat();

const projectStore = useProjectStore();
const { projects, activeProject } = projectStore;

const { theme, cycleTheme } = useTheme();

const themeIcon = computed(() => {
  if (theme.value === "light") return Sun;
  if (theme.value === "dark") return Moon;
  return Monitor;
});

const input = ref("");
const cancelling = ref(false);
const messagesEl = ref<HTMLElement>();
const inputEl = ref<HTMLTextAreaElement>();
const changedFilesRef = ref<InstanceType<typeof ChangedFiles>>();
const sidebarOpen = ref(true);
const changesOpen = ref(false);
const projectDialogOpen = ref(false);
const editingProject = ref<Project | null>(null);
const projectDialogError = ref("");

// Filter sessions by active project
const projectFilteredSessions = computed(() => {
  if (!projectStore.activeProjectId.value) return filteredSessions.value;
  return filteredSessions.value.filter(
    (s) => s.projectId === projectStore.activeProjectId.value,
  );
});

// Branch badges for multi-repo
const branchBadges = computed(() => {
  const session = activeSession.value;
  if (!session) return [];
  const wts = session.worktrees;
  if (wts && Object.keys(wts).length > 1) {
    return Object.entries(wts).map(([name]) => ({
      name,
      branch: `summit/${session.id}/${name}`,
    }));
  }
  if (session.branch) {
    return [{ name: "", branch: session.branch }];
  }
  return [];
});

// Display data comes from the active conversation (computed in store)
const displayMessages = computed(() => activeConversation.value?.messages ?? []);
const displayEvents = computed(() => activeConversation.value?.events ?? []);
const displayAskUser = computed(() => activeConversation.value?.askUser ?? null);

const { helpOpen, shortcuts } = useKeyboardShortcuts({
  sidebarOpen,
  changesOpen,
  refreshChanges: () => changedFilesRef.value?.refresh(),
  newSession: () => handleNewSession(),
  selectPrevSession,
  selectNextSession,
  focusInput: () => inputEl.value?.focus(),
});

function handleNewSession() {
  newSession(projectStore.activeProjectId.value);
}

function handleSend() {
  if (!input.value.trim() || loading.value) return;
  send(input.value);
  input.value = "";
}

async function handleCancel() {
  if (cancelling.value) return;
  cancelling.value = true;
  await cancel();
}

watch(loading, (v) => {
  if (!v) cancelling.value = false;
});

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

watch(
  [() => displayMessages.value.length, () => displayMessages.value.at(-1)?.content, () => displayEvents.value.length, () => elicitation.value, () => displayAskUser.value],
  () => {
    nextTick(() => {
      messagesEl.value?.scrollTo({ top: messagesEl.value.scrollHeight, behavior: "smooth" });
    });
  },
);

// Auto-refresh changed files when a query finishes
watch(loading, (isLoading, wasLoading) => {
  if (wasLoading && !isLoading) {
    changedFilesRef.value?.refresh();
  }
});

// Project management
function handleSelectProject(id: string | null) {
  if (id) {
    projectStore.setActiveProject(id);
  } else {
    projectStore.activeProjectId.value = null;
    localStorage.removeItem("summit:activeProjectId");
  }
  // Select first session for the new project, or clear selection
  nextTick(() => {
    const matching = projectFilteredSessions.value;
    if (matching.length > 0) {
      selectSession(matching[0].id);
    } else {
      selectSession("");
    }
  });
}

function handleCreateProject() {
  editingProject.value = null;
  projectDialogOpen.value = true;
  projectDialogError.value = "";
}

function handleEditProject(project: Project) {
  editingProject.value = project;
  projectDialogOpen.value = true;
  projectDialogError.value = "";
}

async function handleSaveProject(data: { name: string; repos: Array<{ name: string; path: string }> }) {
  projectDialogError.value = "";
  try {
    if (editingProject.value) {
      await projectStore.updateProject(editingProject.value.id, data);
    } else {
      await projectStore.createProject(data.name, data.repos);
    }
    projectDialogOpen.value = false;
  } catch (err: any) {
    projectDialogError.value = err.data?.message || err.message || "Failed to save project";
  }
}

async function handleDeleteProject(id: string) {
  try {
    await projectStore.deleteProject(id);
    projectDialogOpen.value = false;
  } catch (err: any) {
    projectDialogError.value = err.data?.message || err.message || "Failed to delete project";
  }
}

// Projects that have sessions needing user attention
const attentionProjectIds = computed(() => {
  const ids = new Set<string>();
  for (const s of sessions.value) {
    console.log(`Session ${s.id} status:`, s.status);
    if ((s.status === "ask_user" || s.status === "elicitation") && s.projectId) {
      ids.add(s.projectId);
    }
  }
  return ids;
});

const showProjectDetails = computed(() => {
  if (!activeProject.value) return false;
  if (!activeSessionId.value) return true;
  // Show project details if current session belongs to a different project
  const session = activeSession.value;
  if (session && session.projectId !== projectStore.activeProjectId.value) return true;
  return false;
});

// Load projects on mount
onMounted(() => {
  projectStore.loadProjects();
});
</script>

<template>
  <div class="flex h-screen bg-background">
    <!-- Sidebar -->
    <aside
      v-show="sidebarOpen"
      class="flex w-64 flex-col border-r border-border bg-card"
    >
      <div class="flex items-center justify-between p-3">
        <span class="text-sm font-semibold text-foreground">Chats</span>
        <button
          class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="New chat"
          @click="handleNewSession"
        >
          <Plus class="h-4 w-4" />
        </button>
      </div>

      <!-- Project switcher -->
      <ProjectSwitcher
        v-if="projects.length > 0"
        :projects="projects"
        :active-project="activeProject"
        :attention-project-ids="attentionProjectIds"
        @select="handleSelectProject"
        @create="handleCreateProject"
        @edit="handleEditProject"
      />
      <div v-else class="px-2 pb-2">
        <button
          class="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          @click="handleCreateProject"
        >
          <Plus class="h-3 w-3" />
          Create project
        </button>
      </div>

      <!-- Search input -->
      <div class="px-2 pb-2">
        <div class="relative flex items-center gap-1">
          <div class="relative flex-1">
            <Search class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search chats…"
              class="w-full rounded-md border border-input bg-secondary py-1.5 pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              v-if="searchQuery"
              class="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              @click="searchQuery = ''"
            >
              <X class="h-3 w-3" />
            </button>
          </div>
          <button
            class="shrink-0 rounded-md p-1.5 transition-colors"
            :class="fullTextEnabled ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
            title="Search message content"
            @click="fullTextEnabled = !fullTextEnabled"
          >
            <MessageSquareText class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto px-2 pb-2">
        <div
          v-if="projectFilteredSessions.length === 0 && searchQuery"
          class="px-3 py-4 text-center text-xs text-muted-foreground"
        >
          No matching sessions
        </div>
        <div
          v-else-if="projectFilteredSessions.length === 0 && !searchQuery"
          class="px-3 py-4 text-center text-xs text-muted-foreground"
        >
          No sessions yet
        </div>
        <button
          v-for="s in projectFilteredSessions"
          :key="s.id"
          class="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors"
          :class="
            s.id === activeSessionId
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          "
          @click="selectSession(s.id)"
        >
          <span class="relative flex h-4 w-4 shrink-0 items-center justify-center">
            <span
              v-if="statusConfig[s.status].pulse"
              class="absolute h-2.5 w-2.5 animate-ping rounded-full opacity-50"
              :class="statusConfig[s.status].color"
            />
            <span
              class="relative h-2 w-2 rounded-full"
              :class="statusConfig[s.status].color"
              :title="statusConfig[s.status].label"
            />
          </span>
          <span class="flex-1 truncate">
            <span class="block truncate">
              <HighlightMatch :text="s.title" :query="searchQuery" />
            </span>
            <span
              v-if="s.status !== 'idle'"
              class="block truncate text-[10px] leading-tight"
              :class="{
                'text-red-400': s.status === 'error',
                'text-cyan-400': s.status === 'ask_user',
                'text-amber-400': s.status === 'elicitation',
                'text-muted-foreground': s.status !== 'error' && s.status !== 'ask_user' && s.status !== 'elicitation',
              }"
            >{{ statusConfig[s.status].label }}</span>
            <span
              v-if="fullTextEnabled && searchQuery && fullTextResults.find((r) => r.sessionId === s.id) && !s.title.toLowerCase().includes(searchQuery.toLowerCase())"
              class="block truncate text-[10px] leading-tight text-muted-foreground italic"
            >{{ fullTextResults.find((r) => r.sessionId === s.id)?.snippet }}</span>
          </span>
          <span
            class="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-destructive/20 hover:text-red-400 group-hover:opacity-100"
            @click.stop="deleteSession(s.id, projectStore.activeProjectId.value)"
          >
            <Trash2 class="h-3 w-3" />
          </span>
        </button>
      </nav>

      <div v-if="activeSession?.model || model || sessionCost" class="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <div v-if="activeSession?.model || model">{{ activeSession?.model || model }}</div>
        <div v-if="sessionCost">{{ sessionCost.totalTokens.toLocaleString() }} tokens · ${{ sessionCost.totalCost.toFixed(4) }}</div>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex flex-1 flex-col">
      <!-- Header -->
      <header class="flex items-center gap-2 border-b border-border px-4 py-3">
        <button
          class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          @click="sidebarOpen = !sidebarOpen"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <img src="/logo.png" alt="Summit" class="h-6 w-6 rounded" />
        <h1 class="text-lg font-semibold text-foreground">Summit</h1>
        <template v-for="badge in branchBadges" :key="badge.branch">
          <span
            class="flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs text-muted-foreground"
          >
            <GitBranch class="h-3 w-3" />
            <span v-if="badge.name" class="font-medium">{{ badge.name }}:</span>
            {{ badge.branch }}
          </span>
        </template>
        <ModelSelector
          v-if="activeSession"
          :model-value="activeSession.model"
          :disabled="loading"
          @update:model-value="(v) => updateModel(activeSession!.id, v)"
        />
        <div class="flex-1" />
        <button
          class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          :title="`Theme: ${theme}`"
          @click="cycleTheme"
        >
          <component :is="themeIcon" class="h-4 w-4" />
        </button>
        <button
          class="rounded-md p-1.5 transition-colors"
          :class="changesOpen ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
          title="Changed files"
          @click="changesOpen = !changesOpen; if (changesOpen) changedFilesRef?.refresh()"
        >
          <FileCode class="h-4 w-4" />
        </button>
      </header>

      <!-- Project details (no session selected) -->
      <div v-if="showProjectDetails" class="flex flex-1 items-center justify-center overflow-y-auto px-4 py-6">
        <div class="w-full max-w-md space-y-6">
          <div class="text-center">
            <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
              <FolderGit2 class="h-6 w-6 text-foreground" />
            </div>
            <h2 class="text-lg font-semibold text-foreground">{{ activeProject!.name }}</h2>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ activeProject!.repos.length }} {{ activeProject!.repos.length === 1 ? 'repository' : 'repositories' }}
            </p>
          </div>

          <div class="rounded-lg border border-border bg-card">
            <div class="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span class="text-xs font-semibold text-foreground">Repositories</span>
              <button
                class="flex items-center gap-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Edit project"
                @click="handleEditProject(activeProject!)"
              >
                <Pencil class="h-3 w-3" />
              </button>
            </div>
            <div class="divide-y divide-border">
              <div
                v-for="repo in activeProject!.repos"
                :key="repo.name"
                class="flex items-center gap-3 px-4 py-3"
              >
                <FolderGit2 class="h-4 w-4 shrink-0 text-muted-foreground" />
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-foreground">{{ repo.name }}</div>
                  <div class="truncate text-xs text-muted-foreground" :title="repo.path">{{ repo.path }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="text-center">
            <button
              class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              @click="handleNewSession"
            >
              <Plus class="h-4 w-4" />
              New chat
            </button>
          </div>
        </div>
      </div>

      <!-- Messages -->
      <div v-else class="flex flex-1 flex-col overflow-hidden">
        <!-- Conversation tabs -->
        <TeamTabBar
          v-if="activeSession && activeSession.conversations.length > 1"
          :conversations="activeSession.conversations"
          :active-id="activeSession.activeConversationId"
          @select="activeSession!.activeConversationId = $event"
        />

        <div ref="messagesEl" class="flex-1 overflow-y-auto px-4 py-6">
          <div class="mx-auto flex max-w-3xl flex-col gap-4">
            <div
              v-if="displayMessages.length === 0 && !loading"
              class="flex flex-1 items-center justify-center pt-32 text-muted-foreground"
            >
              {{ loaded ? 'Send a message to start a new chat' : 'Loading…' }}
            </div>

            <ChatMessage v-for="msg in displayMessages" :key="msg.id" :message="msg" />

            <!-- Tool events -->
            <div v-if="displayEvents.length" class="flex justify-start">
              <div class="max-w-[80%] space-y-1 rounded-xl rounded-bl-sm border border-border bg-card px-4 py-3">
                <div
                  v-for="ev in displayEvents"
                  :key="ev.id"
                  class="flex items-center gap-2 text-xs"
                  :class="ev.isError ? 'text-red-400' : 'text-muted-foreground'"
                >
                  <span v-if="ev.type === 'thinking'" class="thinking-dots">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                  <span v-else-if="ev.type === 'tool_use'" class="text-primary">&#9654;</span>
                  <span v-else-if="ev.isError" class="text-red-400">&#10007;</span>
                  <span v-else class="text-green-400">&#10003;</span>
                  <span class="truncate">{{ ev.label }}</span>
                </div>
              </div>
            </div>

            <!-- AskUserQuestion -->
            <div v-if="displayAskUser" class="flex justify-start">
              <AskUserQuestions
                :questions="displayAskUser"
                @answer="(answers) => respondAskUser(answers, activeSession?.activeConversationId)"
              />
            </div>

            <!-- Elicitation form -->
            <div v-if="elicitation" class="flex justify-start">
              <ElicitationForm
                :elicitation="elicitation"
                @respond="(action, content) => respondElicitation(action, content)"
              />
            </div>

            <div v-if="loading && !displayEvents.length && !elicitation && !displayAskUser" class="flex justify-start">
              <div class="rounded-xl rounded-bl-sm border border-border bg-card px-4 py-3">
                <span class="thinking-dots text-muted-foreground">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="border-t border-border px-4 py-3">
          <div class="mx-auto flex max-w-3xl gap-2">
            <textarea
              ref="inputEl"
              v-model="input"
              :disabled="loading"
              rows="1"
              placeholder="Message Claude..."
              class="flex-1 resize-none rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              @keydown="handleKeydown"
            />
            <button
              v-if="loading"
              :disabled="cancelling"
              class="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              title="Stop"
              @click="handleCancel"
            >
              <Square class="h-4 w-4" />
            </button>
            <button
              v-else
              :disabled="!input.trim()"
              class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              @click="handleSend"
            >
              <SendHorizontal class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Changed files panel -->
    <aside
      v-show="changesOpen"
      class="flex flex-col border-l border-border bg-card transition-[width] duration-200"
      :class="changedFilesRef?.isViewingDiff ? 'w-[480px]' : 'w-64'"
    >
      <ChangedFiles
        v-if="activeSessionId"
        ref="changedFilesRef"
        :session-id="activeSessionId"
        :worktrees="activeSession?.worktrees || {}"
      />
    </aside>

    <!-- Keyboard shortcuts help -->
    <KeyboardShortcutsHelp
      v-if="helpOpen"
      :shortcuts="shortcuts"
      @close="helpOpen = false"
    />

    <!-- Project config dialog -->
    <ProjectConfigDialog
      v-if="projectDialogOpen"
      :project="editingProject"
      @close="projectDialogOpen = false"
      @save="handleSaveProject"
      @delete="handleDeleteProject"
    />
  </div>
</template>
