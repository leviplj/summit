<script setup lang="ts">
import type { TeammateTab } from "~/composables/useSessionStore";

defineProps<{
  teammates: TeammateTab[];
}>();

function getStatus(t: TeammateTab): string {
  if (t.askUser) return "ask_user";
  return t.status;
}

const statusLabels: Record<string, string> = {
  working: "working",
  waiting: "waiting",
  done: "done",
  error: "error",
  cancelled: "cancelled",
  ask_user: "needs input",
};

const statusEmoji: Record<string, string> = {
  working: "🔄",
  waiting: "⏳",
  done: "✅",
  error: "❌",
  cancelled: "⛔",
  ask_user: "💬",
};
</script>

<template>
  <div class="flex items-center gap-3 border-b border-border bg-card/50 px-4 py-1 text-[10px] text-muted-foreground">
    <span v-for="t in teammates" :key="t.id" class="whitespace-nowrap" :class="getStatus(t) === 'ask_user' ? 'text-cyan-400 font-medium' : ''">
      {{ statusEmoji[getStatus(t)] || '?' }} {{ t.role }}: {{ statusLabels[getStatus(t)] || getStatus(t) }}
    </span>
  </div>
</template>
