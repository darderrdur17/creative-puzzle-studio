// The 5 stages of the creative process and their matching quotes
export interface CreativityStage {
  id: string;
  name: string;
  quotes: string[]; // Multiple quotes for randomization
  quote: string;    // The selected quote for this game session
  color: string;
  /** Student's answer from onboarding — always included as an incubation quote piece */
  personalQuote?: string;
}

/**
 * Every stage needs at least as many quotes as the tallest grid has quote slots
 * per column (see MAX_QUOTE_SLOTS_PER_COLUMN). If a stage ran short, some cells
 * could never be filled and the puzzle would become unwinnable, so the invariant
 * is asserted in gameData.test.ts rather than left to chance.
 */
export const CREATIVITY_STAGES_BASE: Omit<CreativityStage, "quote">[] = [
  {
    id: "preparation",
    name: "Preparation",
    quotes: [
      "Chance favors only the prepared mind. — Louis Pasteur",
      "Give me six hours to chop down a tree and I will spend the first four sharpening the axe. — Abraham Lincoln",
      "Before anything else, preparation is the key to success. — Alexander Graham Bell",
      "You have to learn the rules of the game. And then you have to play better than anyone else. — Albert Einstein",
      "I'm a great believer in luck, and I find the harder I work the more I have of it. — Thomas Jefferson",
      "Success is where preparation and opportunity meet. — Bobby Unser",
    ],
    color: "stage-preparation",
  },
  {
    id: "incubation",
    name: "Incubation",
    quotes: [
      "You can't force creativity; sometimes you just have to let it happen. — Maya Angelou",
      "My best ideas usually come to me when I am stuck in traffic on my way to work along Clementi Road. — Chai Kah Hin",
      "The idea came into my mind during a walk... the whole thing was arranged in my mind. — James Watt",
      "All truly great thoughts are conceived by walking. — Friedrich Nietzsche",
      "There is no such thing as a logical method of having new ideas. — Karl Popper",
      "Creativity is the residue of time wasted. — Albert Einstein",
    ],
    color: "stage-incubation",
  },
  {
    id: "illumination",
    name: "Illumination",
    quotes: [
      "Eureka! I have found it. — Archimedes",
      "The idea came like a flash of lightning, and in an instant the truth was revealed. — Nikola Tesla",
      "The sudden illumination is only the result of long unconscious work. — Henri Poincaré",
      "I can remember the very spot in the road, whilst in my carriage, when to my joy the solution occurred to me. — Charles Darwin",
      "There comes a leap in consciousness, call it intuition or what you will. — Albert Einstein",
      "Suddenly the whole thing was clear to me. — August Kekulé",
    ],
    color: "stage-illumination",
  },
  {
    id: "verification",
    name: "Verification",
    quotes: [
      "The proof of the pudding is in the eating. — proverb",
      "Ideas are easy. Implementation is hard. — Guy Kawasaki",
      "Genius is 1% inspiration and 99% perspiration. — Thomas Edison",
      "However beautiful the strategy, you should occasionally look at the results. — Winston Churchill",
      "Trust, but verify. — proverb",
      "The first principle is that you must not fool yourself — and you are the easiest person to fool. — Richard Feynman",
    ],
    color: "stage-verification",
  },
];

// Generate randomized stages with one quote each
export function getRandomizedStages(): CreativityStage[] {
  return CREATIVITY_STAGES_BASE.map((stage) => ({
    ...stage,
    quote: stage.quotes[Math.floor(Math.random() * stage.quotes.length)],
  }));
}

/** Add the student's "best ideas" answer as a guaranteed incubation puzzle quote */
export function injectStudentIncubationQuote(
  stages: CreativityStage[],
  studentAnswer: string,
): CreativityStage[] {
  const personalQuote = studentAnswer.trim();
  if (!personalQuote) return stages;

  return stages.map((stage) => {
    if (stage.id !== "incubation") return stage;
    const quotes = stage.quotes.includes(personalQuote)
      ? stage.quotes
      : [...stage.quotes, personalQuote];
    return {
      ...stage,
      quotes,
      quote: personalQuote,
      personalQuote,
    };
  });
}

export function getRandomizedStagesForPlayer(studentAnswer?: string | null): CreativityStage[] {
  const base = getRandomizedStages();
  if (!studentAnswer?.trim()) return base;
  return injectStudentIncubationQuote(base, studentAnswer);
}

/**
 * Difficulty scaling: map session difficulty to level (1–4).
 * Level drives grid size.
 */
export function getLevelFromDifficulty(difficulty: string): number {
  const map: Record<string, number> = { easy: 1, medium: 2, hard: 3, very_hard: 4 };
  return map[difficulty] ?? 2;
}

export interface LevelGridConfig {
  cols: number;
  rows: number;
  numFixedClues: number;
  totalPieces: number;
  /** Pieces the player must place */
  totalToPlace: number;
  keyRowSlots: number;
  quoteSlots: number;
}

/**
 * Grid scaling: Level 1 = 4×3, Level 2 = 4×4, Level 3 = 4×5, Level 4 = 4×6.
 * The top row always holds the 4 main keys (one per column); every row below it
 * is a quote slot, so `rows - 1` quotes are needed per column.
 *
 * Invariant: `rows - 1 <= MIN_QUOTES_PER_STAGE`. Each column draws all of its
 * quotes from a single stage, so a stage with fewer quotes than there are slots
 * would leave cells that can never be filled — an unwinnable puzzle. The quote
 * pool is sized to satisfy this (see CREATIVITY_STAGES_BASE) and the invariant is
 * asserted in gameData.test.ts.
 */
export const MAX_LEVEL = 4;
export const MIN_QUOTES_PER_STAGE = 6;
/** Tallest grid's quote slots per column — the binding constraint on the pool size. */
export const MAX_QUOTE_SLOTS_PER_COLUMN = MAX_LEVEL + 2 - 1;

export function getLevelGridConfig(level: number): LevelGridConfig {
  /* `Math.max(1, Math.min(NaN, MAX_LEVEL))` is NaN, so a non-finite level would
     propagate into `rows` and produce a NaN×NaN board. Sanitise first, then clamp. */
  const lvl = Number.isFinite(level)
    ? Math.max(1, Math.min(Math.round(level), MAX_LEVEL))
    : 1;
  const cols = 4; // always 4 — one column per creativity stage
  const rows = lvl + 2; // 3, 4, 5, 6
  const keyRowSlots = cols;
  const quoteSlots = (rows - 1) * cols;
  const numFixedClues = 0; // every piece starts in the tray
  const totalPieces = keyRowSlots + quoteSlots;
  const totalToPlace = keyRowSlots + quoteSlots;
  return { cols, rows, numFixedClues, totalPieces, totalToPlace, keyRowSlots, quoteSlots };
}

/**
 * Build a pool of "filler" quotes for decoy pieces.
 * Excludes any quotes that are used as correct pieces in this game.
 */
export function getFillerQuotePool(stages: CreativityStage[], correctQuotes: Set<string>): string[] {
  const pool: string[] = [];
  for (const s of stages) {
    for (const q of s.quotes) {
      if (!correctQuotes.has(q)) pool.push(q);
    }
  }
  return pool;
}

// Difficulty settings
export interface DifficultyConfig {
  label: string;
  description: string;
  timeLimitSeconds: number | null;
  pointMultiplier: number;
  basePoints: number;
}

export const DIFFICULTY_CONFIG: Record<string, DifficultyConfig> = {
  easy: {
    label: "Easy",
    description: "4×3 grid · no time limit",
    timeLimitSeconds: null,
    pointMultiplier: 1,
    basePoints: 100,
  },
  medium: {
    label: "Medium",
    description: "4×4 grid · 5 minute limit",
    timeLimitSeconds: 300,
    pointMultiplier: 1.5,
    basePoints: 100,
  },
  hard: {
    label: "Hard",
    description: "4×5 grid · 3 minute limit",
    timeLimitSeconds: 180,
    pointMultiplier: 2,
    basePoints: 100,
  },
  very_hard: {
    label: "Very Hard",
    description: "4×6 grid · 90 second limit",
    timeLimitSeconds: 90,
    pointMultiplier: 3,
    basePoints: 100,
  },
};

export function generateGameCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function calculateScore(
  difficulty: string,
  elapsedMs: number,
  incorrectAttempts: number
): number {
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
  const base = config.basePoints * 4; // 4 stages + 4 quotes = 8 placements
  const timePenalty = Math.floor(sanitizeMs(elapsedMs) / 1000) * 2;
  const accuracyPenalty = Math.max(0, incorrectAttempts) * 25;
  const raw = Math.max(base - timePenalty - accuracyPenalty, 50);
  return Math.round(raw * config.pointMultiplier);
}

export function calculateJigsawScore(
  difficulty: string,
  elapsedMs: number,
  incorrectAttempts: number,
  totalPieces: number,
): number {
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
  const base = Math.max(0, totalPieces) * 40;
  const timePenalty = Math.floor(sanitizeMs(elapsedMs) / 1000);
  const accuracyPenalty = Math.max(0, incorrectAttempts) * 15;
  const raw = Math.max(base - timePenalty - accuracyPenalty, 50);
  return Math.round(raw * config.pointMultiplier);
}

/**
 * Guard against a negative or non-finite elapsed time. A negative value would
 * turn the time penalty into a bonus, so it must never reach the score maths.
 */
function sanitizeMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return ms;
}
