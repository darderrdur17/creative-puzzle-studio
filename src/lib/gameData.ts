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

export const CREATIVITY_STAGES_BASE: Omit<CreativityStage, "quote">[] = [
  {
    id: "preparation",
    name: "Preparation",
    quotes: [
      "Chance favors only the prepared mind. — Louis Pasteur",
      "Give me six hours to chop down a tree and I will spend the first four sharpening the axe. — Abraham Lincoln",
      "Before anything else, preparation is the key to success. — Alexander Graham Bell",
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
 * Build a flat array of statements (one per grid cell) for the jigsaw puzzle.
 * Divides the grid into 4 regions (quadrants), randomly assigns each region a creativity stage,
 * and assigns each cell either the stage name or quote. Ensures randomized layout per game.
 */
export function getStatementsForGrid(
  rows: number,
  cols: number,
  stages: CreativityStage[],
): string[] {
  const total = rows * cols;
  const out: string[] = new Array(total);

  // Region index: 0 = top-left, 1 = top-right, 2 = bottom-left, 3 = bottom-right
  const getRegion = (r: number, c: number) => {
    const rMid = rows / 2;
    const cMid = cols / 2;
    const top = r < rMid ? 0 : 2;
    const left = c < cMid ? 0 : 1;
    return top + left;
  };

  // Shuffle stage indices so each region gets a random stage (randomized layout)
  const indices = [0, 1, 2, 3];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const region = getRegion(r, c);
      const stage = stages[indices[region]];
      const useQuote = Math.random() < 0.5;
      out[r * cols + c] = useQuote ? stage.quote : stage.name;
    }
  }

  return out;
}

// Default export for backward compat — randomized once on import
export const CREATIVITY_STAGES: CreativityStage[] = getRandomizedStages();

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
 * Grid scaling: Level 1 = 4×2, Level 2 = 4×3, Level 3 = 4×4, Level 4+ = 4×5.
 * No pre-filled slots — all pieces start in the tray for the player to place.
 * 4 main keys (Preparation, Incubation, Illumination, Verification) are always present.
 */
export function getLevelGridConfig(level: number): LevelGridConfig {
  const lvl = Math.max(1, Math.min(level, 5));
  // Minimum 12 quotes for symmetry (feedback: 8 was unreasonable). All levels: 4×4 grid (12 quotes).
  const rows = 4;
  const cols = 4; // always 4 for the 4 main keys
  const keyRowSlots = cols;
  const quoteSlots = (rows - 1) * cols;
  const numFixedClues = 0; // All pieces start in tray — player places everything
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
    description: "No time limit, relaxed gameplay",
    timeLimitSeconds: null,
    pointMultiplier: 1,
    basePoints: 100,
  },
  medium: {
    label: "Medium",
    description: "5 minute time limit",
    timeLimitSeconds: 300,
    pointMultiplier: 1.5,
    basePoints: 100,
  },
  hard: {
    label: "Hard",
    description: "3 minute time limit",
    timeLimitSeconds: 180,
    pointMultiplier: 2,
    basePoints: 100,
  },
  very_hard: {
    label: "Very Hard",
    description: "90 second time limit",
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
  const timePenalty = Math.floor(elapsedMs / 1000) * 2;
  const accuracyPenalty = incorrectAttempts * 25;
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
  const base = totalPieces * 40;
  const timePenalty = Math.floor(elapsedMs / 1000);
  const accuracyPenalty = incorrectAttempts * 15;
  const raw = Math.max(base - timePenalty - accuracyPenalty, 50);
  return Math.round(raw * config.pointMultiplier);
}



export const stageColors: Record<string, { bg: string; border: string; text: string }> = {
  preparation:  { bg: "bg-stage-preparation",  border: "border-stage-preparation",  text: "text-white" },
  incubation:   { bg: "bg-stage-incubation",   border: "border-stage-incubation",   text: "text-white" },
  illumination: { bg: "bg-stage-illumination", border: "border-stage-illumination", text: "text-white" },
  verification: { bg: "bg-stage-verification", border: "border-stage-verification", text: "text-white" },
};

export const stageColorMap: Record<string, string> = {
  preparation:  "border-stage-preparation  bg-stage-preparation/10  hover:bg-stage-preparation/25",
  incubation:   "border-stage-incubation   bg-stage-incubation/10   hover:bg-stage-incubation/25",
  illumination: "border-stage-illumination bg-stage-illumination/10 hover:bg-stage-illumination/25",
  verification: "border-stage-verification   bg-stage-verification/10   hover:bg-stage-verification/25",
};

export const stageSelectedMap: Record<string, string> = {
  preparation:  "border-stage-preparation  bg-stage-preparation/25  ring-stage-preparation/40",
  incubation:   "border-stage-incubation   bg-stage-incubation/25   ring-stage-incubation/40",
  illumination: "border-stage-illumination bg-stage-illumination/25 ring-stage-illumination/40",
  verification: "border-stage-verification   bg-stage-verification/25   ring-stage-verification/40",
};

export const stageIconMap: Record<string, string> = {
  preparation:  "💡",
  incubation:   "⏳",
  illumination: "✨",
  verification: "✅",
};
