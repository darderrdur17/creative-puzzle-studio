import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, Puzzle, Quote } from "lucide-react";
import elephantImg from "@/assets/elephant-jewel-forest.png";
import type { CreativityStage } from "@/lib/gameData";
import {
  getLevelFromDifficulty,
  getLevelGridConfig,
  getFillerQuotePool,
  type LevelGridConfig,
} from "@/lib/gameData";

const KEY_ROW = 0;

export function getGridConfig(difficulty: string): LevelGridConfig {
  const level = getLevelFromDifficulty(difficulty);
  return getLevelGridConfig(level);
}

export interface JigsawPiece {
  id: number;
  row: number;
  col: number;
  placed: boolean;
  statement: string;
  type: "key" | "quote";
  stageId?: string;
  /** Filler pieces are decoys — placing them is always wrong */
  isFiller?: boolean;
}

interface JigsawImagePuzzleProps {
  difficulty: string;
  stages: CreativityStage[];
  onPiecePlaced: () => void;
  onIncorrect: () => void;
  onCompleted: () => void;
  onPhaseComplete?: () => void;
  isPaused?: boolean;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function sampleRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  shuffleArray(copy);
  return copy.slice(0, Math.min(count, copy.length));
}

/** Pick a random quote from a stage's pool — keeps quote matched to its key */
function randomQuoteForStage(stage: CreativityStage): string {
  return stage.quotes[Math.floor(Math.random() * stage.quotes.length)];
}

/** Sample N unique quotes from a stage — ensures no duplicates per column (feedback: no doubles) */
function sampleUniqueQuotesForStage(stage: CreativityStage, count: number): string[] {
  if (count <= 0) return [];
  const { personalQuote } = stage;
  const pool = shuffleArray([...stage.quotes]);
  if (personalQuote && count > 0) {
    const rest = pool.filter((q) => q !== personalQuote);
    return [personalQuote, ...rest.slice(0, count - 1)];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

export function JigsawImagePuzzle({
  difficulty,
  stages,
  onPiecePlaced,
  onIncorrect,
  onCompleted,
  onPhaseComplete,
  isPaused = false,
}: JigsawImagePuzzleProps) {
  const level = getLevelFromDifficulty(difficulty);
  const gridConfig = useMemo(() => getLevelGridConfig(level), [level]);
  const { cols, rows, numFixedClues, totalPieces, quoteSlots } = gridConfig;

  const { pieces, fixedSlots, fixedSlotQuotes, stageOrder } = useMemo(() => {
    // 1. Single source of truth: stageOrder maps column index -> stage index.
    //    Fixed order per Prof Chai: Preparation -> Incubation -> Illumination -> Verification.
    const stageOrder = [0, 1, 2, 3];

    const keyCols = [0, 1, 2, 3];
    const fixed = new Set<string>();
    const allQuoteSlots: [number, number][] = [];
    for (let r = 1; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        allQuoteSlots.push([r, c]);
      }
    }
    const numFixed = Math.min(numFixedClues, allQuoteSlots.length);
    const chosen = sampleRandom(allQuoteSlots, numFixed);
    const fixedSlotQuotes = new Map<string, string>();
    chosen.forEach(([r, c]) => {
      fixed.add(`${r}-${c}`);
      const stage = stages[stageOrder[c]];
      fixedSlotQuotes.set(`${r}-${c}`, randomQuoteForStage(stage));
    });

    // Per-column unique quote counts for non-fixed slots
    const slotsPerCol = new Map<number, [number, number][]>();
    for (const [r, c] of allQuoteSlots) {
      if (fixed.has(`${r}-${c}`)) continue;
      if (!slotsPerCol.has(c)) slotsPerCol.set(c, []);
      slotsPerCol.get(c)!.push([r, c]);
    }

    // 2. Key pieces: each column gets the stage from stageOrder — randomized per game
    const keyPieces: JigsawPiece[] = keyCols.map((c) => {
      const stage = stages[stageOrder[c]];
      return {
        id: c,
        row: KEY_ROW,
        col: c,
        placed: false,
        statement: stage.name,
        type: "key",
        stageId: stage.id,
      };
    });

    // 3. Quote pieces: each column gets N unique quotes (no doubles). Any quote in a column
    //    can go in any row of that column (feedback: flexibility for assessing student knowledge).
    const quotePieces: JigsawPiece[] = [];
    const correctQuotes = new Set<string>();
    let id = cols;
    for (const [c, slots] of slotsPerCol) {
      const stage = stages[stageOrder[c]];
      const uniqueQuotes = sampleUniqueQuotesForStage(stage, slots.length);
      const shuffledSlots = shuffleArray(slots);
      uniqueQuotes.forEach((statement, i) => {
        const [r, col] = shuffledSlots[i] ?? [1, c];
        correctQuotes.add(statement);
        quotePieces.push({
          id: id++,
          row: r,
          col,
          placed: false,
          statement,
          type: "quote",
          stageId: stage.id,
        });
      });
    }

    // 4. Filler decoys: wrong quotes (exclude correct ones so decoys never match)
    const fillerPool = getFillerQuotePool(stages, correctQuotes);
    const numFiller = Math.max(0, (level - 2) * 2);
    const fillerQuotes = sampleRandom(fillerPool, numFiller);
    fillerQuotes.forEach((q) => {
      quotePieces.push({
        id: id++,
        row: -1,
        col: -1,
        placed: false,
        statement: q,
        type: "quote",
        isFiller: true,
      });
    });

    // 5. Randomize tray order: keys and quotes shuffled so player must match by content
    return {
      pieces: [...shuffleArray(keyPieces), ...shuffleArray(quotePieces)],
      fixedSlots: fixed,
      fixedSlotQuotes,
      stageOrder,
    };
  }, [level, rows, cols, numFixedClues, stages]);

  const [piecesState, setPiecesState] = useState(pieces);
  const [phase, setPhase] = useState<1 | 2>(1);
  const [phaseTransition, setPhaseTransition] = useState(false);
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: "correct" | "incorrect"; row: number; col: number } | null>(null);
  const [isTrayExpanded, setIsTrayExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mq.matches);
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const [lastPlacedCell, setLastPlacedCell] = useState<string | null>(null);
  const completedRef = useRef(false);

  const keyPieces = piecesState.filter((p) => p.type === "key");
  const quotePieces = piecesState.filter((p) => p.type === "quote" && !p.isFiller);
  const keysPlaced = keyPieces.filter((p) => p.placed).length;
  const quotesToPlace = quoteSlots - numFixedClues;
  const quotesPlaced = quotePieces.filter((p) => p.placed).length;

  const unplaced =
    phase === 1
      ? piecesState.filter((p) => p.type === "key" && !p.placed)
      : piecesState.filter((p) => p.type === "quote" && !p.placed);

  const totalToPlace = 4 + quotesToPlace;
  const placedCount = phase === 1 ? keysPlaced : keysPlaced + quotesPlaced;
  const progress = totalToPlace > 0 ? (placedCount / totalToPlace) * 100 : 0;

  useEffect(() => {
    if (phase !== 1 || keysPlaced < 4) return;
    setPhaseTransition(true);
    onPhaseComplete?.();
    const t = setTimeout(() => {
      setPhase(2);
      setPhaseTransition(false);
    }, 2200);
    return () => clearTimeout(t);
  }, [phase, keysPlaced, onPhaseComplete]);

  const getPieceImageStyle = useCallback(
    (row: number, col: number): React.CSSProperties => ({
      backgroundImage: `url(${elephantImg})`,
      backgroundSize: `${cols * 100}% ${rows * 100}%`,
      backgroundPosition:
        `${(col / Math.max(1, cols - 1)) * 100}% ` +
        `${(row / Math.max(1, rows - 1)) * 100}%`,
      backgroundRepeat: "no-repeat",
    }),
    [cols, rows],
  );

  const vibrate = useCallback((pattern: number | number[]) => {
    try {
      navigator?.vibrate?.(pattern);
    } catch {
      /* no-op */
    }
  }, []);

  const handlePieceSelect = useCallback(
    (pieceId: number) => {
      if (isPaused) return;
      vibrate(10);
      setSelectedPieceId((prev) => (prev === pieceId ? null : pieceId));
    },
    [isPaused, vibrate],
  );

  const handleCellTap = useCallback(
    (cellRow: number, cellCol: number) => {
      if (isPaused || selectedPieceId === null) return;

      const piece = piecesState.find((p) => p.id === selectedPieceId);
      if (!piece || piece.placed) return;

      if (phase === 1 && cellRow !== KEY_ROW) return;
      if (phase === 2 && cellRow === KEY_ROW) return;
      if (phase === 2 && fixedSlots.has(`${cellRow}-${cellCol}`)) return;

      const alreadyPlaced = piecesState.some(
        (p) => p.row === cellRow && p.col === cellCol && p.placed,
      );
      if (alreadyPlaced) return;

      const isFiller = piece.isFiller === true;

      let correct = false;
      if (!isFiller) {
        if (phase === 1 && piece.type === "key") {
          // Keys: must match the correct column in the top row
          correct = cellRow === KEY_ROW && piece.col === cellCol;
        } else if (phase === 2 && piece.type === "quote" && piece.stageId) {
          // Quotes: any row in the correct column is valid, as long as the stage matches.
          const stageIdx = stageOrder[cellCol];
          const targetStage = stages[stageIdx];
          correct = !!targetStage && targetStage.id === piece.stageId;
        }
      }

      if (correct) {
        vibrate([20, 50, 20]);
        setFeedback({ type: "correct", row: cellRow, col: cellCol });
        setLastPlacedCell(`${cellRow}-${cellCol}`);
        setPiecesState((prev) =>
          prev.map((p) =>
            p.id === selectedPieceId ? { ...p, placed: true, row: cellRow, col: cellCol } : p,
          ),
        );
        setSelectedPieceId(null);
        onPiecePlaced();

        const newQuotesPlaced = phase === 2 ? quotesPlaced + 1 : quotesPlaced;
        if (phase === 2 && newQuotesPlaced >= quotesToPlace && !completedRef.current) {
          completedRef.current = true;
          setTimeout(() => onCompleted(), 700);
        }
        setTimeout(() => setFeedback(null), 800);
      } else {
        vibrate([50, 30, 50]);
        setFeedback({ type: "incorrect", row: cellRow, col: cellCol });
        setSelectedPieceId(null);
        onIncorrect();
        setTimeout(() => setFeedback(null), 500);
      }
    },
    [
      isPaused,
      selectedPieceId,
      piecesState,
      phase,
      quotesPlaced,
      quotesToPlace,
      fixedSlots,
      onPiecePlaced,
      onIncorrect,
      onCompleted,
      vibrate,
    ],
  );

  const allComplete = keysPlaced === 4 && quotesPlaced >= quotesToPlace;

  const isCellActive = (cellRow: number, cellCol: number) => {
    if (phase === 1) return cellRow === KEY_ROW;
    if (cellRow === KEY_ROW) return false;
    return !fixedSlots.has(`${cellRow}-${cellCol}`);
  };

  const isCellFixed = (cellRow: number, cellCol: number) =>
    cellRow > KEY_ROW && fixedSlots.has(`${cellRow}-${cellCol}`);

  const getCellLabel = (cellRow: number, cellCol: number) => {
    if (cellRow === KEY_ROW) return `Key slot ${cellCol + 1}`;
    return `Quote slot ${cellCol + 1}`;
  };

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-4 lg:gap-6 w-full max-w-5xl mx-auto px-2 sm:px-4 pb-4">
      {/* On mobile: tray first (above board) so quotes are visible without scrolling; desktop: board left, tray right */}
      <div className="flex-1 flex flex-col items-center order-2 lg:order-1">
        <div
          className="jigsaw-board relative w-full rounded-xl border-2 border-explorer-gold/40 shadow-xl overflow-hidden bg-explorer-dark/5 touch-manipulation select-none min-h-[200px]"
          style={{ maxWidth: 640, aspectRatio: `${cols}/${rows}` }}
        >
          {/* Faded background elephant: shows the full puzzle image without giving away individual pieces */}
          <img
            src={elephantImg}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-center rounded-xl pointer-events-none opacity-[0.13]"
            draggable={false}
            decoding="async"
            aria-hidden
          />

          <div className="absolute top-1 left-1 z-10 flex flex-col gap-1 text-[9px] font-semibold text-white/80 drop-shadow-sm pointer-events-none">
            <span>{phase === 1 ? "1. Main keys" : "✓ Main keys"}</span>
            <span>
            {phase === 2 ? "2. Quotes" : "Quotes"}
            </span>
          </div>

          <div
            className="absolute inset-0 grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`,
              gap: "2px",
            }}
          >
            {Array.from({ length: rows * cols }, (_, i) => {
              const r = Math.floor(i / cols);
              const c = i % cols;
              const fixed = isCellFixed(r, c);
              const pieceAtCell = piecesState.find(
                (p) => p.row === r && p.col === c && (p.placed || fixed),
              );
              const isPlaced = !!pieceAtCell || fixed;
              const isFb = feedback?.row === r && feedback?.col === c;
              const isCorrectFb = isFb && feedback?.type === "correct";
              const isIncorrectFb = isFb && feedback?.type === "incorrect";
              const hasSelection = selectedPieceId !== null;
              const wasJustPlaced = lastPlacedCell === `${r}-${c}`;
              const active = isCellActive(r, c);

              const displayStatement = fixed
                ? fixedSlotQuotes?.get(`${r}-${c}`) ?? stages[stageOrder?.[c] ?? c]?.quote
                : pieceAtCell?.statement;

              return (
                <motion.button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => handleCellTap(r, c)}
                  disabled={isPlaced || isPaused || !active}
                  className={[
                    "relative w-full h-full outline-none touch-manipulation transition-all duration-200 flex flex-col",
                    isPlaced ? "cursor-default" : active && hasSelection ? "cursor-pointer" : "cursor-default",
                    !active && !isPlaced ? "opacity-60" : "",
                    fixed ? "ring-2 ring-success/40" : "",
                    isIncorrectFb ? "animate-shake" : "",
                    isCorrectFb ? "animate-glow-correct" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={
                    isPlaced || fixed
                      ? getPieceImageStyle(r, c)
                      : undefined
                  }
                  whileTap={
                    !isPlaced && active && hasSelection ? { scale: 0.93 } : {}
                  }
                  aria-label={
                    isPlaced || fixed
                      ? `Placed: ${displayStatement ?? ""}`
                      : getCellLabel(r, c)
                  }
                >
                  {!isPlaced && !fixed && (
                    <div
                      className={[
                        "absolute inset-0 border transition-all duration-200 rounded-sm",
                        active && hasSelection
                          ? "border-explorer-gold/50 bg-explorer-gold/8"
                          : "border-white/15 bg-black/5",
                      ].join(" ")}
                    />
                  )}

                  {(isPlaced || fixed) && displayStatement && (
                    <div className="absolute inset-0 jigsaw-piece-statement rounded-sm flex items-center justify-center px-1 text-center overflow-y-auto">
                      <span
                        className={[
                          r === KEY_ROW ? "line-clamp-1" : "line-clamp-none",
                          "text-white pointer-events-none block",
                          "text-[8px] min-[380px]:text-[9px] sm:text-[10px]",
                          r === KEY_ROW ? "key-text" : "quote-text",
                        ].join(" ")}
                      >
                        {displayStatement}
                      </span>
                      {fixed && (
                        <span className="absolute top-0.5 right-1 text-[7px] text-success font-bold">
                          ✓
                        </span>
                      )}
                    </div>
                  )}

                  {!isPlaced && !fixed && active && hasSelection && (
                    <motion.div
                      className="absolute inset-[2px] border-2 border-dashed border-explorer-gold/50 rounded-sm pointer-events-none"
                      animate={{ opacity: [0.3, 0.7, 0.3] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  )}

                  {isPlaced && !fixed && wasJustPlaced && (
                    <motion.div
                      initial={{ opacity: 0.6, scale: 1.15 }}
                      animate={{ opacity: 0, scale: 1.4 }}
                      transition={{ duration: 0.6 }}
                      className="absolute inset-0 rounded-sm border-2 border-explorer-gold pointer-events-none"
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          <div className="absolute inset-0 pointer-events-none rounded-xl border-2 border-explorer-gold/50" />

          <AnimatePresence>
            {phaseTransition && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl z-20"
              >
                <motion.div
                  initial={{ scale: 0.8, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 120, damping: 14 }}
                  className="text-center px-6 py-5 rounded-2xl glass shadow-glow-gold"
                >
                  <p className="font-display text-xl sm:text-2xl font-bold text-white drop-shadow-lg mb-1">
                    Main keys complete!
                  </p>
                  <p className="text-white/80 text-sm">
                    Now place each quote under its matching key.
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {allComplete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/20 backdrop-blur-[2px] pointer-events-none z-20"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 120,
                    damping: 14,
                    delay: 0.2,
                  }}
                  className="text-center px-6 py-5 rounded-2xl glass shadow-glow-gold"
                >
                  <motion.div
                    animate={{ rotate: [0, -8, 8, -4, 0] }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    className="text-5xl mb-2"
                  >
                    🧩
                  </motion.div>
                  <p className="font-display text-2xl font-bold text-white drop-shadow-lg mb-1">
                    Puzzle Complete!
                  </p>
                  <p className="text-white/80 text-sm">
                    All {totalToPlace} pieces placed
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-full mt-3 px-1" style={{ maxWidth: 640 }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">
              {phase === 1 ? "Main keys" : "Quotes"} · {placedCount}/{totalToPlace}
            </span>
            <span className="text-xs font-bold text-explorer-gold">
              {placedCount}/{totalToPlace}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-explorer-gold to-explorer-ocean"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      <div className="w-full lg:w-80 flex flex-col order-1 lg:order-2">
        <button
          type="button"
          onClick={() => !isMobile && setIsTrayExpanded((prev) => !prev)}
          aria-expanded={isTrayExpanded || isMobile}
          aria-controls="jigsaw-tray-content"
          className={[
            "jigsaw-tray-toggle w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 min-h-[44px]",
            "bg-gradient-to-r from-explorer-gold/15 to-explorer-parchment border border-explorer-gold/25",
            "lg:bg-transparent lg:border-none lg:p-0",
          ].join(" ")}
        >
          <h3 className="flex items-center gap-2 font-display text-sm font-bold sm:text-base">
            {phase === 1 ? (
              <Puzzle className="h-5 w-5 text-explorer-gold" />
            ) : (
              <Quote className="h-5 w-5 text-explorer-gold" />
            )}
            {phase === 1 ? "Main keys" : "Quotes"}
            <span className="ml-2 rounded-full bg-explorer-gold/20 px-2 py-0.5 text-[10px] font-semibold text-explorer-dark sm:text-xs">
              {unplaced.length} left
            </span>
          </h3>
          {/* On mobile, tray is always expanded — no collapse to avoid extra taps */}
          <div className={isMobile ? "hidden" : "lg:hidden"}>
            {isTrayExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </div>
        </button>

        <AnimatePresence>
          {(isTrayExpanded || isMobile) && (
            <motion.div
              id="jigsaw-tray-content"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="text-[10px] text-muted-foreground mt-2 mb-3 px-1 sm:text-xs italic">
                {phase === 1
                  ? "Place each main key (Preparation, Incubation, Illumination, Verification) in the top row."
                  : `Place each quote under its matching key. Level ${level}: ${rows}×${cols} grid.`}
              </p>

              <div className="jigsaw-tray-grid grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2 sm:gap-2.5 overflow-y-auto lg:max-h-[calc(100vh-16rem)] pr-0.5 pb-4">
                <AnimatePresence mode="popLayout">
                  {unplaced.map((piece) => {
                    const isSelected = selectedPieceId === piece.id;
                    return (
                      <motion.button
                        key={piece.id}
                        layout
                        initial={{ opacity: 0, scale: 0.7, rotate: -4 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.4, rotate: 6 }}
                        transition={{
                          type: "spring",
                          stiffness: 280,
                          damping: 22,
                        }}
                        type="button"
                        onClick={() => handlePieceSelect(piece.id)}
                        className={[
                          "jigsaw-tray-piece relative aspect-auto sm:aspect-[4/3] lg:aspect-square cursor-pointer select-none rounded-lg border-2 transition-all duration-200",
                          "min-h-[64px] touch-manipulation active:scale-95",
                          "bg-gradient-to-br from-explorer-dark/40 to-explorer-ocean/20",
                          isSelected
                            ? "border-explorer-gold ring-2 ring-explorer-gold/50 ring-offset-2 scale-[1.08] shadow-glow-gold z-10"
                            : "border-explorer-gold/30 shadow-card",
                          piece.isFiller ? "opacity-90" : "",
                        ].join(" ")}
                        aria-pressed={isSelected}
                        aria-label={`${piece.type === "key" ? "Key" : piece.isFiller ? "Decoy" : "Quote"}: ${piece.statement}`}
                      >
                        <div className="absolute inset-0 jigsaw-piece-statement rounded-md flex items-center justify-center px-2 text-center overflow-y-auto">
                          {piece.isFiller && (
                            <span className="absolute top-0.5 right-1.5 text-[8px] text-amber-400 font-bold">
                              ?
                            </span>
                          )}
                          <span
                            className={[
                              "text-white pointer-events-none",
                              "text-[10px] sm:text-[10px]",
                              piece.type === "key" ? "key-text line-clamp-1" : "quote-text line-clamp-none",
                            ].join(" ")}
                          >
                            {piece.statement}
                          </span>
                        </div>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-explorer-gold text-[9px] text-white shadow-sm font-bold z-10"
                          >
                            ✓
                          </motion.div>
                        )}
                        {isSelected && (
                          <motion.div
                            className="absolute inset-0 rounded-lg border-2 border-explorer-gold pointer-events-none"
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 1.2, repeat: Infinity }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </AnimatePresence>

                {unplaced.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="col-span-full py-6 text-center text-sm text-muted-foreground"
                  >
                    <span className="text-3xl block mb-2">
                      {phase === 2 ? "🎉" : "👉"}
                    </span>
                    {phase === 2
                      ? "All pieces placed!"
                      : "Place keys to continue…"}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
