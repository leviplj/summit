<script setup lang="ts">
import { ChevronRight, Plus, Trash2 } from "lucide-vue-next";
import type { Project } from "summit-types";
import { getProjectIcon } from "~/lib/projectIcons";

const props = defineProps<{ project: Project; active: boolean; activeSessionId: string | null }>();
const emit = defineEmits<{
  select: [id: string];
  delete: [id: string];
  selectSession: [id: string];
}>();

const expanded = ref(true);
const icon = computed(() => getProjectIcon(props.project.icon));

const { sessionsForProject, createSession, deleteSession } = useSessionStore();
const sessions = sessionsForProject(props.project.id);

async function handleNewSession() {
  const session = await createSession(props.project.id);
  expanded.value = true;
  emit("selectSession", session.id);
}

async function handleDeleteSession(id: string) {
  await deleteSession(id);
  if (props.activeSessionId === id) emit("selectSession", "");
}
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
      <Plus
        class="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity cursor-pointer"
        title="New session"
        @click="handleNewSession"
      />
      <Trash2
        class="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-destructive transition-opacity cursor-pointer"
        @click="$emit('delete', project.id)"
      />
    </div>

    <div v-if="expanded" class="ml-6 mt-0.5 space-y-0.5">
      <div
        v-for="session in sessions"
        :key="session.id"
        :class="[
          'group flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors',
          activeSessionId === session.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
        ]"
        @click="$emit('selectSession', session.id)"
      >
        <span class="flex-1 truncate">{{ session.title }}</span>
        <Trash2
          class="w-3 h-3 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-destructive transition-opacity"
          @click.stop="handleDeleteSession(session.id)"
        />
      </div>
      <p v-if="!sessions.length" class="px-2 py-1 text-xs text-muted-foreground italic">
        No sessions yet
      </p>
    </div>
  </div>
</template>
