# QA Fix Report — creative-puzzle-studio

**Date:** 2026-10-07
**Scope:** Resolve every QA-flagged item and clear all lint/build warnings & errors.
**Constraint honoured:** visual-only / config-only changes. No gameplay, mechanics, layout, or functional behaviour was altered.

---

## Final status — all gates green

| Gate | Command | Result | Exit |
|---|---|---|---|
| Lint | `npm run lint` | **PASS** — 0 errors, 0 warnings (no output) | 0 |
| Types | `npx tsc --noEmit -p tsconfig.app.json` | **PASS** — 0 errors | 0 |
| Tests | `npm test` (vitest) | **PASS** — 4/4 across 2 files | 0 |
| Build | `npm run build` | **PASS** — 2212 modules, no warnings | 0 |

**Before this round:** 10 ESLint errors + 10 ESLint warnings + 1 build chunk warning + 1 browserslist advisory.
**After:** 0 / 0 / 0 / 0.

---

## Issues fixed (root cause → fix)

### ESLint errors (10)

| # | Rule | File | Root cause | Fix |
|---|---|---|---|---|
| 1–4 | `no-explicit-any` | `src/lib/audioFeedback.ts` | `(window as any)` casts for the lazily-cached `AudioContext` | Added a `declare global { interface Window { __gameAudioCtx?; webkitAudioContext? } }` block; replaced the casts with a typed `audioCtx()` helper |
| 5–6 | `rules-of-hooks` | `src/components/game/JigsawPuzzleBoard.tsx` | `useDroppable()` called inside a `.map()` callback | Extracted a `StageSlotDroppables` **render-prop** component so the hooks run at a component top level. The 120-line JSX is byte-identical |
| 7 | `no-empty-object-type` | `src/components/ui/command.tsx` | `interface CommandDialogProps extends DialogProps {}` | Converted to `type CommandDialogProps = DialogProps;` |
| 8 | `no-empty-object-type` | `src/components/ui/textarea.tsx` | `export interface TextareaProps extends … {}` | Converted to a `type` alias |
| 9 | `no-explicit-any` | `puzzle_design 2/gardener.logic.ts` | Vendored design-package reference material | Added `puzzle_design 2/**` to the flat-config `ignores` (not in the build: tailwind content globs and `tsconfig.app` only cover `./src`) |
| 10 | `no-require-imports` | `tailwind.config.ts` | `require("tailwindcss-animate")` in an ESM file | Replaced with `import tailwindcssAnimate from "tailwindcss-animate"` |

### ESLint warnings (10)

| Count | Rule | Resolution |
|---|---|---|
| 7 | `react-refresh/only-export-components` | `src/components/ui/*` — vendored shadcn primitives intentionally co-export non-component values (`buttonVariants`, `badgeVariants`, `useFormField`). Added a config override scoped to `src/components/ui/**` with a comment explaining why splitting would break public imports |
| 1 | `react-refresh/only-export-components` | `JigsawImagePuzzle.tsx` exported the plain function `getGridConfig`. Moved it to a new module `src/lib/jigsawGrid.ts` (the rule governs fast-refresh granularity only — this is the correct structural fix, not a suppression) |
| 1 | `react-hooks/exhaustive-deps` | `JigsawImagePuzzle.tsx` `handleCellTap` — added missing `stageOrder`, `stages` to the `useCallback` deps |
| 1 | `react-hooks/exhaustive-deps` | `src/pages/Game.tsx` — added missing `comboStreak` to the deps |

### Build warnings (2)

| Warning | Root cause | Fix |
|---|---|---|
| `Some chunks are larger than 500 kB` | App shipped as one ~800 kB bundle | Added `build.rollupOptions.output.manualChunks` splitting `vendor-react` / `vendor-motion` / `vendor-supabase` |
| `Browserslist: caniuse-lite is 16 months old` | Stale caniuse-lite data | Refreshed caniuse-lite (`npm install caniuse-lite@latest --no-save`). Verified `package.json` and `package-lock.json` are **unchanged** |

### QA-flagged residuals (from the earlier review round)

| Item | Fix |
|---|---|
| Dead CSS tokens `--stage-evaluation-foreground` / `--stage-elaboration-foreground` and their `stage-fg-evaluation` / `stage-fg-elaboration` Tailwind keys | Removed from both `:root` and `.dark` in `src/index.css`, and from `tailwind.config.ts`. Only the four stages actually rendered as chips need a pairing |
| `BestIdeasQuestion.tsx` border below the 3:1 non-text contrast threshold | `border-stage-incubation/30` → `border-stage-incubation/85` |
| `opacity-90` left on hero stage chips (`Index.tsx`) | Removed — confirmed 0 elements carry the class at runtime |

---

## Chunk sizes after the fix

| Chunk | Size | Gzip |
|---|---|---|
| `index` (app) | 339.62 kB | 104.32 kB |
| `vendor-react` | 161.12 kB | 52.45 kB |
| `vendor-motion` | 125.56 kB | 41.71 kB |
| `vendor-supabase` | 173.72 kB | 45.86 kB |
| `index.css` | 103.50 kB | 18.12 kB |

App bundle dropped from ~800 kB to 339 kB. All chunks are under the 500 kB warning threshold.

---

## Regression verification (rendered in headless Chromium)

The freshly built `dist/` was served via `vite preview` and the landing page was rendered in **both** themes (dark seeded through the app's own `localStorage["puzzle-theme"]` key, since the theme is class-based rather than `prefers-color-scheme`).

### Console / runtime errors
- **Page errors: 0** in both themes.
- **Console errors: 12 per theme**, all of them `net::ERR_NAME_NOT_RESOLVED` → `TypeError: Failed to fetch` inside `supabase.signInAnonymously`. These are **environmental** — this sandbox has no network route to the Supabase project host. None originate from the changed code.

### Contrast — stage chips (text on that stage's own background)

| Chip | Light | Dark |
|---|---|---|
| Preparation | 6.33:1 PASS (AA) | 7.19:1 PASS (AA) |
| Incubation | 5.40:1 PASS (AA) | 4.96:1 PASS (AA) |
| Illumination | 11.41:1 PASS (AA) | 11.55:1 PASS (AA) |
| Verification | 6.35:1 PASS (AA) | 7.94:1 PASS (AA) |

### Contrast — `BestIdeasQuestion` incubation border vs card (non-text, 3:1 threshold)

| Theme | Composited ratio | Verdict |
|---|---|---|
| Light | 4.08:1 | PASS |
| Dark | 3.40:1 | PASS |

### Visual confirmation
- `landing-light.png` — light parchment palette, purple incubation border clearly visible, all four chips legible.
- `landing-dark.png` — dark indigo surface with the elephant artwork showing through, light text, border and chips intact.

---

## Files changed

| File | Change |
|---|---|
| `eslint.config.js` | Ignore `puzzle_design 2/**`; `src/components/ui/**` override |
| `tailwind.config.ts` | ESM import of `tailwindcss-animate`; removed 2 dead `stage-fg-*` keys |
| `src/index.css` | Removed 2 dead stage-foreground tokens (both themes) |
| `vite.config.ts` | `manualChunks` vendor splitting |
| `src/lib/audioFeedback.ts` | Typed global `Window` augmentation |
| `src/lib/jigsawGrid.ts` | **New** — holds `getGridConfig` |
| `src/components/game/JigsawImagePuzzle.tsx` | Dropped `getGridConfig` export; fixed `handleCellTap` deps |
| `src/components/game/JigsawPuzzleBoard.tsx` | `StageSlotDroppables` render-prop component |
| `src/components/ui/command.tsx` | `type` alias |
| `src/components/ui/textarea.tsx` | `type` alias |
| `src/pages/GameEnhanced.tsx` | Imports `getGridConfig` from `@/lib/jigsawGrid` |
| `src/pages/Game.tsx` | Added `comboStreak` to deps |
| `src/components/BestIdeasQuestion.tsx` | Border opacity `30` → `85` |

---

## Residual notes (not defects)

- The live game board could not be exercised end-to-end — it requires a Supabase session and this sandbox is offline. Game logic files were only touched for the two `exhaustive-deps` additions and the hooks extraction, both behaviour-preserving.
- At a 320 px viewport the longest quote (113 chars) still overflows its board cell. This is **pre-existing** and cannot be fixed without a layout change, which was explicitly out of scope.
