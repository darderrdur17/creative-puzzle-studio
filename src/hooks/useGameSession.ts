import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateGameCode } from "@/lib/gameData";
import type { Tables } from "@/integrations/supabase/types";

type GameSession = Tables<"game_sessions">;
type GamePlayer = Tables<"game_players">;

/** Coalesce bursts of realtime events into a single refetch. */
const REFETCH_DEBOUNCE_MS = 200;

export function useGameSession(sessionId: string | null, userId: string | null) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<GamePlayer | null>(null);
  const [loading, setLoading] = useState(!!sessionId);
  const [error, setError] = useState<string | null>(null);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch session and players.
  // `silent` skips the loading flag: realtime refreshes must not tear the page
  // down and replace it with a full-screen spinner on every player event.
  const fetchSession = useCallback(
    async (options?: { silent?: boolean }): Promise<boolean> => {
      if (!sessionId) return false;
      if (!options?.silent) setLoading(true);

      const { data: sess, error: sessErr } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessErr) {
        setError(sessErr.message);
        setLoading(false);
        return false;
      }
      setSession(sess);

      const { data: pls, error: plsErr } = await supabase
        .from("game_players")
        .select("*")
        .eq("session_id", sessionId)
        .order("score", { ascending: false });

      /* On a transient failure keep the previous list. Replacing it with []
         would read as "no students connected yet", which is indistinguishable
         from a genuinely empty lobby and impossible to recover from. */
      if (!plsErr && pls) {
        setPlayers(pls);
        if (userId) {
          setCurrentPlayer(pls.find((p) => p.user_id === userId) ?? null);
        }
      }
      setLoading(false);
      /* Callers need to know whether the retry actually worked — otherwise a
         manual "Try again" that fails again gives the user no feedback at all. */
      return !plsErr;
    },
    [sessionId, userId],
  );

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  // Real-time subscriptions
  useEffect(() => {
    if (!sessionId) return;

    const scheduleSilentRefetch = () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => {
        void fetchSession({ silent: true });
      }, REFETCH_DEBOUNCE_MS);
    };

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
          // Refetch all players for consistency, but coalesced and silently.
          scheduleSilentRefetch();
        }
      )
      .subscribe();

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchSession]);

  /** Runs a write and turns any failure into a human-readable message. */
  const runWrite = useCallback(
    async (
      label: string,
      action: () => PromiseLike<{ error: { message: string } | null }>,
    ): Promise<string | null> => {
      try {
        const { error: writeErr } = await action();
        if (writeErr) return `${label} failed: ${writeErr.message}`;
        return null;
      } catch (e) {
        return `${label} failed: ${e instanceof Error ? e.message : "unknown error"}`;
      }
    },
    [],
  );

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

  // Game master actions — each reports failure instead of silently doing nothing.
  const startGame = useCallback(async (): Promise<string | null> => {
    if (!sessionId) return "No active session.";
    return runWrite("Starting the game", () =>
      supabase
        .from("game_sessions")
        .update({ status: "playing", started_at: new Date().toISOString() })
        .eq("id", sessionId)
    );
  }, [sessionId, runWrite]);

  const endGame = useCallback(async (): Promise<string | null> => {
    if (!sessionId) return "No active session.";
    return runWrite("Ending the game", () =>
      supabase
        .from("game_sessions")
        .update({ status: "finished", finished_at: new Date().toISOString(), paused_at: null })
        .eq("id", sessionId)
    );
  }, [sessionId, runWrite]);

  const togglePause = useCallback(async (): Promise<string | null> => {
    if (!sessionId || !session) return "No active session.";
    const isPaused = !!session.paused_at;
    return runWrite(isPaused ? "Resuming the game" : "Pausing the game", () =>
      supabase
        .from("game_sessions")
        .update({ paused_at: isPaused ? null : new Date().toISOString() })
        .eq("id", sessionId)
    );
  }, [sessionId, session, runWrite]);

  const updateDifficulty = useCallback(
    async (difficulty: string): Promise<string | null> => {
      if (!sessionId) return "No active session.";
      return runWrite("Changing difficulty", () =>
        supabase
          .from("game_sessions")
          .update({ difficulty: difficulty as GameSession["difficulty"] })
          .eq("id", sessionId)
      );
    },
    [sessionId, runWrite]
  );

  const kickPlayer = useCallback(
    async (playerId: string): Promise<string | null> => {
      if (!sessionId) return "No active session.";
      return runWrite("Removing the player", () =>
        supabase.from("game_players").delete().eq("id", playerId).eq("session_id", sessionId)
      );
    },
    [sessionId, runWrite]
  );

  /**
   * Persist a player's result.
   *
   * Returns `true` only when the row was actually written, so the caller can
   * tell the player instead of letting a finished game vanish silently.
   *
   * If `currentPlayer` has not loaded yet (slow join, or the anon user id
   * changed after joining) the row is looked up by session + user rather than
   * giving up — previously this returned early and dropped the final score.
   */
  const updateScore = useCallback(
    async (
      score: number,
      incorrectAttempts: number,
      elapsedMs: number,
      completed: boolean,
    ): Promise<boolean> => {
      let playerId = currentPlayer?.id ?? null;

      if (!playerId) {
        if (!sessionId || !userId) return false;
        const { data } = await supabase
          .from("game_players")
          .select("id")
          .eq("session_id", sessionId)
          .eq("user_id", userId)
          .maybeSingle();
        playerId = data?.id ?? null;
      }
      if (!playerId) return false;

      const payload = {
        score,
        incorrect_attempts: incorrectAttempts,
        elapsed_time_ms: Math.max(0, Math.round(elapsedMs)),
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      };

      let query = supabase.from("game_players").update(payload).eq("id", playerId);
      /* A timeout must never overwrite a run another tab already completed, so
         an incomplete result only applies to rows that are still incomplete. */
      if (!completed) query = query.eq("completed", false);

      const { error: writeErr } = await query;
      if (writeErr) {
        setError(writeErr.message);
        return false;
      }
      return true;
    },
    [currentPlayer, sessionId, userId]
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
