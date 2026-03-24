export type Theme = "light" | "dark" | "system";

export function useTheme() {
  const colorMode = useColorMode();

  const theme = computed<Theme>(() => {
    const pref = colorMode.preference;
    if (pref === "light" || pref === "dark") return pref;
    return "system";
  });

  function setTheme(t: Theme) {
    colorMode.preference = t === "system" ? "system" : t;
  }

  function cycleTheme() {
    const order: Theme[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme.value) + 1) % order.length];
    setTheme(next);
  }

  return { theme, setTheme, cycleTheme };
}
