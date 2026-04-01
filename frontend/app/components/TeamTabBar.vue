<script setup lang="ts">
import type { TeammateTab } from "~/composables/useSessionStore";
import { Users, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, MessageCircleQuestion } from "lucide-vue-next";

defineProps<{
  teammates: TeammateTab[];
  activeTabId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

function getStatus(t: TeammateTab): string {
  if (t.askUser) return "ask_user";
  return t.status;
}

const statusIcons: Record<string, any> = {
  working: Loader2,
  waiting: Clock,
  done: CheckCircle2,
  error: AlertCircle,
  cancelled: XCircle,
  ask_user: MessageCircleQuestion,
};

const statusColors: Record<string, string> = {
  working: "text-blue-400",
  waiting: "text-yellow-400",
  done: "text-green-400",
  error: "text-red-400",
  cancelled: "text-zinc-400",
  ask_user: "text-cyan-400",
};
</script>

<template>
  <div class="flex items-center gap-1 border-b border-border bg-card px-3 py-1.5 overflow-x-auto">
    <!-- Orchestrator tab -->
    <button
      class="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap"
      :class="activeTabId === 'orchestrator'
        ? 'bg-accent text-foreground'
        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'"
      @click="emit('select', 'orchestrator')"
    >
      <Users class="h-3 w-3" />
      Lead
    </button>

    <!-- Teammate tabs -->
    <button
      v-for="t in teammates"
      :key="t.id"
      class="relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap"
      :class="activeTabId === t.id
        ? 'bg-accent text-foreground'
        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'"
      @click="emit('select', t.id)"
    >
      <component
        :is="statusIcons[getStatus(t)] || Loader2"
        class="h-3 w-3"
        :class="[
          statusColors[getStatus(t)] || 'text-muted-foreground',
          getStatus(t) === 'working' ? 'animate-spin' : ''
        ]"
      />
      {{ t.role }}
      <!-- Attention dot when teammate needs input and tab is not selected -->
      <span
        v-if="getStatus(t) === 'ask_user' && activeTabId !== t.id"
        class="absolute -top-0.5 -right-0.5 flex h-2 w-2"
      >
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
        <span class="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
      </span>
    </button>
  </div>
</template>
