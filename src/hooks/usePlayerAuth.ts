import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isStudentUser } from "@/lib/authRoles";

/**
 * Player identity for game sessions: anonymous guest, registered student, or teacher.
 * Teachers reuse their email account id when creating games (no separate anonymous session).
 */
export function usePlayerAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [isRegisteredStudent, setIsRegisteredStudent] = useState(false);

  const applySession = useCallback(
    (sessionUser: { id: string; is_anonymous?: boolean; user_metadata?: Record<string, unknown> } | null) => {
      if (!sessionUser) {
        setUserId(null);
        setIsAnonymous(true);
        setIsRegisteredStudent(false);
        return;
      }

      setUserId(sessionUser.id);
      const anonymous = !!sessionUser.is_anonymous;
      setIsAnonymous(anonymous);
      setIsRegisteredStudent(!anonymous && isStudentUser(sessionUser.user_metadata));
    },
    [],
  );

  const ensureAnonymousSession = useCallback(async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      setAuthError(error.message || "Sign-in failed");
      setUserId(null);
      setIsAnonymous(true);
      setIsRegisteredStudent(false);
      return false;
    }
    applySession(data.user ?? null);
    setAuthError(null);
    return true;
  }, [applySession]);

  const resolveSession = useCallback(async () => {
    setAuthError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return ensureAnonymousSession();
    }

    applySession(user);

    // Guest without a session user id should never stay empty
    if (user.is_anonymous) {
      setAuthError(null);
      return true;
    }

    return true;
  }, [applySession, ensureAnonymousSession]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await resolveSession();
      } catch (e) {
        if (!cancelled) {
          setAuthError(e instanceof Error ? e.message : "Sign-in failed");
          setUserId(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      if (event === "SIGNED_OUT") {
        setLoading(true);
        await ensureAnonymousSession();
        setLoading(false);
        return;
      }

      const user = session?.user ?? null;
      if (user) {
        applySession(user);
        setAuthError(null);
      } else if (event === "INITIAL_SESSION") {
        await ensureAnonymousSession();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applySession, ensureAnonymousSession, resolveSession]);

  const retryAuth = useCallback(async () => {
    setLoading(true);
    await resolveSession();
    setLoading(false);
  }, [resolveSession]);

  return {
    userId,
    loading,
    authError,
    retryAuth,
    isAnonymous,
    isRegisteredStudent,
  };
}

/** @deprecated Use usePlayerAuth — kept for existing imports */
export const useAnonymousAuth = usePlayerAuth;
