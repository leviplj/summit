<script setup lang="ts">
import { Send } from "lucide-vue-next";
import type { StoredSession } from "summit-types";
import { LATEST_MODELS, DEFAULT_MODEL_ID } from "~/constants/models";
import { Select, SelectContent, SelectItem, SelectTrigger } from "~/components/ui/select";

const props = defineProps<{ session: StoredSession }>();

const { updateSession } = useSessionStore();

const text = ref("");

const model = computed({
  get: () => props.session.model ?? DEFAULT_MODEL_ID,
  set: (value: string) => {
    updateSession(props.session.id, { model: value });
  },
});

const modelLabel = computed(
  () => LATEST_MODELS.find((m) => m.id === model.value)?.label ?? "Model",
);
</script>

<template>
  <footer class="border-t border-border p-4">
    <div class="max-w-3xl mx-auto">
      <div class="rounded-lg border border-input bg-background">
        <textarea
          v-model="text"
          disabled
          rows="2"
          placeholder="Ask anything..."
          class="w-full resize-none bg-transparent px-3 py-2 text-sm disabled:opacity-60 focus:outline-none"
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

          <Button disabled size="icon" class="h-7 w-7">
            <Send class="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  </footer>
</template>
