import { describe, it, expect } from "vitest";
import {
  CREATIVITY_STAGES_BASE,
  DIFFICULTY_CONFIG,
  MAX_LEVEL,
  MIN_QUOTES_PER_STAGE,
  MAX_QUOTE_SLOTS_PER_COLUMN,
  calculateJigsawScore,
  getFillerQuotePool,
  getLevelFromDifficulty,
  getLevelGridConfig,
  getRandomizedStages,
  getRandomizedStagesForPlayer,
  generateGameCode,
  injectStudentIncubationQuote,
  type CreativityStage,
} from "@/lib/gameData";
import { getGridConfig } from "@/lib/jigsawGrid";

/* ────────────────────────────────────────────────────────────────────────────
   Scoring
   The score functions are the only place where a bug is silent: nothing throws,
   the game still finishes, and the wrong number is written to the leaderboard.
   These tests pin the direction of every term (time and misses can only ever
   reduce the score) and the defensive guards added for finding H4.
   ──────────────────────────────────────────────────────────────────────────── */

describe("calculateJigsawScore", () => {
  const PIECES = 16;

  it("returns the full base score for an instant, flawless run", () => {
    // 16 pieces × 40 points × easy (×1)
    expect(calculateJigsawScore("easy", 0, 0, PIECES)).toBe(640);
  });

  it("never rewards taking longer", () => {
    const fast = calculateJigsawScore("easy", 5_000, 0, PIECES);
    const slow = calculateJigsawScore("easy", 65_000, 0, PIECES);
    expect(slow).toBeLessThan(fast);
  });

  it("never rewards extra misses", () => {
    const clean = calculateJigsawScore("easy", 30_000, 0, PIECES);
    const sloppy = calculateJigsawScore("easy", 30_000, 3, PIECES);
    expect(sloppy).toBe(clean - 45); // 3 × 15
  });

  it("applies the difficulty multiplier", () => {
    const easy = calculateJigsawScore("easy", 20_000, 1, PIECES);
    const medium = calculateJigsawScore("medium", 20_000, 1, PIECES);
    const hard = calculateJigsawScore("hard", 20_000, 1, PIECES);
    const veryHard = calculateJigsawScore("very_hard", 20_000, 1, PIECES);
    expect(medium).toBeGreaterThan(easy);
    expect(hard).toBeGreaterThan(medium);
    expect(veryHard).toBeGreaterThan(hard);
  });

  it("falls back to medium for an unknown difficulty", () => {
    expect(calculateJigsawScore("nonsense", 10_000, 2, PIECES)).toBe(
      calculateJigsawScore("medium", 10_000, 2, PIECES)
    );
  });

  it("floors at 50 × multiplier however bad the run was", () => {
    const awful = calculateJigsawScore("easy", 10_000_000, 9_999, PIECES);
    expect(awful).toBe(50 * DIFFICULTY_CONFIG.easy.pointMultiplier);
  });

  it("never returns a negative score", () => {
    for (const difficulty of Object.keys(DIFFICULTY_CONFIG)) {
      const score = calculateJigsawScore(difficulty, 99_999_999, 500, PIECES);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(score)).toBe(true);
    }
  });

  /* H4 regression: a negative elapsed time used to make `timePenalty` negative,
     which turned the clock into a bonus. Clamping must make -5000 identical to 0. */
  it("treats a negative elapsed time as zero instead of a bonus", () => {
    expect(calculateJigsawScore("easy", -5_000, 0, PIECES)).toBe(
      calculateJigsawScore("easy", 0, 0, PIECES)
    );
    expect(calculateJigsawScore("easy", -5_000, 0, PIECES)).toBeLessThanOrEqual(
      calculateJigsawScore("easy", 0, 0, PIECES)
    );
  });

  it("survives non-finite time and negative inputs without producing NaN", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const score = calculateJigsawScore("medium", bad, 0, PIECES);
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
    }
    // Negative misses and piece counts must not add points either.
    expect(calculateJigsawScore("easy", 0, -4, PIECES)).toBe(
      calculateJigsawScore("easy", 0, 0, PIECES)
    );
    expect(calculateJigsawScore("easy", 0, 0, -4)).toBe(
      calculateJigsawScore("easy", 0, 0, 0)
    );
  });

  it("always returns an integer", () => {
    for (const difficulty of Object.keys(DIFFICULTY_CONFIG)) {
      const score = calculateJigsawScore(difficulty, 12_345, 2, 18);
      expect(Number.isInteger(score)).toBe(true);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   Grid scaling (finding M3)
   The old implementation ignored `level` entirely, so every difficulty shipped
   the same 4×4 board while the UI promised four different sizes.
   ──────────────────────────────────────────────────────────────────────────── */

describe("getLevelGridConfig", () => {
  it("grows the board by one row per level", () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const { cols, rows } = getLevelGridConfig(level);
      expect(cols).toBe(4);
      expect(rows).toBe(level + 2);
    }
  });

  it("keeps the four key slots in the top row and makes the rest quote slots", () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const cfg = getLevelGridConfig(level);
      expect(cfg.keyRowSlots).toBe(cfg.cols);
      expect(cfg.quoteSlots).toBe((cfg.rows - 1) * cfg.cols);
      expect(cfg.totalPieces).toBe(cfg.keyRowSlots + cfg.quoteSlots);
      expect(cfg.totalToPlace).toBe(cfg.totalPieces);
      expect(cfg.numFixedClues).toBe(0);
    }
  });

  it("gets strictly harder as the level rises", () => {
    for (let level = 2; level <= MAX_LEVEL; level++) {
      expect(getLevelGridConfig(level).totalPieces).toBeGreaterThan(
        getLevelGridConfig(level - 1).totalPieces
      );
    }
  });

  it("clamps levels outside 1..MAX_LEVEL instead of returning a broken grid", () => {
    expect(getLevelGridConfig(0)).toEqual(getLevelGridConfig(1));
    expect(getLevelGridConfig(-3)).toEqual(getLevelGridConfig(1));
    expect(getLevelGridConfig(MAX_LEVEL + 5)).toEqual(getLevelGridConfig(MAX_LEVEL));
    expect(getLevelGridConfig(NaN)).toEqual(getLevelGridConfig(1));
  });

  /* The binding invariant. Each column's quote slots are filled from a single
     stage, so a stage with fewer quotes than slots would leave cells that can
     never be filled — an unwinnable puzzle. */
  it("never needs more quotes per column than a stage can supply", () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const { rows } = getLevelGridConfig(level);
      expect(rows - 1).toBeLessThanOrEqual(MIN_QUOTES_PER_STAGE);
    }
    expect(MAX_QUOTE_SLOTS_PER_COLUMN).toBeLessThanOrEqual(MIN_QUOTES_PER_STAGE);
  });

  it("every stage really does hold enough quotes for the tallest grid", () => {
    for (const stage of CREATIVITY_STAGES_BASE) {
      expect(stage.quotes.length).toBeGreaterThanOrEqual(MAX_QUOTE_SLOTS_PER_COLUMN);
    }
  });

  it("every stage holds only unique quotes", () => {
    for (const stage of CREATIVITY_STAGES_BASE) {
      expect(new Set(stage.quotes).size).toBe(stage.quotes.length);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   The live path (finding M3)

   `GameEnhanced` does not call `getLevelGridConfig` directly — it calls
   `getGridConfig(difficulty)`. Testing only the delegate would leave the wiring
   unproven, so assert the function the game actually uses.
   ──────────────────────────────────────────────────────────────────────────── */

describe("getGridConfig (the function the game calls)", () => {
  it("gives each difficulty the grid its description promises", () => {
    expect(getGridConfig("easy")).toMatchObject({ cols: 4, rows: 3 });
    expect(getGridConfig("medium")).toMatchObject({ cols: 4, rows: 4 });
    expect(getGridConfig("hard")).toMatchObject({ cols: 4, rows: 5 });
    expect(getGridConfig("very_hard")).toMatchObject({ cols: 4, rows: 6 });
  });

  it("defaults an unknown difficulty to the medium grid", () => {
    expect(getGridConfig("bogus")).toEqual(getGridConfig("medium"));
  });

  it("produces a board big enough for every key plus its quote slots", () => {
    for (const difficulty of ["easy", "medium", "hard", "very_hard"]) {
      const cfg = getGridConfig(difficulty);
      expect(cfg.totalPieces).toBe(cfg.cols * cfg.rows);
      expect(cfg.totalToPlace).toBe(cfg.totalPieces);
    }
  });
});

describe("difficulty → grid consistency", () => {  /* The descriptions are user-facing promises. If someone retunes the grid and
     forgets the copy, this fails rather than shipping a lie. */
  it("each difficulty description names its real grid size", () => {
    for (const [difficulty, config] of Object.entries(DIFFICULTY_CONFIG)) {
      const level = getLevelFromDifficulty(difficulty);
      const { cols, rows } = getLevelGridConfig(level);
      expect(config.description).toContain(`${cols}×${rows}`);
    }
  });

  it("maps every known difficulty to a distinct level", () => {
    const levels = Object.keys(DIFFICULTY_CONFIG).map(getLevelFromDifficulty);
    expect(new Set(levels).size).toBe(levels.length);
  });

  it("defaults an unknown difficulty to level 2", () => {
    expect(getLevelFromDifficulty("impossible")).toBe(2);
  });

  it("orders the time limits from unlimited down to the strictest", () => {
    const limits = ["easy", "medium", "hard", "very_hard"].map(
      (d) => DIFFICULTY_CONFIG[d].timeLimitSeconds
    );
    expect(limits[0]).toBeNull();
    for (let i = 2; i < limits.length; i++) {
      expect(limits[i]!).toBeLessThan(limits[i - 1]!);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   Decoy pool (finding M4)
   ──────────────────────────────────────────────────────────────────────────── */

describe("getFillerQuotePool", () => {
  const stages: CreativityStage[] = [
    {
      id: "a",
      name: "A",
      quotes: ["a1", "a2", "a3"],
      quote: "a1",
      color: "x",
    },
    {
      id: "b",
      name: "B",
      quotes: ["b1", "b2"],
      quote: "b1",
      color: "y",
    },
  ];

  it("excludes every quote that is already a correct piece", () => {
    const pool = getFillerQuotePool(stages, new Set(["a1", "b1"]));
    expect(pool).toEqual(["a2", "a3", "b2"]);
    expect(pool).not.toContain("a1");
    expect(pool).not.toContain("b1");
  });

  it("returns everything when nothing is claimed", () => {
    expect(getFillerQuotePool(stages, new Set())).toHaveLength(5);
  });

  it("returns nothing when every quote is already in play", () => {
    const all = new Set(stages.flatMap((s) => s.quotes));
    expect(getFillerQuotePool(stages, all)).toEqual([]);
  });

  it("never emits a duplicate decoy from the real stage data", () => {
    const correct = new Set(getRandomizedStages().map((s) => s.quote));
    const pool = getFillerQuotePool(CREATIVITY_STAGES_BASE as CreativityStage[], correct);
    expect(new Set(pool).size).toBe(pool.length);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   Game code
   ──────────────────────────────────────────────────────────────────────────── */

describe("generateGameCode", () => {
  it("always produces six characters", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateGameCode()).toHaveLength(6);
    }
  });

  it("avoids characters that are easy to misread aloud", () => {
    // Students read these out in class: I/1 and O/0 must never appear.
    for (let i = 0; i < 500; i++) {
      expect(generateGameCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it("is not a constant", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateGameCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   Personal quote injection
   ──────────────────────────────────────────────────────────────────────────── */

describe("injectStudentIncubationQuote", () => {
  it("adds the student's answer to the incubation stage and selects it", () => {
    const result = injectStudentIncubationQuote(getRandomizedStages(), "  My big idea  ");
    const incubation = result.find((s) => s.id === "incubation")!;
    expect(incubation.quote).toBe("My big idea");
    expect(incubation.personalQuote).toBe("My big idea");
    expect(incubation.quotes).toContain("My big idea");
  });

  it("leaves the other stages untouched", () => {
    const before = getRandomizedStages();
    const after = injectStudentIncubationQuote(before, "Something new");
    for (const stage of after) {
      if (stage.id === "incubation") continue;
      expect(stage).toEqual(before.find((s) => s.id === stage.id));
    }
  });

  it("is a no-op for blank answers", () => {
    const before = getRandomizedStages();
    expect(injectStudentIncubationQuote(before, "")).toBe(before);
    expect(injectStudentIncubationQuote(before, "   ")).toBe(before);
  });

  it("does not duplicate an answer that is already in the pool", () => {
    const stages = getRandomizedStages();
    const existing = stages.find((s) => s.id === "incubation")!.quotes[0];
    const result = injectStudentIncubationQuote(stages, existing);
    const incubation = result.find((s) => s.id === "incubation")!;
    expect(incubation.quotes.filter((q) => q === existing)).toHaveLength(1);
  });

  it("is skipped entirely by getRandomizedStagesForPlayer when there is no answer", () => {
    expect(getRandomizedStagesForPlayer(null)).toHaveLength(CREATIVITY_STAGES_BASE.length);
    expect(getRandomizedStagesForPlayer(undefined)).toHaveLength(CREATIVITY_STAGES_BASE.length);
    expect(getRandomizedStagesForPlayer("   ")).toHaveLength(CREATIVITY_STAGES_BASE.length);
    expect(getRandomizedStagesForPlayer("A real answer")).toHaveLength(
      CREATIVITY_STAGES_BASE.length
    );
  });
});

describe("getRandomizedStages", () => {
  it("picks one quote per stage from that stage's own pool", () => {
    for (let run = 0; run < 25; run++) {
      const stages = getRandomizedStages();
      expect(stages).toHaveLength(CREATIVITY_STAGES_BASE.length);
      for (const stage of stages) {
        const source = CREATIVITY_STAGES_BASE.find((s) => s.id === stage.id)!;
        expect(source.quotes).toContain(stage.quote);
      }
    }
  });

  it("gives each of the four columns a distinct stage id", () => {
    const ids = getRandomizedStages().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
