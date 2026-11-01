import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    /* The default 5 s is too tight for the first render in a file: jsdom has to
       build the whole component tree, and the heaviest case (Index, with Framer
       Motion) takes ~4-5 s on a busy machine. When it tips over, the timed-out
       render resolves after cleanup and poisons every later test in the same
       file — one slow render turned into six failures. Give renders room. */
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
