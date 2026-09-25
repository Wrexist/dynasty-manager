/**
 * Getting Started — the Dashboard's ONE onboarding checklist.
 *
 * Week 1 used to run three onboarding systems at once: a welcome modal
 * (`WelcomeCard`), this first-session checklist, and a separate coach
 * checklist with XP claims further down the page. Two cards and a blocking
 * popup taught overlapping things ("set your XI" appeared in all three), and
 * only one of them could be dismissed. They are now one card with two stages
 * (`selectChecklistStage` in `utils/dashboardSelectors.ts`):
 *
 *   1. FIRST SESSION — season 1, week 1 of a first career. The walkthrough
 *      rows below, plus the welcome line and the optional 6-panel tour that
 *      used to be the welcome modal. Finishing the three tickable rows pays
 *      `ONBOARDING_COMPLETION_XP` (idempotent in the store) and hands over to
 *      stage 2.
 *   2. COACH — afterwards, through `COACH_CHECKLIST_MAX_SEASON`: the claimable
 *      coach tasks (`buildCoachTasks`), each paying its XP on the claim tap,
 *      until every task is claimed.
 *
 * One dismiss control for both: it sets `settings.hideOnboarding`, which is
 * persisted with the save and re-enabled from Settings → New-career
 * walkthrough. (It used to be a session-only dismissal, so the card came back
 * on every launch of week 1.)
 *
 * The first row is a FOOTBALL decision, and the ordering is the point. The
 * sponsor and scout rows are administration: worth doing, but neither changes
 * how the team plays and neither has a consequence visible in the first match
 * (a scout report lands weeks later). The game-plan row closes a loop that was
 * already fully built and simply unadvertised: the match engine reads the
 * plan, and PostMatchPopup renders a debrief line that only appears when a
 * plan was set. Choose, play, find out whether it worked.
 *
 * First-session completion rules — all derived from observable state:
 *   - Game-plan row done when matchGamePlan !== 'none'; hidden entirely when
 *     the club has no unplayed fixture this week (no un-tickable orphan row).
 *   - Sponsor row done when sponsorOffers.length === 0.
 *   - Scout row done when scouting.assignments.length > 0; swapped for a
 *     "hire a scout" row when scouting.maxAssignments === 0.
 *   - Advance-week row never ticks; advancing ends the stage via the week.
 *
 * `WELCOME_SHOWN` (which holds back the daily-reward modal and the festival
 * banner so they do not land on top of a brand-new player) is set as soon as
 * the first-session stage is over — it used to be set by the welcome modal.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useGameStore } from '@/store/gameStore';
import { ONBOARDING_COMPLETION_XP, COACH_ALL_TASKS_BONUS_XP } from '@/config/gameBalance';
import { useShallow } from 'zustand/react/shallow';
import { Banknote, Search, Calendar, UserPlus, ClipboardList, Check, X, ChevronRight, ArrowRight } from 'lucide-react';
import type { GameScreen } from '@/types/game';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { readSessionJson, writeSessionJson, getFlag, setFlag, STORAGE_KEYS } from '@/store/helpers/persistence';
import { LIQUID_GLASS_SURFACE } from '@/components/game/GlassPanel';
import { FloatingXP } from '@/components/game/FloatingXP';
import { PremiumCheck } from '@/components/game/icons/PremiumCheck';
import { PremiumProgress } from '@/components/game/PremiumProgress';
import { WelcomeOverlay } from '@/components/game/WelcomeOverlay';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { useUnreadCount } from '@/hooks/useGameSelectors';
import { buildCoachTasks } from '@/utils/gameCoach';
import { isSeasonOver, selectChecklistStage } from '@/utils/dashboardSelectors';
import { celebrationToast } from '@/utils/gameToast';
import { cn } from '@/lib/utils';

/** Session flag: the first-session rows were completed this session. */
const FIRST_SESSION_DONE_KEY = STORAGE_KEYS.ONBOARDING_CHECKLIST_DISMISSED;

interface WalkthroughStep {
  text: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  done: boolean;
  screen: GameScreen;
  whyItMatters: string;
  steps: WalkthroughStep[];
  successCue: string;
}

interface FirstSessionInput {
  hasMatchThisWeek: boolean;
  gamePlanTaskDone: boolean;
  sponsorTaskDone: boolean;
  scouting: { maxAssignments: number; assignments: unknown[] };
}

/** The first-session rows. The scout row swaps to a "hire a scout from Staff"
 *  row when the user has no scout on payroll, so the checklist never has an
 *  un-tickable orphan row. */
function buildFirstSessionItems({ hasMatchThisWeek, gamePlanTaskDone, sponsorTaskDone, scouting }: FirstSessionInput): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // FIRST, and deliberately so. The other two rows are administration — they
  // are worth doing, but neither changes how the team plays and neither has a
  // consequence the player can see in their first match. A new manager's
  // opening lesson was "sign a sponsorship contract, then dispatch a scout
  // whose report arrives in a month", with the football filed under
  // "optionally peek at Tactics".
  //
  // This row is a football decision whose payoff is already built: the match
  // engine reads the plan (counter-tactic bonuses in `engine/match.ts`) and
  // `PostMatchPopup` renders a debrief line that ONLY appears when a plan was
  // set. So choose -> play -> the game tells you whether it worked, which is
  // the loop the first session has to teach. Nobody was being pointed at it.
  if (hasMatchThisWeek) {
    items.push({
      id: 'game-plan',
      label: 'Set a plan for your first match',
      description: 'Read the opposition, then decide how you want to play them.',
      icon: ClipboardList,
      done: gamePlanTaskDone,
      screen: 'match-prep',
      whyItMatters: 'This is the job. Match Prep shows you what the opposition are good at, and your plan is how you answer it — shackle their danger man, target a weak flank, or sit deep and frustrate them. Every plan trades something away, so there is no free right answer. After the match, your debrief tells you whether the plan worked, so you learn something either way.',
      steps: [
        { text: 'Tap "Take me there" below, or tap the match card at the top of your Dashboard.' },
        { text: 'Read the opposition panel first — it shows their form, their shape, and their danger man.' },
        { text: 'Scroll to "Game Plan". You get four choices, including "No Special Plan".' },
        { text: 'Tap the one that answers what you just read. Each card names what it costs you as well as what it gives.' },
      ],
      successCue: 'Your chosen plan stays highlighted and this row ticks. After the final whistle, the post-match summary adds a line telling you how the plan played out.',
    });
  }

  items.push({
    id: 'sponsor',
    label: 'Sign your first sponsor',
    description: 'A local brand has put a kit-sleeve offer on the table.',
    icon: Banknote,
    done: sponsorTaskDone,
    screen: 'finance',
    whyItMatters: 'Sponsorships are weekly income on top of matchday revenue. The offer on your desk pays for the rest of the season. Ignore it and it expires in six weeks — you\'ll have left free money on the table.',
    steps: [
      { text: 'Tap "More" in the bottom navigation bar (three dots, bottom-right).' },
      { text: 'In the menu that slides up, tap "Finance".' },
      { text: 'Scroll down until you see a section titled "Pending Offers".' },
      { text: 'You\'ll see one offer — "Kit Sleeve Sponsor" with a weekly payment. Tap the row.' },
      { text: 'A details sheet opens with the sponsor name, weekly payment, bonus condition, and duration. Read it, then tap "Accept" (or "Decline" — both count as reviewing).' },
    ],
    successCue: 'Once accepted, the offer moves from "Pending Offers" to "Sponsor Slots" with a green payment bar. This checklist row will tick.',
  });

  if (scouting.maxAssignments > 0) {
    items.push({
      id: 'scout',
      label: 'Send your first scout',
      description: 'Scouts find players you would never see on the open market.',
      icon: Search,
      done: scouting.assignments.length > 0,
      screen: 'scouting',
      whyItMatters: 'The transfer market only shows players whose clubs have listed them. Scouts find the rest — hidden gems, high-potential teenagers. You start with idle scouts costing you nothing; put them to work.',
      steps: [
        // Scouting is NOT in the More drawer — it lives on the Market tab's
        // sub-nav (MARKET_SUB_NAV in config/ui.ts). Do not "simplify" this back
        // to "tap More" — that instruction is impossible to follow.
        { text: 'Tap "Market" in the bottom navigation bar (the left-right arrows).' },
        { text: 'At the top of the Market page there\'s a row of pills: Transfers · Scouting · Packs. Tap "Scouting".' },
        { text: 'Below the empty reports area you\'ll see "Send Scout" with five regions.' },
        { text: 'Tap any region. Domestic returns reports fastest (2 weeks); Asia and Africa take 4-5 weeks but surface higher-potential youngsters.' },
        { text: 'A confirmation toast appears. Reports arrive in your inbox automatically.' },
      ],
      successCue: 'A blue progress bar appears under "Active Assignments" showing weeks remaining. This checklist row will tick.',
    });
  } else {
    items.push({
      id: 'hire-scout',
      label: 'Hire your first scout',
      description: 'You currently have no scouts. Hire one from Staff to unlock scouting.',
      icon: UserPlus,
      // No way to derive completion without a scout on the books; the row
      // ticks once the user hires (maxAssignments > 0), which flips the
      // ternary above to the regular scout row.
      done: false,
      screen: 'staff',
      whyItMatters: 'Without a scout on your staff you cannot send anyone out on assignment, and the entire Scouting page sits idle. Tier-1 scouts are cheap and find domestic talent reliably.',
      steps: [
        // Staff is NOT in the More drawer — it lives on the Squad tab's sub-nav
        // (SQUAD_SUB_NAV in config/ui.ts).
        { text: 'Tap "Squad" in the bottom navigation bar.' },
        { text: 'At the top of the Squad page there\'s a row of pills: Squad · Training · Staff · Youth. Tap "Staff".' },
        { text: 'Scroll to the Scout role card — a candidate appears under "Available to Hire".' },
        { text: 'Tap the "+" button on that card to hire — the cost is a one-off signing fee plus a weekly wage. If you can\'t afford the fee the card says so.' },
      ],
      successCue: 'Once hired, this row swaps to "Send your first scout" — head to Scouting and send them on assignment.',
    });
  }

  items.push({
    id: 'advance',
    label: 'Then: play your first match',
    description: 'When you\'re set up, play your Week 1 matches to start the season.',
    icon: Calendar,
    done: false,
    screen: 'match-prep',
    whyItMatters: 'Time only moves when you advance it. The game pauses indefinitely between weeks so you can set tactics, manage transfers, and review scout reports. Once you advance, the next week begins and training fires.',
    steps: [
      { text: 'Check your starting XI under Squad (bottom nav) — one is already picked for you, but it is yours to change.' },
      { text: 'Your game plan from the first task is already locked in for this match.' },
      // "Take me there" jumps straight to Match Prep; these steps describe
      // the manual route for users who prefer to navigate themselves.
      { text: 'Or tap "Take me there" below to jump straight to Match Prep.' },
      { text: 'Review your squad, then tap "Kick Off".' },
      { text: 'Play your Week 1 match, then advance. Any pre-season friendlies are scheduled on free weeks, so you never face two matches in one week.' },
    ],
    successCue: 'Once advanced, this whole checklist disappears — you\'re inside the weekly loop now.',
  });
  return items;
}

export function OnboardingChecklist() {
  const { t } = useTranslation();
  const {
    week, season, totalWeeks, seasonPhase, sponsorOffers, scouting, prestigeLevel, hideOnboarding, matchGamePlan,
    hasMatchThisWeek, club, fixtures, playerClubId, players, weeklyObjectives, transferWindowOpen, shortlistCount,
    completedCoachTaskIds,
  } = useGameStore(
    useShallow(s => ({
      week: s.week,
      season: s.season,
      totalWeeks: s.totalWeeks,
      seasonPhase: s.seasonPhase,
      sponsorOffers: s.sponsorOffers,
      scouting: s.scouting,
      prestigeLevel: s.managerProgression?.prestigeLevel ?? 0,
      hideOnboarding: s.settings.hideOnboarding,
      matchGamePlan: s.matchGamePlan,
      // The game-plan task is only offerable if there is actually a match to
      // plan for. A club with a week-1 bye would otherwise get a row it
      // cannot tick.
      hasMatchThisWeek: s.fixtures.some(
        f => f.week === s.week && !f.played
          && (f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId),
      ),
      club: s.clubs[s.playerClubId],
      fixtures: s.fixtures,
      playerClubId: s.playerClubId,
      players: s.players,
      weeklyObjectives: s.weeklyObjectives,
      transferWindowOpen: s.transferWindowOpen,
      shortlistCount: s.shortlist.length,
      completedCoachTaskIds: s.completedCoachTaskIds,
    })),
  );
  const unread = useUnreadCount();
  const setScreen = useGameStore(s => s.setScreen);
  const updateSettings = useGameStore(s => s.updateSettings);
  const completeOnboardingChecklist = useGameStore(s => s.completeOnboardingChecklist);
  const markCoachTaskComplete = useGameStore(s => s.markCoachTaskComplete);

  const [firstSessionDone, setFirstSessionDone] = useState(() => readSessionJson<boolean>(FIRST_SESSION_DONE_KEY) === true);
  const [activeWalkthrough, setActiveWalkthrough] = useState<ChecklistItem | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [justClaimed, setJustClaimed] = useState<string | null>(null);

  // Focus trap + Escape close for the walkthrough modal. Hooks must run
  // unconditionally before the early-return guards below.
  const walkthroughRef = useRef<HTMLDivElement | null>(null);
  const closeWalkthrough = () => setActiveWalkthrough(null);
  useFocusTrap(walkthroughRef, activeWalkthrough !== null);
  useEscapeClose(closeWalkthrough, activeWalkthrough !== null);

  // ── Stage 1 completion ──
  const sponsorTaskDone = sponsorOffers.length === 0;
  const scoutTaskDone = scouting.maxAssignments > 0 && scouting.assignments.length > 0;
  // Setting a plan is the one task that changes how the team plays, so it
  // gates completion alongside the two admin rows.
  const gamePlanTaskDone = !hasMatchThisWeek || matchGamePlan !== 'none';
  const allFirstSessionDone = gamePlanTaskDone && sponsorTaskDone && scoutTaskDone;

  // ── Stage 2: coach tasks ──
  const coachTasks = useMemo(() => {
    if (!club) return [];
    return buildCoachTasks({
      club, fixtures, playerClubId, unreadMessages: unread, objectives: weeklyObjectives, players,
      transferWindowOpen, scoutAssignments: scouting.assignments, scoutReportsCount: scouting.reports.length,
      shortlistCount, week, season, completedTaskIds: completedCoachTaskIds,
    });
  }, [club, fixtures, playerClubId, unread, weeklyObjectives, players, transferWindowOpen, scouting.assignments,
    scouting.reports.length, shortlistCount, week, season, completedCoachTaskIds]);
  const isClaimed = useCallback((id: string) => completedCoachTaskIds.includes(id), [completedCoachTaskIds]);
  const claimedCount = coachTasks.filter(task => isClaimed(task.id)).length;

  const seasonOver = useMemo(
    () => isSeasonOver({ fixtures, playerClubId, week, totalWeeks, seasonPhase }),
    [fixtures, playerClubId, week, totalWeeks, seasonPhase],
  );
  const stage = selectChecklistStage({
    season, week, prestigeLevel, hideOnboarding: !!hideOnboarding, firstSessionDone, seasonOver,
    coachTaskCount: coachTasks.length, coachTasksClaimed: claimedCount,
  });
  const isFirstSession = stage === 'first-session';

  // The first-launch gate for the daily reward and festival banner used to be
  // set by the welcome modal. Set it once the first-session stage is over.
  useEffect(() => {
    if (!isFirstSession && !getFlag(STORAGE_KEYS.WELCOME_SHOWN)) setFlag(STORAGE_KEYS.WELCOME_SHOWN);
  }, [isFirstSession]);

  // Stage 1 → 2: once the three starter rows are done, pay the one-off reward
  // (idempotent in the store) and, after a beat long enough to see it reach
  // 3/3, hand over to the coach tasks. A career that STARTS already complete
  // (no sponsor offer generated + a pre-assigned scout) gets a longer,
  // readable beat instead of flashing past.
  const sawIncompleteRef = useRef(false);
  useEffect(() => {
    if (!isFirstSession) return;
    if (!allFirstSessionDone) { sawIncompleteRef.current = true; return; }
    if (completeOnboardingChecklist()) {
      toast.success(t('onboardingChecklist.completeToastTitle'), {
        description: t('onboardingChecklist.completeToastBody', { xp: ONBOARDING_COMPLETION_XP }),
      });
    }
    writeSessionJson(FIRST_SESSION_DONE_KEY, true);
    const delay = sawIncompleteRef.current ? 1400 : 5000;
    const timer = window.setTimeout(() => setFirstSessionDone(true), delay);
    return () => window.clearTimeout(timer);
  }, [isFirstSession, allFirstSessionDone, completeOnboardingChecklist, t]);

  // Light tap when a coach task becomes ready to claim (XP lands on the claim).
  const prevReadyRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ready = new Set(coachTasks.filter(task => task.completed).map(task => task.id));
    const prev = prevReadyRef.current;
    prevReadyRef.current = ready;
    if (prev && [...ready].some(id => !prev.has(id))) hapticLight();
  }, [coachTasks]);

  const claimTimerRef = useRef<number | null>(null);
  useEffect(() => () => { if (claimTimerRef.current) window.clearTimeout(claimTimerRef.current); }, []);
  const claimCoachTask = (taskId: string) => {
    if (isClaimed(taskId)) return;
    const wasLast = claimedCount + 1 === coachTasks.length;
    markCoachTaskComplete(taskId);
    hapticMedium();
    setJustClaimed(taskId);
    if (claimTimerRef.current) window.clearTimeout(claimTimerRef.current);
    claimTimerRef.current = window.setTimeout(() => setJustClaimed(null), 1000);
    if (wasLast) {
      celebrationToast(t('onboardingChecklist.allClaimedTitle'), t('onboardingChecklist.allClaimedBody', { xp: COACH_ALL_TASKS_BONUS_XP }));
    }
  };

  const dismiss = () => {
    hapticLight();
    updateSettings({ hideOnboarding: true });
    toast(t('onboardingChecklist.hiddenToast'));
  };

  const goThere = (screen: GameScreen) => {
    hapticLight();
    setActiveWalkthrough(null);
    setScreen(screen);
  };

  const tour = tourOpen ? <WelcomeOverlay onComplete={() => setTourOpen(false)} /> : null;
  if (!stage) return tour;

  const firstSessionItems = isFirstSession
    ? buildFirstSessionItems({ hasMatchThisWeek, gamePlanTaskDone, sponsorTaskDone, scouting })
    : [];
  // The advance row is the closing step, not a tickable task — excluded from
  // the counter so it reads 1/3, 2/3, 3/3.
  const tickable = firstSessionItems.filter(i => i.id !== 'advance');
  const doneCount = isFirstSession ? tickable.filter(i => i.done).length : claimedCount;
  const totalCount = isFirstSession ? tickable.length : coachTasks.length;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(LIQUID_GLASS_SURFACE, 'p-3.5')}
        role="region"
        aria-label={t('onboardingChecklist.gettingStartedChecklist')}
      >
        {/* Specular crescent — same lighting treatment as GlassPanel. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
          style={{
            background:
              'radial-gradient(120% 90% at 50% -30%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.025) 32%, rgba(255,255,255,0) 62%)',
            mixBlendMode: 'screen',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        />

        <button
          type="button"
          onClick={dismiss}
          className="absolute top-0 right-0 w-11 h-11 flex items-center justify-center rounded-full text-foreground/40 hover:text-foreground/80 hover:bg-white/5 transition-colors"
          aria-label={t('onboardingChecklist.dismissChecklist')}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative flex items-center justify-between mb-1 pr-9">
          <span className="text-[11px] uppercase tracking-[0.18em] text-primary/80 font-semibold">
            {isFirstSession ? t('onboardingChecklist.firstSession') : t('onboardingChecklist.coachStage')}
          </span>
          <span className="text-[11px] text-foreground/60 tabular-nums">
            {t('onboardingChecklist.doneCount', { done: doneCount, total: totalCount })}
          </span>
        </div>

        <h3 className="relative text-base font-bold text-foreground font-display mb-1">{t('onboardingChecklist.title')}</h3>
        <p className="relative text-[11px] text-foreground/70 mb-2 leading-snug">
          {isFirstSession ? t('onboardingChecklist.firstSessionIntro') : t('onboardingChecklist.coachIntro')}
        </p>
        {isFirstSession && (
          <button
            type="button"
            onClick={() => { hapticLight(); setTourOpen(true); }}
            className="relative min-h-11 -ml-1 px-1 mb-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            {t('onboardingChecklist.takeTheTour')}
            <ChevronRight className="w-3.5 h-3.5" aria-hidden />
          </button>
        )}
        {!isFirstSession && (
          <PremiumProgress
            className="relative mb-3"
            size="sm"
            value={totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}
            animate={false}
          />
        )}

        <ul className="relative space-y-1.5">
          {isFirstSession && firstSessionItems.map(item => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => { hapticLight(); setActiveWalkthrough(item); }}
                  className={cn(
                    'w-full min-h-11 flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                    'bg-white/[0.025] hover:bg-white/[0.05] active:bg-white/[0.075]',
                    'border border-white/[0.04] hover:border-white/[0.08]',
                  )}
                >
                  <div className={cn(
                    'shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.25)]',
                    item.done
                      ? 'bg-emerald-500/25 text-emerald-300'
                      : item.id === 'advance'
                        ? 'bg-white/10 text-foreground/60'
                        : 'bg-primary/25 text-primary',
                  )}>
                    {item.done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-semibold', item.done ? 'text-foreground/50 line-through' : 'text-foreground')}>
                      {item.label}
                    </p>
                    <p className="text-[11px] text-foreground/60 leading-snug">{item.description}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-foreground/40 shrink-0" aria-hidden />
                </button>
              </li>
            );
          })}

          {!isFirstSession && coachTasks.map(task => {
            const claimed = isClaimed(task.id);
            const claimable = task.completed && !claimed;
            // 'dashboard' tasks (play a match week, complete an objective) are
            // done from this screen — the row is a label, not a link.
            const target = task.screen && task.screen !== 'dashboard' ? task.screen : null;
            return (
              <li key={task.id} className="relative">
                <div className={cn(
                  'w-full rounded-xl border transition-colors flex items-center gap-2 pr-1.5',
                  claimed ? 'bg-emerald-500/10 border-emerald-500/30'
                    : claimable ? 'bg-primary/10 border-primary/40'
                    : 'bg-white/[0.025] border-white/[0.04]',
                )}>
                  <button
                    type="button"
                    disabled={!target}
                    onClick={() => target && goThere(target)}
                    className="flex-1 min-w-0 min-h-11 px-3 py-2 text-left disabled:cursor-default"
                  >
                    <p className={cn('text-xs font-semibold', claimed ? 'text-emerald-400' : 'text-foreground')}>{task.title}</p>
                    <p className="text-[11px] text-foreground/60 leading-snug">{task.description}</p>
                  </button>
                  {claimable ? (
                    <button
                      type="button"
                      onClick={() => claimCoachTask(task.id)}
                      aria-label={t('onboardingChecklist.claimAria', { xp: task.xpReward, task: task.title })}
                      className="shrink-0 min-h-11 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-[0_0_10px_hsl(var(--primary)/0.4)] active:scale-95 transition-transform"
                    >
                      {t('onboardingChecklist.claim', { xp: task.xpReward })}
                    </button>
                  ) : claimed ? (
                    <span className="shrink-0 inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded text-emerald-400/70 bg-emerald-500/10">
                      <PremiumCheck className="w-2.5 h-2.5" />{t('onboardingChecklist.xp', { xp: task.xpReward })}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded text-primary/70 bg-primary/10">
                      {t('onboardingChecklist.plusXp', { xp: task.xpReward })}
                    </span>
                  )}
                </div>
                <FloatingXP amount={task.xpReward} show={justClaimed === task.id} />
              </li>
            );
          })}
        </ul>
      </motion.div>

      <AnimatePresence>
        {activeWalkthrough && (
          <motion.div
            ref={walkthroughRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm px-4 pb-6 safe-area-bottom"
            onClick={() => setActiveWalkthrough(null)}
            role="dialog"
            aria-modal="true"
            aria-label={`Walkthrough: ${activeWalkthrough.label}`}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={cn(LIQUID_GLASS_SURFACE, 'w-full max-w-sm overflow-visible')}
              onClick={e => e.stopPropagation()}
            >
              {/* Specular highlight matching the card */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-2/3 rounded-2xl overflow-hidden"
                style={{
                  background:
                    'radial-gradient(120% 90% at 50% -20%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 38%, rgba(255,255,255,0) 70%)',
                  mixBlendMode: 'screen',
                }}
              />
              <div className="relative p-5 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-foreground font-display">{activeWalkthrough.label}</h2>
                  <button
                    type="button"
                    onClick={() => setActiveWalkthrough(null)}
                    className="p-2 -m-2 rounded-full text-foreground/50 hover:text-foreground hover:bg-white/5 transition-colors"
                    aria-label={t('onboardingChecklist.closeWalkthrough')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div
                  className={cn(
                    'rounded-xl p-3 mb-3 border border-primary/20',
                    'bg-gradient-to-br from-primary/8 via-primary/5 to-transparent',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
                  )}
                >
                  <p className="text-[11px] uppercase tracking-[0.16em] text-primary font-semibold mb-1">{t('onboardingChecklist.whyBother')}</p>
                  <p className="text-xs text-foreground/90 leading-relaxed">{activeWalkthrough.whyItMatters}</p>
                </div>

                <p className="text-[11px] uppercase tracking-[0.16em] text-primary/80 font-semibold mb-2">{t('onboardingChecklist.stepByStep')}</p>
                <ol className="space-y-2.5 mb-3">
                  {activeWalkthrough.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className={cn(
                        'shrink-0 w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center tabular-nums',
                        'bg-primary/20 text-primary',
                        'shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.18)]',
                      )}>
                        {i + 1}
                      </span>
                      <p className="text-xs text-foreground/90 leading-relaxed pt-0.5">{step.text}</p>
                    </li>
                  ))}
                </ol>

                <div
                  className={cn(
                    'rounded-xl p-3 mb-4 border border-emerald-500/20',
                    'bg-gradient-to-br from-emerald-500/8 via-emerald-500/5 to-transparent',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
                  )}
                >
                  <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-400 font-semibold mb-1">{t('onboardingChecklist.whatSuccessLooksLike')}</p>
                  <p className="text-xs text-foreground/85 leading-relaxed">{activeWalkthrough.successCue}</p>
                </div>

                {activeWalkthrough.screen !== 'dashboard' ? (
                  <button
                    type="button"
                    onClick={() => goThere(activeWalkthrough.screen)}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 h-12 rounded-xl',
                      'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground',
                      'font-bold text-sm tracking-wide',
                      'shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.25),0_4px_12px_-4px_hsl(43_96%_46%/0.4)]',
                      'active:scale-[0.98] transition-transform',
                    )}
                  >
                    {t('onboardingChecklist.takeMeThere')}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveWalkthrough(null)}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 h-12 rounded-xl',
                      'bg-white/[0.06] text-foreground font-bold text-sm tracking-wide',
                      'border border-white/[0.08]',
                      'shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
                      'active:scale-[0.98] transition-transform',
                    )}
                  >
                    {t('onboardingChecklist.gotIt')}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {tour}
    </>
  );
}
