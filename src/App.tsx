import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HashRouter, Routes, Route } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SaveRecoveryDialog } from "@/components/SaveRecoveryDialog";
import { AnalyticsConsentModal } from "@/components/AnalyticsConsentModal";
import TitleScreen from "./pages/TitleScreen";
import NotFound from "./pages/NotFound";
import { readAnalyticsConsent } from "@/store/helpers/persistence";
import { refreshAnalyticsConsent, track } from "@/utils/analytics";

// Lazy-loaded routes for code splitting
const ClubSelection = lazy(() => import("./pages/ClubSelection"));
const GameShell = lazy(() => import("./pages/GameShell"));
const ChallengePicker = lazy(() => import("./pages/ChallengePicker"));
const ModeSelect = lazy(() => import("./pages/ModeSelect"));
const ManagerCreation = lazy(() => import("./pages/ManagerCreation"));
const WorldCupSetup = lazy(() => import("./pages/WorldCupSetup"));
const WhatsNewPage = lazy(() => import("./pages/WhatsNewPage"));
const SubscribeOnboarding = lazy(() => import("./pages/SubscribeOnboarding"));
// Cinematic Capture — hidden marketing/dev capture tool. Disabled for now so users can't
// reach it (the Settings entry is removed and the route below is commented out). Kept for
// future use: re-enable this import + the /cinematic-capture route to bring it back.
// const CinematicCapturePage = lazy(() => import("./pages/CinematicCapturePage"));

// Loading fallback
const LoadingFallback = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
    <img
      src="/logo.webp"
      alt="Dynasty Manager"
      className="w-20 h-20 drop-shadow-[0_0_16px_hsl(var(--primary)/0.35)] animate-pulse"
    />
    <div className="text-muted-foreground text-sm">Loading...</div>
  </div>
);

const App = () => {
  const reducedMotion = useGameStore(s => s.settings.reducedMotion);
  const performanceMode = useGameStore(s => s.settings.performanceMode);
  // Performance mode is the single "make it smooth on old devices" switch:
  // a root class drives CSS that strips backdrop-blur + decorative overlays,
  // and it also forces reduced motion below.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('perf-mode', !!performanceMode);
    return () => root.classList.remove('perf-mode');
  }, [performanceMode]);
  // First-launch analytics consent: read once on mount, gate the rest of the
  // app until the user answers. `refreshAnalyticsConsent` seeds the in-memory
  // cache so early `track()` calls (e.g. from splash) see 'granted' only if
  // the user already answered on a previous launch.
  const [consent, setConsent] = useState(() => {
    refreshAnalyticsConsent();
    return readAnalyticsConsent();
  });
  useEffect(() => { refreshAnalyticsConsent(); }, []);
  // Session counter (DAU / sessions proxy). Fires once per app load; no-ops
  // until the user has granted consent. The session id is ephemeral, so this
  // counts sessions, not unique returning users.
  useEffect(() => { track('app_open', {}); }, []);

  return (
  <ErrorBoundary scope="app">
    <MotionConfig reducedMotion={(reducedMotion || performanceMode) ? "always" : "user"}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AnalyticsConsentModal
          open={consent === 'unknown'}
          onChoice={() => setConsent(readAnalyticsConsent())}
        />
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
                path="/world-cup"
                element={<ErrorBoundary scope="world-cup"><WorldCupSetup /></ErrorBoundary>}
              />
              <Route
                path="/challenge"
                element={<ErrorBoundary scope="challenge"><ChallengePicker /></ErrorBoundary>}
              />
              <Route
                path="/whats-new"
                element={<ErrorBoundary scope="whats-new"><WhatsNewPage standalone /></ErrorBoundary>}
              />
              <Route
                path="/subscribe"
                element={<ErrorBoundary scope="subscribe"><SubscribeOnboarding /></ErrorBoundary>}
              />
              <Route
                path="/game"
                element={<ErrorBoundary scope="game-shell"><GameShell /></ErrorBoundary>}
              />
              {/* Cinematic Capture route disabled for now — users can't access it; the URL
                  falls through to NotFound below. Re-enable with the lazy import above when needed.
              <Route
                path="/cinematic-capture"
                element={<ErrorBoundary scope="cinematic-capture"><CinematicCapturePage /></ErrorBoundary>}
              /> */}
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
