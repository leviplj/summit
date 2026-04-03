<script setup lang="ts">
import { X, Plus, Trash2, FolderGit2 } from "lucide-vue-next";
import type { Project } from "summit-types";

const props = defineProps<{
  project?: Project | null;
}>();

const emit = defineEmits<{
  close: [];
  save: [project: { name: string; repos: Array<{ name: string; path: string }> }];
  delete: [id: string];
}>();

const name = ref(props.project?.name || "");
const repos = ref<Array<{ name: string; path: string }>>(
  props.project?.repos?.map((r) => ({ ...r })) || [{ name: "", path: "" }],
);
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
    emit("save", {
      name: name.value.trim(),
      repos: validRepos.map((r) => ({ name: r.name.trim(), path: r.path.trim() })),
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
