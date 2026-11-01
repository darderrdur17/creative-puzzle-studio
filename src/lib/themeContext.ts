import { createContext } from "react";

export type Theme = "light" | "dark";

export interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

/** Storage key — also read by the inline pre-paint script in index.html. */
export const THEME_STORAGE_KEY = "puzzle-theme";

/**
 * Kept in a plain module (not a component file) so React Fast Refresh stays
 * happy: component files may only export components.
 */
export const ThemeContext = createContext<ThemeContextValue | null>(null);
