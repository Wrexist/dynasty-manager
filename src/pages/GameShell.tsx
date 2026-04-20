import * as Sentry from '@sentry/react';
import { useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { TopBar } from '@/components/game/TopBar';
import { BottomNav } from '@/components/game/BottomNav';
import { SubNav } from '@/components/game/SubNav';
import { PageErrorBoundary } from '@/components/game/PageErrorBoundary';
import { ErrorBoundary } from '@/components/game/ErrorBoundary';
import { ContractNegotiation } from '@/components/game/ContractNegotiation';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { BACK_TARGET, MAIN_TABS, SCREEN_GROUPS, UNEMPLOYED_MAIN_TABS } from '@/config/navigation';
import { MARKET_SUB_NAV, SQUAD_SUB_NAV } from '@/config/ui';
import { PACK_PITY_THRESHOLD } from '@/config/packs';
import { useMatchLocked, useCareerUnemployed } from '@/hooks/useGameSelectors';
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
const PacksPage = lazy(() => import('./PacksPage'));
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
const LeagueCupPage = lazy(() => import('./LeagueCupPage'));
const ContinentalPage = lazy(() => import('./ContinentalPage'));
const SuperCupPage = lazy(() => import('./SuperCupPage'));
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
const JobMarket = lazy(() => import('./JobMarket'));
const CareerOverview = lazy(() => import('./CareerOverview'));
const BallonDor = lazy(() => import('./BallonDor'));

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
  packs: PacksPage,
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
  'league-cup': LeagueCupPage,
  'champions-cup': ContinentalPage,
  'shield-cup': ContinentalPage,
  'conference-cup': ContinentalPage,
  'super-cup': SuperCupPage,
  perks: PerksPage,
  'trophy-cabinet': TrophyCabinet,
  'prestige': PrestigePage,
  'hall-of-managers': HallOfManagers,
  'team-detail': TeamDetailPage,
  'shop': ShopPage,
  'help': HelpPage,
  'national-team': NationalTeamPage,
  'international-tournament': InternationalTournament,
  'job-market': JobMarket,
  'career-overview': CareerOverview,
  'ballon-dor': BallonDor,
};


const GameShell = () => {
  const navigate = useNavigate();
  const { gameStarted, currentScreen, packPityCounter } = useGameStore(useShallow(s => ({
    gameStarted: s.gameStarted,
    currentScreen: s.currentScreen,
    packPityCounter: s.packPityCounter || 0,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  const matchLocked = useMatchLocked();
  const isUnemployed = useCareerUnemployed();
  const activeTabs = isUnemployed ? UNEMPLOYED_MAIN_TABS : MAIN_TABS;

  // Derive the sub-nav group for the current screen, if any.
  // Hoisting the SubNav above the page AnimatePresence lets the active
  // pill slide smoothly between siblings via framer-motion's layoutId.
  const subNavGroup = (() => {
    const group = SCREEN_GROUPS.find(g => g.includes(currentScreen));
    if (!group) return null;
    if (group[0] === 'squad') {
      // Decorate Packs tab with a dot when pity is primed (pack feature hook).
      const items = SQUAD_SUB_NAV;
      return { items, layoutId: 'subnav-pill-squad' };
    }
    if (group[0] === 'transfers') {
      const items = MARKET_SUB_NAV.map(item =>
        item.screen === 'packs' && packPityCounter >= PACK_PITY_THRESHOLD - 2
          ? { ...item, dot: 'bg-fuchsia-400' }
          : item,
      );
      return { items, layoutId: 'subnav-pill-market' };
    }
    return null;
  })();

  useEffect(() => {
    if (!gameStarted) navigate('/');
  }, [gameStarted, navigate]);

  // Prefetch the hot main-tab chunks at idle so the first tap on each is instant.
  useEffect(() => {
    const idle = (cb: () => void) =>
      (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback?.(cb) ??
      setTimeout(cb, 400);
    // Prefetch failures (offline, stale hashed chunk after deploy) are
    // non-fatal — Suspense will re-request on tap. Swallow to avoid
    // unhandled rejections / Sentry noise.
    const swallow = () => {};
    idle(() => {
      void import('./SquadPage').catch(swallow);
      void import('./TacticsPage').catch(swallow);
      void import('./TransferPage').catch(swallow);
      void import('./InboxPage').catch(swallow);
    });
  }, []);

  // Sync monetization state on game load
  useEffect(() => {
    let cancelled = false;
    const { restoreEntitlements, initMonetizationTimestamp, updateSubscription } = useGameStore.getState();

    // Start the starter kit countdown timer
    initMonetizationTimestamp();

    // Sync entitlements and subscription from RevenueCat (no-op on web)
    Promise.all([getEntitlements(), getCustomerInfo()])
      .then(([ids, info]) => {
        if (cancelled) return;
        if (ids.length > 0) restoreEntitlements(ids);
        if (info) updateSubscription(extractSubscriptionInfo(info));
      })
      .catch(err => Sentry.captureException(err, { tags: { context: 'syncEntitlements' } }));

    // Listen for real-time entitlement changes (cross-device, family sharing, subscription renewals)
    startEntitlementListener((ids, customerInfo) => {
      const state = useGameStore.getState();
      state.restoreEntitlements(ids);
      state.updateSubscription(extractSubscriptionInfo(customerInfo));
    });

    return () => { cancelled = true; stopEntitlementListener(); };
  }, []);

  const handleSwipeLeft = useCallback(() => {
    if (matchLocked) return;
    // Check SubNav groups first (skip when unemployed — no sub-groups)
    if (!isUnemployed) {
      for (const group of SCREEN_GROUPS) {
        const gIdx = group.indexOf(currentScreen);
        if (gIdx >= 0 && gIdx < group.length - 1) {
          setScreen(group[gIdx + 1]);
          return;
        }
      }
    }
    // Fall back to main tab swiping
    const idx = activeTabs.indexOf(currentScreen);
    if (idx >= 0 && idx < activeTabs.length - 1) {
      setScreen(activeTabs[idx + 1]);
    }
  }, [currentScreen, setScreen, matchLocked, isUnemployed, activeTabs]);

  const handleSwipeRight = useCallback(() => {
    if (matchLocked) return;
    // Check SubNav groups first (skip when unemployed — no sub-groups)
    if (!isUnemployed) {
      for (const group of SCREEN_GROUPS) {
        const gIdx = group.indexOf(currentScreen);
        if (gIdx > 0) {
          setScreen(group[gIdx - 1]);
          return;
        }
      }
    }
    // Main tab swiping
    const idx = activeTabs.indexOf(currentScreen);
    if (idx > 0) {
      setScreen(activeTabs[idx - 1]);
      return;
    }
    // Swipe-back on detail screens
    if (!activeTabs.includes(currentScreen)) {
      const backTarget = BACK_TARGET[currentScreen] || (isUnemployed ? 'job-market' : 'dashboard');
      setScreen(backTarget);
    }
  }, [currentScreen, setScreen, matchLocked, isUnemployed, activeTabs]);

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
  });

  if (import.meta.env.DEV && !screens[currentScreen]) {
    console.warn(`[GameShell] Unrecognized screen: "${currentScreen}", falling back to Dashboard`);
  }
  const Screen = screens[currentScreen] || Dashboard;

  useEffect(() => { window.scrollTo(0, 0); }, [currentScreen]);

  return (
    <ErrorBoundary>
      <InfoTipProvider>
      <div className="min-h-screen bg-background game-theme">
        <TopBar />
        <main
          role="main"
          style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
          {...swipeHandlers}
        >
          {subNavGroup && (
            <div className="max-w-lg mx-auto">
              <SubNav items={subNavGroup.items} layoutId={subNavGroup.layoutId} />
            </div>
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentScreen}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.1, ease: 'easeOut' }}
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
