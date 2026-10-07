import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, HelpCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";
import { useGameSession } from "@/hooks/useGameSession";
import { CREATIVITY_STAGES, getRandomizedStages, DIFFICULTY_CONFIG, calculateScore } from "@/lib/gameData";
import { playCorrectSound, playIncorrectSound, playCelebrationSound } from "@/lib/audioFeedback";
import { PuzzleBoard } from "@/components/game/PuzzleBoard";
import { PiecesTray } from "@/components/game/PiecesTray";
import { CompletionOverlay } from "@/components/game/CompletionOverlay";
import { InstructionsModal } from "@/components/InstructionsModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import confetti from "canvas-confetti";

interface PieceState {
  id: string;
  type: "stage" | "quote";
  stageId: string;
  label: string;
  placed: boolean;
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const Game = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { userId } = useAnonymousAuth();
  const { session, players, currentPlayer, updateScore } = useGameSession(sessionId ?? null, userId);
  const isGameMaster = currentPlayer?.is_game_master ?? false;

  const [phase, setPhase] = useState<1 | 2>(1);
  const [pieces, setPieces] = useState<PieceState[]>([]);
  const [slots, setSlots] = useState<{ id: string; stageId: string; filled: boolean; type: "stage" | "quote" }[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [incorrectAttempts, setIncorrectAttempts] = useState(0);
  const [feedback, setFeedback] = useState<{ type: "correct" | "incorrect"; slotId: string } | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [phaseTransition, setPhaseTransition] = useState(false);
  const [showHalfwayToast, setShowHalfwayToast] = useState(false);
  const [comboStreak, setComboStreak] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const [broadcastToast, setBroadcastToast] = useState<string | null>(null);
  const halfwayTriggered = useRef(false);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const difficulty = session?.difficulty ?? "medium";
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;

  // Randomize quotes once per game session
  const [stages] = useState(() => getRandomizedStages());

  // Initialize pieces
  useEffect(() => {
    const stagePieces: PieceState[] = stages.map((s) => ({
      id: `stage-${s.id}`,
      type: "stage" as const,
      stageId: s.id,
      label: s.name,
      placed: false,
    }));
    setPieces(shuffleArray(stagePieces));

    const stageSlots = stages.map((s) => ({
      id: `slot-stage-${s.id}`,
      stageId: s.id,
      filled: false,
      type: "stage" as const,
    }));
    setSlots(stageSlots);
  }, [stages]);

  const isPaused = !!session?.paused_at;
  const pausedAccumulatedRef = useRef(0);
  const lastPauseRef = useRef<number | null>(null);

  // Timer — pauses when session is paused
  useEffect(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (isPaused) {
        if (!lastPauseRef.current) lastPauseRef.current = Date.now();
        return;
      }
      if (lastPauseRef.current) {
        pausedAccumulatedRef.current += Date.now() - lastPauseRef.current;
        lastPauseRef.current = null;
      }
      setElapsedMs(Date.now() - startTimeRef.current - pausedAccumulatedRef.current);
    }, 100);
    return () => clearInterval(timerRef.current);
  }, [isPaused]);

  // Redirect when game finishes
  useEffect(() => {
    if (session?.status === "finished") {
      navigate(`/results/${session.id}`);
    }
  }, [session?.status, session?.id, navigate]);

  // Redirect Game Master to the Teacher Dashboard
  useEffect(() => {
    if (isGameMaster && session) {
      navigate(`/dashboard/${sessionId}`, { replace: true });
    }
  }, [isGameMaster, session, sessionId, navigate]);

  // Listen for teacher broadcast messages
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`broadcasts-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "broadcast_messages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const msg = (payload.new as { message: string }).message;
          setBroadcastToast(msg);
          setTimeout(() => setBroadcastToast(null), 5000);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  useEffect(() => {
    if (phase === 1 && !phaseTransition) {
      const stageSlots = slots.filter((s) => s.type === "stage");
      const allStagesPlaced = stageSlots.length === stages.length && stageSlots.every((s) => s.filled);
      if (allStagesPlaced && stageSlots.length > 0) {
        setPhaseTransition(true);
        playCorrectSound();
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 } });

        setTimeout(() => {
          const quotePieces: PieceState[] = stages.map((s) => ({
            id: `quote-${s.id}`,
            type: "quote" as const,
            stageId: s.id,
            label: s.quote,
            placed: false,
          }));
          setPieces(shuffleArray(quotePieces));
          const quoteSlots = stages.map((s) => ({
            id: `slot-quote-${s.id}`,
            stageId: s.id,
            filled: false,
            type: "quote" as const,
          }));
          setSlots((prev) => [...prev, ...quoteSlots]);
          setPhase(2);
          setPhaseTransition(false);
        }, 2500);
      }
    }
  }, [phase, slots, stages, phaseTransition]);

  // Check completion (phase 2 all quotes placed)
  useEffect(() => {
    if (phase === 2 && !completed) {
      const quoteSlots = slots.filter((s) => s.type === "quote");
      if (quoteSlots.length > 0 && quoteSlots.every((s) => s.filled)) {
        setCompleted(true);
        clearInterval(timerRef.current);
        const finalScore = calculateScore(difficulty, elapsedMs, incorrectAttempts);
        updateScore(finalScore, incorrectAttempts, elapsedMs, true);
        playCelebrationSound();
        confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 } });
        setTimeout(() => confetti({ particleCount: 100, spread: 60, origin: { x: 0.2, y: 0.7 } }), 300);
        setTimeout(() => confetti({ particleCount: 100, spread: 60, origin: { x: 0.8, y: 0.7 } }), 600);
      }
    }
  }, [phase, slots, completed, difficulty, elapsedMs, incorrectAttempts, updateScore]);

  // 50% milestone celebration (5 out of 10 placed)
  useEffect(() => {
    if (halfwayTriggered.current) return;
    const placed = phase === 1
      ? pieces.filter((p) => p.placed).length
      : 5 + pieces.filter((p) => p.placed).length;
    if (placed >= 5) {
      halfwayTriggered.current = true;
      setShowHalfwayToast(true);
      confetti({ particleCount: 60, spread: 55, origin: { y: 0.6 } });
      playCorrectSound();
      setTimeout(() => setShowHalfwayToast(false), 2200);
    }
  }, [phase, pieces]);

  const handleSlotTap = useCallback(
    (slotId: string, slotStageId: string, slotType: "stage" | "quote") => {
      if (!selectedPiece) return;
      const piece = pieces.find((p) => p.id === selectedPiece);
      if (!piece) return;

      if (piece.stageId === slotStageId && piece.type === slotType) {
        // Correct!
        const newStreak = comboStreak + 1;
        setComboStreak(newStreak);
        playCorrectSound();
        confetti({ particleCount: 40 + newStreak * 10, spread: 50 + newStreak * 5, origin: { y: 0.6 } });
        setFeedback({ type: "correct", slotId });
        setPieces((prev) => prev.map((p) => (p.id === piece.id ? { ...p, placed: true } : p)));
        setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, filled: true } : s)));
        if (newStreak >= 2) {
          setShowCombo(true);
          setTimeout(() => setShowCombo(false), 1200);
        }
        setTimeout(() => setFeedback(null), 800);
      } else {
        // Incorrect
        playIncorrectSound();
        setFeedback({ type: "incorrect", slotId });
        setIncorrectAttempts((prev) => prev + 1);
        setComboStreak(0);
        setTimeout(() => setFeedback(null), 500);
      }
      setSelectedPiece(null);
    },
    [selectedPiece, pieces, comboStreak]
  );

  const handlePieceSelect = useCallback((pieceId: string) => {
    setSelectedPiece((prev) => (prev === pieceId ? null : pieceId));
  }, []);

  const handleDragStart = useCallback((pieceId: string) => {
    setSelectedPiece(pieceId);
  }, []);

  const handleDragEnd = useCallback(() => {
    // Don't clear on drag end — the drop handler will clear it
  }, []);

  const handleDrop = useCallback(
    (slotId: string, slotStageId: string, slotType: "stage" | "quote") => {
      handleSlotTap(slotId, slotStageId, slotType);
    },
    [handleSlotTap]
  );

  const totalPieces = 10; // 5 stage names + 5 quotes
  const actualPlaced = phase === 1
    ? pieces.filter((p) => p.placed).length
    : 5 + pieces.filter((p) => p.placed).length;

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  const timeRemaining = config.timeLimitSeconds
    ? Math.max(0, config.timeLimitSeconds * 1000 - elapsedMs)
    : null;
  const timeUp = timeRemaining !== null && timeRemaining <= 0;
  const isTimeLow = timeRemaining !== null && timeRemaining > 0 && timeRemaining <= 30000;

  // Time up handling
  useEffect(() => {
    if (timeUp && !completed) {
      clearInterval(timerRef.current);
      setCompleted(true);
      const finalScore = calculateScore(difficulty, elapsedMs, incorrectAttempts);
      updateScore(finalScore, incorrectAttempts, elapsedMs, true);
    }
  }, [timeUp, completed, difficulty, elapsedMs, incorrectAttempts, updateScore]);

  const currentSlots = phase === 1
    ? slots.filter((s) => s.type === "stage")
    : slots;

  if (!session) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <InstructionsModal />

      {/* Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card/80 px-3 py-2 backdrop-blur-sm sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Clock className={`h-4 w-4 ${isTimeLow ? "text-destructive animate-pulse" : "text-muted-foreground"}`} />
          <span className={`font-display text-base font-semibold tabular-nums sm:text-lg ${isTimeLow ? "text-destructive animate-pulse" : ""}`}>
            {timeRemaining !== null ? formatTime(timeRemaining) : formatTime(elapsedMs)}
          </span>
          {timeRemaining !== null && !isTimeLow && (
            <span className="hidden text-xs text-muted-foreground sm:inline">remaining</span>
          )}
          {isTimeLow && (
            <span className="text-[10px] font-bold text-destructive animate-pulse sm:text-xs">⚠ HURRY!</span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {comboStreak >= 2 && (
            <span className="flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-foreground sm:px-3 sm:text-xs">
              🔥 {comboStreak}x
            </span>
          )}
          <span className="text-xs text-muted-foreground sm:text-sm">
            {incorrectAttempts} miss{incorrectAttempts !== 1 ? "es" : ""}
          </span>
          <PhaseBadge phase={phase} />
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 min-h-[44px] min-w-[44px] touch-manipulation sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0"
            onClick={() => {
              localStorage.removeItem("puzzle-instructions-seen");
              window.location.reload();
            }}
            aria-label="Show instructions"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:px-3 sm:text-xs">
            <Users className="h-3 w-3" /> {players.length}
          </span>
        </div>
      </header>

      {/* Progress */}
      <div className="px-3 pt-2 sm:px-4 sm:pt-3">
        <Progress value={(actualPlaced / totalPieces) * 100} className="h-2" />
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {actualPlaced} / {totalPieces} pieces placed
        </p>
      </div>

      {/* Main Game Area */}
      <main className="flex flex-1 flex-col gap-3 p-2 sm:gap-4 sm:p-3 md:flex-row md:gap-6 md:p-4">
        {/* Puzzle Board */}
        <div className="flex-1">
          <PuzzleBoard
            phase={phase}
            stages={stages}
            currentSlots={currentSlots}
            feedback={feedback}
            onSlotTap={handleSlotTap}
            onDrop={handleDrop}
            selectedPiece={selectedPiece}
            completed={completed}
          />
        </div>

        {/* Pieces Tray */}
        <PiecesTray
          phase={phase}
          pieces={pieces}
          selectedPiece={selectedPiece}
          onPieceSelect={handlePieceSelect}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      </main>

      {/* Paused Overlay for Players */}
      <AnimatePresence>
        {isPaused && !completed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="mx-4 w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-2xl"
            >
              <span className="text-5xl">⏸️</span>
              <h2 className="mt-4 font-display text-2xl font-bold text-foreground">Game Paused</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                The teacher has paused the game. Please wait...
              </p>
              <div className="mt-4 flex items-center justify-center gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teacher Broadcast Toast */}
      <AnimatePresence>
        {broadcastToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            transition={{ type: "spring", damping: 18 }}
            className="fixed left-1/2 top-16 z-[60] -translate-x-1/2 w-[90vw] max-w-md rounded-2xl border border-primary/30 bg-card px-6 py-4 shadow-2xl text-center"
          >
            <span className="text-2xl">📢</span>
            <p className="mt-1 font-display text-base font-bold text-foreground">Teacher says:</p>
            <p className="mt-1 text-sm text-muted-foreground">{broadcastToast}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Combo Streak Toast */}
      <AnimatePresence>
        {showCombo && comboStreak >= 2 && (
          <motion.div
            key={`combo-${comboStreak}`}
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ type: "spring", damping: 14 }}
            className="fixed right-4 top-20 z-50 rounded-2xl bg-card px-5 py-3 shadow-2xl border border-accent/40 text-center"
          >
            <span className="text-2xl">🔥</span>
            <p className="font-display text-lg font-bold text-foreground">
              {comboStreak}x Combo!
            </p>
            <p className="text-xs text-muted-foreground">
              {comboStreak >= 5 ? "Unstoppable!" : comboStreak >= 3 ? "On fire!" : "Nice streak!"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Halfway Celebration Toast */}
      <AnimatePresence>
        {showHalfwayToast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: "spring", damping: 18 }}
            className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-2xl bg-card px-6 py-4 shadow-2xl border border-primary/30 text-center"
          >
            <span className="text-3xl">🎯</span>
            <p className="mt-1 font-display text-lg font-bold text-foreground">Halfway there!</p>
            <p className="text-sm text-muted-foreground">Keep going, you're doing great!</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase Transition Overlay */}
      <AnimatePresence>
        {phaseTransition && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.5, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="mx-4 w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-2xl"
            >
              <motion.div
                initial={{ rotate: -10 }}
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mx-auto mb-4 text-5xl"
              >
                🎉
              </motion.div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                Stage Names Complete!
              </h2>
              <p className="mt-2 text-muted-foreground">
                Now match each creativity quote to its stage...
              </p>
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.5, ease: "linear" }}
                className="mx-auto mt-4 h-1 rounded-full bg-primary"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion Overlay */}
      <CompletionOverlay
        completed={completed}
        timeUp={timeUp}
        elapsedMs={elapsedMs}
        incorrectAttempts={incorrectAttempts}
        difficulty={difficulty}
        onViewResults={() => navigate(`/results/${sessionId}`)}
      />

    </div>
  );
};

function PhaseBadge({ phase }: { phase: number }) {
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary sm:px-3 sm:py-1 sm:text-xs">
      Phase {phase}: {phase === 1 ? "Stages" : "Quotes"}
    </span>
  );
}

export default Game;
