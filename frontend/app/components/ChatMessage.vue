<script setup lang="ts">
import { Copy, Check } from "lucide-vue-next";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.min.css";
import type { ChatMessage } from "~~/shared/types";

const props = defineProps<{ message: ChatMessage }>();

const md = new Marked(
  markedHighlight({
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
  { gfm: true, breaks: false },
);

const html = computed(() => md.parse(props.message.content) as string);

const meta = computed(() => {
  const m = props.message.meta;
  if (!m) return "";
  const parts: string[] = [];
  if (m.duration_ms) parts.push(`${(m.duration_ms / 1000).toFixed(1)}s`);
  if (m.output_tokens) parts.push(`${m.output_tokens} tokens`);
  if (m.cost_usd) parts.push(`$${m.cost_usd.toFixed(4)}`);
  return parts.join(" \u00b7 ");
});

const copied = ref(false);
function copyMessage() {
  navigator.clipboard.writeText(props.message.content);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}
</script>

<template>
  <div class="group/msg flex flex-col" :class="message.role === 'user' ? 'items-end' : 'items-start'">
    <div
      v-if="message.role === 'user'"
      class="max-w-[80%] rounded-xl rounded-br-sm bg-primary px-4 py-3 text-primary-foreground whitespace-pre-wrap"
    >
      {{ message.content }}
    </div>

    <div
      v-else-if="message.role === 'assistant'"
      class="max-w-[80%] rounded-xl rounded-bl-sm border border-border bg-card px-4 py-3"
    >
      <div class="prose-chat" v-html="html" />
      <div v-if="meta" class="mt-2 text-right text-xs text-muted-foreground">{{ meta }}</div>
    </div>

    <div
      v-else-if="message.role === 'error'"
      class="max-w-[80%] self-center rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-red-400"
    >
      {{ message.content }}
    </div>

    <!-- Action bar below the message -->
    <div v-if="message.role !== 'error'" class="mt-1 flex h-6 gap-1">
      <button
        class="rounded p-1 transition-colors hover:bg-accent hover:text-foreground"
        :class="message.role === 'user' ? 'text-transparent group-hover/msg:text-muted-foreground' : 'text-muted-foreground'"
        title="Copy message"
        @click="copyMessage"
      >
        <Check v-if="copied" class="h-3.5 w-3.5 text-green-400" />
        <Copy v-else class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>
