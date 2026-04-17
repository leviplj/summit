<script setup lang="ts">
import type { StoredSession, Project } from "summit-types";

defineProps<{ session: StoredSession; project: Project | null }>();
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0">
    <SessionHeader :session="session" :project="project" />
    <MessageList />
    <MessageInput :session="session" />
  </div>
</template>
