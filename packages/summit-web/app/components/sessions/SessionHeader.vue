<script setup lang="ts">
import type { StoredSession, Project } from "summit-types";

defineProps<{ session: StoredSession; project: Project | null }>();
</script>

<template>
  <header class="border-b border-border px-6 py-3 flex items-center gap-4">
    <div class="flex-1 min-w-0">
      <h1 class="text-base font-semibold truncate">{{ session.title }}</h1>
      <p v-if="project" class="text-xs text-muted-foreground">{{ project.name }}</p>
    </div>
  </header>
</template>
