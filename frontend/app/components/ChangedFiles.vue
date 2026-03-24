<script setup lang="ts">
import { FileCode, FilePlus, FileMinus, FileEdit, RefreshCw, ArrowLeft } from "lucide-vue-next";

interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
}

const props = defineProps<{
  sessionId: string;
}>();

const files = ref<FileChange[]>([]);
const loading = ref(false);
const selectedFile = ref<FileChange | null>(null);
const diffText = ref("");
const diffLoading = ref(false);

const statusIcon: Record<string, any> = {
  added: FilePlus,
  modified: FileEdit,
  deleted: FileMinus,
  renamed: FileCode,
};

const statusColor: Record<string, string> = {
  added: "text-green-400",
  modified: "text-yellow-400",
  deleted: "text-red-400",
  renamed: "text-blue-400",
};

async function fetchChanges() {
  loading.value = true;
  try {
    const data = await $fetch<{ files: FileChange[] }>(`/api/sessions/${props.sessionId}/changes`);
    files.value = data.files;
  } catch {
    files.value = [];
  } finally {
    loading.value = false;
  }
}

async function viewDiff(file: FileChange) {
  selectedFile.value = file;
  diffLoading.value = true;
  diffText.value = "";
  try {
    const data = await $fetch<{ diff: string }>(`/api/sessions/${props.sessionId}/diff`, {
      params: { path: file.path },
    });
    diffText.value = data.diff;
  } catch {
    diffText.value = "Failed to load diff";
  } finally {
    diffLoading.value = false;
  }
}

function goBack() {
  selectedFile.value = null;
  diffText.value = "";
}

const diffLines = computed(() => {
  if (!diffText.value) return [];
  return diffText.value.split("\n").map((line) => {
    let type: "add" | "del" | "hunk" | "ctx" = "ctx";
    if (line.startsWith("+") && !line.startsWith("+++")) type = "add";
    else if (line.startsWith("-") && !line.startsWith("---")) type = "del";
    else if (line.startsWith("@@")) type = "hunk";
    return { text: line, type };
  });
});

watch(() => props.sessionId, () => {
  goBack();
  fetchChanges();
}, { immediate: true });

const isViewingDiff = computed(() => !!selectedFile.value);

defineExpose({ refresh: fetchChanges, isViewingDiff });
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="flex items-center gap-2 border-b border-border px-3 py-2">
      <button
        v-if="selectedFile"
        class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        @click="goBack"
      >
        <ArrowLeft class="h-3.5 w-3.5" />
      </button>
      <span v-if="selectedFile" class="flex-1 truncate text-xs font-semibold text-foreground" :title="selectedFile.path">
        {{ selectedFile.path }}
      </span>
      <template v-else>
        <span class="flex-1 text-xs font-semibold text-foreground">
          Changed Files
          <span v-if="files.length" class="ml-1 text-muted-foreground">({{ files.length }})</span>
        </span>
        <button
          class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Refresh"
          @click="fetchChanges"
        >
          <RefreshCw class="h-3 w-3" :class="loading ? 'animate-spin' : ''" />
        </button>
      </template>
    </div>

    <!-- File list -->
    <div v-if="!selectedFile" class="flex-1 overflow-y-auto">
      <div v-if="loading && !files.length" class="px-3 py-4 text-center text-xs text-muted-foreground">
        Loading…
      </div>
      <div v-else-if="files.length === 0" class="px-3 py-4 text-center text-xs text-muted-foreground">
        No changes yet
      </div>
      <div v-else class="py-1">
        <button
          v-for="file in files"
          :key="file.path"
          class="flex w-full items-center gap-2 px-3 py-1 text-left text-xs transition-colors hover:bg-accent/50"
          @click="viewDiff(file)"
        >
          <component
            :is="statusIcon[file.status]"
            class="h-3.5 w-3.5 shrink-0"
            :class="statusColor[file.status]"
          />
          <span class="flex-1 truncate text-foreground" :title="file.path">
            {{ file.path }}
          </span>
          <span v-if="file.additions || file.deletions" class="shrink-0 space-x-1 text-[10px]">
            <span v-if="file.additions" class="text-green-400">+{{ file.additions }}</span>
            <span v-if="file.deletions" class="text-red-400">-{{ file.deletions }}</span>
          </span>
        </button>
      </div>
    </div>

    <!-- Diff view -->
    <div v-else class="flex-1 overflow-auto">
      <div v-if="diffLoading" class="px-3 py-4 text-center text-xs text-muted-foreground">
        Loading diff…
      </div>
      <div v-else-if="!diffText" class="px-3 py-4 text-center text-xs text-muted-foreground">
        No diff available
      </div>
      <pre v-else class="text-[11px] leading-tight"><template
        v-for="(line, i) in diffLines"
        :key="i"
><div
          class="px-3 py-px"
          :class="{
            'diff-add': line.type === 'add',
            'diff-del': line.type === 'del',
            'diff-hunk font-medium': line.type === 'hunk',
            'diff-ctx': line.type === 'ctx',
          }"
>{{ line.text }}</div></template></pre>
    </div>
  </div>
</template>