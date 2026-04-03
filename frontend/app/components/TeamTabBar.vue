<script setup lang="ts">
import { Users, Loader2, Clock, CheckCircle2, AlertCircle, MessageCircleQuestion } from "lucide-vue-next";
import type { ClientConversation } from "~/composables/useSessionStore";

defineProps<{
  conversations: ClientConversation[];
  activeId: string;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

const statusIcon: Record<string, any> = {
  working: Loader2,
  done: CheckCircle2,
  error: AlertCircle,
  cancelled: Clock,
  idle: Clock,
};

const statusColor: Record<string, string> = {
  working: "text-blue-400",
  done: "text-green-400",
  error: "text-red-400",
  cancelled: "text-zinc-400",
  idle: "text-zinc-400",
};

function getIcon(c: ClientConversation) {
  return c.askUser ? MessageCircleQuestion : statusIcon[c.status];
}

function getColor(c: ClientConversation) {
  return c.askUser ? "text-cyan-400" : statusColor[c.status];
}
</script>

<template>
  <div class="flex items-center gap-1 border-b border-border bg-card px-3 py-1.5 overflow-x-auto">
    <!-- Lead tab -->
    <button
      class="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap"
      :class="activeId === 'lead'
        ? 'bg-accent text-foreground'
        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'"
      @click="emit('select', 'lead')"
    >
      <Users class="h-3 w-3" />
      Lead
    </button>

    <!-- Conversation tabs (non-lead) -->
    <button
      v-for="c in conversations.filter(c => c.id !== 'lead')"
      :key="c.id"
      class="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap"
      :class="activeId === c.id
        ? 'bg-accent text-foreground'
        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'"
      @click="emit('select', c.id)"
    >
      <component
        :is="getIcon(c)"
        class="h-3.5 w-3.5"
        :class="[getColor(c), c.status === 'working' && !c.askUser ? 'animate-spin' : '', c.askUser ? 'animate-pulse' : '']"
      />
      {{ c.role }}
      <span v-if="c.askUser" class="text-[10px] text-cyan-400">· Needs input</span>
    </button>
  </div>
</template>
