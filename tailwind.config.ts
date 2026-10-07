import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ["Fredoka", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["Roboto Mono", "monospace"],
      },
      colors: {
        // Brand palette (from design package)
        brand: {
          purple: {
            50:  "#faf5ff",
            100: "#f3e8ff",
            200: "#e9d5ff",
            300: "#d8b4fe",
            400: "#c084fc",
            500: "#a855f7",
            600: "hsl(var(--primary))",
            700: "#7e22ce",
            800: "#6b21a8",
            900: "#581c87",
            DEFAULT: "hsl(var(--primary))",
          },
          orange: {
            50:  "#fff7ed",
            100: "#ffedd5",
            200: "#fed7aa",
            300: "#fdba74",
            400: "#fb923c",
            500: "#f97316",
            600: "#ea580c",
            700: "#c2410c",
            800: "#9a3412",
            900: "#7c2d12",
            DEFAULT: "hsl(var(--secondary))",
          },
        },
        // World-specific palettes
        explorer: {
          parchment: "hsl(var(--parchment))",
          gold:      "hsl(var(--gold))",
          "gold-ink":"hsl(var(--gold-ink))",
          ocean:     "hsl(var(--ocean))",
          forest:    "hsl(var(--success))",
          light:     "hsl(var(--parchment-light))",
          dark:      "hsl(var(--ink))",
        },
        alchemist: {
          purple: "#6B21A8",
          green:  "#059669",
          gold:   "#D97706",
          blue:   "#0EA5E9",
        },
        gardener: {
          brown:   "#92400E",
          green:   "#16A34A",
          blossom: "#F472B6",
          sky:     "#38BDF8",
        },
        observatory: {
          blue:   "#1E3A8A",
          gold:   "#FCD34D",
          purple: "#7C3AED",
          pink:   "#EC4899",
        },
        // Semantic status
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        stage: {
          preparation:  "hsl(var(--stage-preparation))",
          incubation:   "hsl(var(--stage-incubation))",
          illumination:"hsl(var(--stage-illumination))",
          verification: "hsl(var(--stage-verification))",
          evaluation:   "hsl(var(--stage-evaluation))",
          elaboration:  "hsl(var(--stage-elaboration))",
        },
        // Flat stage-chip foregrounds (keep the `stage` group above flat too).
        // Only the four stages rendered as chips in the UI have a pairing.
        "stage-fg-preparation":  "hsl(var(--stage-preparation-foreground))",
        "stage-fg-incubation":   "hsl(var(--stage-incubation-foreground))",
        "stage-fg-illumination": "hsl(var(--stage-illumination-foreground))",
        "stage-fg-verification": "hsl(var(--stage-verification-foreground))",
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT:              "hsl(var(--sidebar-background))",
          foreground:           "hsl(var(--sidebar-foreground))",
          primary:              "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent:               "hsl(var(--sidebar-accent))",
          "accent-foreground":  "hsl(var(--sidebar-accent-foreground))",
          border:               "hsl(var(--sidebar-border))",
          ring:                 "hsl(var(--sidebar-ring))",
        },
      },
      boxShadow: {
        "glow-purple": "var(--shadow-glow-violet)",
        "glow-orange": "0 0 20px rgba(249, 115, 22, 0.4), 0 0 40px rgba(249, 115, 22, 0.2)",
        "glow-green":  "0 0 20px rgba(16, 185, 129, 0.4), 0 0 40px rgba(16, 185, 129, 0.2)",
        "glow-blue":   "0 0 20px rgba(14, 165, 233, 0.4), 0 0 40px rgba(14, 165, 233, 0.2)",
        "glow-gold":   "var(--shadow-glow-gold)",
        "card":        "var(--shadow-sm)",
        "card-hover":  "var(--shadow-md)",
        "inner-glow":  "inset 0 0 20px rgba(147, 51, 234, 0.15)",
      },
      borderRadius: {
        "4xl": "2rem",
        lg:    "var(--radius)",
        md:    "calc(var(--radius) - 2px)",
        sm:    "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-10px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 5px rgba(147,51,234,0.3)" },
          "50%":      { boxShadow: "0 0 20px rgba(147,51,234,0.8), 0 0 40px rgba(147,51,234,0.4)" },
        },
        "rotate-slow": {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.85)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        sparkle: {
          "0%":   { transform: "scale(0) rotate(0deg)",   opacity: "1" },
          "50%":  { transform: "scale(1) rotate(180deg)", opacity: "0.8" },
          "100%": { transform: "scale(0) rotate(360deg)", opacity: "0" },
        },
        "phase-complete": {
          "0%":   { transform: "scale(1)",    boxShadow: "0 0 0 rgba(16,185,129,0)" },
          "50%":  { transform: "scale(1.15)", boxShadow: "0 0 20px rgba(16,185,129,0.6)" },
          "100%": { transform: "scale(1)",    boxShadow: "0 0 0 rgba(16,185,129,0)" },
        },
        "map-reveal": {
          from: { opacity: "0", transform: "scale(0.9) rotate(-2deg)" },
          to:   { opacity: "1", transform: "scale(1) rotate(0deg)" },
        },
      },
      animation: {
        "accordion-down":  "accordion-down 0.2s ease-out",
        "accordion-up":    "accordion-up 0.2s ease-out",
        "float":           "float 3s ease-in-out infinite",
        "pulse-glow":      "pulse-glow 2s ease-in-out infinite",
        "rotate-slow":     "rotate-slow 8s linear infinite",
        "shimmer":         "shimmer 2.5s linear infinite",
        "fade-in":         "fade-in 0.3s ease-out",
        "slide-up":        "slide-up 0.4s ease-out",
        "scale-in":        "scale-in 0.3s ease-out",
        "sparkle":         "sparkle 0.8s ease-out forwards",
        "phase-complete":  "phase-complete 0.6s ease-in-out",
        "map-reveal":      "map-reveal 0.5s ease-out",
      },
      spacing: {
        "128": "32rem",
        "144": "36rem",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
