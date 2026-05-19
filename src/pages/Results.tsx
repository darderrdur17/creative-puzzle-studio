import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Clock, Target, Home, Crown, Puzzle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";
import { useGameSession } from "@/hooks/useGameSession";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import confetti from "canvas-confetti";
import elephantPuzzleImage from "@/assets/elephant-jewel-forest.png";

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  very_hard: "Very Hard",
};

const Results = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { userId } = useAnonymousAuth();
  const { session, players, currentPlayer, loading } = useGameSession(sessionId ?? null, userId);
  const confettiFired = useRef(false);

  const isGameMaster = currentPlayer?.is_game_master ?? false;
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const myRank = sortedPlayers.findIndex((p) => p.user_id === userId) + 1;

  // Save to all-time leaderboard
  useEffect(() => {
    if (!currentPlayer?.completed || currentPlayer.score === 0) return;
    const save = async () => {
      try {
        const { data: existing } = await supabase
          .from("leaderboard")
          .select("*")
          .eq("user_id", currentPlayer.user_id)
          .maybeSingle();
        if (existing) {
          await supabase
            .from("leaderboard")
            .update({
              total_score: existing.total_score + currentPlayer.score,
              games_played: existing.games_played + 1,
              best_time_ms: existing.best_time_ms
                ? Math.min(existing.best_time_ms, currentPlayer.elapsed_time_ms)
                : currentPlayer.elapsed_time_ms,
              last_played_at: new Date().toISOString(),
              nickname: currentPlayer.nickname,
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("leaderboard").insert({
            user_id: currentPlayer.user_id,
            nickname: currentPlayer.nickname,
            total_score: currentPlayer.score,
            games_played: 1,
            best_time_ms: currentPlayer.elapsed_time_ms,
          });
        }
      } catch (err) {
        console.warn("Leaderboard save failed:", err);
      }
    };
    save();
  }, [currentPlayer]);

  // Fire confetti for top 3 finishers
  useEffect(() => {
    if (confettiFired.current || !players.length) return;
    if (myRank >= 1 && myRank <= 3 && currentPlayer?.completed) {
      confettiFired.current = true;
      const count = myRank === 1 ? 300 : myRank === 2 ? 180 : 100;
      confetti({ particleCount: count, spread: 100, origin: { y: 0.5 } });
    }
  }, [myRank, players.length, currentPlayer]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  const getMedal = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return null;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
          <Puzzle className="h-12 w-12 text-primary" aria-hidden />
        </motion.div>
        <span className="sr-only">Loading results…</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <Puzzle className="h-16 w-16 text-muted-foreground mb-4" aria-hidden />
        <h1 className="font-display text-xl font-bold text-foreground">Session not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This game may have ended or the link is invalid.
        </p>
        <Button variant="default" className="mt-6 gap-2" onClick={() => navigate("/")}>
          <Home className="h-4 w-4" />
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl space-y-6"
      >
        {/* Header */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.15 }}
            className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-secondary to-secondary/70 shadow-xl shadow-secondary/30"
          >
            <Trophy className="h-10 w-10 text-secondary-foreground" />
          </motion.div>
          <h1 className="font-display text-3xl font-bold text-foreground">Game Results</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {DIFFICULTY_LABELS[session.difficulty] ?? session.difficulty} difficulty &middot; {players.length} player{players.length !== 1 ? "s" : ""}
          </p>

          {/* Personal result highlight */}
          {currentPlayer && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4 inline-flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-3 shadow-sm"
            >
              <Star className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="text-xs text-muted-foreground">Your score</p>
                <p className="font-display text-2xl font-bold text-primary leading-none">
                  {currentPlayer.score}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">pts</span>
                </p>
              </div>
              {myRank > 0 && (
                <div className="text-left border-l border-border pl-3">
                  <p className="text-xs text-muted-foreground">Rank</p>
                  <p className="font-display text-2xl font-bold leading-none">
                    {getMedal(myRank - 1) ?? `#${myRank}`}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Full puzzle — same artwork as the jigsaw; visible to teacher and all students when the game ends */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45 }}
          className="overflow-hidden rounded-2xl border bg-card p-3 shadow-md"
        >
          <img
            src={elephantPuzzleImage}
            alt="Complete creativity puzzle: elephant artwork"
            className="mx-auto max-h-[min(52vh,440px)] w-full rounded-lg object-contain object-center"
            decoding="async"
          />
          <p className="mt-2 text-center text-xs font-medium text-muted-foreground">The complete puzzle</p>
        </motion.div>

        {/* Full Scoreboard */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-secondary" />
              Full Scoreboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedPlayers.map((p, i) => {
                const isMe = p.user_id === userId;
                const medal = getMedal(i);
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={[
                      "flex items-center justify-between rounded-xl border px-4 py-3 transition-colors",
                      isMe
                        ? "border-primary/30 bg-primary/5 ring-1 ring-primary/20"
                        : i === 0
                          ? "border-secondary/30 bg-secondary/5"
                          : "border-border bg-background",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank / Medal */}
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-display text-base font-bold">
                        {medal ?? i + 1}
                      </span>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-display font-semibold text-sm">{p.nickname}</span>
                          {p.is_game_master && <Crown className="h-3 w-3 text-secondary" />}
                          {isMe && <Badge variant="outline" className="text-[10px] px-1.5 py-0">You</Badge>}
                          {!p.completed && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 opacity-60">
                              Incomplete
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(p.elapsed_time_ms)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {p.incorrect_attempts} miss{p.incorrect_attempts !== 1 ? "es" : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className={`font-display text-xl font-bold ${i === 0 ? "text-secondary" : "text-primary"}`}>
                      {p.score}
                    </span>
                  </motion.div>
                );
              })}

              {sortedPlayers.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No scores yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="gap-2" onClick={() => navigate("/")}>
            <Home className="h-4 w-4" />
            Home
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate("/leaderboard")}>
            <Trophy className="h-4 w-4" />
            All-time Board
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Results;
