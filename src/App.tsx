import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Lobby from "./pages/Lobby";
import GameEnhanced from "./pages/GameEnhanced";
import Results from "./pages/Results";
import Leaderboard from "./pages/Leaderboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherLogin from "./pages/TeacherLogin";
import GameTimePage from "./pages/GameTimePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
