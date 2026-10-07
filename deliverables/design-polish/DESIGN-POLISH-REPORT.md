# QA Close-Out + Design Polish — creative-puzzle-studio

**Date:** 2026-10-07 (round 2)
**Scope:** Close out every remaining QA/feedback item, then significantly improve the
visual design and motion.
**Preserved as required:** the elephant background artwork
(`src/assets/elephant-jewel-forest.png`) and all fonts (Fredoka display / Inter body).

---

## Final status — all gates green

| Gate | Command | Result | Exit |
|---|---|---|---|
| Lint | `npm run lint` | **PASS** — 0 errors, 0 warnings | 0 |
| Types | `npx tsc --noEmit -p tsconfig.app.json` | **PASS** — 0 errors | 0 |
| Tests | `npm test` | **PASS** — 4/4 (2 files) | 0 |
| Build | `npm run build` | **PASS** — 2212 modules, **no warnings** | 0 |

No chunk-size warning, no Browserslist advisory. All chunks < 500 kB
(app 342.64 kB, vendor-react 161.12 kB, vendor-supabase 173.72 kB, vendor-motion 125.56 kB).

---

## Part 1 — QA / feedback close-out

Every item in `deliverables/software-company/visual-enhancement-spec.md` is now delivered.
The audit found exactly **one** outstanding item from the previous round.

| Item | Status | Notes |
|---|---|---|
| P0 dark-mode board background | delivered (round 1) | `.dark .bg-explorer` deep-indigo override |
| P0 `explorer-*` token remap | delivered (round 1) | literal hex → `hsl(var(--…))` |
| P0 board-cell affordance | delivered (round 1) | |
| P0 logo palette | delivered (round 1) + polished this round | |
| P0 `<motionField>` build blocker | delivered (round 1) | |
| P1 text legibility / board contrast / landing vibrancy / depth / stage colours / `.glass` | delivered (round 1) | |
| P2 ambient blobs | delivered (round 1) | verified: `bg-secondary/[0.12]`, `bg-accent/[0.12]`, `bg-primary/[0.12]` |
| P2 combo/milestone accents | delivered (round 1) | verified: `from-primary to-accent` + `shadow-glow-violet` |
| **P2 jigsaw silhouette on tray pieces** | **delivered THIS round** | see below |

### The P2 jigsaw silhouette — and why it was implemented differently

The spec proposed applying a `clip-path` polygon (copied from the dead
`PuzzleBoard.tsx`) directly to the tray buttons. Its own risk table (§6) flagged that
this would clip the quote text and the ✓ badge, and advised skipping it if so.
That warning was correct, and a literal implementation would have **degraded** the design:

- `clip-path` also clips `box-shadow`, which is how Tailwind renders **both** `ring-*`
  and `shadow-*`. The selected-piece ring and `shadow-glow-gold` would vanish.
- The original polygon uses coordinates outside the box (105 %, 108 %, −5 %, −8 %).
  Those tabs would overlap neighbouring pieces and be cut off by the tray's
  `overflow-y-auto`.
- A full-bleed statement bar means the quote text — the learning content — sits
  directly under the clipped edges.

**What was built instead** (`.jigsaw-tray-piece` rule in `src/index.css`):

- Four **socket blanks** with a genuine undercut (opening 40–60 %, cavity 36–64 %,
  depth 10 %), all *inside* 0–100 %, so nothing overflows and neighbours stay clean.
- Scoped to `@media (min-width: 1024px)`, where the tray renders ~155 px squares.
  Below that the pieces get wide and the cavities would bite into the quote text, so
  they keep their rounded corners.
- The selection glow is re-expressed as a **`drop-shadow` filter**, which *does* follow
  the clipped outline, replacing the ring/box-shadow that clip-path destroys.
- Statement padding widened to `1.1rem` (> the 10 % ≈ 15.5 px cavity) so text clears
  the sockets.
- The ✓ badge moves from `-top-1.5 -right-1.5` to `lg:top-1 lg:right-1` so it stays
  visible on shaped pieces (unchanged on smaller breakpoints).

Verified by rendering the real tray markup against the compiled CSS at 155 px
(`deliverables/design-polish/tray-harness.png`): 155×155 pieces, `clip-path` applied,
`border-color: transparent`, `box-shadow: none`, selected piece carrying the gold
`drop-shadow`, and **zero text overflow** on every sample including the 113-character
longest quote.

---

## Part 2 — Design & motion enhancements

### New shared motion vocabulary (`src/index.css`)

Six keyframes (`aurora-drift`, `ken-burns`, `float-drift`, `shine-sweep`,
`gradient-pan`, `sparkle-pop`, `ring-breathe`) plus the reusable classes `.aurora`,
`.text-gradient`, `.shine-hover`, `.card-luxe` and `.progress-shine`. All are
neutralised automatically by the existing `prefers-reduced-motion` block.

### Landing page (`src/pages/Index.tsx`)

| Enhancement | Detail |
|---|---|
| **Elephant artwork** | Preserved, now on a 34 s `ken-burns` drift (scale 1.06 → 1.15) so the hero breathes |
| Aurora mesh | Three palette blooms (violet / teal / gold), blurred 30 px, drifting on a 28 s cycle. Much subtler in light than dark |
| Scrim + vignette | Vertical wash plus a radial vignette so the content column reads cleanly over the artwork |
| Sparkle field | Six deterministic twinkling motes (no `Math.random`, so layout is stable) |
| Hero title | Animated violet→teal gradient (`background-clip: text`) + a pulsing ellipsis |
| Logo | Pulsing palette halo behind it, gradient now pans, inner gloss added |
| Stage chips | Staggered spring pop-in, lift on hover |
| Floating badges | Now drift on a 7.5 s float cycle; **hidden below 640 px** where they collided with the content column |
| Primary button | Diagonal light sweep on hover (`.shine-hover`) |
| Cards | Gradient-bordered `.card-luxe` surface |
| Feature strip | Per-item stagger + hover lift/tap scale |

### Game screen (`src/pages/GameEnhanced.tsx`)

- Ambient blobs now drift on offset cycles (two on `aurora-drift`, one on `float-drift`).
- Combo pill breathes and its ⚡ icon rocks; light sweep on the pill.
- XP bar fill has a travelling gradient shine.

### Board & tray (`src/components/game/JigsawImagePuzzle.tsx`)

- **Radial sparkle burst** (6 particles) emitted when a piece snaps home.
- Progress fill carries a moving light sheen.
- Tray pieces: jigsaw silhouette on desktop (above), selection glow via `drop-shadow`.

---

## Regression verification (headless Chromium, both themes)

| Check | Light | Dark |
|---|---|---|
| Elephant artwork present | ✅ `elephant-jewel-forest…png` | ✅ |
| Body font | `Inter, sans-serif` | `Inter, sans-serif` |
| Heading font | `Fredoka, sans-serif` | `Fredoka, sans-serif` |
| Aurora layer | ✅ | ✅ |
| Sparkles | 6 | 6 |
| Stage chip colours | unchanged | unchanged |
| Horizontal overflow (1440 & 390 px) | none | none |
| **Page errors** | **0** | **0** |
| Non-network console errors | **0** | **0** |

The 12 console errors per load are all `ERR_NAME_NOT_RESOLVED` → `Failed to fetch` from
`supabase.signInAnonymously` — **environmental** (offline sandbox, no route to the
Supabase host). None originate from the changed code.

Chip text contrast is unchanged from the verified values (4.96:1 – 11.55:1, all ≥ AA).

---

## Files changed this round

| File | Change |
|---|---|
| `src/index.css` | Motion vocabulary, `.aurora`, `.text-gradient`, `.shine-hover`, `.card-luxe`, `.progress-shine`, desktop jigsaw silhouette rule |
| `src/pages/Index.tsx` | Background stack, sparkles, hero title, logo halo, chip stagger, badge drift + mobile hide, button sweep, `card-luxe`, feature strip |
| `src/pages/GameEnhanced.tsx` | Blob drift, combo pill motion, XP shine |
| `src/components/game/JigsawImagePuzzle.tsx` | Sparkle burst, progress shine, badge reposition for shaped pieces |
| `src/components/AppLogo.tsx` | Animated gradient + inner gloss |
| `src/components/BestIdeasQuestion.tsx` | Coloured incubation glow shadow |

**Not touched:** `src/lib/gameData.ts`, all handlers/state/`useMemo` bodies, the board
grid geometry (`repeat(cols,1fr)`, `gap: 2px`, `aspectRatio`), routing, Supabase calls,
`package.json`, and the elephant asset. No new dependencies.

---

## Residual / not verifiable offline

- The **live game board could not be exercised end-to-end** — `/game/:sessionId`
  requires a Supabase session and this sandbox has no network route. The board and tray
  were therefore verified via a standalone harness rendering the real markup against the
  compiled CSS, not in the running app.
- The manual checklists in `TESTING_GUIDE.md` (phase transitions, combo scoring,
  cross-browser matrix) remain unverified for the same reason.
