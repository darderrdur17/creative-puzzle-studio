import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 800;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Background guest session for students (no email/password). Teachers use their own login separately. */
export function useAnonymousAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const signInAsGuest = useCallback(async (): Promise<string | null> => {
    let lastError: string | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (!error && data.user?.id) {
          setUserId(data.user.id);
          setAuthError(null);
          return data.user.id;
        }
        lastError = error?.message ?? "Could not start a guest session";
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Connection failed";
      }
      if (attempt < MAX_RETRIES - 1) await delay(RETRY_DELAY_MS);
    }

    setAuthError(lastError);
    setUserId(null);
    return null;
  }, []);

  const ensureGuestSession = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        setAuthError(null);
        return session.user.id;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setAuthError(msg);
    }
    return signInAsGuest();
  }, [signInAsGuest]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setAuthError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (session?.user?.id) {
          setUserId(session.user.id);
          setLoading(false);
          return;
        }

        await signInAsGuest();
      } catch (e) {
        if (!cancelled) {
          setAuthError(e instanceof Error ? e.message : "Connection failed");
          setUserId(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id) {
        setUserId(session.user.id);
        setAuthError(null);
        return;
      }

      setUserId(null);

      if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
        void signInAsGuest();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [signInAsGuest]);

  const retryAuth = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    await ensureGuestSession();
    setLoading(false);
  }, [ensureGuestSession]);

  return { userId, loading, authError, retryAuth, ensureGuestSession };
}
