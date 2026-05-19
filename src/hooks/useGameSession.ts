import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateGameCode } from "@/lib/gameData";
import type { Tables } from "@/integrations/supabase/types";

type GameSession = Tables<"game_sessions">;
type GamePlayer = Tables<"game_players">;

export function useGameSession(sessionId: string | null, userId: string | null) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<GamePlayer | null>(null);
  const [loading, setLoading] = useState(!!sessionId);
  const [error, setError] = useState<string | null>(null);

  // Fetch session and players
  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    const { data: sess, error: sessErr } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();
    if (sessErr) {
      setError(sessErr.message);
      setLoading(false);
      return;
    }
    setSession(sess);

    const { data: pls } = await supabase
      .from("game_players")
      .select("*")
      .eq("session_id", sessionId)
      .order("score", { ascending: false });
    setPlayers(pls || []);
    if (userId) {
      setCurrentPlayer(pls?.find((p) => p.user_id === userId) ?? null);
    }
    setLoading(false);
  }, [sessionId, userId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Real-time subscriptions
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`game-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setSession(payload.new as GameSession);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players", filter: `session_id=eq.${sessionId}` },
        () => {
          // Refetch all players for consistency
          fetchSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchSession]);

  // Create a new game session
  const createSession = useCallback(
    async (nickname: string) => {
      if (!userId) return null;
      const code = generateGameCode();
      const { data: sess, error: sessErr } = await supabase
        .from("game_sessions")
        .insert({ code, created_by: userId })
        .select()
        .single();
      if (sessErr) {
        setError(sessErr.message);
        return null;
      }
      // Join as game master
      const { error: playerErr } = await supabase.from("game_players").insert({
        session_id: sess.id,
        user_id: userId,
        nickname,
        is_game_master: true,
      });
      if (playerErr) {
        setError(playerErr.message);
        return null;
      }
      return sess;
    },
    [userId]
  );

  // Join existing session by code — works for both lobby and in-progress games
  const joinSession = useCallback(
    async (code: string, nickname: string, activeUserId?: string) => {
      const uid = activeUserId ?? userId;
      if (!uid) {
        setError(
          "Still connecting — tap \"Try again\" below, or reload the page. No account is needed to join as a student."
        );
        return null;
      }
      setError(null);

      // Accept lobby AND playing sessions so late-joiners can still enter
      const { data: sess, error: sessErr } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("code", code.toUpperCase())
        .in("status", ["lobby", "playing"])
        .single();

      if (sessErr || !sess) {
        setError("Game not found. Check your code and try again.");
        return null;
      }

      const { error: playerErr } = await supabase.from("game_players").insert({
        session_id: sess.id,
        user_id: uid,
        nickname,
      });

      if (playerErr) {
        if (playerErr.message.includes("duplicate") || playerErr.code === "23505") {
          // Player is already registered — just send them to the right page
          return sess;
        }
        setError(playerErr.message);
        return null;
      }

      return sess;
    },
    [userId]
  );

  // Game master actions
  const startGame = useCallback(async () => {
    if (!sessionId) return;
    await supabase
      .from("game_sessions")
      .update({ status: "playing", started_at: new Date().toISOString() })
      .eq("id", sessionId);
  }, [sessionId]);

  const endGame = useCallback(async () => {
    if (!sessionId) return;
    await supabase
      .from("game_sessions")
      .update({ status: "finished", finished_at: new Date().toISOString(), paused_at: null })
      .eq("id", sessionId);
  }, [sessionId]);

  const togglePause = useCallback(async () => {
    if (!sessionId || !session) return;
    const isPaused = !!session.paused_at;
    await supabase
      .from("game_sessions")
      .update({ paused_at: isPaused ? null : new Date().toISOString() })
      .eq("id", sessionId);
  }, [sessionId, session]);

  const updateDifficulty = useCallback(
    async (difficulty: string) => {
      if (!sessionId) return;
      await supabase
        .from("game_sessions")
        .update({ difficulty: difficulty as GameSession["difficulty"] })
        .eq("id", sessionId);
    },
    [sessionId]
  );

  const kickPlayer = useCallback(
    async (playerId: string) => {
      if (!sessionId) return;
      await supabase.from("game_players").delete().eq("id", playerId).eq("session_id", sessionId);
    },
    [sessionId]
  );

  // Player actions
  const updateScore = useCallback(
    async (score: number, incorrectAttempts: number, elapsedMs: number, completed: boolean) => {
      if (!currentPlayer) return;
      await supabase
        .from("game_players")
        .update({
          score,
          incorrect_attempts: incorrectAttempts,
          elapsed_time_ms: elapsedMs,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", currentPlayer.id);
    },
    [currentPlayer]
  );

  return {
    session,
    players,
    currentPlayer,
    loading,
    error,
    setError,
    createSession,
    joinSession,
    startGame,
    endGame,
    togglePause,
    updateDifficulty,
    kickPlayer,
    updateScore,
    refetch: fetchSession,
  };
}
