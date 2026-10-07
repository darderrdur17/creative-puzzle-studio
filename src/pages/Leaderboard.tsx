import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, ArrowLeft, Clock, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";
import type { Tables } from "@/integrations/supabase/types";

type LeaderboardEntry = Tables<"leaderboard">;

const Leaderboard = () => {
  const navigate = useNavigate();
  const { userId } = useAnonymousAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("leaderboard")
        .select("*")
        .order("total_score", { ascending: false })
        .limit(50);
      setEntries(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const formatTime = (ms: number | null) => {
    if (!ms) return "—";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  const getMedal = (i: number) => {
    if (i === 0) return "🥇";
    if (i === 1) return "🥈";
    if (i === 2) return "🥉";
    return `#${i + 1}`;
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg space-y-6"
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to home"
            className="h-11 w-11 shrink-0"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">All-Time Leaderboard</h1>
            <p className="text-sm text-muted-foreground">Top players across all games</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-secondary" /> Rankings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-muted-foreground">Loading...</p>
            ) : entries.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No games played yet. Be the first!</p>
            ) : (
              <div className="space-y-2">
                {entries.map((e, i) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      e.user_id === userId ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-center text-lg">{getMedal(i)}</span>
                      <div>
                        <span className="font-medium">{e.nickname}</span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {e.games_played} games
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Best: {formatTime(e.best_time_ms)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-primary">{e.total_score}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Leaderboard;
