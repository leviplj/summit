<script setup lang="ts">
import { SendHorizontal } from "lucide-vue-next";
import ChatMessage from "~/components/ChatMessage.vue";

const { messages, events, loading, model, send } = useChat();

const input = ref("");
const messagesEl = ref<HTMLElement>();

function handleSend() {
  if (!input.value.trim() || loading.value) return;
  send(input.value);
  input.value = "";
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

// Auto-scroll on new messages / events
watch(
  [() => messages.value.length, () => messages.value.at(-1)?.content, () => events.value.length],
  () => {
    nextTick(() => {
      messagesEl.value?.scrollTo({ top: messagesEl.value.scrollHeight, behavior: "smooth" });
    });
  },
);
</script>

<template>
  <div class="flex h-screen flex-col bg-background">
    <!-- Header -->
    <header class="flex items-center justify-between border-b border-border px-4 py-3">
      <h1 class="text-lg font-semibold text-foreground">Summit</h1>
      <span v-if="model" class="text-xs text-muted-foreground">{{ model }}</span>
    </header>

    <!-- Messages -->
    <div ref="messagesEl" class="flex-1 overflow-y-auto px-4 py-6">
      <div class="mx-auto flex max-w-3xl flex-col gap-4">
        <!-- Empty state -->
        <div
          v-if="messages.length === 0 && !loading"
          class="flex flex-1 items-center justify-center pt-32 text-muted-foreground"
        >
          Send a message to start
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

        <!-- Loading indicator (no events) -->
        <div v-if="loading && !events.length" class="flex justify-start">
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
          v-model="input"
          :disabled="loading"
          rows="1"
          placeholder="Message Claude..."
          class="flex-1 resize-none rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          @keydown="handleKeydown"
        />
        <button
          :disabled="loading || !input.trim()"
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          @click="handleSend"
        >
          <SendHorizontal class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>
