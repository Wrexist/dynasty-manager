import * as Sentry from '@sentry/react';
import { useTranslation } from '@/hooks/useTranslation';
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
import { BACK_TARGET, MAIN_TABS, WC_MAIN_TABS, SUNDAY_MAIN_TABS, SCREEN_GROUPS, SUNDAY_SCREEN_GROUPS, SUNDAY_TEAM_GROUP, UNEMPLOYED_MAIN_TABS, UNEMPLOYED_ALLOWED_SCREENS } from '@/config/navigation';
import { MARKET_SUB_NAV, SQUAD_SUB_NAV, SUNDAY_TEAM_SUB_NAV, SUNDAY_CLUB_SUB_NAV } from '@/config/ui';
import { PACK_PITY_THRESHOLD } from '@/config/packs';
import { useMatchLocked, useCareerUnemployed, useCareerRetired } from '@/hooks/useGameSelectors';
import { InfoTipProvider } from '@/components/game/InfoTip';
import { PresentationQueueProvider } from '@/hooks/usePresentationQueue';
import { AdOfferHost } from '@/components/game/AdOfferHost';
import { REWARDED_ADS_USABLE } from '@/utils/ads';
import { getEntitlementsDefinitive, getCustomerInfo, extractSubscriptionInfo, startEntitlementListener, stopEntitlementListener } from '@/utils/purchases';

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
const CareerRetired = lazy(() => import('./CareerRetired'));
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
const WorldCupDraw = lazy(() => import('./WorldCupDraw'));
const WorldCupDashboard = lazy(() => import('./WorldCupDashboard'));
const RivalriesPage = lazy(() => import('./RivalriesPage'));
const CompetitionsPage = lazy(() => import('./CompetitionsPage'));
const SundayHub = lazy(() => import('./SundayHub'));
const SundayTeamsheet = lazy(() => import('./SundayTeamsheet'));
const SundayMatchDay = lazy(() => import('./SundayMatchDay'));
const SundaySquad = lazy(() => import('./SundaySquad'));
const SundayClubhouse = lazy(() => import('./SundayClubhouse'));
const SundayTable = lazy(() => import('./SundayTable'));
const SundayRecruit = lazy(() => import('./SundayRecruit'));
const SundayHistory = lazy(() => import('./SundayHistory'));
// Lazy like the pages, not static like the rest of the shell: the bar reads
// `findSundayFixture`, which lives in the Sunday matchday module and would
// otherwise be pulled into the GameShell chunk every elite player downloads.
const SundayWeekBar = lazy(() =>
  import('@/components/game/sunday/SundayWeekBar').then(m => ({ default: m.SundayWeekBar })),
);
// ONE instance for the whole mode. It used to be mounted per page, on six of
// the eight Sunday screens — History was the miss, and History is now a tab, so
// a pending event would have been invisible there while `advanceSundayWeek`
// refused to run: a soft deadlock with nothing on screen explaining it. The
// modal self-gates on `sunday.pendingEvent`, so mounting it once here is enough.
const SundayEventModal = lazy(() =>
  import('@/components/game/sunday/SundayEventModal').then(m => ({ default: m.SundayEventModal })),
);

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
  'career-retired': CareerRetired,
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
  'world-cup-draw': WorldCupDraw,
  'world-cup-result': WorldCupResult,
  'rivalries': RivalriesPage,
  'competitions': CompetitionsPage,
  'sunday-hub': SundayHub,
  'sunday-teamsheet': SundayTeamsheet,
  'sunday-match': SundayMatchDay,
  'sunday-squad': SundaySquad,
  'sunday-clubhouse': SundayClubhouse,
  'sunday-table': SundayTable,
  'sunday-recruit': SundayRecruit,
  'sunday-history': SundayHistory,
};

// Route-level Suspense fallback while a lazy page chunk downloads. Renders
// a structural placeholder in the same `max-w-lg` column the real screens
// use so there's no visual jump when the chunk resolves. Honors reduced
// motion via Tailwind's motion-reduce variant.
const PageSuspenseFallback = () => {
  const { t } = useTranslation();
  return (
  <div
    role="status"
    aria-busy="true"
    aria-live="polite"
    aria-label={t('gameShell.loadingPage')}
    className="max-w-lg mx-auto px-4 py-4 space-y-3"
  >
    <div className="h-9 w-40 rounded-md bg-muted/40 animate-pulse motion-reduce:animate-none" />
    <div className="h-28 rounded-xl bg-card/40 border border-border/40 animate-pulse motion-reduce:animate-none" />
    <div className="h-40 rounded-xl bg-card/40 border border-border/40 animate-pulse motion-reduce:animate-none" />
    <div className="h-40 rounded-xl bg-card/40 border border-border/40 animate-pulse motion-reduce:animate-none" />
  </div>
  );
};


const GameShell = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { gameStarted, currentScreen, packPityCounter, gameMode } = useGameStore(useShallow(s => ({
    gameStarted: s.gameStarted,
    currentScreen: s.currentScreen,
    packPityCounter: s.packPityCounter || 0,
    gameMode: s.gameMode,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  const matchLocked = useMatchLocked();
  const isUnemployed = useCareerUnemployed();
  const isRetired = useCareerRetired();
  const activeTabs = gameMode === 'sunday'
    ? SUNDAY_MAIN_TABS
    : gameMode === 'world-cup' ? WC_MAIN_TABS : isUnemployed ? UNEMPLOYED_MAIN_TABS : MAIN_TABS;

  // A retired manager has no club, so the club tabs would point at a squad they
  // no longer manage. Keep them on the retrospective; everything reachable from
  // there (Hall of Fame, Main Menu) is an explicit navigation.
  useEffect(() => {
    if (isRetired && currentScreen !== 'career-retired' && !UNEMPLOYED_ALLOWED_SCREENS.has(currentScreen)) {
      setScreen('career-retired');
    }
  }, [isRetired, currentScreen, setScreen]);

  // Derive the sub-nav group for the current screen, if any. Memoized so
  // SubNav doesn't receive a fresh `items` array on every GameShell render
  // (which would defeat its prop stability and trigger child re-renders).
  const subNavGroup = useMemo(() => {
    // Sunday League has its own two groups (Team and Clubhouse) and its own
    // key-based labels, so it branches out before the club-game lookup.
    if (gameMode === 'sunday') {
      const sundayGroup = SUNDAY_SCREEN_GROUPS.find(g => g.includes(currentScreen));
      if (!sundayGroup) return null;
      const isTeam = sundayGroup === SUNDAY_TEAM_GROUP;
      const source = isTeam ? SUNDAY_TEAM_SUB_NAV : SUNDAY_CLUB_SUB_NAV;
      return {
        items: source.map(i => ({ screen: i.screen, label: t(i.labelKey) })),
        layoutId: isTeam ? 'subnav-pill-sunday-team' : 'subnav-pill-sunday-club',
      };
    }
    // World Cup strips the club sub-screens (Staff/Youth/Training,
    // Scouting/Packs) — so there is no Squad/Market sub-nav to show.
    if (gameMode === 'world-cup') return null;
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
  }, [currentScreen, packPityCounter, gameMode, t]);

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
    const { restoreEntitlements, reconcileEntitlements, initMonetizationTimestamp, updateSubscription } = useGameStore.getState();

    // Start the starter kit countdown timer
    initMonetizationTimestamp();

    // Sync entitlements and subscription from RevenueCat (no-op on web)
    Promise.all([getEntitlementsDefinitive(), getCustomerInfo()])
      .then(([ids, info]) => {
        if (cancelled) return;
        // `null` means we could not ask — change nothing. A real list, even an
        // empty one, is the store's answer: grant what is owned and prune what
        // is not, so a refunded purchase stops conveying Pro forever. Every
        // other write path is additive, which is why refunds never revoked.
        if (ids !== null) {
          if (ids.length > 0) restoreEntitlements(ids);
          reconcileEntitlements(ids);
        }
        // Never write a null sub from a sync path: extractSubscriptionInfo
        // returns null on a transient RC glitch (no active pro entitlement in
        // this payload), which would clear subscription.expiresAt — the ONLY
        // source of sub truth — and transiently strip Pro from a paying user.
        // A genuine lapse is handled by isSubscriptionActive's expiresAt check,
        // so we only ever write a confirmed, non-null subscription here.
        const sub = extractSubscriptionInfo(info);
        if (sub) updateSubscription(sub);
      })
      .catch(err => Sentry.captureException(err, { tags: { context: 'syncEntitlements' } }));

    // Listen for real-time entitlement changes (cross-device, family sharing, subscription renewals)
    startEntitlementListener((ids, customerInfo) => {
      const state = useGameStore.getState();
      state.restoreEntitlements(ids);
      // Same guard as above — a listener callback with no active pro entitlement
      // must not clear an active local subscription (see comment above).
      const sub = extractSubscriptionInfo(customerInfo);
      if (sub) state.updateSubscription(sub);
    });

    return () => { cancelled = true; stopEntitlementListener(); };
  }, []);

  // World Cup mode has no sub-groups, so swipe ignores them. Sunday League has
  // its own two, so swipe walks those instead of the club game's.
  const useSubGroups = !isUnemployed && gameMode !== 'world-cup';
  const activeGroups = gameMode === 'sunday' ? SUNDAY_SCREEN_GROUPS : SCREEN_GROUPS;

  const handleSwipeLeft = useCallback(() => {
    if (matchLocked) return;
    // Check SubNav groups first (skip when unemployed / World Cup — no sub-groups)
    if (useSubGroups) {
      for (const group of activeGroups) {
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
  }, [currentScreen, setScreen, matchLocked, useSubGroups, activeGroups, activeTabs]);

  const handleSwipeRight = useCallback(() => {
    if (matchLocked) return;
    // Check SubNav groups first (skip when unemployed / World Cup — no sub-groups)
    if (useSubGroups) {
      for (const group of activeGroups) {
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
  }, [currentScreen, setScreen, matchLocked, isUnemployed, useSubGroups, activeGroups, activeTabs]);

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
  // Sunday League never uses `dashboard`; `startSundayLeague` and every
  // Sunday screen navigate to `sunday-hub` directly. The redirect here catches
  // the one path that cannot: `loadGame`, which sets `dashboard` for every mode.
  const Screen = (gameMode === 'world-cup' && currentScreen === 'dashboard')
    ? WorldCupDashboard
    : (gameMode === 'sunday' && currentScreen === 'dashboard')
      ? SundayHub
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
          style={{
            paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
            // Sunday reserves the week bar's strip ALWAYS, even on the two
            // screens that hide it — render conditionally, reserve
            // unconditionally, so changing tabs never reflows the page.
            paddingBottom: gameMode === 'sunday'
              ? 'calc(9.5rem + env(safe-area-inset-bottom, 0px))'
              : 'calc(6rem + env(safe-area-inset-bottom, 0px))',
          }}
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
          {/* Keyed on the screen: an error boundary holds `hasError` in state
              with no reset path, so a crash on one screen left the error card
              rendered over EVERY subsequent tab — BottomNav sits outside the
              boundary, so the tab highlight moved while the body did not, and
              only "Try Again" recovered. Remounting per screen makes navigating
              away the natural escape. */}
          <PageErrorBoundary key={currentScreen}>
            <Suspense fallback={<PageSuspenseFallback />}>
              {/* Coordinates the post-advance overlay queue so only one modal
                  shows at a time (G3). */}
              <PresentationQueueProvider>
                <Screen />
                {/* Rewarded-ad offers. Inside the provider so they queue at the
                    lowest priority and can never preempt an in-fiction beat.
                    Not mounted at all while ads are unusable: `canPrompt` would
                    return `ads_unavailable` every time, so the host was running
                    a 2.5s timer on every screen change to reach a decision it
                    could never take. */}
                {REWARDED_ADS_USABLE && <AdOfferHost />}
              </PresentationQueueProvider>
            </Suspense>
          </PageErrorBoundary>
        </main>
        {gameMode === 'sunday' && (
          <Suspense fallback={null}><SundayWeekBar /></Suspense>
        )}
        {/* Match day deliberately does not raise events mid-match and must stay
            clean, so the modal is excluded there rather than self-suppressed. */}
        {gameMode === 'sunday' && currentScreen !== 'sunday-match' && (
          <Suspense fallback={null}><SundayEventModal /></Suspense>
        )}
        <BottomNav />
        <ContractNegotiation />
      </div>
      </InfoTipProvider>
    </ErrorBoundary>
  );
};

export default GameShell;
