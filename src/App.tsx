import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HashRouter, Routes, Route } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import TitleScreen from "./pages/TitleScreen";
// Both of these are Radix Dialogs that appear on a CONDITION — first launch for
// the consent modal, a corrupt save for the recovery dialog — yet importing them
// eagerly pulled @radix-ui/react-dialog into the boot graph for every launch.
// Lazy + conditionally mounted, so the chunk is fetched only when one is
// actually shown. There is no fallback on purpose: nothing should flash while a
// dialog nobody asked for downloads.
const AnalyticsConsentModal = lazy(() =>
  import("@/components/AnalyticsConsentModal").then(m => ({ default: m.AnalyticsConsentModal })));
const SaveRecoveryDialog = lazy(() =>
  import("@/components/SaveRecoveryDialog").then(m => ({ default: m.SaveRecoveryDialog })));
import NotFound from "./pages/NotFound";
import { readAnalyticsConsent } from "@/store/helpers/persistence";
import { refreshAnalyticsConsent } from "@/utils/analytics";

// Lazy-loaded routes for code splitting
const ClubSelection = lazy(() => import("./pages/ClubSelection"));
const GameShell = lazy(() => import("./pages/GameShell"));
const ChallengePicker = lazy(() => import("./pages/ChallengePicker"));
const ModeSelect = lazy(() => import("./pages/ModeSelect"));
const ManagerCreation = lazy(() => import("./pages/ManagerCreation"));
const WorldCupSetup = lazy(() => import("./pages/WorldCupSetup"));
const SundaySetup = lazy(() => import("./pages/SundaySetup"));
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

  return (
  <ErrorBoundary scope="app">
    <MotionConfig reducedMotion={(reducedMotion || performanceMode) ? "always" : "user"}>
      <TooltipProvider>
        <Sonner />
        {consent === 'unknown' && (
          <Suspense fallback={null}>
            <AnalyticsConsentModal
              open
              onChoice={() => setConsent(readAnalyticsConsent())}
            />
          </Suspense>
        )}
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={null}><SaveRecoveryDialog /></Suspense>
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
                path="/sunday-league"
                element={<ErrorBoundary scope="sunday-league"><SundaySetup /></ErrorBoundary>}
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
