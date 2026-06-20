import * as Sentry from '@sentry/react';
import { useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
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
const WhatsNewPage = lazy(() => import('./WhatsNewPage'));
const NationalTeamPage = lazy(() => import('./NationalTeamPage'));
const NationalSquadPicker = lazy(() => import('./NationalSquadPicker'));
const InternationalTournament = lazy(() => import('./InternationalTournament'));
const JobMarket = lazy(() => import('./JobMarket'));
const CareerOverview = lazy(() => import('./CareerOverview'));
const BallonDor = lazy(() => import('./BallonDor'));
const FestivalHub = lazy(() => import('./FestivalHub'));
const DynastyLegacy = lazy(() => import('./DynastyLegacy'));
const WorldCupResult = lazy(() => import('./WorldCupResult'));
const WorldCupDashboard = lazy(() => import('./WorldCupDashboard'));

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
  'whats-new': WhatsNewPage,
  'national-team': NationalTeamPage,
  'national-squad-picker': NationalSquadPicker,
  'international-tournament': InternationalTournament,
  'job-market': JobMarket,
  'career-overview': CareerOverview,
  'ballon-dor': BallonDor,
  'festival': FestivalHub,
  'dynasty-legacy': DynastyLegacy,
  'world-cup-result': WorldCupResult,
};

// Route-level Suspense fallback while a lazy page chunk downloads. Renders
// a structural placeholder in the same `max-w-lg` column the real screens
// use so there's no visual jump when the chunk resolves. Honors reduced
// motion via Tailwind's motion-reduce variant.
const PageSuspenseFallback = () => (
  <div
    role="status"
    aria-busy="true"
    aria-live="polite"
    aria-label="Loading page"
    className="max-w-lg mx-auto px-4 py-4 space-y-3"
  >
    <div className="h-9 w-40 rounded-md bg-muted/40 animate-pulse motion-reduce:animate-none" />
    <div className="h-28 rounded-xl bg-card/40 border border-border/40 animate-pulse motion-reduce:animate-none" />
    <div className="h-40 rounded-xl bg-card/40 border border-border/40 animate-pulse motion-reduce:animate-none" />
    <div className="h-40 rounded-xl bg-card/40 border border-border/40 animate-pulse motion-reduce:animate-none" />
  </div>
);


const GameShell = () => {
  const navigate = useNavigate();
  const { gameStarted, currentScreen, packPityCounter, gameMode } = useGameStore(useShallow(s => ({
    gameStarted: s.gameStarted,
    currentScreen: s.currentScreen,
    packPityCounter: s.packPityCounter || 0,
    gameMode: s.gameMode,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  const matchLocked = useMatchLocked();
  const isUnemployed = useCareerUnemployed();
  const activeTabs = isUnemployed ? UNEMPLOYED_MAIN_TABS : MAIN_TABS;

  // Derive the sub-nav group for the current screen, if any. Memoized so
  // SubNav doesn't receive a fresh `items` array on every GameShell render
  // (which would defeat its prop stability and trigger child re-renders).
  const subNavGroup = useMemo(() => {
    const group = SCREEN_GROUPS.find(g => g.includes(currentScreen));
    if (!group) return null;
    if (group[0] === 'squad') {
      return { items: SQUAD_SUB_NAV, layoutId: 'subnav-pill-squad' };
    }
    if (group[0] === 'transfers') {
      const items = MARKET_SUB_NAV.map(item =>
        item.screen === 'packs' && packPityCounter >= PACK_PITY_THRESHOLD - 2
          ? { ...item, dot: 'bg-yellow-400' }
          : item,
      );
      return { items, layoutId: 'subnav-pill-market' };
    }
    return null;
  }, [currentScreen, packPityCounter]);

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
      void import('./LeagueTable').catch(swallow);
      void import('./CalendarView').catch(swallow);
      void import('./TrainingPage').catch(swallow);
      void import('./MatchPrep').catch(swallow);
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
  // World Cup mode swaps the club Dashboard for a nation-adapted hub. Every
  // other screen (Squad, Tactics, MatchDay, …) is shared — the national team
  // is the player's club, so they operate on it natively.
  const Screen = (gameMode === 'world-cup' && currentScreen === 'dashboard')
    ? WorldCupDashboard
    : (screens[currentScreen] || Dashboard);

  // Scroll-position memory per screen. Returning to a long list (Market, Squad,
  // Inbox) should land you back where you were, not dumped at the top — which
  // reads as a jarring reset. We remember each screen's scroll offset and
  // restore it on re-entry; genuinely-new screens default to 0.
  const scrollPositions = useRef<Record<string, number>>({});

  // Continuously record the active screen's scroll offset (passive, writes only
  // to a ref — no re-render). Captured per-screen via the effect's closure.
  useEffect(() => {
    const screenAtSetup = currentScreen;
    const onScroll = () => { scrollPositions.current[screenAtSetup] = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [currentScreen]);

  // On screen change, restore the remembered offset (or top for first visits).
  // 'instant' so there's no smooth-scroll animation on tab change.
  useEffect(() => {
    const saved = scrollPositions.current[currentScreen] ?? 0;
    window.scrollTo({ top: saved, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [currentScreen]);

  return (
    <ErrorBoundary>
      <InfoTipProvider>
      <div className="min-h-screen bg-background game-theme">
        <TopBar />
        <main
          role="main"
          // touch-action: pan-y lets the OS keep horizontal edge gestures
          // (iOS back swipe) while we handle vertical scroll + our own
          // intentional left/right swipes via useSwipeGesture (which already
          // ignores edge-originating touches).
          className="touch-pan-y"
          style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
          {...swipeHandlers}
        >
          {subNavGroup && (
            <div className="max-w-lg mx-auto">
              <SubNav items={subNavGroup.items} layoutId={subNavGroup.layoutId} />
            </div>
          )}
          {/* Render the active screen directly (no AnimatePresence wait):
              tab switches mount the new screen instantly instead of
              blocking on an exit animation, which was the dominant
              source of perceived "long loading between tabs". */}
          <PageErrorBoundary>
            <Suspense fallback={<PageSuspenseFallback />}>
              <Screen />
            </Suspense>
          </PageErrorBoundary>
        </main>
        <BottomNav />
        <ContractNegotiation />
      </div>
      </InfoTipProvider>
    </ErrorBoundary>
  );
};

export default GameShell;
