<script setup lang="ts">
import type { Project } from "summit-types";

defineProps<{ projects: Project[]; loaded: boolean; activeId: string | null }>();
defineEmits<{ select: [id: string]; delete: [id: string] }>();
</script>

<template>
  <div class="flex-1 overflow-y-auto p-2">
    <p v-if="!loaded" class="text-xs text-muted-foreground p-2">Loading...</p>
    <div v-else-if="projects.length" class="space-y-1">
      <ProjectItem
        v-for="project in projects"
        :key="project.id"
        :project="project"
        :active="activeId === project.id"
        @select="$emit('select', $event)"
        @delete="$emit('delete', $event)"
      />
    </div>
    <p v-else class="text-xs text-muted-foreground p-2">No projects yet.</p>
  </div>
</template>
