<script setup lang="ts">
import type { ElicitationPayload } from "summit-types";

const props = defineProps<{
  elicitation: ElicitationPayload;
}>();

const emit = defineEmits<{
  respond: [action: "accept" | "decline", content?: Record<string, unknown>];
}>();

interface SchemaField {
  key: string;
  type: string;
  title: string;
  description?: string;
  enum?: string[];
  default?: unknown;
}

const fields = computed<SchemaField[]>(() => {
  const schema = props.elicitation.schema;
  if (!schema?.properties || typeof schema.properties !== "object") return [];

  return Object.entries(schema.properties as Record<string, any>).map(([key, prop]) => ({
    key,
    type: prop.type || "string",
    title: prop.title || key,
    description: prop.description,
    enum: prop.enum,
    default: prop.default,
  }));
});

const formData = ref<Record<string, unknown>>({});

// Initialize defaults
watchEffect(() => {
  const data: Record<string, unknown> = {};
  for (const field of fields.value) {
    if (field.default !== undefined) {
      data[field.key] = field.default;
    } else if (field.enum?.length) {
      data[field.key] = field.enum[0];
    } else if (field.type === "boolean") {
      data[field.key] = false;
    } else {
      data[field.key] = "";
    }
  }
  formData.value = data;
});

function handleAccept() {
  emit("respond", "accept", fields.value.length ? formData.value : undefined);
}

function handleDecline() {
  emit("respond", "decline");
}
</script>

<template>
  <div class="max-w-[80%] space-y-3 rounded-xl rounded-bl-sm border border-border bg-card px-4 py-4">
    <div class="flex items-center gap-2 text-xs text-muted-foreground">
      <span class="text-amber-400">&#9632;</span>
      <span>{{ elicitation.serverName }} needs input</span>
    </div>

    <p class="text-sm text-foreground">{{ elicitation.message }}</p>

    <div v-if="fields.length" class="space-y-3">
      <div v-for="field in fields" :key="field.key" class="space-y-1">
        <label class="block text-xs font-medium text-muted-foreground">
          {{ field.title }}
          <span v-if="field.description" class="font-normal"> — {{ field.description }}</span>
        </label>

        <!-- Enum: radio buttons -->
        <div v-if="field.enum" class="flex flex-wrap gap-2">
          <button
            v-for="option in field.enum"
            :key="option"
            class="rounded-md border px-3 py-1.5 text-sm transition-colors"
            :class="
              formData[field.key] === option
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-secondary text-foreground hover:bg-accent'
            "
            @click="formData[field.key] = option"
          >
            {{ option }}
          </button>
        </div>

        <!-- Boolean: toggle -->
        <button
          v-else-if="field.type === 'boolean'"
          class="rounded-md border px-3 py-1.5 text-sm transition-colors"
          :class="
            formData[field.key]
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-secondary text-foreground hover:bg-accent'
          "
          @click="formData[field.key] = !formData[field.key]"
        >
          {{ formData[field.key] ? "Yes" : "No" }}
        </button>

        <!-- String/number: text input -->
        <input
          v-else
          :type="field.type === 'number' || field.type === 'integer' ? 'number' : 'text'"
          :value="formData[field.key]"
          class="w-full rounded-md border border-input bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          @input="formData[field.key] = ($event.target as HTMLInputElement).value"
        />
      </div>
    </div>

    <div class="flex gap-2 pt-1">
      <button
        class="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        @click="handleAccept"
      >
        Accept
      </button>
      <button
        class="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        @click="handleDecline"
      >
        Decline
      </button>
    </div>
  </div>
</template>
