<script setup lang="ts">
import { X, Plus, Trash2, FolderGit2, ChevronDown, Terminal } from "lucide-vue-next";
import type { Project } from "~~/shared/types";

const props = defineProps<{
  project?: Project | null;
}>();

const emit = defineEmits<{
  close: [];
  save: [project: { name: string; repos: Array<{ name: string; path: string }>; devServer?: { command: string; basePort: number; repo?: string } | null }];
  delete: [id: string];
}>();

const name = ref(props.project?.name || "");
const repos = ref<Array<{ name: string; path: string }>>(
  props.project?.repos?.map((r) => ({ ...r })) || [{ name: "", path: "" }],
);
const devServerEnabled = ref(!!props.project?.devServer);
const devServerCommand = ref(props.project?.devServer?.command || "");
const devServerBasePort = ref(props.project?.devServer?.basePort || 3100);
const devServerRepo = ref(props.project?.devServer?.repo || "");
const devServerOpen = ref(!!props.project?.devServer);
const error = ref("");
const saving = ref(false);

const isEdit = computed(() => !!props.project);

function addRepo() {
  repos.value.push({ name: "", path: "" });
}

function removeRepo(index: number) {
  if (repos.value.length <= 1) return;
  repos.value.splice(index, 1);
}

async function handleSave() {
  error.value = "";
  if (!name.value.trim()) {
    error.value = "Project name is required";
    return;
  }
  const validRepos = repos.value.filter((r) => r.name.trim() && r.path.trim());
  if (!validRepos.length) {
    error.value = "At least one repo with name and path is required";
    return;
  }

  saving.value = true;
  try {
    const devServer = devServerEnabled.value && devServerCommand.value.trim()
      ? {
          command: devServerCommand.value.trim(),
          basePort: devServerBasePort.value,
          ...(devServerRepo.value.trim() ? { repo: devServerRepo.value.trim() } : {}),
        }
      : null;

    emit("save", {
      name: name.value.trim(),
      repos: validRepos.map((r) => ({ name: r.name.trim(), path: r.path.trim() })),
      devServer,
    });
  } finally {
    saving.value = false;
  }
}

function handleDelete() {
  if (props.project && confirm(`Delete project "${props.project.name}"?`)) {
    emit("delete", props.project.id);
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="emit('close')">
    <div class="w-full max-w-lg rounded-lg border border-border bg-card p-4 shadow-xl">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-foreground">
          {{ isEdit ? 'Edit Project' : 'New Project' }}
        </h2>
        <button
          class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="space-y-3">
        <!-- Project name -->
        <div>
          <label class="mb-1 block text-xs font-medium text-muted-foreground">Project Name</label>
          <input
            v-model="name"
            type="text"
            placeholder="My Project"
            class="w-full rounded-md border border-input bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <!-- Repos -->
        <div>
          <div class="mb-1 flex items-center justify-between">
            <label class="text-xs font-medium text-muted-foreground">Repositories</label>
            <button
              class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              @click="addRepo"
            >
              <Plus class="h-3 w-3" />
              Add repo
            </button>
          </div>
          <div class="space-y-2">
            <div
              v-for="(repo, i) in repos"
              :key="i"
              class="flex items-start gap-2"
            >
              <div class="flex-1 space-y-1">
                <input
                  v-model="repo.name"
                  type="text"
                  placeholder="Repo name (e.g. api)"
                  class="w-full rounded-md border border-input bg-secondary px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div class="flex items-center gap-1">
                  <FolderGit2 class="h-3 w-3 shrink-0 text-muted-foreground" />
                  <input
                    v-model="repo.path"
                    type="text"
                    placeholder="/path/to/repo"
                    class="w-full rounded-md border border-input bg-secondary px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <button
                v-if="repos.length > 1"
                class="mt-1 rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-red-400"
                @click="removeRepo(i)"
              >
                <Trash2 class="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        <!-- Dev Server -->
        <div>
          <button
            class="flex w-full items-center gap-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
            type="button"
            @click="devServerOpen = !devServerOpen; if (devServerOpen) devServerEnabled = true"
          >
            <ChevronDown
              class="h-3 w-3 transition-transform"
              :class="devServerOpen ? '' : '-rotate-90'"
            />
            <Terminal class="h-3 w-3" />
            Dev Server
            <span v-if="devServerEnabled && devServerCommand" class="text-[10px] text-green-400">configured</span>
          </button>
          <div v-if="devServerOpen" class="mt-2 space-y-2 rounded-md border border-border p-3">
            <label class="flex items-center gap-2 text-xs text-foreground">
              <input
                v-model="devServerEnabled"
                type="checkbox"
                class="h-3 w-3 accent-primary"
              />
              Enable dev server
            </label>
            <template v-if="devServerEnabled">
              <div>
                <label class="mb-1 block text-[10px] text-muted-foreground">Command</label>
                <input
                  v-model="devServerCommand"
                  type="text"
                  placeholder="npm run dev"
                  class="w-full rounded-md border border-input bg-secondary px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div class="flex gap-2">
                <div class="flex-1">
                  <label class="mb-1 block text-[10px] text-muted-foreground">Base Port</label>
                  <input
                    v-model.number="devServerBasePort"
                    type="number"
                    min="1024"
                    max="65535"
                    class="w-full rounded-md border border-input bg-secondary px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div v-if="repos.length > 1" class="flex-1">
                  <label class="mb-1 block text-[10px] text-muted-foreground">Repo (optional)</label>
                  <select
                    v-model="devServerRepo"
                    class="w-full rounded-md border border-input bg-secondary px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">First repo</option>
                    <option v-for="r in repos.filter((r) => r.name)" :key="r.name" :value="r.name">{{ r.name }}</option>
                  </select>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Error -->
        <div v-if="error" class="text-xs text-red-400">{{ error }}</div>

        <!-- Actions -->
        <div class="flex items-center gap-2 pt-1">
          <button
            v-if="isEdit"
            class="rounded-md px-3 py-1.5 text-xs text-red-400 hover:bg-destructive/20"
            @click="handleDelete"
          >
            Delete
          </button>
          <div class="flex-1" />
          <button
            class="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            :disabled="saving"
            class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            @click="handleSave"
          >
            {{ isEdit ? 'Save' : 'Create' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
