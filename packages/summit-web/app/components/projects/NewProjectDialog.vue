<script setup lang="ts">
import { Plus } from "lucide-vue-next";

const emit = defineEmits<{
  created: [{ name: string; icon: string; repos: Array<{ name: string; path: string }> }];
}>();

const open = ref(false);
const name = ref("");
const icon = ref("folder");
const repoName = ref("");
const repoPath = ref("");
const creating = ref(false);

function reset() {
  name.value = "";
  icon.value = "folder";
  repoName.value = "";
  repoPath.value = "";
}

async function handleCreate() {
  if (!name.value.trim() || !repoPath.value.trim()) return;
  creating.value = true;
  try {
    emit("created", {
      name: name.value.trim(),
      icon: icon.value,
      repos: [{ name: repoName.value.trim() || name.value.trim(), path: repoPath.value.trim() }],
    });
    open.value = false;
    reset();
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="ghost" size="sm" class="w-full justify-start">
        <Plus class="w-4 h-4 mr-1" />
        Add project
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
          <Input id="name" v-model="name" placeholder="my-project" />
        </div>
        <div class="grid gap-2">
          <Label>Icon</Label>
          <IconPicker v-model="icon" />
        </div>
        <div class="grid gap-2">
          <Label for="repo-name">Repo Name</Label>
          <Input id="repo-name" v-model="repoName" placeholder="defaults to project name" />
        </div>
        <div class="grid gap-2">
          <Label for="repo-path">Repo Path</Label>
          <Input id="repo-path" v-model="repoPath" placeholder="/path/to/repo" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="open = false">Cancel</Button>
        <Button :disabled="!name.trim() || !repoPath.trim() || creating" @click="handleCreate">
          {{ creating ? 'Creating...' : 'Create' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
