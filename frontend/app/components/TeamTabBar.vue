<script setup lang="ts">
import type { TeammateTab } from "~/composables/useTeamStore";
import { Users, Loader2, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-vue-next";

defineProps<{
  teammates: TeammateTab[];
  activeTabId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

const statusIcons: Record<string, any> = {
  working: Loader2,
  waiting: Clock,
  done: CheckCircle2,
  error: AlertCircle,
  cancelled: XCircle,
};

const statusColors: Record<string, string> = {
  working: "text-blue-400",
  waiting: "text-yellow-400",
  done: "text-green-400",
  error: "text-red-400",
  cancelled: "text-zinc-400",
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
      class="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap"
      :class="activeTabId === t.id
        ? 'bg-accent text-foreground'
        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'"
      @click="emit('select', t.id)"
    >
      <component
        :is="statusIcons[t.status] || Loader2"
        class="h-3 w-3"
        :class="[
          statusColors[t.status] || 'text-muted-foreground',
          t.status === 'working' ? 'animate-spin' : ''
        ]"
      />
      {{ t.role }}
    </button>
  </div>
</template>
