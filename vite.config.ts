/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split large third-party libraries into their own chunks. Without this the
        // app ships as one ~800 kB bundle, which trips Rollup's 500 kB chunk warning
        // and forces the whole vendor tree to be re-downloaded on every app change.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react/jsx-runtime", "react-router-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-supabase": ["@supabase/supabase-js"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "framer-motion"],
  },
  test: {
    // The scoring/grid tests are pure, but component tests need a DOM. Running
    // everything under jsdom keeps one environment for the whole suite, and
    // `setup.ts` (which polyfills matchMedia) is dead code without this wiring.
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    restoreMocks: true,
  },
});
