<script setup lang="ts">
import { Send } from "lucide-vue-next";
import { LATEST_MODELS } from "~/constants/models";
import { Select, SelectContent, SelectItem, SelectTrigger } from "~/components/ui/select";

const model = defineModel<string>("model", { required: true });

const emit = defineEmits<{ send: [text: string] }>();

const text = ref("");

const modelLabel = computed(
  () => LATEST_MODELS.find((m) => m.id === model.value)?.label ?? "Model",
);

const canSend = computed(() => text.value.trim().length > 0);

function handleSend() {
  if (!canSend.value) return;
  emit("send", text.value.trim());
  text.value = "";
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
}
</script>

<template>
  <footer class="border-t border-border p-4">
    <div class="max-w-3xl mx-auto">
      <div class="rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
        <textarea
          v-model="text"
          rows="2"
          placeholder="Ask anything..."
          class="w-full resize-none bg-transparent px-3 py-2 text-sm focus:outline-none"
          @keydown="onKeydown"
        />
        <div class="flex items-center gap-2 px-2 py-1.5 border-t border-border">
          <Select v-model="model">
            <SelectTrigger
              class="h-7 w-auto px-2 gap-1 text-xs border-0 shadow-none bg-transparent hover:bg-accent focus:ring-0"
            >
              <span>{{ modelLabel }}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="m in LATEST_MODELS" :key="m.id" :value="m.id">
                {{ m.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <div class="flex-1" />

          <Button :disabled="!canSend" size="icon" class="h-7 w-7" @click="handleSend">
            <Send class="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  </footer>
</template>
