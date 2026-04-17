<script setup lang="ts">
import type { Project } from "summit-types";

defineProps<{
  projects: Project[];
  loaded: boolean;
  activeId: string | null;
  activeSessionId: string | null;
}>();
defineEmits<{
  select: [id: string];
  delete: [id: string];
  selectSession: [id: string];
  create: [{ name: string; icon: string; repos: Array<{ name: string; path: string }> }];
}>();
</script>

<template>
  <aside class="w-64 border-r border-border flex flex-col bg-sidebar">
    <div class="p-3 border-b border-border flex items-center gap-2">
      <img src="/logo.png" alt="Summit" class="w-6 h-6 rounded" />
      <span class="font-semibold text-sm">Summit</span>
    </div>

    <ProjectList
      :projects="projects"
      :loaded="loaded"
      :active-id="activeId"
      :active-session-id="activeSessionId"
      @select="$emit('select', $event)"
      @delete="$emit('delete', $event)"
      @select-session="$emit('selectSession', $event)"
    />

    <div class="p-2 border-t border-border">
      <NewProjectDialog @created="$emit('create', $event)" />
    </div>
  </aside>
</template>
