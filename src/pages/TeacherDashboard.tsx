import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy, Clock, Target, CheckCircle2, Loader2, Users,
  StopCircle, ArrowLeft, Puzzle, BarChart3, Download, Send,
  Pause, Play, UserPlus, LogOut, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";
import { useGameSession } from "@/hooks/useGameSession";
import { useTeacherAuth } from "@/hooks/useTeacherAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { JoinQRCode } from "@/components/JoinQRCode";
import { supabase } from "@/integrations/supabase/client";
import { copyTextToClipboard } from "@/lib/clipboard";
import { buildCsv } from "@/lib/csv";
import { toast } from "sonner";

/**
 * CSV export is RFC-4180 quoted and formula-injection guarded — see
 * `src/lib/csv.ts` for the implementation and `csv.test.ts` for the cases.
 */

const TeacherDashboard = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { userId } = useAnonymousAuth();
  const { displayName: teacherName, signOut: teacherSignOut } = useTeacherAuth();
  const { session, players, currentPlayer, loading, error, refetch, endGame, togglePause } =
    useGameSession(sessionId ?? null, userId);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [joinLinkCopied, setJoinLinkCopied] = useState(false);

  const joinLink = typeof window !== "undefined"
    ? `${window.location.origin}/?code=${session?.code ?? ""}`
    : "";

  const copyJoinLink = async () => {
    if (!joinLink) return;
    const ok = await copyTextToClipboard(joinLink);
    if (!ok) {
      toast.error("Couldn't copy automatically — select the link and copy it manually.");
      return;
    }
    setJoinLinkCopied(true);
    toast.success("Join link copied!");
    setTimeout(() => setJoinLinkCopied(false), 2500);
  };

  const handleSignOut = async () => {
    await teacherSignOut();
    navigate("/");
  };

  const isGameMaster = currentPlayer?.is_game_master ?? false;
  const isPaused = !!session?.paused_at;

  useEffect(() => {
    if (session?.status === "finished") {
      navigate(`/results/${session.id}`);
    }
  }, [session?.status, session?.id, navigate]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  // A player is "late" if they joined after the game started
  const isLateJoiner = (playerCreatedAt: string) => {
    if (!session?.started_at) return false;
    return new Date(playerCreatedAt) > new Date(session.started_at);
  };

  const students = players.filter((p) => !p.is_game_master);
  const sorted = [...students].sort((a, b) => {
    if (a.completed && !b.completed) return -1;
    if (!a.completed && b.completed) return 1;
    return b.score - a.score;
  });

  const completedCount = sorted.filter((p) => p.completed).length;
  const lateCount = sorted.filter((p) => isLateJoiner(p.created_at)).length;
  const avgScore =
    sorted.length > 0
      ? Math.round(sorted.reduce((sum, p) => sum + p.score, 0) / sorted.length)
      : 0;
  const bestTime = sorted
    .filter((p) => p.completed && p.elapsed_time_ms > 0)
    .reduce((best, p) => Math.min(best, p.elapsed_time_ms), Infinity);

  const exportCSV = () => {
    const headers = ["Rank", "Nickname", "Score", "Time", "Misses", "Completed", "Late Join"];
    const rows = sorted.map((p, i) => [
      i + 1,
      p.nickname,
      p.score,
      formatTime(p.elapsed_time_ms),
      p.incorrect_attempts,
      p.completed ? "Yes" : "No",
      isLateJoiner(p.created_at) ? "Yes" : "No",
    ]);
    const csv = buildCsv(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `game-results-${session?.code ?? "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded!");
  };

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim() || !sessionId || !userId) return;
    setSending(true);
    const { error } = await supabase.from("broadcast_messages").insert({
      session_id: sessionId,
      sender_id: userId,
      message: broadcastMsg.trim(),
    });
    setSending(false);
    if (error) {
      toast.error("Failed to send message");
    } else {
      toast.success("Message sent to all students!");
      setBroadcastMsg("");
    }
  };

  /* Loading and "not found" are different states. Previously a null session
     rendered the spinner forever, so a bad link or a failed fetch left the
     teacher staring at an empty page with no message and no way out. */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        >
          <Puzzle className="h-12 w-12 text-primary" aria-hidden />
        </motion.div>
        <span className="sr-only">Loading dashboard…</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <Puzzle className="h-14 w-14 text-muted-foreground" aria-hidden />
        <h1 className="font-display text-xl font-bold text-foreground">Session not available</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {error ?? "This game may have ended, or the link is invalid."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              /* Without this, a retry that fails again looks exactly like a
                 button that does nothing at all. */
              void refetch().then((ok) => {
                if (!ok) toast.error("Still can't reach the server. Check your connection.");
              });
            }}
          >
            Try again
          </Button>
          <Button onClick={() => navigate("/")}>Back to Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to home"
            className="h-11 w-11 shrink-0"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-display text-lg font-bold">Teacher Dashboard</h1>
          <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">
            {session.code}
          </span>
          {isPaused && (
            <span className="rounded-full bg-destructive/10 px-3 py-0.5 text-xs font-bold text-destructive animate-pulse">
              ⏸ PAUSED
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">
            <Users className="h-3 w-3" /> {students.length} students
          </span>
          {lateCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <UserPlus className="h-3 w-3" /> {lateCount} late
            </span>
          )}
          <ThemeToggle />
          {teacherName && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-destructive hidden sm:flex"
              onClick={handleSignOut}
              title={`Sign out (${teacherName})`}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="text-xs">{teacherName}</span>
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <SummaryCard
              icon={<Users className="h-5 w-5 text-primary" />}
              label="Students"
              value={String(students.length)}
            />
            <SummaryCard
              icon={<CheckCircle2 className="h-5 w-5 text-success" />}
              label="Finished"
              value={`${completedCount}/${students.length}`}
            />
            <SummaryCard
              icon={<BarChart3 className="h-5 w-5 text-secondary" />}
              label="Avg Score"
              value={String(avgScore)}
            />
            <SummaryCard
              icon={<Clock className="h-5 w-5 text-accent-foreground" />}
              label="Best Time"
              value={bestTime === Infinity ? "—" : formatTime(bestTime)}
            />
          </div>

          {/* Try the game yourself — join as student in incognito */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Puzzle className="h-4 w-4 text-primary" /> Try the game yourself
              </CardTitle>
              <CardDescription className="text-sm">
                As the teacher, this page stays on the dashboard. To play the puzzle like a student, open the link below in an <strong>incognito or private window</strong> (or another browser), then join with a nickname.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* QR code — primary way for mobile: scan to open join page with code pre-filled */}
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-between">
                <JoinQRCode
                  key={session?.id ?? "no-session"}
                  value={joinLink}
                  label="Scan to join (opens link with code)"
                  size={160}
                  className="shrink-0"
                />
                <div className="flex flex-col gap-2 flex-1 min-w-0 w-full sm:w-auto">
                  <p className="text-xs text-muted-foreground font-medium">Or copy link</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      readOnly
                      value={joinLink}
                      className="font-mono text-xs bg-muted/50 min-h-[44px] touch-manipulation"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 shrink-0 min-h-[44px] touch-manipulation"
                      onClick={copyJoinLink}
                    >
                      {joinLinkCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      {joinLinkCopied ? "Copied!" : "Copy link"}
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Share code <strong>{session?.code}</strong> or the link — students open the site, enter the code (or scan QR), and join.
              </p>
            </CardContent>
          </Card>

          {/* Game Controls */}
          {isGameMaster && (
            <Button
              variant={isPaused ? "default" : "outline"}
              size="lg"
              className="w-full gap-2"
              onClick={() => {
                void togglePause().then((message) => {
                  if (message) toast.error(message);
                });
              }}
            >
              {isPaused ? (
                <>
                  <Play className="h-5 w-5" /> Resume Game
                </>
              ) : (
                <>
                  <Pause className="h-5 w-5" /> Pause Game
                </>
              )}
            </Button>
          )}

          {/* Broadcast Message */}
          {isGameMaster && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Send className="h-4 w-4" /> Broadcast to Students
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendBroadcast();
                  }}
                >
                  <Input
                    placeholder="Type a message for all students..."
                    value={broadcastMsg}
                    onChange={(e) => setBroadcastMsg(e.target.value)}
                    maxLength={200}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={!broadcastMsg.trim() || sending}
                    className="gap-1"
                  >
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </form>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    "👏 Great job!",
                    "⏰ Hurry up!",
                    "⏳ 2 minutes left!",
                    "🤔 Read carefully!",
                    "💪 Almost there!",
                  ].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={sending}
                      onClick={() => setBroadcastMsg(preset)}
                      onDoubleClick={() => {
                        setBroadcastMsg(preset);
                        supabase
                          .from("broadcast_messages")
                          .insert({
                            session_id: sessionId!,
                            sender_id: userId!,
                            message: preset,
                          })
                          .then(({ error }) => {
                            if (!error) toast.success("Sent: " + preset);
                          });
                      }}
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Tap to fill · Double-tap to send instantly
                </p>
              </CardContent>
            </Card>
          )}

          {/* Class Progress */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Class Progress</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {completedCount}/{students.length} complete
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress
                value={students.length > 0 ? (completedCount / students.length) * 100 : 0}
                className="h-3"
              />
            </CardContent>
          </Card>

          {/* Student List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Student Progress</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={exportCSV}
                >
                  <Download className="h-3 w-3" /> Export CSV
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sorted.map((player, i) => {
                  const late = isLateJoiner(player.created_at);
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                        player.completed
                          ? "border-success/30 bg-success/5"
                          : "border-border bg-background"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-display text-sm font-semibold">
                              {player.nickname}
                            </span>
                            {late && (
                              <span
                                title="Joined after game started"
                                className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              >
                                <UserPlus className="h-2.5 w-2.5" /> Late
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Trophy className="h-3 w-3" />
                            {player.score}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(player.elapsed_time_ms)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {player.incorrect_attempts}
                          </span>
                        </div>
                        {player.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  );
                })}
                {sorted.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">No students connected yet.</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Share code{" "}
                      <strong className="font-mono text-foreground">{session.code}</strong> or the join
                      link above — they will appear here as they join.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* End Game */}
          {isGameMaster && (
            <Button
              variant="destructive"
              size="lg"
              className="w-full gap-2"
              onClick={() => {
                void endGame().then((message) => {
                  if (message) toast.error(message);
                });
              }}
            >
              <StopCircle className="h-5 w-5" /> End Game for All Students
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        {icon}
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default TeacherDashboard;
