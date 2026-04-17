<script setup lang="ts">
defineProps<{ title: string; projectName?: string }>();
</script>

<template>
  <header class="border-b border-border px-6 py-3 flex items-center gap-4">
    <div class="flex-1 min-w-0">
      <h1 class="text-base font-semibold truncate">{{ title }}</h1>
      <p v-if="projectName" class="text-xs text-muted-foreground">{{ projectName }}</p>
    </div>
  </header>
</template>
