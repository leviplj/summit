<script setup lang="ts">
defineProps<{ title: string; projectName?: string }>();

const model = defineModel<string>("model", { required: true });

defineEmits<{ send: [text: string] }>();
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0">
    <SessionHeader :title="title" :project-name="projectName" />
    <MessageList />
    <MessageInput v-model:model="model" @send="$emit('send', $event)" />
  </div>
</template>
