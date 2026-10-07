# Visual-Only Enhancement Specification — Creativity Jigsaw Puzzle

**Author:** 许清楚 (Xu) · Product Manager
**Status:** Ready for implementation
**Scope:** Visual styling only. Gameplay, layout structure, component APIs, routing, copy, scoring and Supabase behaviour are frozen (see §5).

---

## 1. TL;DR

1. The app runs **three disagreeing palettes** (teal/mint tokens, legacy brand purple/orange, and a hardcoded "explorer" parchment). We unify everything onto **one artwork-derived palette**: royal violet (elephant body) as primary, amber-gold (lightbulbs/gears) as secondary, teal (swirls) as accent, forest green (foliage) as success.
2. **Dark mode is broken on the live game screen** because `.bg-explorer` is a hardcoded light parchment gradient and the `explorer-*` Tailwind colors are literal hex. We re-point all `explorer-*` values to CSS variables so every existing class name becomes theme-aware with **zero JSX structural change**.
3. We raise contrast, text legibility and depth on the board/tray, unify radii/shadows, un-mute the landing page, and fix the pre-existing `<motionField>` JSX defect (→ `<motion.div>`) so `tsc` passes. **No new runtime dependencies.**

---

## 2. Visual aspects to enhance (prioritized)

The user explicitly asked *which* visual aspects to enhance. This is the headline table. "Files" lists every file that must change for the item.

| Pri | Aspect | Current | Proposed | Why it improves the game | Files |
|-----|--------|---------|----------|--------------------------|-------|
| **P0** | Dark-mode game background | `.bg-explorer { background: linear-gradient(135deg,#FEF3C7,#FEF9EC,#E0F2FE) }` — hardcoded light parchment; game area stays bright white in dark mode while text/surfaces darken | Tokenised gradient using `--board-surface` / `--background`; add explicit `.dark .bg-explorer` override → deep indigo night gradient (`hsl(258 30% 10%)` → `hsl(262 28% 14%)`) | Removes the #1 visible defect: an unusable half-bright/half-dark screen in dark mode | `src/index.css` |
| **P0** | `explorer-*` colors are literal hex | `explorer.gold:"#CA8A04"`, `ocean:"#0284C7"`, `parchment:"#FEF3C7"`, `dark:"#92400E"` — cannot respond to theme | Re-point each to `hsl(var(--gold))` / `--ocean` / `--parchment` / `--parchment-light` / `--ink`; define both `:root` and `.dark` values | Every `border-explorer-gold/40`, `text-explorer-dark`, `bg-explorer-ocean/10` etc. becomes correct in both themes with no class renames | `tailwind.config.ts`, `src/index.css` |
| **P0** | Empty board-cell affordance | `border-white/15 bg-black/5` — near-invisible on the light parchment board; the "where can I drop?" cue is lost | `border-explorer-dark/25 bg-explorer-dark/[0.06]`; active target `border-explorer-gold/70 bg-explorer-gold/12` + stronger pulsing dashed inset | Players can see the grid and valid drop targets instantly — reduces mis-drops and frustration | `src/components/game/JigsawImagePuzzle.tsx` (class values only) |
| **P0** | App logo palette mismatch | `AppLogo.tsx` hardcodes a teal/mint gradient `hsl(160,40%,78%)→hsl(160,45%,58%)`, unrelated to the violet elephant | Gradient `hsl(var(--primary))` → `hsl(var(--accent))` (violet→teal), token-driven, theme-aware | Logo becomes the brand anchor that matches the artwork instead of fighting it | `src/components/AppLogo.tsx` |
| **P0** | Build blocker: invalid JSX `<motionField>` | `src/pages/Index.tsx:458` opens `<motionField …>` and `:469` closes `</motionField>` → TS2339, `tsc` fails | Replace with `<motion.div …>` / `</motion.div>` (defect fix, not a design change; `motion` already imported line 3) | Restores a green type-check/build; required before any visual work can ship | `src/pages/Index.tsx` |
| **P1** | Quote text legibility | Placed pieces `text-[8px] min-[380px]:text-[9px] sm:text-[10px]`; tray `text-[10px]`; `.jigsaw-piece-statement` `min-height: 2rem`, padding `0.35rem 0.5rem` | Board `text-[10px] min-[380px]:text-[11px] sm:text-xs`; tray `text-[11px] sm:text-xs`; statement `min-height: 2.25rem`, padding `0.4rem 0.55rem`, `line-height: 1.4` | Quotes are the learning content — they must be readable at arm's length on a shared classroom screen | `src/components/game/JigsawImagePuzzle.tsx`, `src/index.css` |
| **P1** | Board contrast & depth | Board frame `border-explorer-gold/40`; faded backdrop `opacity-[0.13]`; inner cells `rounded-sm`; frame border `border-explorer-gold/50` | Board frame `border-explorer-gold/60` + `shadow-lg` + `ring-1 ring-explorer-dark/10`; backdrop `opacity-[0.18] dark:opacity-[0.12]`; cells `rounded-[4px]`; add inner top highlight `bg-gradient-to-b from-white/10 to-transparent` | Gives the board a crisp "framed puzzle" feel and separates it from the page | `src/components/game/JigsawImagePuzzle.tsx` |
| **P1** | Landing page is muted | Elephant backdrop `opacity-[0.13] dark:opacity-[0.08]`; floating stage badges `opacity: 0.18`; plain `bg-background` | Backdrop `opacity-[0.20] dark:opacity-[0.12]`; badges `opacity: 0.30`; add a soft violet→teal radial wash layer behind the hero | First impression becomes vivid and on-brand; the artwork reads as the hero | `src/pages/Index.tsx` |
| **P1** | Depth system is incoherent | Board `rounded-xl border-2`, tray `rounded-lg border-2`, cards shadcn defaults, mixed `shadow-card` / `shadow-xl` / ad-hoc rgba | One radius scale (`--radius-sm…--radius-3xl`) and one shadow scale (`--shadow-xs…--shadow-xl`, `--shadow-glow-gold/violet`); board=`xl`, tray=`lg`, cards=`lg` | Consistent, intentional depth; the board visually outranks the tray | `src/index.css`, `tailwind.config.ts` |
| **P1** | Stage badge colors drift from artwork | `--stage-illumination: 45 90% 55%` etc. are warm-generic; `--stage-incubation` purple is close but unharmonised | Re-derive: Preparation `205 85% 52%` (indigo-blue), Incubation `262 72% 58%` (elephant violet), Illumination `43 92% 55%` (lightbulb gold), Verification `150 62% 40%` (forest) | The four creativity stages now map to actual colors in the artwork (esp. Illumination = gold lightbulb) | `src/index.css` |
| **P1** | `.glass` frosted panels are hardcoded white | `.glass { @apply bg-white/20 border-white/30 }` | Tokenised `background: hsl(var(--card)/0.55)` (light) / `hsl(0 0% 100%/0.12)` (dark), `border: hsl(var(--border)/0.5)`, `backdrop-blur-md`; keep `text-white` legible over the dark scrims where it is used | Panels stop looking washed-out in light mode and stay legible in dark mode | `src/index.css` |
| **P2** | Jigsaw silhouette lives only in dead code | Active tray (`JigsawImagePuzzle.tsx`) uses plain `rounded-lg` rectangles; a `jigsawClip` exists in un-routed `PuzzleBoard.tsx:57` and `jigsawPiecePath` in un-routed `PiecesTray.tsx:45` | Apply a shared `--jigsaw-clip` (from `jigsawClip`, `PuzzleBoard.tsx:57`) to **tray pieces only**, via a new `.jigsaw-piece-shape` class. Keep board cells rectangular so grid geometry/text are untouched. | Restores the "puzzle piece" identity the game is named for, at low risk | `src/index.css`, `src/components/game/JigsawImagePuzzle.tsx` (add class) |
| **P2** | Ambient background blobs are faint & off-palette | `bg-explorer-gold/10`, `bg-explorer-ocean/10`, `bg-brand-purple/5` at `opacity-30/20` | `bg-primary/12`, `bg-accent/12`, `bg-secondary/10`, sizes unchanged, `opacity-40` | Adds atmospheric depth that matches the artwork's sparkle without distracting | `src/pages/GameEnhanced.tsx` |
| **P2** | Combo / milestone accents use legacy brand | `from-brand-purple to-brand-orange` combo pill; `shadow-glow-purple` | `from-primary to-accent` + `shadow-glow-violet`; halfway toast keep `shadow-glow-gold` | Accent moments use the unified palette | `src/pages/GameEnhanced.tsx` |

> **P2 rule:** implement P0 + P1 first and re-verify dark mode before starting P2. P2 items are additive polish and independently revertible.

---

## 3. Unified design tokens

Single source of truth. Add/merge the block below into `src/index.css` inside the existing `@layer base { :root { … } .dark { … } }` — **do not create a second `:root`**. Values are HSL triplets (`H S% L%`) consumed as `hsl(var(--x))` by Tailwind.

### 3.1 Core surface & semantic tokens

| Token | `:root` (light) | `.dark` | Used by |
|-------|-----------------|---------|---------|
| `--background` | `268 32% 98%` | `258 30% 10%` | page bg |
| `--foreground` | `258 28% 16%` | `268 20% 96%` | body text |
| `--card` | `0 0% 100%` | `258 26% 14%` | cards, modals |
| `--card-foreground` | `258 28% 16%` | `268 20% 96%` | card text |
| `--popover` | `0 0% 100%` | `258 26% 14%` | popovers |
| `--popover-foreground` | `258 28% 16%` | `268 20% 96%` | popover text |
| `--primary` | `262 72% 54%` | `262 70% 62%` | violet — elephant body |
| `--primary-foreground` | `0 0% 100%` | `258 35% 10%` | text on primary |
| `--secondary` | `43 90% 52%` | `43 88% 58%` | amber-gold — lightbulb |
| `--secondary-foreground` | `258 35% 16%` | `258 35% 10%` | text on secondary |
| `--muted` | `268 24% 94%` | `258 20% 20%` | muted surfaces |
| `--muted-foreground` | `260 12% 46%` | `265 14% 66%` | secondary text |
| `--accent` | `174 70% 42%` | `174 65% 48%` | teal — swirls |
| `--accent-foreground` | `0 0% 100%` | `258 35% 10%` | text on accent |
| `--destructive` | `0 72% 55%` | `0 62% 52%` | errors, miss |
| `--destructive-foreground` | `0 0% 100%` | `0 0% 100%` | text on destructive |
| `--success` | `145 62% 40%` | `150 58% 46%` | correct / fixed |
| `--success-foreground` | `0 0% 100%` | `258 35% 10%` | text on success |
| `--border` | `268 22% 88%` | `258 18% 24%` | borders |
| `--input` | `268 22% 88%` | `258 18% 24%` | input borders |
| `--ring` | `262 72% 54%` | `262 70% 62%` | focus ring |

### 3.2 Artwork / board tokens (new — these back the `explorer-*` remap)

| Token | `:root` | `.dark` | Notes |
|-------|---------|---------|-------|
| `--gold` | `43 88% 46%` | `43 92% 58%` | darker in light for text contrast on parchment |
| `--ocean` | `190 82% 42%` | `190 78% 52%` | teal-blue swirl |
| `--parchment` | `268 40% 97%` | `258 26% 16%` | board/tray base surface |
| `--parchment-light` | `268 45% 99%` | `258 24% 20%` | tray gradient stop |
| `--ink` | `258 35% 20%` | `268 20% 92%` | text on gold pills (was `explorer-dark`) |
| `--board-surface` | `268 35% 96%` | `258 28% 13%` | `.bg-explorer` gradient midpoint |
| `--board-cell-border` | `258 30% 30%` | `268 25% 80%` | empty-cell outline (apply at `/25`) |
| `--board-cell-fill` | `258 30% 30%` | `268 25% 80%` | empty-cell fill (apply at `/[0.06]`) |

### 3.3 Stage tokens (harmonised to artwork)

| Token | `:root` | `.dark` |
|-------|---------|---------|
| `--stage-preparation` | `205 85% 52%` | `205 78% 58%` |
| `--stage-incubation` | `262 72% 58%` | `262 68% 64%` |
| `--stage-illumination` | `43 92% 55%` | `43 88% 58%` |
| `--stage-verification` | `150 62% 40%` | `150 58% 46%` |
| `--stage-evaluation` | `350 75% 58%` | `350 70% 62%` |
| `--stage-elaboration` | `150 62% 40%` | `150 58% 46%` |

### 3.4 Radius scale (add to `:root`; keep `--radius` for shadcn compat)

| Token | Value | px |
|-------|-------|----|
| `--radius-sm` | `0.5rem` | 8 |
| `--radius-md` | `0.625rem` | 10 |
| `--radius-lg` | `0.75rem` | 12 |
| `--radius-xl` | `1rem` | 16 |
| `--radius-2xl` | `1.25rem` | 20 |
| `--radius-3xl` | `1.5rem` | 24 |
| `--radius-pill` | `9999px` | — |

### 3.5 Shadow scale (add to `:root`)

| Token | Value |
|-------|-------|
| `--shadow-xs` | `0 1px 2px hsl(258 30% 20% / 0.06)` |
| `--shadow-sm` | `0 1px 3px hsl(258 30% 20% / 0.10), 0 1px 2px hsl(258 30% 20% / 0.06)` |
| `--shadow-md` | `0 4px 10px -2px hsl(258 30% 20% / 0.14)` |
| `--shadow-lg` | `0 12px 24px -6px hsl(258 30% 20% / 0.18)` |
| `--shadow-xl` | `0 20px 40px -12px hsl(258 30% 20% / 0.24)` |
| `--shadow-glow-gold` | `0 0 20px hsl(43 90% 55% / 0.45)` |
| `--shadow-glow-violet` | `0 0 22px hsl(262 72% 55% / 0.40)` |

In `.dark`, override `--shadow-lg`/`--shadow-xl` to pure black at higher alpha (`hsl(0 0% 0% / 0.45)` / `0.6`) so shadows still read on dark surfaces.

### 3.6 Typography (no font changes — scale only)

Keep `font-display: Fredoka`, `font-body: Inter`. Only adjust sizes where noted in §4. Minimum readable size on the board becomes **10px**, tray **11px** (was 8px/10px).

---

## 4. File-by-file change list

Surgical. Where stated "values only", the DOM tree, element order and props are untouched.

### 4.1 `tailwind.config.ts`
- `theme.extend.colors.explorer`: replace the six literal hex values with token references:
  - `parchment: "hsl(var(--parchment))"`, `gold: "hsl(var(--gold))"`, `ocean: "hsl(var(--ocean))"`, `forest: "hsl(var(--success))"`, `light: "hsl(var(--parchment-light))"`, `dark: "hsl(var(--ink))"`.
- `theme.extend.colors.brand`: leave the numbered ramps in place (harmless), but change `purple.DEFAULT` → `"hsl(var(--primary))"` and `orange.DEFAULT` → `"hsl(var(--secondary))"` so the remaining live `brand-purple`/`brand-orange` usages in `GameEnhanced.tsx` snap to the new palette without editing that file's classes. **Keep `brand.purple.600`** (used at `GameEnhanced.tsx:250`) — set it to `"hsl(var(--primary))"` too.
- `theme.extend.boxShadow`: re-point `card` → `var(--shadow-sm)`, `card-hover` → `var(--shadow-md)`, `glow-gold` → `var(--shadow-glow-gold)`, `glow-purple` → `var(--shadow-glow-violet)`.
- **Do not** remove the `alchemist` / `gardener` / `observatory` palettes in this pass (dead but harmless; removing risks a missed usage). They may be pruned in a later cleanup.
- No dependency, plugin, content-glob or darkMode changes.

### 4.2 `src/index.css`
- **`:root`** — update the 18 core tokens per §3.1, add the artwork tokens §3.2, update stage tokens §3.3, append radius §3.4 and shadow §3.5 scales. Keep `--radius: 0.75rem` and the `--sidebar-*` block unchanged.
- **`.dark`** — update the mirror values per §3.1–§3.3; add the dark overrides for §3.2 and the shadow alpha note in §3.5.
- **`.bg-explorer`** — replace the hardcoded gradient with:
  `background: linear-gradient(135deg, hsl(var(--parchment)) 0%, hsl(var(--board-surface)) 45%, hsl(var(--parchment-light)) 100%);`
  then add, immediately after it, `.dark .bg-explorer { background: linear-gradient(135deg, hsl(258 30% 10%) 0%, hsl(262 28% 14%) 50%, hsl(258 26% 16%) 100%); }`.
- **`.glass`** — replace `@apply bg-white/20 backdrop-blur-md border border-white/30 shadow-lg;` with token form: `background: hsl(var(--card) / 0.55); border: 1px solid hsl(var(--border) / 0.5); backdrop-filter: blur(12px); box-shadow: var(--shadow-lg);`. Add `.dark .glass { background: hsl(0 0% 100% / 0.10); border-color: hsl(0 0% 100% / 0.16); }`. **Leave `.glass-dark` unchanged** (already dark-correct).
- **`.jigsaw-piece-statement`** — `min-height: 2.25rem`; `padding: 0.4rem 0.55rem`; keep the existing gradient/shadow; in the `max-width: 639px` block raise `min-height` to `2.5rem`.
- **`.jigsaw-piece-statement .quote-text`** — `line-height: 1.4` (was 1.35). Keep serif italic, colour `#fefefe`, text-shadow.
- **`.jigsaw-tray-piece` (hover block, ~line 474)** — change the hardcoded `border-color: hsl(43 96% 40% / 0.6)` to `hsl(var(--gold) / 0.7)`; change `.jigsaw-tray-toggle:hover` gradient to `linear-gradient(to right, hsl(var(--gold) / 0.25), hsl(var(--parchment-light)))`.
- **Add** `.jigsaw-piece-shape { clip-path: <jigsawClip from PuzzleBoard.tsx:57>; }` — P2 only.
- **`.glow-purple/.glow-orange/.glow-green/.glow-gold`** (lines 243–254): leave as-is (still valid accent glows) or, optionally, re-point to the new shadow vars. Not required.
- **Do not** touch keyframes, `prefers-reduced-motion`, safe-area helpers, or any `@layer components` class not named above.

### 4.3 `src/components/game/JigsawImagePuzzle.tsx` (THE live board + tray) — values only
Board container (line 345): `border-explorer-gold/40` → `border-explorer-gold/60`; `shadow-xl` → `shadow-lg`; add `ring-1 ring-explorer-dark/10`; `bg-explorer-dark/5` → `bg-explorer-dark/[0.06]`.
Faded backdrop (line 352): `opacity-[0.13]` → `opacity-[0.18] dark:opacity-[0.12]`.
Phase label (line 358): `text-[9px]` → `text-[10px]`.
Empty-cell outline (line 428): `"border-white/15 bg-black/5"` → `"border-explorer-dark/25 bg-explorer-dark/[0.06]"`; keep `rounded-sm` (→ optionally `rounded-[4px]`).
Active-target outline (line 427): `"border-explorer-gold/50 bg-explorer-gold/8"` → `"border-explorer-gold/70 bg-explorer-gold/12"`.
Placed quote text (line 439): `text-[8px] min-[380px]:text-[9px] sm:text-[10px]` → `text-[10px] min-[380px]:text-[11px] sm:text-xs`.
Tray piece gradient (line 632): keep `from-explorer-dark/40 to-explorer-ocean/20` (now token-backed, auto theme-aware).
Tray quote text (line 650): `text-[10px] sm:text-[10px]` → `text-[11px] sm:text-xs`.
Tray piece (line 630): add `jigsaw-piece-shape` to the class list (P2 only) — this is an added class, not a structural change.
Tray toggle (line 570): `from-explorer-gold/15 to-explorer-parchment border-explorer-gold/25` → `from-explorer-gold/20 to-explorer-parchment border-explorer-gold/35`.
Progress bar (line 553): keep `from-explorer-gold to-explorer-ocean` (now token-backed).
**Do not** change: the `style={{ gridTemplateColumns… gap:"2px" }}` grid, `aspectRatio: cols/rows`, the `motion.button` key/order, `handleCellTap`, `getPieceImageStyle`, or any handler.

### 4.4 `src/pages/GameEnhanced.tsx` — values only
Root (line 220): `bg-explorer` unchanged (now theme-aware via CSS).
Ambient blobs (lines 223–225): `bg-explorer-gold/10` → `bg-secondary/12`; `bg-explorer-ocean/10` → `bg-accent/12`; `bg-brand-purple/5` → `bg-primary/12`; `opacity-30` → `opacity-40` (keep `opacity-20` blob at `opacity-30`).
Header (line 229): `border-explorer-gold/20` → `border-explorer-gold/30`; keep `bg-background/85 backdrop-blur-md`.
XP label (line 250): `text-brand-purple-600` → `text-primary` (optional, equivalent after config remap; keep either).
Timer pill (line 264): `bg-explorer-gold/15 text-explorer-dark` unchanged (token-backed).
Progress pill (line 280): `bg-explorer-gold/15` → `bg-explorer-gold/20`.
Combo pill (line 340): `from-brand-purple to-brand-orange` → `from-primary to-accent`; `shadow-glow-purple` → `shadow-glow-violet`.
**Do not** change: `useParams`, timer effect, `handleCompleted` scoring, confetti calls, `JigsawImagePuzzle` props, `CompletionOverlay` props, or any text.

### 4.5 `src/pages/Index.tsx` — defect fix + values only
- **Defect fix (P0, required for `tsc`):** line 458 `<motionField …>` → `<motion.div …>`; line 469 `</motionField>` → `</motion.div>`. No other change to that block.
- Elephant backdrop (line 146): `opacity-[0.13] dark:opacity-[0.08]` → `opacity-[0.20] dark:opacity-[0.12]`.
- Add a second wash layer immediately after the existing gradient `<div>` (line 149): `<div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,hsl(var(--primary)/0.10),transparent_60%)]" />` — purely decorative, `pointer-events-none` inherited from parent.
- Floating badges (line 158): `animate={{ opacity: 0.18, y: 0 }}` → `animate={{ opacity: 0.30, y: 0 }}`.
- Hero `text-primary` (line 191) and stage chips (lines 21–24) unchanged (stage tokens now harmonised).
**Do not** change: `useState`/`useEffect` logic, `handleJoin`/`handleCreate`, `mode`/`joinStep` state machine, `BestIdeasQuestion` props, or any copy.

### 4.6 `src/components/AppLogo.tsx`
- Replace the inline `background` gradient with `background: linear-gradient(160deg, hsl(var(--primary)), hsl(var(--accent)))`.
- Replace `shadow-teal-900/20` with `shadow-primary/25`.
- Keep `sizeClasses`, `iconSizes`, the `Puzzle` icon, `strokeWidth={2.25}` and `rotate(8deg)` — layout/props unchanged.

### 4.7 `src/pages/Lobby.tsx`, `src/pages/Results.tsx`, `src/pages/Leaderboard.tsx`, `src/pages/TeacherDashboard.tsx`, `src/components/InstructionsModal.tsx`, `src/components/ThemeToggle.tsx`, `src/components/game/CompletionOverlay.tsx`
- **No changes required.** All of these already use semantic tokens (`bg-background`, `text-primary`, `border-secondary/30`, `text-success`, `bg-accent/10`, etc.), so they inherit the new palette automatically.
- The only item worth an optional touch: `CompletionOverlay.tsx:59` `bg-muted/40` and `Results.tsx:177` `border bg-card` are already token-based — leave them.
- `InstructionsModal.tsx` uses `bg-primary/10`, `bg-accent/10`, `bg-secondary/10`, `bg-success/10` — auto-updates.

### 4.8 Dead / non-routed files — **leave alone**
`src/pages/Game.tsx`, `src/components/game/PuzzleBoard.tsx`, `src/components/game/PiecesTray.tsx`, `src/components/game/MobileOptimizedPiecesTray.tsx`, `src/components/game/JigsawPuzzleBoard.tsx`, `src/pages/GameTimePage.tsx`. None are on a live route (`App.tsx` maps `/game/:sessionId` → `GameEnhanced`). Editing them adds risk with zero user-visible benefit. The `jigsawClip` value is **copied** into `index.css` (§4.2) rather than imported from `PuzzleBoard.tsx`.

---

## 5. DO NOT TOUCH list

These must remain **byte-identical** or semantically unchanged:

1. **Game mechanics** — `src/lib/gameData.ts` (all of it: `getLevelGridConfig`, `getRandomizedStagesForPlayer`, `calculateJigsawScore`, `getFillerQuotePool`, `DIFFICULTY_CONFIG`), and every handler in `JigsawImagePuzzle.tsx`: `handlePieceSelect`, `handleCellTap`, `isCellActive`, `isCellFixed`, `getCellLabel`, the `useEffect` phase-transition (lines 212–221), and all `useState`/`useMemo` bodies.
2. **Scoring / timers** — `GameEnhanced.tsx` timer effect (61–75), `handlePiecePlaced`, `handleIncorrect`, `handlePhaseComplete`, `handleCompleted`, `timeUp` effect, `xpLevel`/`xpProgress`.
3. **Layout geometry** — `JigsawImagePuzzle.tsx` grid style block: `gridTemplateColumns: repeat(cols,1fr)`, `gridTemplateRows: repeat(rows,1fr)`, `gap: "2px"`, `maxWidth: 640`, `aspectRatio: cols/rows`. Also `SLOT_LAYOUT` in `src/components/game/PuzzleBoard.tsx:38-47` (leave the file alone entirely).
4. **DOM hierarchy** — no element may be reordered, reparented, added-to or removed-from any live render tree. Class strings may change; element names/order may not. The single permitted exception is the `<motionField>` → `<motion.div>` defect fix (§4.5), which is a corrected tag name, not a new node.
5. **Component APIs** — every `interface …Props`, exported function signature, and prop name in `JigsawImagePuzzle.tsx`, `CompletionOverlay.tsx`, `InstructionsModal.tsx`, `AppLogo.tsx`, `ThemeToggle.tsx` stays as-is.
6. **Hooks / data** — `src/hooks/*`, `src/integrations/supabase/*`, `src/lib/audioFeedback.ts`, `src/lib/bestIdeasAnswer.ts`, all Supabase queries, channels, and RLS-dependent calls.
7. **Routing** — `src/App.tsx` route table unchanged.
8. **Copy / labels** — every user-visible string (button labels, headings, instructions, aria-labels, `title`s) unchanged. Class changes only.
9. **Dependencies** — `package.json` dependencies/devDependencies unchanged. No new fonts, icon packs, or CSS libs. Google Fonts import line stays.
10. **Tests** — `src/test/example.test.ts` and `src/lib/bestIdeasAnswer.test.ts` must still pass; they do not assert on class names, but the logic they cover must be untouched.
11. **Dark mode toggle** — `useTheme` / `ThemeToggle` behaviour and the `.dark` class strategy (`darkMode: ["class"]`) unchanged; both themes must render correctly after the change.

---

## 6. Risks & acceptance criteria

### Risks
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Re-pointing `explorer.dark` to a flipping token (`--ink`) changes `text-explorer-dark` on gold pills in dark mode | Medium | Intentional: in dark mode the pill text must be light. Verify the two live usages (`GameEnhanced.tsx:264,282`, `JigsawImagePuzzle.tsx:581`) on both themes. |
| Lowering board `shadow-xl` → `shadow-lg` makes the board look flat | Low | Compensate with `ring-1 ring-explorer-dark/10` and the frame border bump to `/60`. |
| `.jigsaw-piece-shape` clip-path clips the quote text or the selection ✓ badge | Medium | P2 only, tray-only, and the badge is at `-top-1.5 -right-1.5` — if clipped, drop the badge outside via unchanged markup or skip P2. Re-verify before merge. |
| Raising text sizes overflows small board cells on the smallest breakpoint | Low–Medium | Board uses `overflow-y-auto` on the statement bar and `line-clamp` on keys; confirm at 320px width that no quote is truncated (the game requires full quote display). |
| Token remap silently changes shadcn primitives (`Button`, `Card`, `Badge`) | Low | These read `--primary`/`--card`/`--border`; the new values are a hue shift, not a contrast inversion. Visually diff all pages. |
| Removing `brand-*`/world palettes breaks a missed usage | Low | **We are not removing them** (§4.1). |

### Acceptance criteria (definition of "purely visual")
1. `npx tsc --noEmit` passes (motionField fixed) and `npm run build` succeeds.
2. `npm test` — the two existing tests still pass, unmodified.
3. `git diff --stat` touches **only**: `src/index.css`, `tailwind.config.ts`, `src/components/AppLogo.tsx`, `src/pages/Index.tsx`, `src/pages/GameEnhanced.tsx`, `src/components/game/JigsawImagePuzzle.tsx`. Any other source file in the diff is a defect.
4. `git diff` contains **no** changes to: any `interface …Props`, any function body in `gameData.ts`, any `useState`/`useEffect`/`useMemo` logic, any Supabase call, any string literal in JSX (except none), `App.tsx`, or `package.json`.
5. Manual parity check — with a session at `/game/:sessionId`:
   - Phase 1: 4 keys still snap into the top row; correct/incorrect feedback animations still fire.
   - Phase 2: quotes still match by column; decoys still rejected; completion still triggers `CompletionOverlay` and score is identical to a pre-change run at the same difficulty/inputs.
   - Toggle light↔dark: board, tray, header, toasts and overlays are all legible in **both** modes (the P0 goal).
6. Responsive check at 320px / 390px / 768px / 1280px: no quote text truncated, no horizontal scroll, grid still 4×4 (or `cols×rows`) with 2px gaps.
7. `prefers-reduced-motion` still disables animations (unchanged rule).
8. No new network requests, no new console warnings.

---

### Implementation order (recommended)
1. P0 defect: `<motionField>` → `<motion.div>` (§4.5) — unblocks `tsc`.
2. P0 tokens + `explorer-*` remap + `.bg-explorer` dark override (§4.1, §4.2) — fixes dark mode globally.
3. P0 logo, board-cell contrast, board frame (§4.3, §4.6).
4. P1 text legibility, landing vibrancy, depth, `.glass` (§4.2, §4.3, §4.4, §4.5).
5. Verify acceptance criteria 1–8.
6. P2 polish (jigsaw silhouette, blobs, combo accents) only after sign-off.
