import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  /* The icon shows the theme you would switch TO, so the accessible name has
     to describe the action, not the current state — and `aria-pressed` carries
     the current state for screen readers. */
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      /* 44×44 minimum touch target (TESTING_GUIDE.md). The icon itself stays
         h-4 w-4 and the ghost variant has no resting background, so the extra
         hit area is invisible until hover. */
      className="h-11 w-11 shrink-0"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
