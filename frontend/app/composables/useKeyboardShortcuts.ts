export interface ShortcutDef {
  key: string;
  modifiers: ("mod" | "shift")[];
  description: string;
  category: string;
  requiresNoFocus: boolean;
  action: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export const modLabel = isMac ? "Cmd" : "Ctrl";

function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(opts: {
  sidebarOpen: Ref<boolean>;
  changesOpen: Ref<boolean>;
  refreshChanges: () => void;
  newSession: () => void;
  selectPrevSession: () => void;
  selectNextSession: () => void;
  focusInput: () => void;
}) {
  const helpOpen = ref(false);

  const shortcuts: ShortcutDef[] = [
    {
      key: "n", modifiers: ["mod"], description: "New session",
      category: "Sessions", requiresNoFocus: false,
      action: () => opts.newSession(),
    },
    {
      key: "[", modifiers: ["mod"], description: "Previous session",
      category: "Sessions", requiresNoFocus: false,
      action: () => opts.selectPrevSession(),
    },
    {
      key: "]", modifiers: ["mod"], description: "Next session",
      category: "Sessions", requiresNoFocus: false,
      action: () => opts.selectNextSession(),
    },
    {
      key: "b", modifiers: ["mod"], description: "Toggle sidebar",
      category: "Panels", requiresNoFocus: false,
      action: () => { opts.sidebarOpen.value = !opts.sidebarOpen.value; },
    },
    {
      key: "E", modifiers: ["mod", "shift"], description: "Toggle changed files",
      category: "Panels", requiresNoFocus: false,
      action: () => {
        opts.changesOpen.value = !opts.changesOpen.value;
        if (opts.changesOpen.value) opts.refreshChanges();
      },
    },
    {
      key: "/", modifiers: [], description: "Focus chat input",
      category: "General", requiresNoFocus: true,
      action: () => opts.focusInput(),
    },
    {
      key: "Escape", modifiers: [], description: "Close panel",
      category: "General", requiresNoFocus: false,
      action: () => {
        if (helpOpen.value) { helpOpen.value = false; return; }
        if (opts.changesOpen.value) { opts.changesOpen.value = false; return; }
        if (opts.sidebarOpen.value) { opts.sidebarOpen.value = false; }
      },
    },
    {
      key: "/", modifiers: ["mod"], description: "Keyboard shortcuts",
      category: "General", requiresNoFocus: false,
      action: () => { helpOpen.value = !helpOpen.value; },
    },
  ];

  function onKeydown(e: KeyboardEvent) {
    for (const s of shortcuts) {
      if (e.key !== s.key) continue;

      const needsMod = s.modifiers.includes("mod");
      const needsShift = s.modifiers.includes("shift");
      const hasMod = isMac ? e.metaKey : e.ctrlKey;
      const hasShift = e.shiftKey;

      if (needsMod !== hasMod) continue;
      if (needsShift !== hasShift) continue;
      if (!needsMod && (e.metaKey || e.ctrlKey || e.altKey)) continue;

      if (s.requiresNoFocus && isTextInput(document.activeElement)) continue;

      e.preventDefault();
      s.action();
      return;
    }
  }

  onMounted(() => document.addEventListener("keydown", onKeydown));
  onUnmounted(() => document.removeEventListener("keydown", onKeydown));

  return { helpOpen, shortcuts };
}
