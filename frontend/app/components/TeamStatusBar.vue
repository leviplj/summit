<script setup lang="ts">
import type { TeammateTab } from "~/composables/useTeamStore";

defineProps<{
  teammates: TeammateTab[];
}>();

const statusEmoji: Record<string, string> = {
  working: "🔄",
  waiting: "⏳",
  done: "✅",
  error: "❌",
  cancelled: "⛔",
};
</script>

<template>
  <div class="flex items-center gap-3 border-b border-border bg-card/50 px-4 py-1 text-[10px] text-muted-foreground">
    <span v-for="t in teammates" :key="t.id" class="whitespace-nowrap">
      {{ statusEmoji[t.status] || '?' }} {{ t.role }}: {{ t.status }}
    </span>
  </div>
</template>