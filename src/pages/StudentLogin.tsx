import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Puzzle, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Lightbulb, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useStudentAuth } from "@/hooks/useStudentAuth";

type Tab = "signin" | "signup" | "magic";

export default function StudentLogin() {
  const navigate = useNavigate();
  const { user, loading, signIn, signUp, sendMagicLink } = useStudentAuth();

  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await signIn(email.trim(), password.trim());
    setSubmitting(false);
    if (result.error) setError(result.error);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await signUp(email.trim(), password.trim(), displayName.trim() || undefined);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else if (result.needsEmailConfirmation) {
      setSuccess("Account created! Check your email to confirm, then sign in.");
      setTab("signin");
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const result = await sendMagicLink(email.trim());
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Check your email for a sign-in link. Your ideas will sync when you open it.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        >
          <Puzzle className="h-12 w-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-md space-y-5"
      >
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 min-h-[44px] touch-manipulation"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Button>

        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-stage-incubation/20 shadow-lg">
            <Lightbulb className="h-8 w-8 text-stage-incubation" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
            Save across devices
          </h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed px-2">
            Optional student account — sync your &ldquo;best ideas&rdquo; answer on phone, tablet, and computer.
          </p>
        </div>

        <Card className="shadow-lg border-stage-incubation/20">
          <div className="flex border-b overflow-x-auto">
            {(
              [
                { id: "signin" as const, label: "Sign In" },
                { id: "signup" as const, label: "Create" },
                { id: "magic" as const, label: "Email Link" },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id);
                  setError(null);
                  setSuccess(null);
                }}
                className={[
                  "flex-1 min-w-[5.5rem] py-3 text-sm font-medium transition-colors touch-manipulation",
                  tab === id
                    ? "border-b-2 border-stage-incubation text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === "magic" ? (
              <motion.div
                key="magic"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Magic link
                  </CardTitle>
                  <CardDescription className="text-xs">
                    No password — we&apos;ll email you a link to sign in.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleMagicLink} className="space-y-4">
                    <EmailField email={email} setEmail={setEmail} id="magic-email" />
                    <AuthMessages error={error} success={success} />
                    <Button
                      type="submit"
                      className="w-full gap-2 min-h-[48px] touch-manipulation text-base"
                      disabled={!email.trim() || submitting}
                    >
                      {submitting ? "Sending…" : "Send link"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                </CardContent>
              </motion.div>
            ) : tab === "signin" ? (
              <motion.div
                key="signin"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.18 }}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Welcome back</CardTitle>
                  <CardDescription className="text-xs">
                    Sign in to load your saved incubation answer on this device.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <EmailField email={email} setEmail={setEmail} id="si-email" />
                    <PasswordField
                      password={password}
                      setPassword={setPassword}
                      showPassword={showPassword}
                      setShowPassword={setShowPassword}
                      id="si-password"
                      autoComplete="current-password"
                    />
                    <AuthMessages error={error} success={success} />
                    <Button
                      type="submit"
                      className="w-full gap-2 min-h-[48px] touch-manipulation text-base"
                      disabled={!email.trim() || !password.trim() || submitting}
                    >
                      {submitting ? "Signing in…" : "Sign In"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                </CardContent>
              </motion.div>
            ) : (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Create account</CardTitle>
                  <CardDescription className="text-xs">
                    Free — use the same email on any device.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div>
                      <label htmlFor="su-name" className="mb-1.5 block text-sm font-medium">
                        Display name <span className="text-muted-foreground">(optional)</span>
                      </label>
                      <Input
                        id="su-name"
                        placeholder="e.g. Alex"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        maxLength={20}
                        className="min-h-[48px] text-base touch-manipulation"
                        autoComplete="nickname"
                      />
                    </div>
                    <EmailField email={email} setEmail={setEmail} id="su-email" />
                    <PasswordField
                      password={password}
                      setPassword={setPassword}
                      showPassword={showPassword}
                      setShowPassword={setShowPassword}
                      id="su-password"
                      autoComplete="new-password"
                    />
                    <AuthMessages error={error} success={success} />
                    <Button
                      type="submit"
                      className="w-full gap-2 min-h-[48px] touch-manipulation text-base"
                      disabled={!email.trim() || !password.trim() || submitting}
                    >
                      {submitting ? "Creating…" : "Create Account"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <Button
          variant="ghost"
          className="w-full min-h-[48px] touch-manipulation text-muted-foreground"
          onClick={() => navigate("/")}
        >
          Continue without an account
        </Button>
      </motion.div>
    </div>
  );
}

function EmailField({
  email,
  setEmail,
  id,
}: {
  email: string;
  setEmail: (v: string) => void;
  id: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        Email
      </label>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@school.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="pl-9 min-h-[48px] text-base touch-manipulation"
        />
      </div>
    </div>
  );
}

function PasswordField({
  password,
  setPassword,
  showPassword,
  setShowPassword,
  id,
  autoComplete,
}: {
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  id: string;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        Password
      </label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="pl-9 pr-10 min-h-[48px] text-base touch-manipulation"
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function AuthMessages({ error, success }: { error: string | null; success: string | null }) {
  return (
    <>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-primary" role="status">
          {success}
        </p>
      )}
    </>
  );
}
