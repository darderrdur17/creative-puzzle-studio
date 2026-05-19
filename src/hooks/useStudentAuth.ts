import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { AUTH_ROLE_KEY } from "@/lib/authRoles";
import { migrateBestIdeasAnswer } from "@/lib/bestIdeasAnswer";
import { stashPendingBestIdeasMigration } from "@/lib/authCallback";

export function useStudentAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const u = session?.user ?? null;
        setUser(u && !u.is_anonymous && u.user_metadata?.[AUTH_ROLE_KEY] === "student" ? u : null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u && !u.is_anonymous && u.user_metadata?.[AUTH_ROLE_KEY] === "student" ? u : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const capturePriorUserId = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const priorUserId = await capturePriorUserId();
    stashPendingBestIdeasMigration(priorUserId);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    const newUser = data.user;
    if (newUser && priorUserId && priorUserId !== newUser.id) {
      await migrateBestIdeasAnswer(priorUserId, newUser.id);
    }
    return { user: newUser };
  }, [capturePriorUserId]);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const priorUserId = await capturePriorUserId();
    stashPendingBestIdeasMigration(priorUserId);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          [AUTH_ROLE_KEY]: "student",
          display_name: displayName ?? email.split("@")[0],
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) return { error: error.message };

    if (data.user && priorUserId && priorUserId !== data.user.id) {
      await migrateBestIdeasAnswer(priorUserId, data.user.id);
    }
    return { user: data.user, needsEmailConfirmation: !data.session };
  }, [capturePriorUserId]);

  const sendMagicLink = useCallback(async (email: string) => {
    const priorUserId = await capturePriorUserId();
    stashPendingBestIdeasMigration(priorUserId);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { [AUTH_ROLE_KEY]: "student" },
      },
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const displayName = user
    ? (user.user_metadata?.display_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Student"
    : null;

  return {
    user,
    loading,
    isStudent: !!user,
    displayName,
    email: user?.email ?? null,
    signIn,
    signUp,
    sendMagicLink,
    signOut,
  };
}
