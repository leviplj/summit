<script setup lang="ts">
import { Terminal } from "lucide-vue-next";

const props = defineProps<{
  sessionId: string;
}>();

interface LogLine {
  stream: "stdout" | "stderr";
  text: string;
  ts: number;
}

const logs = ref<LogLine[]>([]);
const logsEl = ref<HTMLElement>();
let refreshTimer: ReturnType<typeof setInterval> | null = null;

async function fetchLogs() {
  try {
    const data = await $fetch<{ logs: LogLine[] }>(`/api/sessions/${props.sessionId}/dev-server/logs`);
    logs.value = data.logs;
    nextTick(() => {
      logsEl.value?.scrollTo({ top: logsEl.value.scrollHeight });
    });
  } catch {}
}

function startRefresh() {
  stopRefresh();
  refreshTimer = setInterval(fetchLogs, 2000);
}

function stopRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

watch(() => props.sessionId, () => {
  fetchLogs();
  startRefresh();
}, { immediate: true });

onUnmounted(() => stopRefresh());
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center gap-2 border-b border-border px-3 py-2">
      <Terminal class="h-3.5 w-3.5 text-muted-foreground" />
      <span class="flex-1 text-xs font-semibold text-foreground">Dev Server Logs</span>
    </div>
    <div
      ref="logsEl"
      class="flex-1 overflow-auto bg-zinc-950 p-2 font-mono text-[11px] leading-relaxed"
    >
      <div v-if="!logs.length" class="py-4 text-center text-xs text-muted-foreground">
        No logs yet
      </div>
      <div
        v-for="(line, i) in logs"
        :key="i"
        class="whitespace-pre-wrap break-all"
        :class="line.stream === 'stderr' ? 'text-red-400' : 'text-zinc-300'"
      >{{ line.text }}</div>
    </div>
  </div>
</template>