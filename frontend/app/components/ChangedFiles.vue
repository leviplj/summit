<script setup lang="ts">
import { FileCode, FilePlus, FileMinus, FileEdit, RefreshCw, ArrowLeft, GitMerge, Circle, Sparkles, Loader2, ChevronDown } from "lucide-vue-next";
import type { FileChange } from "summit-types";

const props = defineProps<{
  sessionId: string;
  worktrees: Record<string, string>;
}>();

// Multi-repo state
const isMultiRepo = computed(() => Object.keys(props.worktrees).length > 1);
const repoChanges = ref<Record<string, FileChange[]>>({});
const collapsedRepos = ref<Set<string>>(new Set());

// Single-repo / flat state
const files = ref<FileChange[]>([]);
const sourceBranch = ref("main");
const loading = ref(false);
const selectedFile = ref<FileChange | null>(null);
const selectedFileRepo = ref<string | null>(null);
const diffText = ref("");
const diffLoading = ref(false);
const commitMessage = ref("");
const committing = ref(false);
const commitError = ref("");
const commitSuccess = ref("");
const generating = ref(false);
const merging = ref(false);
const mergeError = ref("");
const mergeSuccess = ref("");

// Flatten all files across repos for summary
const allFiles = computed(() => {
  if (isMultiRepo.value) {
    const all: Array<FileChange & { repo: string }> = [];
    for (const [repo, files] of Object.entries(repoChanges.value)) {
      for (const f of files) {
        all.push({ ...f, repo });
      }
    }
    return all;
  }
  return files.value.map((f) => ({ ...f, repo: "" }));
});

const uncommittedFiles = computed(() => allFiles.value.filter((f) => f.uncommitted));
const stagedFiles = computed(() => uncommittedFiles.value.filter((f) => f.staged));
const unstagedFiles = computed(() => uncommittedFiles.value.filter((f) => !f.staged));
const hasUncommitted = computed(() => uncommittedFiles.value.length > 0);
const totalFiles = computed(() => allFiles.value.length);

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
    const data = await $fetch<any>(`/api/sessions/${props.sessionId}/changes`);
    if (data.repoChanges) {
      repoChanges.value = data.repoChanges;
      files.value = [];
    } else {
      files.value = data.files || [];
      repoChanges.value = {};
    }
    if (data.sourceBranch) sourceBranch.value = data.sourceBranch;
  } catch {
    files.value = [];
    repoChanges.value = {};
  } finally {
    loading.value = false;
  }
}

async function viewDiff(file: FileChange, repo?: string) {
  selectedFile.value = file;
  selectedFileRepo.value = repo || null;
  diffLoading.value = true;
  diffText.value = "";
  try {
    const params: Record<string, string> = { path: file.path };
    if (repo) params.repo = repo;
    const data = await $fetch<{ diff: string }>(`/api/sessions/${props.sessionId}/diff`, { params });
    diffText.value = data.diff;
  } catch {
    diffText.value = "Failed to load diff";
  } finally {
    diffLoading.value = false;
  }
}

function goBack() {
  selectedFile.value = null;
  selectedFileRepo.value = null;
  diffText.value = "";
}

function toggleRepoCollapse(repo: string) {
  if (collapsedRepos.value.has(repo)) {
    collapsedRepos.value.delete(repo);
  } else {
    collapsedRepos.value.add(repo);
  }
}

async function toggleStage(file: FileChange & { repo?: string }) {
  const endpoint = file.staged ? "unstage" : "stage";
  try {
    await $fetch(`/api/sessions/${props.sessionId}/git/${endpoint}`, {
      method: "POST",
      body: { paths: [file.path], repo: file.repo || undefined },
    });
    await fetchChanges();
  } catch {}
}

async function stageAll() {
  // Group by repo
  const byRepo = new Map<string, string[]>();
  for (const f of unstagedFiles.value) {
    const repo = f.repo || "";
    if (!byRepo.has(repo)) byRepo.set(repo, []);
    byRepo.get(repo)!.push(f.path);
  }
  try {
    for (const [repo, paths] of byRepo) {
      await $fetch(`/api/sessions/${props.sessionId}/git/stage`, {
        method: "POST",
        body: { paths, repo: repo || undefined },
      });
    }
    await fetchChanges();
  } catch {}
}

async function unstageAll() {
  const byRepo = new Map<string, string[]>();
  for (const f of stagedFiles.value) {
    const repo = f.repo || "";
    if (!byRepo.has(repo)) byRepo.set(repo, []);
    byRepo.get(repo)!.push(f.path);
  }
  try {
    for (const [repo, paths] of byRepo) {
      await $fetch(`/api/sessions/${props.sessionId}/git/unstage`, {
        method: "POST",
        body: { paths, repo: repo || undefined },
      });
    }
    await fetchChanges();
  } catch {}
}

async function handleCommit() {
  if (!commitMessage.value.trim() || !stagedFiles.value.length) return;
  committing.value = true;
  commitError.value = "";
  commitSuccess.value = "";
  try {
    // For multi-repo, commit per repo
    if (isMultiRepo.value) {
      const byRepo = new Map<string, boolean>();
      for (const f of stagedFiles.value) {
        byRepo.set(f.repo, true);
      }
      for (const repo of byRepo.keys()) {
        await $fetch<{ ok: boolean; hash: string }>(`/api/sessions/${props.sessionId}/git/commit`, {
          method: "POST",
          body: { message: commitMessage.value.trim(), repo },
        });
      }
      commitSuccess.value = `Committed to ${byRepo.size} repo(s)`;
    } else {
      const result = await $fetch<{ ok: boolean; hash: string }>(`/api/sessions/${props.sessionId}/git/commit`, {
        method: "POST",
        body: { message: commitMessage.value.trim() },
      });
      commitSuccess.value = `Committed ${result.hash}`;
    }
    commitMessage.value = "";
    await fetchChanges();
    setTimeout(() => { commitSuccess.value = ""; }, 3000);
  } catch (err: any) {
    commitError.value = err.data?.message || err.message || "Commit failed";
  } finally {
    committing.value = false;
  }
}

async function generateMessage() {
  if (!stagedFiles.value.length) return;
  generating.value = true;
  try {
    // Use first repo with staged files
    const repo = isMultiRepo.value ? stagedFiles.value[0].repo : undefined;
    const result = await $fetch<{ message: string }>(`/api/sessions/${props.sessionId}/git/generate-message`, {
      method: "POST",
      body: { repo },
    });
    commitMessage.value = result.message;
  } catch {}
  generating.value = false;
}

async function handleMerge() {
  merging.value = true;
  mergeError.value = "";
  mergeSuccess.value = "";
  try {
    await $fetch(`/api/sessions/${props.sessionId}/git/merge`, {
      method: "POST",
      body: {},
    });
    mergeSuccess.value = "Merged to source branch";
    await fetchChanges();
    setTimeout(() => { mergeSuccess.value = ""; }, 5000);
  } catch (err: any) {
    mergeError.value = err.data?.message || err.message || "Merge failed";
  } finally {
    merging.value = false;
  }
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
        <span v-if="selectedFileRepo" class="text-muted-foreground">{{ selectedFileRepo }}/</span>{{ selectedFile.path }}
      </span>
      <template v-else>
        <span class="flex-1 text-xs font-semibold text-foreground">
          Session Changes
          <span v-if="totalFiles" class="ml-1 text-muted-foreground">({{ totalFiles }})</span>
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
      <div v-if="loading && totalFiles === 0" class="px-3 py-4 text-center text-xs text-muted-foreground">
        Loading…
      </div>
      <div v-else-if="totalFiles === 0" class="px-3 py-4 text-center text-xs text-muted-foreground">
        No changes yet
      </div>
      <template v-else>
        <!-- Multi-repo: grouped by repo -->
        <template v-if="isMultiRepo">
          <div v-for="(repoFiles, repoName) in repoChanges" :key="repoName" class="border-b border-border last:border-b-0">
            <button
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-semibold text-foreground hover:bg-accent/30"
              @click="toggleRepoCollapse(String(repoName))"
            >
              <ChevronDown
                class="h-3 w-3 shrink-0 text-muted-foreground transition-transform"
                :class="collapsedRepos.has(String(repoName)) ? '-rotate-90' : ''"
              />
              <span>{{ repoName }}</span>
              <span class="text-[10px] font-normal text-muted-foreground">({{ repoFiles.length }})</span>
            </button>
            <div v-if="!collapsedRepos.has(String(repoName))" class="pb-1">
              <button
                v-for="file in repoFiles"
                :key="file.path"
                class="flex w-full items-center gap-2 px-3 py-1 pl-7 text-left text-xs transition-colors hover:bg-accent/50"
                @click="viewDiff(file, String(repoName))"
              >
                <component
                  :is="statusIcon[file.status]"
                  class="h-3.5 w-3.5 shrink-0"
                  :class="statusColor[file.status]"
                />
                <span class="flex-1 truncate text-foreground" :title="file.path">
                  {{ file.path }}
                </span>
                <Circle
                  v-if="file.uncommitted"
                  class="h-2 w-2 shrink-0 fill-current text-amber-400"
                  :title="file.staged ? 'Staged' : 'Uncommitted'"
                />
                <span v-if="file.additions || file.deletions" class="shrink-0 space-x-1 text-[10px]">
                  <span v-if="file.additions" class="text-green-400">+{{ file.additions }}</span>
                  <span v-if="file.deletions" class="text-red-400">-{{ file.deletions }}</span>
                </span>
              </button>
            </div>
          </div>
        </template>

        <!-- Single-repo: flat list -->
        <template v-else>
          <div class="py-1">
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
              <Circle
                v-if="file.uncommitted"
                class="h-2 w-2 shrink-0 fill-current text-amber-400"
                :title="file.staged ? 'Staged' : 'Uncommitted'"
              />
              <span v-if="file.additions || file.deletions" class="shrink-0 space-x-1 text-[10px]">
                <span v-if="file.additions" class="text-green-400">+{{ file.additions }}</span>
                <span v-if="file.deletions" class="text-red-400">-{{ file.deletions }}</span>
              </span>
            </button>
          </div>
        </template>

        <!-- Staging & commit section (only when uncommitted files exist) -->
        <div v-if="hasUncommitted" class="border-t border-border">
          <!-- Staged files -->
          <div v-if="stagedFiles.length" class="px-3 pt-2 pb-1">
            <div class="flex items-center justify-between pb-1">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-green-400">Staged ({{ stagedFiles.length }})</span>
              <button
                class="text-[10px] text-muted-foreground hover:text-foreground"
                @click="unstageAll"
              >Unstage All</button>
            </div>
            <div
              v-for="file in stagedFiles"
              :key="'s-' + (file.repo ? file.repo + '/' : '') + file.path"
              class="flex items-center gap-2 py-0.5 text-xs"
            >
              <input
                type="checkbox"
                checked
                class="h-3 w-3 shrink-0 accent-green-400"
                @click.stop="toggleStage(file)"
              />
              <span class="truncate text-foreground" :title="file.path">
                <span v-if="isMultiRepo && file.repo" class="text-muted-foreground">{{ file.repo }}/</span>{{ file.path }}
              </span>
            </div>
          </div>

          <!-- Unstaged files -->
          <div v-if="unstagedFiles.length" class="px-3 pt-2 pb-1">
            <div class="flex items-center justify-between pb-1">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Unstaged ({{ unstagedFiles.length }})</span>
              <button
                class="text-[10px] text-muted-foreground hover:text-foreground"
                @click="stageAll"
              >Stage All</button>
            </div>
            <div
              v-for="file in unstagedFiles"
              :key="'u-' + (file.repo ? file.repo + '/' : '') + file.path"
              class="flex items-center gap-2 py-0.5 text-xs"
            >
              <input
                type="checkbox"
                :checked="false"
                class="h-3 w-3 shrink-0"
                @click.stop="toggleStage(file)"
              />
              <span class="truncate text-foreground" :title="file.path">
                <span v-if="isMultiRepo && file.repo" class="text-muted-foreground">{{ file.repo }}/</span>{{ file.path }}
              </span>
            </div>
          </div>

          <!-- Commit -->
          <div class="px-3 py-2">
            <div class="relative">
              <textarea
                v-model="commitMessage"
                rows="2"
                placeholder="Commit message…"
                class="w-full resize-none rounded border border-input bg-secondary px-2 py-1.5 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                v-if="stagedFiles.length"
                :disabled="generating"
                class="absolute right-1.5 top-1.5 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                title="Generate commit message"
                @click="generateMessage"
              >
                <Loader2 v-if="generating" class="h-3 w-3 animate-spin" />
                <Sparkles v-else class="h-3 w-3" />
              </button>
            </div>
            <div v-if="commitError" class="mb-1 text-[10px] text-red-400">{{ commitError }}</div>
            <div v-if="commitSuccess" class="mb-1 text-[10px] text-green-400">{{ commitSuccess }}</div>
            <button
              :disabled="!commitMessage.trim() || !stagedFiles.length || committing"
              class="w-full rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              @click="handleCommit"
            >
              {{ committing ? "Committing…" : `Commit (${stagedFiles.length})` }}
            </button>
          </div>
        </div>

        <!-- Merge section -->
        <div v-if="totalFiles" class="border-t border-border px-3 py-2">
          <div v-if="mergeError" class="mb-1 text-[10px] text-red-400">{{ mergeError }}</div>
          <div v-if="mergeSuccess" class="mb-1 text-[10px] text-green-400">{{ mergeSuccess }}</div>
          <button
            :disabled="hasUncommitted || merging"
            :title="hasUncommitted ? 'Commit all changes before merging' : `Merge session branch into ${sourceBranch}`"
            class="flex w-full items-center justify-center gap-1.5 rounded bg-green-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            @click="handleMerge"
          >
            <GitMerge class="h-3 w-3" />
            {{ merging ? "Merging…" : `Merge into ${sourceBranch}` }}
          </button>
        </div>
      </template>
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
