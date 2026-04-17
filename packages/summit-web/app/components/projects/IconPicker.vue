<script setup lang="ts">
import { projectIcons, projectIconNames } from "~/lib/projectIcons";

const model = defineModel<string>({ required: true });
</script>

<template>
  <div class="grid grid-cols-6 gap-2">
    <button
      v-for="name in projectIconNames"
      :key="name"
      type="button"
      :class="[
        'flex items-center justify-center h-9 rounded border transition-colors',
        model === name
          ? 'border-primary bg-accent text-accent-foreground'
          : 'border-border hover:bg-accent/50',
      ]"
      @click="model = name"
    >
      <component :is="projectIcons[name]" class="w-4 h-4" />
    </button>
  </div>
</template>
