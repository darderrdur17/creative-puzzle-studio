import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Puzzle, Users, Trophy, ArrowRight, BookOpen,
  LogIn, Sparkles, LogOut, PlusCircle,
} from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";
import { useTeacherAuth } from "@/hooks/useTeacherAuth";
import { useGameSession } from "@/hooks/useGameSession";
import { BestIdeasQuestion } from "@/components/BestIdeasQuestion";
import { useBestIdeasAnswer } from "@/hooks/useBestIdeasAnswer";
import elephantImg from "@/assets/elephant-jewel-forest.png";

const STAGES = [
  { name: "Preparation",  color: "bg-stage-preparation",  emoji: "🔵" },
  { name: "Incubation",   color: "bg-stage-incubation",   emoji: "🟣" },
  { name: "Illumination", color: "bg-stage-illumination", emoji: "🟡" },
  { name: "Verification", color: "bg-stage-verification",  emoji: "✅" },
];

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const joinCode = searchParams.get("code");

  // Teacher auth (real Supabase email/password session)
  const { user: teacherUser, displayName: teacherName, signOut: teacherSignOut, loading: teacherAuthLoading } = useTeacherAuth();

  // Anonymous auth (used for both teachers creating games and students joining)
  const { userId, loading: authLoading, authError, retryAuth, ensureGuestSession } = useAnonymousAuth();
  const { createSession, joinSession, error, setError } = useGameSession(null, userId);

  const loading = authLoading || teacherAuthLoading;

  const [nickname, setNickname] = useState(() => teacherName ?? "");
  const [gameCode, setGameCode] = useState(joinCode || "");
  const [mode, setMode] = useState<"home" | "create" | "join">(joinCode ? "join" : "home");
  const [joinStep, setJoinStep] = useState<"ideas" | "details">("details");
  const [submitting, setSubmitting] = useState(false);

  const {
    hasAnswer: hasBestIdeas,
    loading: bestIdeasLoading,
    saving: bestIdeasSaving,
    error: bestIdeasError,
    setError: setBestIdeasError,
    saveAnswer: saveBestIdeas,
  } = useBestIdeasAnswer(userId);

  const isStudent = !teacherUser;
  const needsBestIdeasAnswer = isStudent && !bestIdeasLoading && !hasBestIdeas;
  const guestActionsBlocked = isStudent && authLoading;

  useEffect(() => {
    if (mode === "join" && !bestIdeasLoading && !hasBestIdeas) {
      setJoinStep("ideas");
    } else if (mode === "join" && !bestIdeasLoading) {
      setJoinStep("details");
    }
  }, [mode, hasBestIdeas, bestIdeasLoading]);

  const handleBestIdeasSubmit = async (answer: string) => {
    if (!userId) await ensureGuestSession();
    const ok = await saveBestIdeas(answer);
    if (ok && mode === "join") {
      setJoinStep("details");
    }
  };

  const handleCreate = async () => {
    const name = nickname.trim() || teacherName || "Teacher";
    setSubmitting(true);
    setError(null);
    const sess = await createSession(name);
    setSubmitting(false);
    if (sess) navigate(`/lobby/${sess.id}`);
  };

  const handleJoin = async () => {
    if (!nickname.trim() || !gameCode.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const guestId = userId ?? (await ensureGuestSession());
      if (!guestId) {
        setError(
          authError ??
            "Could not connect right now. Tap Try again or reload — students do not need an account."
        );
        return;
      }
      const sess = await joinSession(gameCode.trim(), nickname.trim(), guestId);
      if (!sess) return;
      if (sess.status === "playing") {
        navigate(`/game/${sess.id}`);
      } else {
        navigate(`/lobby/${sess.id}`);
      }
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Unable to join right now. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTeacherSignOut = async () => {
    await teacherSignOut();
    setMode("home");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        >
          <Puzzle className="h-12 w-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-background px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      {/* Controls */}
      <div className="absolute right-4 z-20 top-[max(1rem,env(safe-area-inset-top))]">
        <ThemeToggle />
      </div>

      {/* Elephant background */}
      <div className="pointer-events-none absolute inset-0">
        <img
          src={elephantImg}
          alt=""
          className="h-full w-full object-cover object-center opacity-[0.13] dark:opacity-[0.08]"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/30 to-background/70" />
      </div>

      {/* Floating stage badges */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {STAGES.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 0.18, y: 0 }}
            transition={{ delay: 0.6 + i * 0.15, duration: 0.6 }}
            style={{
              position: "absolute",
              top: `${15 + i * 15}%`,
              left: i % 2 === 0 ? `${4 + i * 2}%` : undefined,
              right: i % 2 !== 0 ? `${4 + i * 2}%` : undefined,
            }}
            className={`rounded-full ${s.color} px-3 py-1 text-xs font-bold text-white shadow-lg`}
          >
            {s.emoji} {s.name}
          </motion.div>
        ))}
      </div>

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="relative z-10 flex w-full max-w-md flex-col items-center gap-6"
      >
        {/* Logo */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 220, delay: 0.18 }}
            className="mx-auto mb-4 flex justify-center"
          >
            <AppLogo size="lg" />
          </motion.div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Creativity is<span className="text-primary">…</span>
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            A jigsaw puzzle game about the creative process
          </p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="mt-3 flex flex-wrap justify-center gap-1.5"
          >
            {STAGES.map((s) => (
              <span
                key={s.name}
                className={`rounded-full ${s.color} px-2.5 py-0.5 text-[10px] font-semibold text-white opacity-90 shadow-sm`}
              >
                {s.name}
              </span>
            ))}
          </motion.div>
        </div>

        {/* ── TEACHER LOGGED IN: show teacher home ── */}
        {teacherUser && mode === "home" && (
          <motion.div
            key="teacher-home"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full space-y-3"
          >
            {/* Teacher greeting */}
            <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Signed in as teacher</p>
                <p className="font-display font-bold text-foreground">{teacherName}</p>
                <p className="text-[11px] text-muted-foreground">{teacherUser?.email ?? ""}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-destructive"
                onClick={handleTeacherSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>

            <Button
              size="lg"
              className="w-full gap-2 text-base shadow-lg shadow-primary/20"
              onClick={() => setMode("create")}
            >
              <PlusCircle className="h-5 w-5" />
              Create New Game
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="w-full gap-2 text-base"
              onClick={() => navigate("/leaderboard")}
            >
              <Trophy className="h-5 w-5" />
              Leaderboard
            </Button>
          </motion.div>
        )}

        {/* ── NO TEACHER SESSION: home choice ── */}
        <AnimatePresence mode="wait">
          {!teacherUser && mode === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
              className="flex w-full flex-col gap-3"
            >
              {needsBestIdeasAnswer && (
                <BestIdeasQuestion
                  onSubmit={handleBestIdeasSubmit}
                  submitting={bestIdeasSaving}
                  disabled={guestActionsBlocked}
                  error={bestIdeasError}
                />
              )}

              {/* Student join — primary action */}
              <Button
                size="lg"
                className="w-full gap-2 text-base shadow-lg shadow-primary/20 min-h-[48px] touch-manipulation"
                disabled={needsBestIdeasAnswer || guestActionsBlocked}
                onClick={() => setMode("join")}
              >
                <Users className="h-5 w-5" />
                Join a Game
                <span className="ml-auto text-xs font-normal opacity-70">Student</span>
              </Button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 border-t" />
              </div>

              {/* Teacher login */}
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2 text-base"
                onClick={() => navigate("/teacher/login")}
              >
                <LogIn className="h-5 w-5" />
                Teacher Login
                <span className="ml-auto text-xs font-normal opacity-70">Teacher</span>
              </Button>

              <Button
                size="lg"
                variant="ghost"
                className="w-full gap-2 text-base"
                onClick={() => navigate("/leaderboard")}
              >
                <Trophy className="h-5 w-5" />
                Leaderboard
              </Button>
            </motion.div>
          )}

          {/* ── CREATE GAME panel (teacher only) ── */}
          {mode === "create" && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
              className="w-full"
            >
              <Card className="shadow-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Create a New Game
                  </CardTitle>
                  <CardDescription>
                    You'll be the Game Master for this session.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label htmlFor="nickname" className="mb-1.5 block text-sm font-medium">
                      Display Name
                    </label>
                    <Input
                      id="nickname"
                      placeholder={teacherName ?? "e.g. Ms. Rivera"}
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      maxLength={20}
                      onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                      autoFocus
                    />
                  </div>
                  {error && (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="ghost"
                      onClick={() => { setMode("home"); setError(null); }}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1 gap-2"
                      disabled={(!nickname.trim() && !teacherName) || submitting}
                      onClick={handleCreate}
                    >
                      {submitting ? "Creating…" : "Create Game"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── JOIN GAME panel (students) ── */}
          {mode === "join" && joinStep === "ideas" && (
            <motion.div
              key="join-ideas"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
              className="w-full space-y-3"
            >
              <BestIdeasQuestion
                onSubmit={handleBestIdeasSubmit}
                submitting={bestIdeasSaving}
                disabled={guestActionsBlocked}
                error={bestIdeasError}
              />
              <Button
                variant="ghost"
                className="w-full min-h-[48px] touch-manipulation"
                onClick={() => { setMode("home"); setError(null); setBestIdeasError(null); }}
              >
                Back
              </Button>
            </motion.div>
          )}

          {mode === "join" && joinStep === "details" && (
            <motion.div
              key="join"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}
              className="w-full"
            >
              <Card className="shadow-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Join a Game
                  </CardTitle>
                  <CardDescription>
                    Enter the 6-character code shared by your teacher.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label htmlFor="join-nickname" className="mb-1.5 block text-sm font-medium">
                      Your Nickname
                    </label>
                    <Input
                      id="join-nickname"
                      placeholder="Enter your nickname…"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      maxLength={20}
                      autoFocus
                      className="min-h-[44px] touch-manipulation"
                    />
                  </div>
                  <div>
                    <label htmlFor="game-code" className="mb-1.5 block text-sm font-medium">
                      Game Code
                    </label>
                    <Input
                      id="game-code"
                      placeholder="e.g. ABC123"
                      value={gameCode}
                      onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="text-center font-display text-xl tracking-[0.35em] min-h-[44px] touch-manipulation"
                      onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    />
                  </div>
                  {error && (
                    <motionField className="space-y-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <p role="alert">{error}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-destructive/50 text-destructive hover:bg-destructive/10 min-h-[44px] touch-manipulation"
                        onClick={() => { setError(null); void retryAuth(); }}
                      >
                        Try again
                      </Button>
                    </motionField>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="ghost"
                      className="min-h-[44px] touch-manipulation"
                      onClick={() => { setMode("home"); setError(null); }}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1 gap-2 min-w-0 min-h-[44px] touch-manipulation"
                      disabled={!nickname.trim() || !gameCode.trim() || submitting}
                      onClick={handleJoin}
                    >
                      {submitting ? "Joining…" : "Join Game"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="grid w-full grid-cols-4 gap-3 text-center text-xs text-muted-foreground"
        >
          {[
            { icon: <Puzzle   className="h-5 w-5 text-primary mx-auto" />,              label: "Drag & Drop" },
            { icon: <Users    className="h-5 w-5 text-secondary mx-auto" />,            label: "Multiplayer" },
            { icon: <Trophy   className="h-5 w-5 text-accent mx-auto" />,              label: "Leaderboard" },
            { icon: <BookOpen className="h-5 w-5 text-stage-elaboration mx-auto" />,   label: "8‑Puzzle Lab", href: "/lab07/game" },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => f.href && navigate(f.href)}
                className="flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px] touch-manipulation"
                aria-label={f.href ? `Go to ${f.label}` : f.label}
              >
                {f.icon}
                <span>{f.label}</span>
              </button>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Index;
