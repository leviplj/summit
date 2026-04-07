<script setup lang="ts">
import { Trash2, Plus, FolderGit2 } from "lucide-vue-next";

const { projects, loaded, loadProjects, createProject, deleteProject } = useProjectStore();

const showDialog = ref(false);
const newName = ref("");
const newRepoName = ref("");
const newRepoPath = ref("");
const creating = ref(false);

onMounted(() => {
  loadProjects();
});

async function handleCreate() {
  if (!newName.value.trim() || !newRepoPath.value.trim()) return;
  creating.value = true;
  try {
    await createProject(newName.value.trim(), [
      { name: newRepoName.value.trim() || newName.value.trim(), path: newRepoPath.value.trim() },
    ]);
    showDialog.value = false;
    newName.value = "";
    newRepoName.value = "";
    newRepoPath.value = "";
  } finally {
    creating.value = false;
  }
}

async function handleDelete(id: string) {
  await deleteProject(id);
}
</script>

<template>
  <div class="max-w-2xl mx-auto p-8">
    <div class="flex items-center gap-3 mb-6">
      <img src="/logo.png" alt="Summit" class="w-8 h-8 rounded" />
      <h1 class="text-2xl font-bold flex-1">Projects</h1>
      <Dialog v-model:open="showDialog">
        <DialogTrigger as-child>
          <Button size="sm">
            <Plus class="w-4 h-4 mr-1" />
            New Project
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Create a new project with a git repository.</DialogDescription>
          </DialogHeader>
          <div class="grid gap-4 py-4">
            <div class="grid gap-2">
              <Label for="name">Project Name</Label>
              <Input id="name" v-model="newName" placeholder="my-project" />
            </div>
            <div class="grid gap-2">
              <Label for="repo-name">Repo Name</Label>
              <Input id="repo-name" v-model="newRepoName" placeholder="defaults to project name" />
            </div>
            <div class="grid gap-2">
              <Label for="repo-path">Repo Path</Label>
              <Input id="repo-path" v-model="newRepoPath" placeholder="/path/to/repo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="showDialog = false">Cancel</Button>
            <Button :disabled="!newName.trim() || !newRepoPath.trim() || creating" @click="handleCreate">
              {{ creating ? 'Creating...' : 'Create' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    <p v-if="!loaded" class="text-muted-foreground">Loading...</p>

    <div v-else-if="projects.length" class="grid gap-3">
      <Card v-for="project in projects" :key="project.id" class="p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <FolderGit2 class="w-5 h-5 text-muted-foreground" />
            <div>
              <p class="font-medium">{{ project.name }}</p>
              <p class="text-sm text-muted-foreground">
                {{ project.repos.map(r => r.name).join(', ') }}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" @click="handleDelete(project.id)">
            <Trash2 class="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </Card>
    </div>

    <p v-else class="text-muted-foreground">No projects yet. Create one to get started.</p>
  </div>
</template>
