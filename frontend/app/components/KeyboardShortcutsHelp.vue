<script setup lang="ts">
import { X } from "lucide-vue-next";
import type { ShortcutDef } from "~/composables/useKeyboardShortcuts";
import { modLabel } from "~/composables/useKeyboardShortcuts";

defineProps<{ shortcuts: ShortcutDef[] }>();
const emit = defineEmits<{ close: [] }>();

function formatKey(s: ShortcutDef): string {
  const parts: string[] = [];
  if (s.modifiers.includes("mod")) parts.push(modLabel);
  if (s.modifiers.includes("shift")) parts.push("Shift");
  const keyLabel = s.key === "Escape" ? "Esc" : s.key === " " ? "Space" : s.key.toUpperCase();
  parts.push(keyLabel);
  return parts.join(" + ");
}

// Group shortcuts, showing all unique key combos per description
function groupedShortcuts(shortcuts: ShortcutDef[]) {
  const seen = new Set<string>();
  const unique: ShortcutDef[] = [];
  for (const s of shortcuts) {
    const id = `${s.description}:${formatKey(s)}`;
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(s);
    }
  }
  const groups: Record<string, ShortcutDef[]> = {};
  for (const s of unique) {
    if (!groups[s.category]) groups[s.category] = [];
    groups[s.category].push(s);
  }
  return groups;
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="emit('close')">
    <div class="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-foreground">Keyboard Shortcuts</h2>
        <button
          class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div v-for="(items, category) in groupedShortcuts(shortcuts)" :key="category" class="mb-4 last:mb-0">
        <h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{{ category }}</h3>
        <div v-for="s in items" :key="s.description" class="flex items-center justify-between py-1.5">
          <span class="text-sm text-foreground">{{ s.description }}</span>
          <kbd class="rounded border border-border bg-accent px-2 py-0.5 text-xs font-mono text-muted-foreground">
            {{ formatKey(s) }}
          </kbd>
        </div>
      </div>
    </div>
  </div>
</template>
