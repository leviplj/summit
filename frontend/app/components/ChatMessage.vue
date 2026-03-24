<script setup lang="ts">
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.min.css";
import type { ChatMessage } from "~/composables/useChat";

const props = defineProps<{ message: ChatMessage }>();

marked.setOptions({
  highlight(code: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  gfm: true,
  breaks: false,
});

const html = computed(() => marked.parse(props.message.content) as string);

const meta = computed(() => {
  const m = props.message.meta;
  if (!m) return "";
  const parts: string[] = [];
  if (m.duration_ms) parts.push(`${(m.duration_ms / 1000).toFixed(1)}s`);
  if (m.output_tokens) parts.push(`${m.output_tokens} tokens`);
  if (m.cost_usd) parts.push(`$${m.cost_usd.toFixed(4)}`);
  return parts.join(" \u00b7 ");
});
</script>

<template>
  <div class="flex" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
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
      class="max-w-[80%] mx-auto rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-red-400"
    >
      {{ message.content }}
    </div>
  </div>
</template>
