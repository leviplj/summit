<script setup lang="ts">
const props = defineProps<{ text: string; query: string }>();

const segments = computed(() => {
  const q = props.query.toLowerCase().trim();
  if (!q) return [{ text: props.text, match: false }];

  const result: { text: string; match: boolean }[] = [];
  const lower = props.text.toLowerCase();
  let pos = 0;

  while (pos < props.text.length) {
    const idx = lower.indexOf(q, pos);
    if (idx === -1) {
      result.push({ text: props.text.slice(pos), match: false });
      break;
    }
    if (idx > pos) {
      result.push({ text: props.text.slice(pos, idx), match: false });
    }
    result.push({ text: props.text.slice(idx, idx + q.length), match: true });
    pos = idx + q.length;
  }

  return result;
});
</script>

<template>
  <template v-for="(seg, i) in segments" :key="i">
    <mark v-if="seg.match" class="bg-yellow-400/30 text-foreground rounded-sm">{{ seg.text }}</mark>
    <span v-else>{{ seg.text }}</span>
  </template>
</template>
