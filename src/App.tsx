import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLogo } from "@/components/AppLogo";

/* The landing page is the primary entry point, so it stays eager — putting a
   lazy boundary in front of `/` would add a round-trip before first paint.
   NotFound is eager too: it is a few lines and lazy-loading it would only add
   a request on an error path. */
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

/* Every other route is split into its own chunk. Previously all nine routes
   shipped in a single bundle, which meant a visitor to the landing page
   downloaded the game board, teacher dashboard and leaderboard code they
   would never execute. */
const Lobby = lazy(() => import("./pages/Lobby"));
const GameEnhanced = lazy(() => import("./pages/GameEnhanced"));
const Results = lazy(() => import("./pages/Results"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const TeacherLogin = lazy(() => import("./pages/TeacherLogin"));
const GameTimePage = lazy(() => import("./pages/GameTimePage"));

const queryClient = new QueryClient();

/**
 * Suspense fallback shown while a route chunk is fetched. Built from design
 * tokens so it matches both the light and dark themes, and it fills the
 * viewport so swapping in the real page causes no layout shift.
 */
const RouteFallback = () => (
  <div
    className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background"
    role="status"
    aria-live="polite"
  >
    <AppLogo size="md" className="animate-ring-breathe" />
    <p className="text-sm font-medium tracking-wide text-muted-foreground">Loading…</p>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/teacher/login" element={<TeacherLogin />} />
              <Route path="/lobby/:sessionId" element={<Lobby />} />
              <Route path="/game/:sessionId" element={<GameEnhanced />} />
              <Route path="/results/:sessionId" element={<Results />} />
              <Route path="/dashboard/:sessionId" element={<TeacherDashboard />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              {/* Lab-style 8-puzzle & sliding puzzle demo */}
              <Route path="/lab07/game" element={<GameTimePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
