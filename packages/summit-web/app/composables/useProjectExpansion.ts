export function useProjectExpansion() {
  const collapsedIds = useState<Record<string, true>>(
    "projects:collapsed",
    () => ({}),
  );

  function isExpanded(id: string): boolean {
    return !collapsedIds.value[id];
  }

  function toggle(id: string) {
    const next = { ...collapsedIds.value };
    if (next[id]) delete next[id];
    else next[id] = true;
    collapsedIds.value = next;
  }

  function collapseAll(ids: string[]) {
    const next: Record<string, true> = {};
    for (const id of ids) next[id] = true;
    collapsedIds.value = next;
  }

  function expandAll() {
    collapsedIds.value = {};
  }

  return { isExpanded, toggle, collapseAll, expandAll };
}
