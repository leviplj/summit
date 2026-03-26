<script setup lang="ts">
import { ChevronDown, Plus, Settings, FolderGit2 } from "lucide-vue-next";
import type { Project } from "~~/shared/types";

const props = defineProps<{
  projects: Project[];
  activeProject: Project | null;
  attentionProjectIds?: Set<string>;
}>();

const emit = defineEmits<{
  select: [id: string | null];
  create: [];
  edit: [project: Project];
}>();

const open = ref(false);

function select(id: string | null) {
  emit("select", id);
  open.value = false;
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest(".project-switcher")) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener("click", handleClickOutside));
onUnmounted(() => document.removeEventListener("click", handleClickOutside));
</script>

<template>
  <div class="project-switcher relative px-2 pb-2">
    <button
      class="flex w-full items-center gap-2 rounded-md border border-input bg-secondary px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
      @click.stop="open = !open"
    >
      <span class="relative">
        <FolderGit2 class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span
          v-if="attentionProjectIds?.size && (!activeProject || !attentionProjectIds.has(activeProject.id))"
          class="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-cyan-400"
        />
      </span>
      <span class="flex-1 truncate text-left">
        {{ activeProject?.name || 'All Sessions' }}
      </span>
      <ChevronDown class="h-3 w-3 shrink-0 text-muted-foreground transition-transform" :class="open ? 'rotate-180' : ''" />
    </button>

    <div
      v-if="open"
      class="absolute left-2 right-2 top-full z-50 mt-1 rounded-md border border-border bg-card shadow-lg"
    >
      <div class="max-h-48 overflow-y-auto py-1">
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
          :class="!activeProject ? 'bg-accent/50 text-foreground' : 'text-muted-foreground'"
          @click.stop="select(null)"
        >
          <span class="flex-1">All Sessions</span>
        </button>
        <button
          v-for="p in projects"
          :key="p.id"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
          :class="p.id === activeProject?.id ? 'bg-accent/50 text-foreground' : 'text-muted-foreground'"
          @click.stop="select(p.id)"
        >
          <span class="relative">
            <FolderGit2 class="h-3 w-3 shrink-0" />
            <span
              v-if="attentionProjectIds?.has(p.id)"
              class="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-cyan-400"
            />
          </span>
          <span class="flex-1 truncate">{{ p.name }}</span>
          <span class="shrink-0 text-[10px] text-muted-foreground">{{ p.repos.length }} repo{{ p.repos.length !== 1 ? 's' : '' }}</span>
          <button
            class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Edit project"
            @click.stop="emit('edit', p); open = false"
          >
            <Settings class="h-3 w-3" />
          </button>
        </button>
      </div>
      <div class="border-t border-border">
        <button
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          @click.stop="emit('create'); open = false"
        >
          <Plus class="h-3 w-3" />
          <span>New project…</span>
        </button>
      </div>
    </div>
  </div>
</template>
