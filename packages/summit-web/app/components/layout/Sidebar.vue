<script setup lang="ts">
import { ChevronsDownUp, ChevronsUpDown } from "lucide-vue-next";
import type { Project } from "summit-types";

const props = defineProps<{
  projects: Project[];
  loaded: boolean;
  activeId: string | null;
  activeSessionId: string | null;
}>();
defineEmits<{
  select: [id: string];
  delete: [id: string];
  selectSession: [id: string];
  reorder: [ids: string[]];
  create: [{ name: string; icon: string; repos: Array<{ name: string; path: string }> }];
}>();

const { isExpanded, collapseAll, expandAll } = useProjectExpansion();

const allCollapsed = computed(() =>
  props.projects.length > 0 && props.projects.every((p) => !isExpanded(p.id)),
);

function toggleAll() {
  if (allCollapsed.value) {
    expandAll();
  } else {
    collapseAll(props.projects.map((p) => p.id));
  }
}
</script>

<template>
  <aside class="w-64 border-r border-border flex flex-col bg-sidebar">
    <div class="p-3 border-b border-border flex items-center gap-2">
      <img src="/logo.png" alt="Summit" class="w-6 h-6 rounded" />
      <span class="font-semibold text-sm flex-1">Summit</span>
      <button
        v-if="projects.length"
        class="p-1 rounded hover:bg-accent text-muted-foreground"
        :title="allCollapsed ? 'Expand all' : 'Collapse all'"
        @click="toggleAll"
      >
        <ChevronsUpDown v-if="allCollapsed" class="w-4 h-4" />
        <ChevronsDownUp v-else class="w-4 h-4" />
      </button>
    </div>

    <ProjectList
      :projects="projects"
      :loaded="loaded"
      :active-id="activeId"
      :active-session-id="activeSessionId"
      @select="$emit('select', $event)"
      @delete="$emit('delete', $event)"
      @select-session="$emit('selectSession', $event)"
      @reorder="$emit('reorder', $event)"
    />

    <div class="p-2 border-t border-border">
      <NewProjectDialog @created="$emit('create', $event)" />
    </div>
  </aside>
</template>
