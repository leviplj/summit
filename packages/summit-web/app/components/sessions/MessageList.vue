<script setup lang="ts">
import { MessageSquare, Loader2 } from "lucide-vue-next";
import type { ChatMessage } from "summit-types";

defineProps<{ messages: ChatMessage[]; pending?: boolean }>();
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div v-if="!messages.length && !pending" class="h-full flex items-center justify-center text-muted-foreground">
      <div class="text-center">
        <MessageSquare class="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p class="text-sm">No messages yet</p>
        <p class="text-xs mt-1 opacity-60">Send a message to start the conversation</p>
      </div>
    </div>

    <div v-else class="max-w-3xl mx-auto px-6 py-4 space-y-4">
      <div
        v-for="msg in messages"
        :key="msg.id"
        :class="['flex', msg.role === 'user' ? 'justify-end' : 'justify-start']"
      >
        <div
          :class="[
            'rounded-lg px-4 py-2 max-w-[85%] text-sm whitespace-pre-wrap',
            msg.role === 'user' && 'bg-primary text-primary-foreground',
            msg.role === 'assistant' && 'bg-muted text-foreground',
            msg.role === 'error' && 'bg-destructive/10 text-destructive border border-destructive/40',
          ]"
        >
          {{ msg.content }}
        </div>
      </div>

      <div v-if="pending" class="flex justify-start">
        <div class="rounded-lg px-4 py-2 bg-muted flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 class="w-4 h-4 animate-spin" />
          Thinking...
        </div>
      </div>
    </div>
  </div>
</template>
