import { useContext } from "react";
import { ThemeContext } from "@/lib/themeContext";

/**
 * Reads the app-wide theme. Requires `<ThemeProvider>` above it — which is
 * mounted once at the root in `App.tsx`, so every route has access.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return context;
}
