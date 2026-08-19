import { useMemo, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GameScreen } from '@/types/game';
import { LayoutDashboard, Users, Target, ArrowLeftRight, Briefcase, User, Mail, Trophy, ClipboardList, Landmark, ListOrdered } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MoreDrawer } from './MoreDrawer';
import { hapticLight } from '@/utils/haptics';
import { useMatchLocked, useCareerUnemployed } from '@/hooks/useGameSelectors';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { SUNDAY_TEAM_GROUP, SUNDAY_CLUB_GROUP } from '@/config/navigation';

/** A bottom-nav tab. `label` is a legacy English literal (elite / World Cup /
 *  unemployed sets); `labelKey` resolves through `t()`. Exactly one is set —
 *  every Sunday tab uses the key, so its text cannot drift from the sub-nav
 *  or from SCREEN_TITLES. */
interface NavTab {
  screen: GameScreen;
  label?: string;
  labelKey?: string;
  icon: React.ElementType;
  group?: GameScreen[];
}

const SQUAD_SCREENS: GameScreen[] = ['squad', 'staff', 'youth-academy', 'training'];
const MARKET_SCREENS: GameScreen[] = ['transfers', 'scouting', 'packs'];

const tabs: NavTab[] = [
  { screen: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { screen: 'squad', label: 'Squad', icon: Users, group: SQUAD_SCREENS },
  { screen: 'tactics', label: 'Tactics', icon: Target },
  { screen: 'transfers', label: 'Market', icon: ArrowLeftRight, group: MARKET_SCREENS },
];

const unemployedTabs: NavTab[] = [
  { screen: 'job-market', label: 'Jobs', icon: Briefcase },
  { screen: 'career-overview', label: 'Career', icon: User },
  { screen: 'inbox', label: 'Inbox', icon: Mail },
];

// World Cup mode is the normal game with the national team as your club — same
// Home/Squad/Tactics tabs and icons; only the Market slot is reformatted to the
// tournament. No league/market/finance.
const worldCupTabs: NavTab[] = [
  { screen: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { screen: 'squad', label: 'Squad', icon: Users },
  { screen: 'tactics', label: 'Tactics', icon: Target },
  { screen: 'international-tournament', label: 'Tournament', icon: Trophy },
];

// Sunday League: where you are (Home), the side you name (Team), the division
// you are in (League), and the club behind it (Clubhouse). No market, no
// tactics screen — tactics live on the teamsheet where the XI they apply to is
// visible. Squad, Recruits and History hang off the Team and Clubhouse groups.
const sundayTabs: NavTab[] = [
  // 'dashboard' in the group: shared screens back-target 'dashboard', which
  // GameShell renders as the hub in this mode — the tab highlight must agree.
  { screen: 'sunday-hub', labelKey: 'sunday.nav.home', icon: LayoutDashboard, group: ['sunday-hub', 'dashboard'] },
  { screen: 'sunday-teamsheet', labelKey: 'sunday.nav.team', icon: ClipboardList, group: SUNDAY_TEAM_GROUP },
  { screen: 'sunday-table', labelKey: 'sunday.nav.league', icon: ListOrdered },
  { screen: 'sunday-clubhouse', labelKey: 'sunday.nav.clubhouse', icon: Landmark, group: SUNDAY_CLUB_GROUP },
];

export function BottomNav() {
  const { t } = useTranslation();
  const { currentScreen, messages, incomingOffers, jobOffers, gameMode, sundayRecruits } = useGameStore(useShallow(s => ({
    currentScreen: s.currentScreen, messages: s.messages, incomingOffers: s.incomingOffers,
    jobOffers: s.jobOffers, gameMode: s.gameMode,
    // Scalar, not the array — a length through useShallow keeps this component
    // off every recruit-list mutation (renderHygiene guards this file).
    sundayRecruits: s.sunday?.recruits.length ?? 0,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  const matchLocked = useMatchLocked();
  const isUnemployed = useCareerUnemployed();
  const reduceMotion = useReducedMotionPref();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const unreadCount = useMemo(() => messages.filter(m => !m.read).length, [messages]);
  const pendingOffers = incomingOffers.length;
  const hasJobOffers = gameMode === 'career' && jobOffers.length > 0;
  const isWorldCup = gameMode === 'world-cup';
  const isSunday = gameMode === 'sunday';
  const activeTabs = isSunday ? sundayTabs : isWorldCup ? worldCupTabs : isUnemployed ? unemployedTabs : tabs;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-3 pt-2 pb-2 safe-area-bottom pointer-events-none transform-gpu">
      <nav
        role="navigation"
        aria-label={t('bottomNav.mainNavigation')}
        className={cn(
          'pointer-events-auto max-w-lg mx-auto flex items-center gap-1 bg-card/95 border border-border/50 rounded-full p-1 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]',
          matchLocked && 'opacity-60',
        )}
      >
        {activeTabs.map(({ screen, label, labelKey, icon: Icon, group }) => {
          const text = labelKey ? t(labelKey) : (label ?? '');
          const screenActive = group
            ? group.includes(currentScreen)
            : currentScreen === screen;
          const active = screenActive && !drawerOpen;
          // The badges below are unlabelled 8px dots — invisible to assistive
          // tech and countless to everyone. Fold the count into the tab's
          // accessible name (TopBar already does this for its inbox button).
          const showJobBadge = (screen === 'job-market' || screen === 'dashboard') && hasJobOffers;
          const showUnreadBadge =
            (screen === 'inbox' || (screen === 'dashboard' && !hasJobOffers)) && unreadCount > 0;
          const showOffersBadge = screen === 'transfers' && pendingOffers > 0;
          // Sunday: recruits live one sub-nav tap under Team, so the Team tab
          // carries the "somebody is interested" dot the hub button used to own.
          const showRecruitsBadge = screen === 'sunday-teamsheet' && sundayRecruits > 0;
          const badgeSuffix = showRecruitsBadge
            ? ` — ${t('sunday.nav.recruitsInterested', { n: sundayRecruits })}`
            : showJobBadge
            ? ` — ${jobOffers.length} job offer${jobOffers.length === 1 ? '' : 's'}`
            : showUnreadBadge
              ? ` — ${unreadCount} unread`
              : showOffersBadge
                ? ` — ${pendingOffers} transfer offer${pendingOffers === 1 ? '' : 's'}`
                : '';
          return (
            <button
              key={screen}
              type="button"
              onClick={() => { if (matchLocked) return; hapticLight(); setScreen(screen); }}
              aria-label={`${text}${badgeSuffix}`}
              aria-current={screenActive ? 'page' : undefined}
              aria-disabled={matchLocked || undefined}
              className={cn(
                'relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-full transition-colors min-h-[44px]',
                matchLocked ? 'pointer-events-none' : active ? 'text-primary-foreground' : 'text-foreground/70',
              )}
            >
              {active && (
                <motion.span
                  layoutId="bottom-tab-pill"
                  initial={false}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }
                  }
                  className="absolute inset-0 rounded-full bg-primary/90 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.2),0_2px_8px_hsl(var(--primary)/0.3)] will-change-transform"
                />
              )}
              <span className="relative inline-flex flex-col items-center gap-0.5">
                <span className="relative">
                  <Icon className="w-5 h-5" />
                  {showJobBadge && (
                    <motion.div
                      aria-hidden
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full animate-pulse"
                      style={{
                        background: 'radial-gradient(circle at 35% 30%, hsl(43 96% 75%) 0%, hsl(43 96% 50%) 60%, hsl(35 80% 38%) 100%)',
                        boxShadow: '0 0 6px hsl(var(--primary)/0.85), inset 0 0 0 1px rgba(255,255,255,0.25)',
                      }}
                    />
                  )}
                  {(showUnreadBadge || showOffersBadge || showRecruitsBadge) && (
                    <motion.div
                      aria-hidden
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full animate-pulse"
                      style={{
                        background: 'radial-gradient(circle at 35% 30%, #FCA5A5 0%, #E11D48 60%, #9F1239 100%)',
                        boxShadow: '0 0 6px rgba(239,68,68,0.85), inset 0 0 0 1px rgba(255,255,255,0.25)',
                      }}
                    />
                  )}
                </span>
                <span className="text-[10px] font-medium">{text}</span>
              </span>
            </button>
          );
        })}
        {/* No "More" drawer in World Cup mode — there are no club screens
            (transfers, finance, board, …) to surface. */}
        {/* The More drawer lists club-game screens (Training, Scouting, Board,
            Continental…) that do not exist in World Cup or Sunday League, so it is
            hidden in both rather than offering routes that dead-end. */}
        {!isWorldCup && !isSunday && <MoreDrawer disabled={matchLocked} open={drawerOpen} onOpenChange={setDrawerOpen} />}
      </nav>
    </div>
  );
}
