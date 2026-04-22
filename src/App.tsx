import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HashRouter, Routes, Route } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SaveRecoveryDialog } from "@/components/SaveRecoveryDialog";
import TitleScreen from "./pages/TitleScreen";
import NotFound from "./pages/NotFound";

// Lazy-loaded routes for code splitting
const ClubSelection = lazy(() => import("./pages/ClubSelection"));
const GameShell = lazy(() => import("./pages/GameShell"));
const ChallengePicker = lazy(() => import("./pages/ChallengePicker"));
const ModeSelect = lazy(() => import("./pages/ModeSelect"));
const ManagerCreation = lazy(() => import("./pages/ManagerCreation"));

// Loading fallback
const LoadingFallback = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
    <img
      src="/logo.png"
      alt="Dynasty Manager"
      className="w-20 h-20 drop-shadow-[0_0_16px_hsl(var(--primary)/0.35)] animate-pulse"
    />
    <div className="text-muted-foreground text-sm">Loading...</div>
  </div>
);

const App = () => {
  const reducedMotion = useGameStore(s => s.settings.reducedMotion);

  return (
  <ErrorBoundary scope="app">
    <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SaveRecoveryDialog />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<TitleScreen />} />
              <Route
                path="/mode-select"
                element={<ErrorBoundary scope="mode-select"><ModeSelect /></ErrorBoundary>}
              />
              <Route
                path="/select-club"
                element={<ErrorBoundary scope="select-club"><ClubSelection /></ErrorBoundary>}
              />
              <Route
                path="/create-manager"
                element={<ErrorBoundary scope="create-manager"><ManagerCreation /></ErrorBoundary>}
              />
              <Route
                path="/challenge"
                element={<ErrorBoundary scope="challenge"><ChallengePicker /></ErrorBoundary>}
              />
              <Route
                path="/game"
                element={<ErrorBoundary scope="game-shell"><GameShell /></ErrorBoundary>}
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </TooltipProvider>
    </MotionConfig>
  </ErrorBoundary>
  );
};

export default App;
