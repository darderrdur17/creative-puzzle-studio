import { Puzzle } from "lucide-react";

interface AppLogoProps {
  /** Size of the logo container (icon scales with it). */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-12 w-12 rounded-xl",
  md: "h-16 w-16 rounded-2xl",
  lg: "h-20 w-20 rounded-3xl",
};

const iconSizes = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

/**
 * App logo: violet→teal token gradient squircle with white outline puzzle piece (slightly rotated).
 * Matches the Creative Puzzle Studio branding.
 */
export function AppLogo({ size = "lg", className = "" }: AppLogoProps) {
  return (
    <div
      className={`animate-gradient-pan relative flex items-center justify-center shadow-lg shadow-primary/25 ${sizeClasses[size]} ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(160deg, hsl(var(--primary)), hsl(var(--accent)) 50%, hsl(var(--primary)))",
        backgroundSize: "220% 220%",
      }}
      aria-hidden
    >
      {/* Inner gloss — keeps the squircle from reading flat */}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/25 to-transparent" />
      <Puzzle
        className={`${iconSizes[size]} relative shrink-0 text-white drop-shadow-sm`}
        strokeWidth={2.25}
        style={{ transform: "rotate(8deg)" }}
      />
    </div>
  );
}
