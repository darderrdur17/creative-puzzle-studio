import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, HelpCircle, Zap, Star, MapPin, Target, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";
import { useGameSession } from "@/hooks/useGameSession";
import { DIFFICULTY_CONFIG, calculateJigsawScore, getRandomizedStagesForPlayer } from "@/lib/gameData";
import { useBestIdeasAnswer } from "@/hooks/useBestIdeasAnswer";
import { playCorrectSound, playIncorrectSound, playCelebrationSound } from "@/lib/audioFeedback";
import elephantPuzzleImage from "@/assets/elephant-jewel-forest.png";
import { JigsawImagePuzzle, getGridConfig } from "@/components/game/JigsawImagePuzzle";
import { CompletionOverlay } from "@/components/game/CompletionOverlay";
import { InstructionsModal } from "@/components/InstructionsModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import confetti from "canvas-confetti";

const GameEnhanced = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { userId, loading: authLoading } = useAnonymousAuth();
  const { answer: bestIdeasAnswer, loading: bestIdeasLoading } = useBestIdeasAnswer(userId);
  const { session, players, currentPlayer, updateScore } = useGameSession(sessionId ?? null, userId);
  const isGameMaster = currentPlayer?.is_game_master ?? false;

  const [incorrectAttempts, setIncorrectAttempts] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [comboStreak, setComboStreak] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const [broadcastToast, setBroadcastToast] = useState<string | null>(null);
  const [showHalfwayToast, setShowHalfwayToast] = useState(false);
  const [xp, setXp] = useState(0);
  const [placedCount, setPlacedCount] = useState(0);

  const halfwayTriggered = useRef(false);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const difficulty = session?.difficulty ?? "medium";
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
  const gridConfig = getGridConfig(difficulty);
  const totalPieces = gridConfig.totalToPlace;

  /** Randomized stages per game — student's best-ideas answer becomes an incubation piece */
  const stages = useMemo(
    () => getRandomizedStagesForPlayer(bestIdeasAnswer),
    [bestIdeasAnswer],
  );

  const profileLoading = authLoading || (!!userId && bestIdeasLoading);

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
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  // Halfway milestone
  useEffect(() => {
    if (halfwayTriggered.current) return;
    if (placedCount >= Math.ceil(totalPieces / 2)) {
      halfwayTriggered.current = true;
      setShowHalfwayToast(true);
      confetti({ particleCount: 60, spread: 55, origin: { y: 0.6 } });
      playCorrectSound();
      setTimeout(() => setShowHalfwayToast(false), 2200);
    }
  }, [placedCount, totalPieces]);

  const handlePiecePlaced = useCallback(() => {
    const newStreak = comboStreak + 1;
    setComboStreak(newStreak);
    const xpGained = 20 + (newStreak >= 2 ? 5 * (newStreak - 1) : 0);
    setXp(prev => prev + xpGained);
    setPlacedCount(prev => prev + 1);
    playCorrectSound();
    confetti({ particleCount: 30 + newStreak * 8, spread: 45 + newStreak * 5, origin: { y: 0.6 } });
    if (newStreak >= 2) {
      setShowCombo(true);
      setTimeout(() => setShowCombo(false), 1200);
    }
  }, [comboStreak]);

  const handleIncorrect = useCallback(() => {
    playIncorrectSound();
    setIncorrectAttempts(prev => prev + 1);
    setComboStreak(0);
  }, []);

  const handlePhaseComplete = useCallback(() => {
    playCorrectSound();
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 } });
  }, []);

  const handleCompleted = useCallback(() => {
    setCompleted(true);
    clearInterval(timerRef.current);
    const finalScore = calculateJigsawScore(difficulty, elapsedMs, incorrectAttempts, totalPieces);
    updateScore(finalScore, incorrectAttempts, elapsedMs, true);
    playCelebrationSound();
    confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 } });
    setTimeout(() => confetti({ particleCount: 100, spread: 60, origin: { x: 0.2, y: 0.7 } }), 300);
    setTimeout(() => confetti({ particleCount: 100, spread: 60, origin: { x: 0.8, y: 0.7 } }), 600);
  }, [difficulty, elapsedMs, incorrectAttempts, totalPieces, updateScore]);

  const xpLevel = Math.floor(xp / 100) + 1;
  const xpProgress = (xp % 100) / 100;

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
      const finalScore = calculateJigsawScore(difficulty, elapsedMs, incorrectAttempts, totalPieces);
      updateScore(finalScore, incorrectAttempts, elapsedMs, true);
    }
  }, [timeUp, completed, difficulty, elapsedMs, incorrectAttempts, totalPieces, updateScore]);

  if (isGameMaster) return null;

  if (profileLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          aria-label="Loading game"
        >
          <Puzzle className="h-12 w-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  // Avoid a blank screen: if session can't be fetched (network/auth/RLS), show a recovery UI.
  if (!session) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl text-center space-y-3">
          <h1 className="font-display text-xl font-bold">Unable to load the game</h1>
          <p className="text-sm text-muted-foreground">
            This usually happens if sign-in/session storage is blocked (private browsing settings),
            or if the network is temporarily unavailable.
          </p>
          <div className="flex gap-2 justify-center pt-1">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <Button onClick={() => navigate("/")}>Back to Join</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-explorer overflow-x-hidden overflow-y-auto">
      {/* Ambient background blobs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-explorer-gold/10 rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-explorer-ocean/10 rounded-full blur-3xl opacity-30" />
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-brand-purple/5 rounded-full blur-3xl opacity-20" />
      </div>

      {/* ───── Header ───── */}
      <header className="relative z-10 border-b border-explorer-gold/20 bg-background/85 backdrop-blur-md safe-area-top">
        <div className="flex items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
          {/* Left: title + hint */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-explorer-gold/20 text-lg sm:text-xl shadow-sm">
              🧩
            </div>
            <div className="flex flex-col gap-0 min-w-0">
              <h1 className="font-display text-sm sm:text-base lg:text-lg font-bold leading-tight truncate">
                Jigsaw Puzzle
              </h1>
              <p className="text-[9px] sm:text-[10px] lg:text-xs text-muted-foreground truncate">
                Reassemble the elephant — tap a piece, then tap the board
              </p>
            </div>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* XP badge (desktop) */}
            <div className="hidden md:flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-brand-purple-600">
                <Star className="h-3 w-3" />
                Lv.{xpLevel} · {xp} XP
              </div>
              <div className="xp-bar w-16">
                <motion.div className="xp-fill" animate={{ width: `${xpProgress * 100}%` }} transition={{ duration: 0.5 }} />
              </div>
            </div>

            {/* Timer */}
            <motion.div
              animate={isTimeLow ? { scale: [1, 1.05, 1] } : {}}
              transition={isTimeLow ? { repeat: Infinity, duration: 1 } : {}}
              className={`flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg font-semibold text-xs sm:text-sm ${
                isTimeLow ? "bg-destructive/20 text-destructive" : "bg-explorer-gold/15 text-explorer-dark"
              }`}
            >
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{timeRemaining !== null ? formatTime(timeRemaining) : formatTime(elapsedMs)}</span>
            </motion.div>

            {/* Wrong attempts — distinguishes first-time success from trial-and-error */}
            <div className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-muted/50">
              <Target className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                {incorrectAttempts} miss{incorrectAttempts !== 1 ? "es" : ""}
              </span>
            </div>

            {/* Progress pill (desktop) */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-explorer-gold/15">
              <MapPin className="h-3.5 w-3.5 text-explorer-gold" />
              <span className="text-xs font-semibold text-explorer-dark">{placedCount}/{totalPieces}</span>
            </div>

            <Button variant="ghost" size="sm" onClick={() => setShowInstructions(true)} className="gap-1 h-8 w-8 sm:h-auto sm:w-auto sm:px-2 p-0">
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Help</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile progress bar */}
        <div className="sm:hidden px-3 pb-2.5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
              <Star className="h-3 w-3 text-brand-purple" />
              {xp} XP · Lv.{xpLevel}
            </div>
            <span className="text-xs font-bold text-explorer-gold">{placedCount}/{totalPieces}</span>
          </div>
          <Progress value={(placedCount / totalPieces) * 100} className="h-1.5" />
        </div>
      </header>

      {/* ───── Main Content ───── */}
      <main className="relative z-10 px-3 py-3 sm:px-6 sm:py-5">
        <JigsawImagePuzzle
          difficulty={difficulty}
          stages={stages}
          onPiecePlaced={handlePiecePlaced}
          onIncorrect={handleIncorrect}
          onCompleted={handleCompleted}
          onPhaseComplete={handlePhaseComplete}
          isPaused={isPaused}
        />
      </main>

      {/* ───── Toasts & Overlays ───── */}
      <AnimatePresence>
        {showHalfwayToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 glass px-5 py-3 rounded-xl shadow-glow-gold font-semibold text-sm safe-area-top"
          >
            🎯 Halfway there! Keep going!
          </motion.div>
        )}

        {showCombo && comboStreak >= 2 && (
          <motion.div
            key={`combo-${comboStreak}`}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
          >
            <div className="flex items-center gap-2 bg-gradient-to-r from-brand-purple to-brand-orange text-white px-6 py-3 rounded-full shadow-glow-purple font-display text-lg font-bold">
              <Zap className="h-5 w-5" />
              {comboStreak}x Combo! +{5 * (comboStreak - 1)} XP
            </div>
          </motion.div>
        )}

        {broadcastToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 glass-dark text-white px-4 py-3 rounded-xl shadow-lg max-w-sm text-sm safe-area-bottom"
          >
            📢 {broadcastToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paused Overlay */}
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
              <p className="mt-2 text-sm text-muted-foreground">The teacher has paused the game. Please wait...</p>
              <div className="mt-4 flex items-center justify-center gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions modal */}
      <InstructionsModal open={showInstructions} onOpenChange={setShowInstructions} />

      {/* Completion overlay */}
      <CompletionOverlay
        completed={completed}
        timeUp={timeUp}
        elapsedMs={elapsedMs}
        incorrectAttempts={incorrectAttempts}
        difficulty={difficulty}
        totalPieces={totalPieces}
        puzzleImageSrc={elephantPuzzleImage}
        onViewResults={() => navigate(`/results/${sessionId}`)}
      />
    </div>
  );
};

export default GameEnhanced;
