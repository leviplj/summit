<script setup lang="ts">
import { Plus, SendHorizontal, Square, Trash2, GitBranch, FileCode, Sun, Moon, Monitor, Search, X, MessageSquareText } from "lucide-vue-next";
import type { SessionStatus } from "~~/shared/types";
import ChatMessage from "~/components/ChatMessage.vue";
import ElicitationForm from "~/components/ElicitationForm.vue";
import AskUserQuestions from "~/components/AskUserQuestions.vue";
import ChangedFiles from "~/components/ChangedFiles.vue";
import ModelSelector from "~/components/ModelSelector.vue";
import KeyboardShortcutsHelp from "~/components/KeyboardShortcutsHelp.vue";
import HighlightMatch from "~/components/HighlightMatch.vue";

const statusConfig: Record<SessionStatus, { color: string; pulse: boolean; label: string }> = {
  idle: { color: "bg-zinc-500", pulse: false, label: "Idle" },
  waiting: { color: "bg-yellow-400", pulse: true, label: "Waiting…" },
  thinking: { color: "bg-purple-400", pulse: true, label: "Thinking…" },
  streaming: { color: "bg-blue-400", pulse: true, label: "Responding…" },
  tool: { color: "bg-orange-400", pulse: true, label: "Running tool…" },
  elicitation: { color: "bg-amber-400", pulse: true, label: "Needs input" },
  error: { color: "bg-red-400", pulse: false, label: "Error" },
};

const {
  sessions,
  activeSessionId,
  activeSession,
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

const { helpOpen, shortcuts } = useKeyboardShortcuts({
  sidebarOpen,
  changesOpen,
  refreshChanges: () => changedFilesRef.value?.refresh(),
  newSession,
  selectPrevSession,
  selectNextSession,
  focusInput: () => inputEl.value?.focus(),
});

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
  [() => messages.value.length, () => messages.value.at(-1)?.content, () => events.value.length, () => elicitation.value, () => askUser.value],
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
          @click="newSession"
        >
          <Plus class="h-4 w-4" />
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
          v-if="filteredSessions.length === 0 && searchQuery"
          class="px-3 py-4 text-center text-xs text-muted-foreground"
        >
          No matching sessions
        </div>
        <button
          v-for="s in filteredSessions"
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
              :class="s.status === 'error' ? 'text-red-400' : 'text-muted-foreground'"
            >{{ statusConfig[s.status].label }}</span>
            <span
              v-if="fullTextEnabled && searchQuery && fullTextResults.find((r) => r.sessionId === s.id) && !s.title.toLowerCase().includes(searchQuery.toLowerCase())"
              class="block truncate text-[10px] leading-tight text-muted-foreground italic"
            >{{ fullTextResults.find((r) => r.sessionId === s.id)?.snippet }}</span>
          </span>
          <span
            v-if="sessions.length > 1"
            class="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-destructive/20 hover:text-red-400 group-hover:opacity-100"
            @click.stop="deleteSession(s.id)"
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
        <span
          v-if="activeSession?.branch"
          class="flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs text-muted-foreground"
        >
          <GitBranch class="h-3 w-3" />
          {{ activeSession.branch }}
        </span>
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

      <!-- Messages -->
      <div ref="messagesEl" class="flex-1 overflow-y-auto px-4 py-6">
        <div class="mx-auto flex max-w-3xl flex-col gap-4">
          <div
            v-if="messages.length === 0 && !loading"
            class="flex flex-1 items-center justify-center pt-32 text-muted-foreground"
          >
            {{ loaded ? 'Send a message to start' : 'Loading…' }}
          </div>

          <ChatMessage v-for="msg in messages" :key="msg.id" :message="msg" />

          <!-- Tool events -->
          <div v-if="events.length" class="flex justify-start">
            <div class="max-w-[80%] space-y-1 rounded-xl rounded-bl-sm border border-border bg-card px-4 py-3">
              <div
                v-for="ev in events"
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
          <div v-if="askUser" class="flex justify-start">
            <AskUserQuestions
              :questions="askUser"
              @answer="(answers) => respondAskUser(answers)"
            />
          </div>

          <!-- Elicitation form -->
          <div v-if="elicitation" class="flex justify-start">
            <ElicitationForm
              :elicitation="elicitation"
              @respond="(action, content) => respondElicitation(action, content)"
            />
          </div>

          <div v-if="loading && !events.length && !elicitation && !askUser" class="flex justify-start">
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
      />
    </aside>

    <!-- Keyboard shortcuts help -->
    <KeyboardShortcutsHelp
      v-if="helpOpen"
      :shortcuts="shortcuts"
      @close="helpOpen = false"
    />
  </div>
</template>
