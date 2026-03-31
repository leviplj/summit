<script setup lang="ts">
import { ArrowRight, ArrowLeft } from "lucide-vue-next";

defineProps<{
  direction: "sent" | "received";
  otherName: string;
  content: string;
}>();
</script>

<template>
  <div
    class="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
    :class="direction === 'sent'
      ? 'border-blue-500/20 bg-blue-500/5'
      : 'border-green-500/20 bg-green-500/5'"
  >
    <component
      :is="direction === 'sent' ? ArrowRight : ArrowLeft"
      class="mt-0.5 h-3 w-3 shrink-0"
      :class="direction === 'sent' ? 'text-blue-400' : 'text-green-400'"
    />
    <div class="min-w-0 flex-1">
      <span
        class="font-medium"
        :class="direction === 'sent' ? 'text-blue-400' : 'text-green-400'"
      >
        {{ direction === 'sent' ? `→ ${otherName}` : `← ${otherName}` }}
      </span>
      <p class="mt-0.5 text-foreground whitespace-pre-wrap">{{ content }}</p>
    </div>
  </div>
</template>
