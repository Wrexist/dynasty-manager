import { useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { TopBar } from '@/components/game/TopBar';
import { BottomNav } from '@/components/game/BottomNav';
import { PageErrorBoundary } from '@/components/game/PageErrorBoundary';
import { ErrorBoundary } from '@/components/game/ErrorBoundary';
import { ContractNegotiation } from '@/components/game/ContractNegotiation';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { BACK_TARGET, MAIN_TABS, SCREEN_GROUPS } from '@/config/navigation';
import { InfoTipProvider } from '@/components/game/InfoTip';
import { getEntitlements, getCustomerInfo, extractSubscriptionInfo, startEntitlementListener, stopEntitlementListener } from '@/utils/purchases';

// Lazy-load all pages for code splitting (Dashboard prefetched from TitleScreen)
const Dashboard = lazy(() => import('./Dashboard'));
const SquadPage = lazy(() => import('./SquadPage'));
const TacticsPage = lazy(() => import('./TacticsPage'));
const TransferPage = lazy(() => import('./TransferPage'));
const ClubPage = lazy(() => import('./ClubPage'));
const MatchDay = lazy(() => import('./MatchDay'));
const PlayerDetail = lazy(() => import('./PlayerDetail'));
const LeagueTable = lazy(() => import('./LeagueTable'));
const InboxPage = lazy(() => import('./InboxPage'));
const SeasonSummary = lazy(() => import('./SeasonSummary'));
const CalendarView = lazy(() => import('./CalendarView'));
const TrainingPage = lazy(() => import('./TrainingPage'));
const ScoutingPage = lazy(() => import('./ScoutingPage'));
const StaffPage = lazy(() => import('./StaffPage'));
const YouthAcademy = lazy(() => import('./YouthAcademy'));
const FacilitiesPage = lazy(() => import('./FacilitiesPage'));
const FinancePage = lazy(() => import('./FinancePage'));
const MatchPrep = lazy(() => import('./MatchPrep'));
const MatchReview = lazy(() => import('./MatchReview'));
const BoardPage = lazy(() => import('./BoardPage'));
const SettingsPage = lazy(() => import('./SettingsPage'));
const ComparisonPage = lazy(() => import('./ComparisonPage'));
const ManagerProfile = lazy(() => import('./ManagerProfile'));
const CupPage = lazy(() => import('./CupPage'));
const PerksPage = lazy(() => import('./PerksPage'));
const TrophyCabinet = lazy(() => import('./TrophyCabinet'));
const PrestigePage = lazy(() => import('./PrestigePage'));
const HallOfManagers = lazy(() => import('./HallOfManagers'));
const MerchandisePage = lazy(() => import('./MerchandisePage'));
const TeamDetailPage = lazy(() => import('./TeamDetailPage'));
const ShopPage = lazy(() => import('./ShopPage'));
const HelpPage = lazy(() => import('./HelpPage'));
const NationalTeamPage = lazy(() => import('./NationalTeamPage'));
const InternationalTournament = lazy(() => import('./InternationalTournament'));

const screens: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  squad: SquadPage,
  tactics: TacticsPage,
  transfers: TransferPage,
  club: ClubPage,
  match: MatchDay,
  'player-detail': PlayerDetail,
  'league-table': LeagueTable,
  inbox: InboxPage,
  'season-summary': SeasonSummary,
  calendar: CalendarView,
  training: TrainingPage,
  scouting: ScoutingPage,
  staff: StaffPage,
  'youth-academy': YouthAcademy,
  facilities: FacilitiesPage,
  finance: FinancePage,
  merchandise: MerchandisePage,
  'match-prep': MatchPrep,
  'match-review': MatchReview,
  board: BoardPage,
  settings: SettingsPage,
  comparison: ComparisonPage,
  'manager-profile': ManagerProfile,
  cup: CupPage,
  perks: PerksPage,
  'trophy-cabinet': TrophyCabinet,
  'prestige': PrestigePage,
  'hall-of-managers': HallOfManagers,
  'team-detail': TeamDetailPage,
  'shop': ShopPage,
  'help': HelpPage,
  'national-team': NationalTeamPage,
  'international-tournament': InternationalTournament,
};


const GameShell = () => {
  const navigate = useNavigate();
  const { gameStarted, currentScreen, setScreen } = useGameStore();

  useEffect(() => {
    if (!gameStarted) navigate('/');
  }, [gameStarted, navigate]);

  // Sync monetization state on game load
  useEffect(() => {
    const { restoreEntitlements, initMonetizationTimestamp, updateSubscription } = useGameStore.getState();

    // Start the starter kit countdown timer
    initMonetizationTimestamp();

    // Sync entitlements and subscription from RevenueCat (no-op on web)
    Promise.all([getEntitlements(), getCustomerInfo()]).then(([ids, info]) => {
      if (ids.length > 0) restoreEntitlements(ids);
      if (info) updateSubscription(extractSubscriptionInfo(info));
    });

    // Listen for real-time entitlement changes (cross-device, family sharing, subscription renewals)
    startEntitlementListener((ids, customerInfo) => {
      const state = useGameStore.getState();
      state.restoreEntitlements(ids);
      state.updateSubscription(extractSubscriptionInfo(customerInfo));
    });

    return () => { stopEntitlementListener(); };
  }, []);

  const handleSwipeLeft = useCallback(() => {
    // Check SubNav groups first
    for (const group of SCREEN_GROUPS) {
      const gIdx = group.indexOf(currentScreen);
      if (gIdx >= 0 && gIdx < group.length - 1) {
        setScreen(group[gIdx + 1]);
        return;
      }
    }
    // Fall back to main tab swiping
    const idx = MAIN_TABS.indexOf(currentScreen);
    if (idx >= 0 && idx < MAIN_TABS.length - 1) {
      setScreen(MAIN_TABS[idx + 1]);
    }
  }, [currentScreen, setScreen]);

  const handleSwipeRight = useCallback(() => {
    // Check SubNav groups first
    for (const group of SCREEN_GROUPS) {
      const gIdx = group.indexOf(currentScreen);
      if (gIdx > 0) {
        setScreen(group[gIdx - 1]);
        return;
      }
    }
    // Main tab swiping
    const idx = MAIN_TABS.indexOf(currentScreen);
    if (idx > 0) {
      setScreen(MAIN_TABS[idx - 1]);
      return;
    }
    // Swipe-back on detail screens
    if (!MAIN_TABS.includes(currentScreen)) {
      const backTarget = BACK_TARGET[currentScreen] || 'dashboard';
      setScreen(backTarget);
    }
  }, [currentScreen, setScreen]);

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
  });

  if (import.meta.env.DEV && !screens[currentScreen]) {
    console.warn(`[GameShell] Unrecognized screen: "${currentScreen}", falling back to Dashboard`);
  }
  const Screen = screens[currentScreen] || Dashboard;

  // Track navigation direction for transition animations
  const prevScreenRef = useRef(currentScreen);
  const direction = (() => {
    const prev = prevScreenRef.current;
    const prevIdx = MAIN_TABS.indexOf(prev);
    const curIdx = MAIN_TABS.indexOf(currentScreen);
    if (prevIdx >= 0 && curIdx >= 0) return curIdx > prevIdx ? 1 : curIdx < prevIdx ? -1 : 0;
    // Detail screens slide in from right, back slides left
    if (MAIN_TABS.includes(currentScreen) && !MAIN_TABS.includes(prev)) return -1;
    if (!MAIN_TABS.includes(currentScreen) && MAIN_TABS.includes(prev)) return 1;
    return 0;
  })();
  useEffect(() => { prevScreenRef.current = currentScreen; }, [currentScreen]);

  return (
    <ErrorBoundary>
      <InfoTipProvider>
      <div className="min-h-screen bg-background">
        <TopBar />
        <main
          role="main"
          style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
          {...swipeHandlers}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScreen}
              initial={{ opacity: 0, x: direction * 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -20 }}
              transition={{ duration: 0.15 }}
            >
              <PageErrorBoundary>
                <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
                  <Screen />
                </Suspense>
              </PageErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
        <BottomNav />
        <ContractNegotiation />
      </div>
      </InfoTipProvider>
    </ErrorBoundary>
  );
};

export default GameShell;
