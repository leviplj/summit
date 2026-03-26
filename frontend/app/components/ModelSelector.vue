<script setup lang="ts">
import { ChevronDown } from "lucide-vue-next";
import { LATEST_MODELS, LEGACY_MODELS, type ModelOption } from "~/constants/models";

const props = defineProps<{
  modelValue: string | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | null];
}>();

const open = ref(false);
const showLegacy = ref(false);
const dropdownRef = ref<HTMLElement>();

const currentLabel = computed(() => {
  if (!props.modelValue) return "Default";
  const all = [...LATEST_MODELS, ...LEGACY_MODELS];
  return all.find((m) => m.id === props.modelValue)?.label ?? props.modelValue;
});

function select(model: ModelOption | null) {
  emit("update:modelValue", model?.id ?? null);
  open.value = false;
  showLegacy.value = false;
}

function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    open.value = false;
    showLegacy.value = false;
  }
}

onMounted(() => document.addEventListener("click", handleClickOutside));
onUnmounted(() => document.removeEventListener("click", handleClickOutside));
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <button
      :disabled="disabled"
      class="flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      @click="open = !open"
    >
      {{ currentLabel }}
      <ChevronDown class="h-3 w-3" />
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-border bg-card p-1 shadow-lg"
    >
      <button
        class="flex w-full items-center rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-accent"
        :class="!modelValue ? 'text-foreground font-medium' : 'text-muted-foreground'"
        @click="select(null)"
      >
        Default
      </button>

      <div class="my-1 h-px bg-border" />

      <button
        v-for="m in LATEST_MODELS"
        :key="m.id"
        class="flex w-full items-center rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-accent"
        :class="modelValue === m.id ? 'text-foreground font-medium' : 'text-muted-foreground'"
        @click="select(m)"
      >
        {{ m.label }}
      </button>

      <div class="my-1 h-px bg-border" />

      <button
        v-if="!showLegacy"
        class="flex w-full items-center rounded-sm px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
        @click.stop="showLegacy = true"
      >
        Legacy models...
      </button>

      <template v-if="showLegacy">
        <button
          v-for="m in LEGACY_MODELS"
          :key="m.id"
          class="flex w-full items-center rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-accent"
          :class="modelValue === m.id ? 'text-foreground font-medium' : 'text-muted-foreground'"
          @click="select(m)"
        >
          {{ m.label }}
        </button>
      </template>
    </div>
  </div>
</template>
