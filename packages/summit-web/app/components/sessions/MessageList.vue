<script setup lang="ts">
import { MessageSquare } from "lucide-vue-next";
</script>

<template>
  <div class="flex-1 overflow-y-auto flex items-center justify-center text-muted-foreground">
    <div class="text-center">
      <MessageSquare class="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p class="text-sm">No messages yet</p>
      <p class="text-xs mt-1 opacity-60">Send a message to start the conversation</p>
    </div>
  </div>
</template>
