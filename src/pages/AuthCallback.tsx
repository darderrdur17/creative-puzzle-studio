import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Puzzle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AUTH_ROLE_KEY } from "@/lib/authRoles";
import { migrateBestIdeasAnswer } from "@/lib/bestIdeasAnswer";
import {
  PENDING_BEST_IDEAS_MIGRATE_KEY,
  clearPendingBestIdeasMigration,
} from "@/lib/authCallback";

/**
 * Handles email magic-link / confirmation redirects from Supabase Auth.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      try {
        const priorUserId = sessionStorage.getItem(PENDING_BEST_IDEAS_MIGRATE_KEY);

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const user = session?.user;
        if (!user) {
          if (!cancelled) setError("Sign-in could not be completed. Please try again.");
          return;
        }

        if (!user.is_anonymous && user.user_metadata?.[AUTH_ROLE_KEY] !== "student") {
          await supabase.auth.updateUser({
            data: { [AUTH_ROLE_KEY]: "student" },
          });
        }

        if (priorUserId && priorUserId !== user.id) {
          await migrateBestIdeasAnswer(priorUserId, user.id);
        }
        clearPendingBestIdeasMigration();

        if (!cancelled) navigate("/", { replace: true });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Sign-in failed");
        }
      }
    };

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 text-center">
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
        <Button className="min-h-[48px] touch-manipulation" onClick={() => navigate("/student/login")}>
          Back to student sign-in
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        aria-label="Completing sign-in"
      >
        <Puzzle className="h-12 w-12 text-primary" />
      </motion.div>
    </div>
  );
}
