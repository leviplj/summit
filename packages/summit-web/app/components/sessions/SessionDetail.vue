<script setup lang="ts">
import type { ChatMessage, ProviderModel } from "summit-types";

defineProps<{
  title: string;
  projectName?: string;
  messages: ChatMessage[];
  pending?: boolean;
  models: ProviderModel[];
}>();

const model = defineModel<string>("model", { required: true });

defineEmits<{ send: [text: string] }>();
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0">
    <SessionHeader :title="title" :project-name="projectName" />
    <MessageList :messages="messages" :pending="pending" />
    <MessageInput v-model:model="model" :models="models" :disabled="pending" @send="$emit('send', $event)" />
  </div>
</template>
