<script setup lang="ts">
import type { AskUserQuestion } from "~~/shared/types";

const props = defineProps<{
  questions: AskUserQuestion[];
}>();

const emit = defineEmits<{
  answer: [answers: Record<string, string>];
}>();

const activeTab = ref(0);

// Track selected option per question
const selections = ref<Record<number, number>>({});
const otherText = ref<Record<number, string>>({});
const showOther = ref<Record<number, boolean>>({});

// Previews arrive as HTML (toolConfig.askUserQuestion.previewFormat: 'html')
const previewHtml = computed(() => {
  const result: Record<string, string> = {};
  for (const [qi, q] of props.questions.entries()) {
    for (const [oi, opt] of q.options.entries()) {
      if (opt.preview) {
        result[`${qi}-${oi}`] = opt.preview;
      }
    }
  }
  return result;
});

function selectOption(qi: number, oi: number) {
  selections.value[qi] = oi;
  showOther.value[qi] = false;
}

function selectOther(qi: number) {
  selections.value[qi] = -1;
  showOther.value[qi] = true;
}

function handleSubmit() {
  const answers: Record<string, string> = {};
  for (const [qi, q] of props.questions.entries()) {
    const sel = selections.value[qi];
    if (sel === -1) {
      answers[q.question] = otherText.value[qi] || "";
    } else if (sel !== undefined) {
      answers[q.question] = q.options[sel].label;
    }
  }
  if (Object.keys(answers).length) {
    emit("answer", answers);
  }
}

const allAnswered = computed(() => {
  return props.questions.every((_, qi) => {
    const sel = selections.value[qi];
    if (sel === undefined) return false;
    if (sel === -1) return (otherText.value[qi] || "").trim().length > 0;
    return true;
  });
});
</script>

<template>
  <div class="max-w-[80%] space-y-4 rounded-xl rounded-bl-sm border border-border bg-card px-4 py-4">
    <!-- Tabs (only when multiple questions) -->
    <div v-if="questions.length > 1" class="flex gap-1 border-b border-border">
      <button
        v-for="(q, qi) in questions"
        :key="qi"
        class="relative px-3 py-1.5 text-xs font-medium transition-colors"
        :class="
          activeTab === qi
            ? 'text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        "
        @click="activeTab = qi"
      >
        <span class="flex items-center gap-1.5">
          <span
            v-if="selections[qi] !== undefined"
            class="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-white"
          >
            <svg class="h-2 w-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
          {{ q.header || `Q${qi + 1}` }}
        </span>
        <span
          v-if="activeTab === qi"
          class="absolute inset-x-0 -bottom-px h-0.5 bg-blue-500"
        />
      </button>
    </div>

    <!-- Question content -->
    <template v-for="(q, qi) in questions" :key="qi">
      <div v-show="questions.length === 1 || activeTab === qi" class="space-y-2">
        <div class="flex items-center gap-2">
          <span class="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            {{ q.header }}
          </span>
          <span class="text-sm text-foreground">{{ q.question }}</span>
        </div>

        <div class="space-y-1.5">
          <button
            v-for="(opt, oi) in q.options"
            :key="oi"
            class="flex w-full items-start gap-3 rounded-lg border-2 px-3 py-2 text-left transition-all"
            :class="
              selections[qi] === oi
                ? 'border-blue-500 bg-blue-500/15'
                : 'border-border hover:border-muted-foreground/50'
            "
            @click="selectOption(qi, oi)"
          >
            <span
              class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
              :class="
                selections[qi] === oi
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-muted-foreground/40'
              "
            >
              <svg v-if="selections[qi] === oi" class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span class="flex-1">
              <span class="text-sm font-medium text-foreground">{{ opt.label }}</span>
              <span class="block text-xs text-muted-foreground">{{ opt.description }}</span>
            </span>
          </button>

          <!-- Other option -->
          <button
            class="flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2 text-left text-sm transition-all"
            :class="
              showOther[qi]
                ? 'border-blue-500 bg-blue-500/15'
                : 'border-border hover:border-muted-foreground/50'
            "
            @click="selectOther(qi)"
          >
            <span
              class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
              :class="
                showOther[qi]
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-muted-foreground/40'
              "
            >
              <svg v-if="showOther[qi]" class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span class="text-muted-foreground">Other…</span>
          </button>

          <textarea
            v-if="showOther[qi]"
            v-model="otherText[qi]"
            rows="2"
            placeholder="Type your answer…"
            class="w-full resize-none rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <!-- Preview -->
        <div
          v-if="selections[qi] !== undefined && selections[qi] !== -1 && previewHtml[`${qi}-${selections[qi]}`]"
          class="rounded-lg border border-border bg-secondary/50 px-3 py-2"
        >
          <div class="prose-chat text-xs" v-html="previewHtml[`${qi}-${selections[qi]}`]" />
        </div>
      </div>
    </template>

    <button
      :disabled="!allAnswered"
      class="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      @click="handleSubmit"
    >
      Submit
    </button>
  </div>
</template>
