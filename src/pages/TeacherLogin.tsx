import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Puzzle, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTeacherAuth } from "@/hooks/useTeacherAuth";

// ─── Demo credentials (visible to teachers on the page) ───────────────────────
const DEMO_EMAIL = "demo.teacher@puzzle.com";
const DEMO_PASSWORD = "Teacher2024!";

export default function TeacherLogin() {
  const navigate = useNavigate();
  const { user, loading, signIn, signUp } = useTeacherAuth();

  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [demoCooldown, setDemoCooldown] = useState(0); // seconds until demo button can be used again

  // If the teacher is already logged in, send them straight to the landing page
  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  // Cooldown timer for demo button (avoids rate limits after failed create)
  useEffect(() => {
    if (demoCooldown <= 0) return;
    const t = setInterval(() => setDemoCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [demoCooldown]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await signIn(email.trim(), password.trim());
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    }
    // Navigation is handled by the useEffect above once user state updates
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const result = await signUp(email.trim(), password.trim(), displayName.trim() || undefined);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    /* Supabase answers a sign-up for an existing address with a fake user and
       no error. Saying "check your email" here would send the teacher to an
       inbox that never receives anything, so tell them what actually happened. */
    if (result.alreadyRegistered) {
      setError("An account with that email already exists. Sign in instead.");
      setTab("signin");
      return;
    }

    setSuccess("Account created! Check your email to confirm your address, then sign in.");
    setTab("signin");
  };

  // Demo account: sign in first; if user doesn't exist, try creating once (then sign in). Cooldown on create failure to avoid rate limits.
  const handleUseDemo = async () => {
    if (demoCooldown > 0) return;
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    let result = await signIn(DEMO_EMAIL, DEMO_PASSWORD);
    if (!result.error) {
      setSubmitting(false);
      return;
    }

    // Sign-in failed — try creating the demo user once (first-time setup)
    const signupResult = await signUp(DEMO_EMAIL, DEMO_PASSWORD, "Demo Teacher");
    if (signupResult.error) {
      setSubmitting(false);
      setDemoCooldown(45);
      if (signupResult.error.includes("seconds") || signupResult.error.includes("rate")) {
        setError("Too many attempts. Please wait about a minute, then try again or create your own account below.");
      } else {
        setError("Could not create demo account. Create your own teacher account below.");
      }
      return;
    }

    result = await signIn(DEMO_EMAIL, DEMO_PASSWORD);
    setSubmitting(false);
    if (result.error) {
      /* Two different worlds produce the same second failure. If the address was
         already registered, the account exists and something else is blocking
         the login (most often email confirmation). Otherwise the account really
         was just created and still needs confirming. */
      setError(
        signupResult.alreadyRegistered
          ? "The demo account already exists, but sign-in was refused. If email confirmation is switched on in Supabase Auth, confirm that address or turn confirmation off, then try again."
          : "Demo account was created. If your project requires email confirmation, turn it off in Supabase Auth settings, or sign in with the demo email/password above."
      );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-md space-y-5"
      >
        {/* Back link */}
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Button>

        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/25">
            <Sparkles className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Teacher Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to create and manage puzzle game sessions
          </p>
        </div>

        {/* Demo account callout */}
        <div className="rounded-2xl border border-secondary/40 bg-secondary/10 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-secondary">
            Demo Account
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Email</span>
              <p className="font-mono font-medium text-foreground">{DEMO_EMAIL}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Password</span>
              <p className="font-mono font-medium text-foreground">{DEMO_PASSWORD}</p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80"
            disabled={submitting || demoCooldown > 0}
            onClick={handleUseDemo}
          >
            {submitting
              ? "Signing in…"
              : demoCooldown > 0
                ? `Try again in ${demoCooldown}s`
                : "Use Demo Account →"}
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            One-click test login. If the demo user doesn’t exist yet, it will be created on first use. Other teachers can create their own account below.
          </p>
        </div>

        {/* Auth tabs */}
        <Card className="shadow-lg">
          {/* Tab switcher */}
          <div className="flex border-b">
            {(["signin", "signup"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(null); setSuccess(null); }}
                className={[
                  "flex-1 py-3 text-sm font-medium transition-colors",
                  tab === t
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {t === "signin" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === "signin" ? (
              <motion.div
                key="signin"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.18 }}
              >
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Welcome back</CardTitle>
                  <CardDescription className="text-xs">
                    Sign in with your teacher account to continue.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div>
                      <label htmlFor="si-email" className="mb-1.5 block text-sm font-medium">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="si-email"
                          type="email"
                          placeholder="you@school.edu"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-9"
                          autoComplete="email"
                          autoFocus
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="si-password" className="mb-1.5 block text-sm font-medium">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="si-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-9 pr-10"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          aria-pressed={showPassword}
                          /* 44x44 hit area per TESTING_GUIDE.md. The icon stays
                             h-4 w-4 and the button is centred on the input, so the
                             extra hit area is invisible. Was 16x16 with no
                             accessible name and `tabIndex={-1}`, which also made it
                             unreachable by keyboard (WCAG 2.1.1). */
                          className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                      </p>
                    )}
                    {success && (
                      <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                        {success}
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="w-full gap-2"
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
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Create a teacher account</CardTitle>
                  <CardDescription className="text-xs">
                    Register with your school email to manage game sessions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div>
                      <label htmlFor="su-name" className="mb-1.5 block text-sm font-medium">
                        Your Name <span className="text-muted-foreground">(optional)</span>
                      </label>
                      <Input
                        id="su-name"
                        placeholder="e.g. Ms. Rivera"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div>
                      <label htmlFor="su-email" className="mb-1.5 block text-sm font-medium">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="su-email"
                          type="email"
                          placeholder="you@school.edu"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-9"
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="su-password" className="mb-1.5 block text-sm font-medium">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="su-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Min. 6 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-9 pr-10"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          aria-pressed={showPassword}
                          /* 44x44 hit area per TESTING_GUIDE.md. The icon stays
                             h-4 w-4 and the button is centred on the input, so the
                             extra hit area is invisible. Was 16x16 with no
                             accessible name and `tabIndex={-1}`, which also made it
                             unreachable by keyboard (WCAG 2.1.1). */
                          className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                      </p>
                    )}
                    {success && (
                      <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                        {success}
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="w-full gap-2"
                      disabled={!email.trim() || !password.trim() || submitting}
                    >
                      {submitting ? "Creating account…" : "Create Account"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Students don't need an account —{" "}
          <button
            type="button"
            data-inline
            className="underline hover:text-foreground"
            onClick={() => navigate("/")}
          >
            join a game here
          </button>
          .
        </p>
      </motion.div>
    </div>
  );
}
