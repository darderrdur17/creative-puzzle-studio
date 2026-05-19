import { useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { CreativityStage, stageColors } from "@/lib/gameData";
import puzzleBgImg from "@/assets/elephant-jewel-forest.png";
import { SparkleEffect } from "./SparkleEffect";

interface PuzzlePiece {
  id: string;
  stageId: string;
  type: "stage" | "quote";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  filled: boolean;
  label: string;
}

interface JigsawPuzzleBoardProps {
  phase: 1 | 2;
  stages: CreativityStage[];
  pieces: PuzzlePiece[];
  feedback: { type: "correct" | "incorrect"; slotId: string } | null;
  onSlotTap: (slotId: string, stageId: string, slotType: "stage" | "quote") => void;
  onDrop: (slotId: string, stageId: string, slotType: "stage" | "quote") => void;
  selectedPiece: string | null;
  completed?: boolean;
  /** 0–4 for phase 1 (stage slots filled), 0–4 for phase 2 (quote slots filled) */
  placedCount?: number;
}

// Slot layout for the puzzle board - positioned on the elephant (4 stages)
const SLOT_LAYOUT: Record<
  string,
  { stage: { top: string; left: string; width: string }; quote: { top: string; left: string; width: string } }
> = {
  preparation:  { stage: { top: "25%", left: "10%", width: "16%" }, quote: { top: "36%", left: "8%",  width: "22%" } },
  incubation:   { stage: { top: "22%", left: "29%", width: "16%" }, quote: { top: "33%", left: "27%", width: "22%" } },
  illumination: { stage: { top: "20%", left: "45%", width: "16%" }, quote: { top: "31%", left: "43%", width: "22%" } },
  verification: { stage: { top: "18%", left: "63%", width: "16%" }, quote: { top: "29%", left: "61%", width: "22%" } },
};

const slotPositions: Record<string, { top: string; left: string; width: string }> = Object.fromEntries(
  Object.entries(SLOT_LAYOUT).map(([id, layout]) => [id, layout.stage])
);

const quotePositions: Record<string, { top: string; left: string; width: string }> = Object.fromEntries(
  Object.entries(SLOT_LAYOUT).map(([id, layout]) => [id, layout.quote])
);

// Jigsaw outline shape for slots
const jigsawClip =
  "polygon(8% 0%, 36% 0%, 38% 5%, 50% 8%, 62% 5%, 64% 0%, 92% 0%, 100% 8%, 100% 36%, 105% 38%, 108% 50%, 105% 62%, 100% 64%, 100% 92%, 92% 100%, 64% 100%, 62% 95%, 50% 92%, 38% 95%, 36% 100%, 8% 100%, 0% 92%, 0% 64%, -5% 62%, -8% 50%, -5% 38%, 0% 36%, 0% 8%)";

const PHASE_LABELS = ["Stage Names", "Quotes"] as const;

export function JigsawPuzzleBoard({
  phase,
  stages,
  pieces,
  feedback,
  onSlotTap,
  onDrop,
  selectedPiece,
  completed,
  placedCount = 0,
}: JigsawPuzzleBoardProps) {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-elephant-board]")) {
        e.preventDefault();
      }
    };
    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const phaseProgress = phase === 1 ? placedCount / 4 : (4 + placedCount) / 8;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-2">
      {/* Phase progress tracker */}
      <div className="flex items-center justify-between px-1">
        <div className="phase-indicator">
          {PHASE_LABELS.map((label, idx) => {
            const phaseNum = (idx + 1) as 1 | 2;
            const isActive = phase === phaseNum && !completed;
            const isCompleted = phase > phaseNum || completed;
            return (
              <div key={label} className="flex items-center gap-1">
                <div className="flex flex-col items-center gap-0.5">
                  <div
                    className={[
                      "phase-step",
                      isCompleted ? "phase-step-completed" : isActive ? "phase-step-active" : "phase-step-inactive",
                    ].join(" ")}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {isCompleted ? "✓" : phaseNum}
                  </div>
                  <span className="text-[9px] font-medium text-muted-foreground hidden sm:block">{label}</span>
                </div>
                {idx < PHASE_LABELS.length - 1 && (
                  <div
                    className={[
                      "phase-connector mb-3",
                      phase > phaseNum || completed ? "phase-connector-done" : "phase-connector-pending",
                    ].join(" ")}
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Mini progress */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end gap-0.5">
            <span className="text-[10px] font-semibold text-muted-foreground">
              {Math.round(phaseProgress * 100)}% complete
            </span>
            <div className="xp-bar w-24">
              <motion.div
                className="xp-fill"
                initial={{ width: 0 }}
                animate={{ width: `${phaseProgress * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Board */}
      <div
        className="relative mx-auto aspect-[4/3] w-full overflow-visible rounded-xl border-2 border-explorer-gold/30 shadow-xl touch-manipulation bg-explorer parchment-overlay"
        data-elephant-board
      >
        {/* Puzzle background image */}
        <img
          src={puzzleBgImg}
          alt="Creativity Elephant Puzzle"
          className="h-full w-full object-cover object-center rounded-xl transition-all duration-700"
          decoding="async"
          draggable={false}
        />

        {/* Subtle overlay for slot contrast */}
        {!completed && <div className="absolute inset-0 rounded-xl bg-black/5 pointer-events-none" />}

        {/* Animated grid pattern overlay */}
        {!completed && (
          <div className="absolute inset-0 rounded-xl opacity-[0.03] pointer-events-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        )}

        {/* Slot layer */}
        <div className="absolute inset-0">
          {stages.map((stage, i) => {
            const stageSlot = pieces.find((p) => p.stageId === stage.id && p.type === "stage");
            const quoteSlot = pieces.find((p) => p.stageId === stage.id && p.type === "quote");
            const pos = slotPositions[stage.id];
            const qPos = quotePositions[stage.id];
            const colors = stageColors[stage.id] ?? { bg: "bg-primary", border: "border-primary", text: "text-white" };

            if (!pos) return null;

            // Droppable ids map 1:1 to slot ids used in puzzlePieces
            const stageDroppableId = stageSlot?.id;
            const quoteDroppableId = quoteSlot?.id;

            const {
              setNodeRef: setStageRef,
              isOver: isStageOver,
            } = useDroppable({
              id: stageDroppableId ?? `${stage.id}-stage-slot`,
              disabled: !stageSlot,
            });

            const {
              setNodeRef: setQuoteRef,
              isOver: isQuoteOver,
            } = useDroppable({
              id: quoteDroppableId ?? `${stage.id}-quote-slot`,
              disabled: !(phase === 2 && quoteSlot),
            });

            return (
              <div key={stage.id}>
                {/* ── Stage slot ── */}
                {stageSlot && (
                  <>
                    <motion.button
                      ref={setStageRef}
                      type="button"
                      onClick={() => onSlotTap(stageSlot.id, stageSlot.stageId, "stage")}
                      onDragOver={handleDragOver}
                      onDrop={(e) => {
                        e.preventDefault();
                        onDrop(stageSlot.id, stageSlot.stageId, "stage");
                      }}
                      style={{
                        position: "absolute",
                        top: pos.top,
                        left: pos.left,
                        width: pos.width,
                        clipPath: jigsawClip,
                      }}
                      aria-label={stageSlot.filled ? stage.name : `Stage slot ${i + 1}`}
                      whileHover={!stageSlot.filled ? { scale: 1.06 } : {}}
                      whileTap={!stageSlot.filled ? { scale: 0.94 } : {}}
                      className={[
                        "puzzle-piece flex h-9 items-center justify-center text-center text-[7px] font-semibold leading-tight px-1",
                        "backdrop-blur-[2px] transition-all duration-200 sm:h-11 sm:text-[9px] md:h-12 md:text-[10px]",
                        stageSlot.filled
                          ? `${colors.bg}/70 ${colors.text} jigsaw-filled shadow-lg`
                          : selectedPiece
                            ? "bg-white/35 text-white animate-pulse jigsaw-empty-active cursor-pointer border-2 border-dashed border-white/60 drop-zone-active"
                            : "bg-black/20 text-white/80 hover:bg-white/25 jigsaw-empty cursor-pointer drop-zone",
                        isStageOver && !stageSlot.filled ? "drop-zone-valid" : "",
                        feedback?.slotId === stageSlot.id && feedback.type === "correct"
                          ? "animate-glow-correct"
                          : "",
                        feedback?.slotId === stageSlot.id && feedback.type === "incorrect"
                          ? "animate-shake"
                          : "",
                      ].filter(Boolean).join(" ")}
                    >
                      {stageSlot.filled ? (
                        <span className="drop-shadow-sm font-display font-bold">{stage.name}</span>
                      ) : (
                        <span className="opacity-80">{i + 1}. ???</span>
                      )}
                    </motion.button>

                    <SparkleEffect
                      trigger={
                        feedback?.slotId === stageSlot.id && feedback.type === "correct" ? stageSlot.id : null
                      }
                      top={pos.top}
                      left={pos.left}
                      width={pos.width}
                    />
                  </>
                )}

                {/* ── Quote slot (phase 2 only) ── */}
                {phase === 2 && quoteSlot && qPos && (
                  <>
                    <motion.button
                      ref={setQuoteRef}
                      type="button"
                      onClick={() => onSlotTap(quoteSlot.id, quoteSlot.stageId, "quote")}
                      onDragOver={handleDragOver}
                      onDrop={(e) => {
                        e.preventDefault();
                        onDrop(quoteSlot.id, quoteSlot.stageId, "quote");
                      }}
                      style={{
                        position: "absolute",
                        top: qPos.top,
                        left: qPos.left,
                        width: qPos.width,
                        clipPath: jigsawClip,
                      }}
                      aria-label={quoteSlot.filled ? `Quote for ${stage.name}` : `Quote slot for stage ${i + 1}`}
                      whileHover={!quoteSlot.filled ? { scale: 1.06 } : {}}
                      whileTap={!quoteSlot.filled ? { scale: 0.94 } : {}}
                      className={[
                        "puzzle-piece flex min-h-[2rem] items-start justify-center p-1.5 text-center text-[5px] leading-tight overflow-y-auto",
                        "backdrop-blur-[2px] transition-all duration-200 sm:min-h-[2.6rem] sm:text-[7px] md:min-h-[3rem] md:text-[9px]",
                        quoteSlot.filled
                          ? `${colors.bg}/65 ${colors.text} jigsaw-filled shadow-lg`
                          : selectedPiece
                            ? "bg-white/25 text-white/90 animate-pulse jigsaw-empty-active cursor-pointer border-2 border-dashed border-accent/60 drop-zone-active"
                            : "bg-black/15 text-white/70 hover:bg-white/20 jigsaw-empty cursor-pointer drop-zone",
                        isQuoteOver && !quoteSlot.filled ? "drop-zone-valid" : "",
                        feedback?.slotId === quoteSlot.id && feedback.type === "correct"
                          ? "animate-glow-correct"
                          : "",
                        feedback?.slotId === quoteSlot.id && feedback.type === "incorrect"
                          ? "animate-shake"
                          : "",
                      ].filter(Boolean).join(" ")}
                    >
                      {quoteSlot.filled ? (
                        <span className="italic drop-shadow-sm leading-tight px-0.5 block overflow-y-auto max-h-full line-clamp-none text-left">
                          "{quoteSlot.label}"
                        </span>
                      ) : (
                        <span className="opacity-70">📝 ?</span>
                      )}
                    </motion.button>

                    <SparkleEffect
                      trigger={
                        feedback?.slotId === quoteSlot.id && feedback.type === "correct" ? quoteSlot.id : null
                      }
                      top={qPos.top}
                      left={qPos.left}
                      width={qPos.width}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Completion overlay */}
        <AnimatePresence>
          {completed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-xl bg-gradient-to-b from-explorer-gold/30 via-brand-purple/20 to-explorer-forest/30 backdrop-blur-sm flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 120, damping: 14 }}
                className="text-center px-6 py-5 rounded-2xl glass shadow-glow-gold"
              >
                <motion.div
                  animate={{ rotate: [0, -10, 10, -5, 0] }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className="text-5xl mb-3"
                >
                  🗺️
                </motion.div>
                <p className="font-display text-2xl font-bold text-white drop-shadow-lg mb-1">Map Complete!</p>
                <p className="text-white/80 text-sm">All creativity stages discovered</p>
                <div className="mt-3 achievement-badge achievement-badge-unlocked mx-auto w-fit">
                  🏆 Explorer Achievement
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

