<script setup lang="ts">
import { Play, Square, ExternalLink, Terminal, ChevronDown, Loader2, AlertCircle } from "lucide-vue-next";
import type { DevServerStatus } from "~~/shared/types";

const props = defineProps<{
  sessionId: string;
}>();

const emit = defineEmits<{
  toggleLogs: [];
}>();

const status = ref<DevServerStatus["status"]>("stopped");
const port = ref<number | null>(null);
const error = ref("");
const dropdownOpen = ref(false);
const loading = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const statusColor: Record<string, string> = {
  stopped: "text-zinc-500",
  starting: "text-yellow-400",
  running: "text-green-400",
  error: "text-red-400",
};

const statusBg: Record<string, string> = {
  stopped: "bg-zinc-500",
  starting: "bg-yellow-400",
  running: "bg-green-400",
  error: "bg-red-400",
};

async function fetchStatus() {
  try {
    const data = await $fetch<DevServerStatus>(`/api/sessions/${props.sessionId}/dev-server/status`);
    status.value = data.status;
    port.value = data.port;
    if (data.error) error.value = data.error;
  } catch {}
}

async function start() {
  loading.value = true;
  error.value = "";
  try {
    const data = await $fetch<DevServerStatus>(`/api/sessions/${props.sessionId}/dev-server/start`, { method: "POST" });
    status.value = data.status;
    port.value = data.port;
    startPolling();
  } catch (err: any) {
    error.value = err.data?.statusMessage || err.message || "Failed to start";
  } finally {
    loading.value = false;
  }
}

async function stop() {
  loading.value = true;
  try {
    const data = await $fetch<DevServerStatus>(`/api/sessions/${props.sessionId}/dev-server/stop`, { method: "POST" });
    status.value = data.status;
    port.value = data.port;
    stopPolling();
  } catch {}
  loading.value = false;
  dropdownOpen.value = false;
}

function openPreview() {
  const prefix = props.sessionId.split("-")[0];
  window.open(`http://${prefix}.localhost:3000/`, "_blank");
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    await fetchStatus();
    if (status.value !== "starting") {
      stopPolling();
    }
  }, 1500);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function handleClick() {
  if (status.value === "stopped" || status.value === "error") {
    start();
  } else if (status.value === "running") {
    openPreview();
  }
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest(".dev-server-btn")) {
    dropdownOpen.value = false;
  }
}

watch(() => props.sessionId, () => {
  stopPolling();
  fetchStatus();
  if (status.value === "starting") startPolling();
}, { immediate: true });

onMounted(() => document.addEventListener("click", handleClickOutside));
onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  stopPolling();
});
</script>

<template>
  <div class="dev-server-btn relative flex items-center">
    <button
      :disabled="loading && status === 'stopped'"
      class="flex items-center gap-1.5 rounded-l-md px-2.5 py-1.5 text-xs transition-colors"
      :class="status === 'running'
        ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
        : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
      :title="status === 'running' ? 'Open preview' : status === 'starting' ? 'Starting…' : 'Start dev server'"
      @click="handleClick"
    >
      <span class="relative flex h-3 w-3 items-center justify-center">
        <span
          v-if="status === 'starting'"
          class="absolute h-2.5 w-2.5 animate-ping rounded-full opacity-50"
          :class="statusBg[status]"
        />
        <span
          class="relative h-2 w-2 rounded-full"
          :class="statusBg[status]"
        />
      </span>
      <Loader2 v-if="loading && status === 'stopped'" class="h-3 w-3 animate-spin" />
      <Play v-else-if="status === 'stopped' || status === 'error'" class="h-3 w-3" />
      <ExternalLink v-else-if="status === 'running'" class="h-3 w-3" />
      <Loader2 v-else class="h-3 w-3 animate-spin" />
      <span>Preview</span>
    </button>

    <button
      class="rounded-r-md border-l border-border px-1 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      @click.stop="dropdownOpen = !dropdownOpen"
    >
      <ChevronDown class="h-3 w-3" />
    </button>

    <!-- Dropdown -->
    <div
      v-if="dropdownOpen"
      class="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border border-border bg-card shadow-lg"
    >
      <div class="py-1">
        <button
          v-if="status === 'running'"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent"
          @click="openPreview(); dropdownOpen = false"
        >
          <ExternalLink class="h-3 w-3" />
          Open preview
        </button>
        <button
          v-if="status === 'running' || status === 'starting'"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-400 hover:bg-accent"
          @click="stop()"
        >
          <Square class="h-3 w-3" />
          Stop server
        </button>
        <button
          v-if="status === 'stopped' || status === 'error'"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent"
          @click="start(); dropdownOpen = false"
        >
          <Play class="h-3 w-3" />
          Start server
        </button>
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent"
          @click="emit('toggleLogs'); dropdownOpen = false"
        >
          <Terminal class="h-3 w-3" />
          View logs
        </button>
      </div>
      <div v-if="error" class="border-t border-border px-3 py-1.5">
        <div class="flex items-start gap-1.5 text-[10px] text-red-400">
          <AlertCircle class="mt-0.5 h-3 w-3 shrink-0" />
          {{ error }}
        </div>
      </div>
    </div>
  </div>
</template>
