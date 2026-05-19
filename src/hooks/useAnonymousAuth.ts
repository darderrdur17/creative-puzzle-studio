import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAnonymousAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const trySignIn = useCallback(async () => {
    setAuthError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        return;
      }
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        setAuthError(error.message || "Sign-in failed");
        setUserId(null);
      } else {
        setUserId(data.user?.id ?? null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      setAuthError(msg);
      setUserId(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          setUserId(session.user.id);
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signInAnonymously();
        if (cancelled) return;
        if (error) {
          setAuthError(error.message || "Sign-in failed");
          setUserId(null);
        } else {
          setUserId(data.user?.id ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          setAuthError(e instanceof Error ? e.message : "Sign-in failed");
          setUserId(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthError(null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const retryAuth = useCallback(async () => {
    setLoading(true);
    await trySignIn();
    setLoading(false);
  }, [trySignIn]);

  return { userId, loading, authError, retryAuth };
}
