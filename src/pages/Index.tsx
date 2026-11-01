import { useState, useEffect, type ReactNode } from "react";
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
import elephantImg from "@/assets/elephant-jewel-forest.webp";

const STAGES = [
  { name: "Preparation",  color: "bg-stage-preparation",  text: "text-stage-fg-preparation",  emoji: "🔵" },
  { name: "Incubation",   color: "bg-stage-incubation",   text: "text-stage-fg-incubation",   emoji: "🟣" },
  { name: "Illumination", color: "bg-stage-illumination", text: "text-stage-fg-illumination", emoji: "🟡" },
  { name: "Verification", color: "bg-stage-verification", text: "text-stage-fg-verification", emoji: "✅" },
];

/**
 * Decorative sparkle field. Deterministic (no Math.random) so the layout is
 * stable across renders and screenshots. Purely presentational.
 */
const SPARKLES = [
  { top: "12%", left: "8%",  size: 5, delay: "0s",   dur: "3.4s" },
  { top: "22%", left: "88%", size: 4, delay: "0.9s", dur: "4.1s" },
  { top: "38%", left: "5%",  size: 3, delay: "1.6s", dur: "3.8s" },
  { top: "58%", left: "92%", size: 5, delay: "0.4s", dur: "4.6s" },
  { top: "72%", left: "12%", size: 4, delay: "2.1s", dur: "3.6s" },
  { top: "86%", left: "78%", size: 3, delay: "1.2s", dur: "4.3s" },
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

  /* `teacherName` arrives asynchronously, so a lazy useState initialiser always
     captured null. Adopt the name once it resolves, without ever overwriting
     something the teacher has already typed. */
  useEffect(() => {
    setNickname((current) => current || teacherName || "");
  }, [teacherName]);

  useEffect(() => {
    if (mode === "join" && !bestIdeasLoading && !hasBestIdeas) {
      setJoinStep("ideas");
    } else if (mode === "join" && !bestIdeasLoading) {
      setJoinStep("details");
    }
  }, [mode, hasBestIdeas, bestIdeasLoading]);

  const handleBestIdeasSubmit = async (answer: string) => {
    /* Resolve the id first and pass it in explicitly. `saveAnswer` closes over
       the userId from this render, which is still null when the guest session
       was created moments ago — that made the very first "Continue" fail. */
    const id = userId ?? (await ensureGuestSession());
    if (!id) {
      setBestIdeasError("Still connecting — tap Continue again in a moment.");
      return;
    }
    const ok = await saveBestIdeas(answer, id);
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

      {/* ── Background stack: elephant artwork + aurora mesh + sparkles ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Elephant artwork (preserved) — now drifts on a very slow ken-burns cycle */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,hsl(var(--primary)_/_0.12),transparent_62%)]">
          <img
            src={elephantImg}
            alt=""
            className="animate-ken-burns h-full w-full object-cover object-center opacity-[0.26] dark:opacity-[0.14]"
            decoding="async"
          />
        </div>

        {/* Animated aurora mesh, drifting slowly behind the content */}
        <div className="animate-aurora aurora absolute -inset-[14%]" />

        {/* Legibility scrim: vertical wash + soft vignette to focus the column */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/20 to-background/70" />
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_46%,transparent_42%,hsl(var(--background)_/_0.62)_100%)]" />

        {/* Sparkle field */}
        <div className="absolute inset-0">
          {SPARKLES.map((sp, i) => (
            <span
              key={i}
              className="animate-twinkle absolute rounded-full bg-secondary/80 blur-[1px]"
              style={{
                top: sp.top,
                left: sp.left,
                width: sp.size,
                height: sp.size,
                animationDelay: sp.delay,
                animationDuration: sp.dur,
              }}
            />
          ))}
        </div>
      </div>

      {/* Floating stage badges — decorative; hidden on phones where they
          collide with the content column */}
      <div className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block" aria-hidden>
        {STAGES.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 0.30, y: 0 }}
            transition={{ delay: 0.6 + i * 0.15, duration: 0.6 }}
            style={{
              position: "absolute",
              top: `${15 + i * 15}%`,
              left: i % 2 === 0 ? `${4 + i * 2}%` : undefined,
              right: i % 2 !== 0 ? `${4 + i * 2}%` : undefined,
            }}
          >
            <span
              className={`animate-float-drift block rounded-full ${s.color} px-3 py-1 text-xs font-bold ${s.text} shadow-lg`}
              style={{ animationDelay: `${i * 0.8}s` }}
            >
              {s.emoji} {s.name}
            </span>
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
        {/* Logo + title */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.18 }}
            className="relative mx-auto mb-4 flex justify-center"
          >
            {/* Soft palette halo pulsing behind the logo */}
            <span
              aria-hidden
              className="animate-pulse-glow absolute inset-0 rounded-full bg-primary/25 blur-2xl"
            />
            <AppLogo size="lg" className="relative" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.5 }}
            className="font-display text-4xl font-bold tracking-tight md:text-5xl"
          >
            <span className="text-gradient animate-gradient-pan">Creativity is</span>
            <motion.span
              className="inline-block text-primary"
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
            >
              …
            </motion.span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-2 text-base text-muted-foreground"
          >
            A jigsaw puzzle game about the creative process
          </motion.p>

          {/* Stage chips — staggered pop-in, lift on hover */}
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {STAGES.map((s, i) => (
              <motion.span
                key={s.name}
                initial={{ opacity: 0, scale: 0.6, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  delay: 0.55 + i * 0.08,
                  type: "spring",
                  stiffness: 320,
                  damping: 20,
                }}
                whileHover={{ scale: 1.09, y: -2 }}
                className={`cursor-default rounded-full ${s.color} px-2.5 py-0.5 text-[10px] font-semibold ${s.text} shadow-sm`}
              >
                {s.name}
              </motion.span>
            ))}
          </div>
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
                className="shine-hover w-full gap-2 text-base shadow-lg shadow-primary/20 min-h-[48px] touch-manipulation"
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
              <Card className="card-luxe">
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
              <Card className="card-luxe">
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
                    <motion.div className="space-y-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
                    </motion.div>
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

        {/* Feature strip. Only the lab tile navigates; the other three are
            descriptive, so they must not render as buttons that appear
            clickable and then do nothing. */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { delayChildren: 0.7, staggerChildren: 0.08 } },
          }}
          className="grid w-full grid-cols-4 gap-3 text-center text-xs text-muted-foreground"
        >
          {(
            [
              { icon: <Puzzle className="h-5 w-5 text-primary mx-auto" />, label: "Drag & Drop" },
              { icon: <Users className="h-5 w-5 text-secondary mx-auto" />, label: "Multiplayer" },
              { icon: <Trophy className="h-5 w-5 text-accent mx-auto" />, label: "Leaderboard" },
              {
                icon: <BookOpen className="h-5 w-5 text-stage-elaboration mx-auto" />,
                label: "8‑Puzzle Lab",
                href: "/lab07/game",
              },
            ] as Array<{ icon: ReactNode; label: string; href?: string }>
          ).map((f) => (
            <motion.div
              key={f.label}
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
              className="flex flex-col items-center gap-1"
            >
              {f.href ? (
                <motion.button
                  type="button"
                  whileHover={{ y: -3, scale: 1.06 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(f.href!)}
                  className="flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px] touch-manipulation"
                  aria-label={`Go to ${f.label}`}
                >
                  {f.icon}
                  <span>{f.label}</span>
                </motion.button>
              ) : (
                <div className="flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground">
                  {f.icon}
                  <span>{f.label}</span>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Index;
