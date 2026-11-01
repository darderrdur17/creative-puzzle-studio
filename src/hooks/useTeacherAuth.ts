import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AuthResult = { user: User | null; error: string | null };
export type SignUpResult = AuthResult & { alreadyRegistered: boolean };

export function useTeacherAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const u = session?.user ?? null;
        setUser(u && !u.is_anonymous ? u : null);
      } catch (e) {
        console.error("Teacher auth init error:", e);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u && !u.is_anonymous ? u : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  /* Both callbacks return a discriminated result object with BOTH keys always
     present. The previous version returned `{ error }` or `{ user }`, which
     TypeScript types as a union — so `result.error` was only legal on one arm
     and `result.user` only on the other. Keeping `error: null` on success makes
     every call site read the same way. */
  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { user: null, error: error.message };
      return { user: data.user, error: null };
    },
    []
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string): Promise<SignUpResult> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName ?? email.split("@")[0] } },
      });
      if (error) return { user: null, error: error.message, alreadyRegistered: false };

      /* For an address that already has an account, Supabase deliberately
         returns a user with an EMPTY `identities` array and NO error, so the
         endpoint cannot be used to enumerate accounts. Treat that as "already
         registered", otherwise the UI tells the teacher to check an inbox for a
         mail that will never arrive. */
      const alreadyRegistered = !!data.user && (data.user.identities?.length ?? 0) === 0;

      return { user: data.user, error: null, alreadyRegistered };
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const displayName = user
    ? (user.user_metadata?.display_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Teacher"
    : null;

  return {
    user,
    loading,
    isTeacher: !!user,
    displayName,
    signIn,
    signUp,
    signOut,
  };
}
