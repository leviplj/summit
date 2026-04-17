<script setup lang="ts">
import { VueDraggable } from "vue-draggable-plus";
import type { Project } from "summit-types";

const props = defineProps<{
  projects: Project[];
  loaded: boolean;
  activeId: string | null;
  activeSessionId: string | null;
}>();
const emit = defineEmits<{
  select: [id: string];
  delete: [id: string];
  selectSession: [id: string];
  reorder: [ids: string[]];
}>();

const items = ref<Project[]>([...props.projects]);

watch(
  () => props.projects,
  (value) => {
    items.value = [...value];
  },
);

function onEnd() {
  emit("reorder", items.value.map((p) => p.id));
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-2">
    <p v-if="!loaded" class="text-xs text-muted-foreground p-2">Loading...</p>
    <VueDraggable
      v-else-if="projects.length"
      v-model="items"
      :animation="150"
      handle=".drag-handle"
      ghost-class="project-drop-ghost"
      chosen-class="project-drop-chosen"
      drag-class="project-drop-drag"
      class="space-y-1"
      @end="onEnd"
    >
      <ProjectItem
        v-for="project in items"
        :key="project.id"
        :project="project"
        :active="activeId === project.id"
        :active-session-id="activeSessionId"
        @select="emit('select', $event)"
        @delete="emit('delete', $event)"
        @select-session="emit('selectSession', $event)"
      />
    </VueDraggable>
    <p v-else class="text-xs text-muted-foreground p-2">No projects yet.</p>
  </div>
</template>

<style scoped>
:deep(.project-drop-ghost) {
  background-color: color-mix(in oklab, var(--primary) 15%, transparent);
  border-radius: var(--radius-md);
  opacity: 1;
}
:deep(.project-drop-chosen) {
  opacity: 0.9;
}
:deep(.project-drop-drag) {
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.2), 0 4px 6px -4px rgb(0 0 0 / 0.2);
}
</style>
