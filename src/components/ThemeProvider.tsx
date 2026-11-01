import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext, THEME_STORAGE_KEY, type Theme } from "@/lib/themeContext";

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* Storage can be blocked (private mode / hardened settings) — fall back. */
  }
  return "light";
}

/**
 * Single owner of the theme.
 *
 * Previously each `ThemeToggle` ran its own `useTheme` hook, which meant the
 * `.dark` class was only ever applied on the routes that happened to render a
 * toggle. Deep-linking to the lobby, results, leaderboard, login or the lab
 * therefore lost the user's dark preference entirely. Mounting one provider at
 * the root fixes that for every route at once.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* Non-fatal: the theme still applies for this page view. */
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggle = useCallback(
    () => setThemeState((current) => (current === "light" ? "dark" : "light")),
    [],
  );

  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
