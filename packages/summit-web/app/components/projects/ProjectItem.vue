<script setup lang="ts">
import { ChevronRight, Trash2 } from "lucide-vue-next";
import type { Project } from "summit-types";
import { getProjectIcon } from "~/lib/projectIcons";

const props = defineProps<{ project: Project; active: boolean }>();
defineEmits<{ select: [id: string]; delete: [id: string] }>();

const expanded = ref(false);
const icon = computed(() => getProjectIcon(props.project.icon));
</script>

<template>
  <div>
    <div
      :class="[
        'group flex items-center gap-1 pr-2 py-1.5 rounded text-sm transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
      ]"
    >
      <button
        class="p-0.5 rounded hover:bg-accent"
        :aria-label="expanded ? 'Collapse' : 'Expand'"
        @click="expanded = !expanded"
      >
        <ChevronRight
          :class="['w-3.5 h-3.5 text-muted-foreground transition-transform', expanded && 'rotate-90']"
        />
      </button>
      <button class="flex-1 flex items-center gap-2 text-left min-w-0" @click="$emit('select', project.id)">
        <component :is="icon" class="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        <span class="flex-1 truncate">{{ project.name }}</span>
      </button>
      <Trash2
        class="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-destructive transition-opacity cursor-pointer"
        @click="$emit('delete', project.id)"
      />
    </div>

    <div v-if="expanded" class="ml-6 mt-0.5 space-y-0.5">
      <div
        v-for="repo in project.repos"
        :key="repo.name"
        class="px-2 py-1 text-xs text-muted-foreground truncate"
        :title="repo.path"
      >
        {{ repo.name }}
      </div>
      <p v-if="!project.repos.length" class="px-2 py-1 text-xs text-muted-foreground italic">
        No repos
      </p>
    </div>
  </div>
</template>
