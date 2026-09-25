/**
 * The Dashboard's "More" section — everything that is not the next thing to
 * do.
 *
 * The Dashboard used to render ~40 sections in one column, with the injury and
 * contract alerts below the XP bar, sagas, objectives, achievements and
 * cliffhangers. The page now leads with one Continue button, the "Needs your
 * attention" list and the next match; this component holds the rest, collapsed
 * by default (the expanded state is remembered per device).
 *
 * It is only mounted while expanded, so its selectors and memos — week
 * previews, manager tips, record chases, achievement progress — cost nothing
 * for a player who never opens it.
 */
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  ChevronRight, TrendingUp, DollarSign, Heart, Trophy, Calendar, ShoppingBag, Dumbbell, Banknote, Users, Shield,
  BarChart3, UserPlus, Award, Flame, Zap, Package, Building2, Search, GraduationCap,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { PremiumCheck } from '@/components/game/icons/PremiumCheck';
import { PremiumProgress } from '@/components/game/PremiumProgress';
import { FloatingXP } from '@/components/game/FloatingXP';
import { InfoTip } from '@/components/game/InfoTip';
import { FormGuide } from '@/components/game/FormGuide';
import { AnimatedNumber } from '@/components/game/AnimatedNumber';
import { DynastyStatusChip } from '@/components/game/DynastyStatusChip';
import { WeeklyDigestInlineCard } from '@/components/game/WeeklyDigest';
import { FinanceBreakdownSheet, type FinanceSheetMode } from '@/components/game/FinanceBreakdownSheet';
import { BoardObjectivesCard } from '@/components/dashboard/BoardObjectivesCard';
import { usePlayerClub, useLeaguePosition, useSquadAverageMorale } from '@/hooks/useGameSelectors';
import { useFinanceBreakdown } from '@/hooks/useFinanceBreakdown';
import { useFlash } from '@/hooks/useFlash';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/helpers';
import { getConfidenceColor, getFanConfidenceColor } from '@/utils/uiHelpers';
import { getActiveCompetitions } from '@/utils/competitionStatus';
import { getWinStreak, getUnbeatenRun, getCleanSheetStreak } from '@/utils/celebrations';
import { getXPProgress, MANAGER_PERKS, canUnlockPerk, getTotalXP } from '@/utils/managerPerks';
import { getReputationTierLabel } from '@/utils/managerCareer';
import { getWeekPreview, getFallbackPreview } from '@/utils/weekPreview';
import { getManagerTips, type TipType } from '@/utils/managerTips';
import { getActiveRecordChases } from '@/utils/records';
import { getRecentForm } from '@/utils/formGuide';
import { hasUnclaimedFreeDailyPack } from '@/utils/freePacks';
import { ACHIEVEMENTS } from '@/utils/achievements';
import { STORYLINE_CHAINS } from '@/data/storylineChains';
import { LEAGUES } from '@/data/league';
import { hapticMedium } from '@/utils/haptics';
import { effectiveObjectiveXp, selectObjectivesWithProgress } from '@/utils/dashboardSelectors';
import { getTransferWindows } from '@/config/transfers';
import { PACK_PITY_THRESHOLD } from '@/config/packs';
import {
  STREAK_MORALE_THRESHOLD, OBJECTIVE_STREAK_THRESHOLD, OBJECTIVE_CYCLE_WEEKS, OBJECTIVE_STREAK_MULTIPLIER,
  ACHIEVEMENT_XP_BRONZE, ACHIEVEMENT_XP_SILVER, ACHIEVEMENT_XP_GOLD,
} from '@/config/gameBalance';
import {
  HELP_TEXTS, CONFIDENCE_CRITICAL_THRESHOLD, CONFIDENCE_LOW_THRESHOLD, FAN_MOOD_HIGH_THRESHOLD, FAN_MOOD_MID_THRESHOLD,
} from '@/config/ui';
import type { CompetitionStatusEntry, GameScreen } from '@/types/game';

// Quick Links complement the bottom nav instead of duplicating it: Squad,
// Tactics, Training and Transfers are already one tap away in the bottom bar,
// so these tiles surface the buried club-management screens instead. No two
// tiles share a hue.
const QUICK_LINKS = [
  { label: 'Schedule',   screen: 'calendar'      as const, icon: Calendar,      color: 'text-cyan-400',    glow: 'bg-cyan-500',    chip: 'bg-cyan-500/10 border-cyan-500/30' },
  { label: 'League',     screen: 'league-table'  as const, icon: Trophy,        color: 'text-amber-400',   glow: 'bg-amber-500',   chip: 'bg-amber-500/10 border-amber-500/30' },
  { label: 'Finance',    screen: 'finance'       as const, icon: Banknote,      color: 'text-emerald-400', glow: 'bg-emerald-500', chip: 'bg-emerald-500/10 border-emerald-500/30' },
  { label: 'Facilities', screen: 'facilities'    as const, icon: Building2,     color: 'text-sky-400',     glow: 'bg-sky-500',     chip: 'bg-sky-500/10 border-sky-500/30' },
  { label: 'Scouting',   screen: 'scouting'      as const, icon: Search,        color: 'text-blue-400',    glow: 'bg-blue-500',    chip: 'bg-blue-500/10 border-blue-500/30' },
  { label: 'Packs',      screen: 'packs'         as const, icon: Package,       color: 'text-yellow-300',  glow: 'bg-yellow-400',  chip: 'bg-yellow-400/10 border-yellow-400/30' },
  { label: 'Youth',      screen: 'youth-academy' as const, icon: GraduationCap, color: 'text-rose-400',    glow: 'bg-rose-500',    chip: 'bg-rose-500/10 border-rose-500/30' },
  { label: 'Cup',        screen: 'cup'           as const, icon: BarChart3,     color: 'text-orange-400',  glow: 'bg-orange-500',  chip: 'bg-orange-500/10 border-orange-500/30' },
];
const TIP_BG: Record<TipType, string> = {
  warning: 'bg-destructive/10',
  tactical: 'bg-blue-500/10',
  transfer: 'bg-amber-500/10',
  squad: 'bg-emerald-500/10',
  info: 'bg-muted/20',
};
const TIP_ICON: Record<TipType, string> = {
  warning: 'text-destructive',
  tactical: 'text-blue-400',
  transfer: 'text-amber-400',
  squad: 'text-emerald-400',
  info: 'text-primary',
};
const TRAINING_LABELS: Record<string, string> = {
  fitness: 'Fitness',
  attacking: 'Attacking',
  defending: 'Defending',
  mentality: 'Mentality',
};
const VISIBLE_ACHIEVEMENT_COUNT = ACHIEVEMENTS.filter(a => !a.hidden).length;
const TRANSFER_WINDOW_BANNER_WEEKS = 4;

// Icon per competition row. Continental keeps the per-tournament cue (Shield
// for the Shield Cup, Trophy otherwise); Super Cup is Trophy; domestic cups
// use Award.
function competitionRowIcon(entry: CompetitionStatusEntry) {
  if (entry.key === 'continental') return entry.screen === 'shield-cup' ? Shield : Trophy;
  if (entry.key === 'super-cup') return Trophy;
  return Award;
}

/**
 * A stat tile that navigates. The tap target is a full-cover button laid
 * BESIDE the content rather than around it, so the InfoTip button inside the
 * tile is a sibling, not a button nested in a button (the old tiles were
 * `role="button"` panels with an InfoTip button inside).
 */
function StatTile({ label, onOpen, className, children }: {
  label: string;
  onOpen: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <GlassPanel className={cn('p-4', className)}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className="absolute inset-0 z-[1] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      />
      {children}
    </GlassPanel>
  );
}

/** Keeps an InfoTip tappable above a StatTile's cover button. */
function TipSlot({ text }: { text: string }) {
  return <span className="relative z-[2]"><InfoTip text={text} /></span>;
}

interface DashboardMoreProps {
  seasonOver: boolean;
  inPlayoffs: boolean;
}

export function DashboardMore({ seasonOver, inPlayoffs }: DashboardMoreProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotionPref();
  const {
    playerClubId, clubs, players, week, season, fixtures, leagueTable, boardConfidence, boardObjectives,
    incomingOffers, trainingFocus, cup, leagueCup, championsCup, shieldCup, conferenceCup, virtualClubs,
    domesticSuperCup, continentalSuperCup, weekCliffhangers, objectiveStreak, facilities, scouting, divisionTables,
    playerDivision, managerProgression, clubRecords, transferWindowOpen, training, weeklyObjectives, totalWeeks,
    objectivesStartWeek, gameMode, careerManager, jobOffers, fanMood, sessionStats, activeStorylineChains,
    unlockedAchievements, packPityCounter, dailyPackOpens, friendlies,
  } = useGameStore(useShallow(s => ({
    playerClubId: s.playerClubId, clubs: s.clubs, players: s.players, week: s.week, season: s.season,
    fixtures: s.fixtures, leagueTable: s.leagueTable, boardConfidence: s.boardConfidence,
    boardObjectives: s.boardObjectives, incomingOffers: s.incomingOffers, trainingFocus: s.trainingFocus,
    cup: s.cup, leagueCup: s.leagueCup, championsCup: s.championsCup, shieldCup: s.shieldCup,
    conferenceCup: s.conferenceCup, virtualClubs: s.virtualClubs, domesticSuperCup: s.domesticSuperCup,
    continentalSuperCup: s.continentalSuperCup, weekCliffhangers: s.weekCliffhangers,
    objectiveStreak: s.objectiveStreak, facilities: s.facilities, scouting: s.scouting,
    divisionTables: s.divisionTables, playerDivision: s.playerDivision, managerProgression: s.managerProgression,
    clubRecords: s.clubRecords, transferWindowOpen: s.transferWindowOpen, training: s.training,
    weeklyObjectives: s.weeklyObjectives, totalWeeks: s.totalWeeks, objectivesStartWeek: s.objectivesStartWeek,
    gameMode: s.gameMode, careerManager: s.careerManager, jobOffers: s.jobOffers, fanMood: s.fanMood,
    sessionStats: s.sessionStats, activeStorylineChains: s.activeStorylineChains,
    unlockedAchievements: s.unlockedAchievements, packPityCounter: s.packPityCounter || 0,
    dailyPackOpens: s.dailyPackOpens, friendlies: s.friendlies,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  const selectPlayer = useGameStore(s => s.selectPlayer);
  const claimObjective = useGameStore(s => s.claimObjective);
  const club = usePlayerClub();
  const pos = useLeaguePosition();
  const avgMorale = useSquadAverageMorale();
  const budgetFlash = useFlash(club?.budget || 0);
  const { breakdown: financeBreakdown } = useFinanceBreakdown();
  const netWeeklyIncome = financeBreakdown?.net ?? 0;
  const tw = getTransferWindows(totalWeeks);
  const [financeSheetOpen, setFinanceSheetOpen] = useState(false);
  const [financeSheetMode, setFinanceSheetMode] = useState<FinanceSheetMode>('all');
  const openFinance = (mode: FinanceSheetMode) => { setFinanceSheetMode(mode); setFinanceSheetOpen(true); };

  const entry = useMemo(() => leagueTable.find(e => e.clubId === playerClubId), [leagueTable, playerClubId]);
  const winStreak = useMemo(() => getWinStreak(playerClubId, fixtures), [playerClubId, fixtures]);
  const unbeatenRun = useMemo(() => getUnbeatenRun(playerClubId, fixtures), [playerClubId, fixtures]);
  const cleanSheetStreak = useMemo(() => getCleanSheetStreak(playerClubId, fixtures), [playerClubId, fixtures]);
  const recentForm = useMemo(() => getRecentForm(playerClubId, fixtures), [playerClubId, fixtures]);
  const hasPlayed = useMemo(
    () => fixtures.some(m => m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId)),
    [fixtures, playerClubId],
  );

  const activeCompetitions = useMemo(() => getActiveCompetitions({
    cup, leagueCup, championsCup, shieldCup, conferenceCup,
    domesticSuperCup, continentalSuperCup, playerClubId, clubs, virtualClubs,
  }), [cup, leagueCup, championsCup, shieldCup, conferenceCup, domesticSuperCup, continentalSuperCup, playerClubId, clubs, virtualClubs]);

  // Week preview teasers (with fallback so there's always something forward-looking)
  const weekPreviews = useMemo(() => {
    if (!club) return [];
    const ctx = { playerClubId, players, clubs, fixtures, facilities, scouting, week, season, totalWeeks, boardObjectives, divisionTables, playerDivision };
    const items = getWeekPreview(ctx);
    return items.length > 0 ? items : getFallbackPreview(ctx);
  }, [playerClubId, players, clubs, fixtures, facilities, scouting, week, season, totalWeeks, club, boardObjectives, divisionTables, playerDivision]);

  const xpProgress = useMemo(() => getXPProgress(managerProgression), [managerProgression]);
  // Cheapest perk that is unlockable or only blocked by XP (not prerequisites).
  const nextPerk = useMemo(() => {
    const totalXP = getTotalXP(managerProgression);
    const available = MANAGER_PERKS
      .filter(p => !managerProgression.unlockedPerks.includes(p.id))
      .filter(p => {
        const { canUnlock, reason } = canUnlockPerk(p, managerProgression);
        return canUnlock || (reason && reason.startsWith('Need'));
      })
      .sort((a, b) => a.cost - b.cost);
    if (available.length === 0) return null;
    const perk = available[0];
    return { name: perk.name, xpNeeded: Math.max(0, perk.cost - totalXP) };
  }, [managerProgression]);

  const recordChases = useMemo(() => {
    if (!club) return [];
    const squad = club.playerIds.map(id => players[id]).filter(Boolean);
    return getActiveRecordChases(clubRecords, squad, fixtures, playerClubId);
  }, [club, players, fixtures, playerClubId, clubRecords]);

  // Season race — the leader plus the two places either side of the player.
  const seasonRace = useMemo(() => {
    if (!entry || leagueTable.length < 3) return [];
    const playerIdx = leagueTable.indexOf(entry);
    const nearby = new Set<number>();
    if (playerIdx > 0) nearby.add(0);
    for (let i = Math.max(0, playerIdx - 2); i <= Math.min(leagueTable.length - 1, playerIdx + 2); i++) nearby.add(i);
    return [...nearby].sort((a, b) => a - b).slice(0, 5).map(i => ({
      clubId: leagueTable[i].clubId,
      shortName: clubs[leagueTable[i].clubId]?.shortName || '?',
      color: clubs[leagueTable[i].clubId]?.color ?? '#6b7280',
      points: leagueTable[i].points,
      position: i + 1,
      isPlayer: leagueTable[i].clubId === playerClubId,
    }));
  }, [leagueTable, entry, clubs, playerClubId]);

  const managerTips = useMemo(() => club ? getManagerTips({
    week, season, totalWeeks, club, players, fixtures, transferWindowOpen,
    boardConfidence, incomingOffers: incomingOffers.length, tacticalFamiliarity: training.tacticalFamiliarity,
  }) : [], [week, season, totalWeeks, club, players, fixtures, transferWindowOpen, boardConfidence, incomingOffers.length, training.tacticalFamiliarity]);

  const activeSagas = useMemo(() => (activeStorylineChains || []).map(chain => {
    const def = STORYLINE_CHAINS.find(c => c.id === chain.chainId);
    if (!def || chain.currentStep >= def.steps.length) return null;
    const targetPlayer = chain.targetPlayerId ? players[chain.targetPlayerId] : null;
    return { chain, def, targetPlayer };
  }).filter(Boolean), [activeStorylineChains, players]);

  // Achievement progress (top 5 closest to completion). An achievement's
  // progress function reads the WHOLE state, so this is a per-week snapshot
  // on purpose: subscribing to the whole store would re-render on every set.
  const achievementProgress = useMemo(() => {
    void week;
    const state = useGameStore.getState();
    return ACHIEVEMENTS
      .filter(a => !a.hidden && !(unlockedAchievements || []).includes(a.id) && a.progress)
      .map(a => ({ ...a, prog: a.progress!(state) }))
      .filter(a => a.prog && a.prog.current > 0 && a.prog.target > 0)
      .sort((a, b) => (b.prog!.current / b.prog!.target) - (a.prog!.current / a.prog!.target))
      .slice(0, 5);
  }, [unlockedAchievements, week]);

  const objectivesWithProgress = useMemo(() => selectObjectivesWithProgress({
    weeklyObjectives, club, players, playerClubId, fixtures, leagueTable, week, season,
    friendlies, cup, leagueCup, championsCup, shieldCup, conferenceCup, domesticSuperCup, continentalSuperCup,
  }), [weeklyObjectives, club, players, playerClubId, fixtures, leagueTable, week, season,
    friendlies, cup, leagueCup, championsCup, shieldCup, conferenceCup, domesticSuperCup, continentalSuperCup]);
  const claimedObjectives = weeklyObjectives.filter(o => o.claimed).length;
  const allObjectivesClaimed = weeklyObjectives.length > 0 && weeklyObjectives.every(o => o.completed && o.claimed);

  const [justClaimedObjective, setJustClaimedObjective] = useState<string | null>(null);
  const claimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (claimTimerRef.current) clearTimeout(claimTimerRef.current); }, []);
  const handleClaimObjective = useCallback((objectiveId: string) => {
    const obj = weeklyObjectives.find(o => o.objectiveId === objectiveId);
    if (!obj || !obj.completed || obj.claimed) return;
    claimObjective(objectiveId);
    hapticMedium();
    setJustClaimedObjective(objectiveId);
    if (claimTimerRef.current) clearTimeout(claimTimerRef.current);
    claimTimerRef.current = setTimeout(() => setJustClaimedObjective(null), 1000);
  }, [weeklyObjectives, claimObjective]);

  if (!club) return null;

  // Packs tile badge: the pity countdown when it is close, else a dot for an
  // unopened free daily pack.
  const packPityRemaining = Math.max(0, PACK_PITY_THRESHOLD - packPityCounter);
  const packBadge = packPityRemaining <= 2
    ? { label: packPityRemaining === 0 ? '✦' : String(packPityRemaining) }
    : hasUnclaimedFreeDailyPack(dailyPackOpens) ? { label: null } : null;

  const windowEnd = week <= tw.summerEnd ? tw.summerEnd : tw.winterEnd;
  const windowWeeksLeft = windowEnd - week;
  const isDeadlineWeek = week === tw.summerEnd || week === tw.winterEnd;
  const showWindowBanner = transferWindowOpen && !isDeadlineWeek && windowWeeksLeft <= TRANSFER_WINDOW_BANNER_WEEKS;
  const windowUrgent = windowWeeksLeft <= 2;

  const chip = 'inline-flex items-center gap-1.5 min-h-11 rounded-full px-3.5 text-xs font-semibold border transition-colors';

  return (
    <div className="space-y-4">
      {/* This week's summary — the digest's inline form on quiet weeks. */}
      <WeeklyDigestInlineCard />

      <DynastyStatusChip />

      {/* Club overview */}
      <div className="space-y-3">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold px-1">{t('dashboard.more.clubOverview')}</p>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label={t('dashboard.more.openLeagueTable')} onOpen={() => setScreen('league-table')}>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-muted-foreground">League Pos</span>
            </div>
            <p className="text-3xl font-black text-foreground tabular-nums">
              {pos}<span className="text-sm text-muted-foreground">/{leagueTable.length}</span>
            </p>
            <p className="text-[11px] text-muted-foreground truncate">{LEAGUES.find(d => d.id === playerDivision)?.shortName || ''} {'•'} {entry?.points || 0} pts</p>
            {hasPlayed ? <FormGuide form={recentForm} className="mt-2" /> : <p className="text-[11px] text-muted-foreground mt-2">No games yet</p>}
          </StatTile>

          <StatTile label={t('dashboard.more.openBudget')} onOpen={() => openFinance('budget')}>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-muted-foreground">Budget</span>
              <TipSlot text={HELP_TEXTS.budget} />
            </div>
            <p className={cn('text-2xl font-black text-foreground tabular-nums', budgetFlash)}>
              <AnimatedNumber value={club.budget} formatFn={formatMoney} />
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">Wage: {formatMoney(club.wageBill)}/w</p>
          </StatTile>

          <StatTile label={t('dashboard.more.openSquad')} onOpen={() => setScreen('squad')}>
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-4 h-4 text-red-400" />
              <span className="text-xs text-muted-foreground">Morale</span>
              <TipSlot text={HELP_TEXTS.morale} />
            </div>
            <p className={cn('text-2xl font-black tabular-nums', avgMorale > 70 ? 'text-emerald-400' : avgMorale > 40 ? 'text-amber-400' : 'text-destructive')}>
              {avgMorale}%
            </p>
            <p className="text-[11px] text-muted-foreground">
              {avgMorale > 70 ? 'Excellent' : avgMorale > 40 ? 'Decent' : 'Low — affects performance'}
            </p>
          </StatTile>

          <StatTile
            label={t('dashboard.more.openBoard')}
            onOpen={() => setScreen('board')}
            className={cn(boardConfidence <= CONFIDENCE_CRITICAL_THRESHOLD && 'border-destructive/50')}
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className={cn('w-4 h-4', getConfidenceColor(boardConfidence).textClass)} />
              <span className="text-xs text-muted-foreground">Board</span>
              <TipSlot text={HELP_TEXTS.boardConfidence} />
            </div>
            <p className={cn('text-2xl font-black tabular-nums', getConfidenceColor(boardConfidence).textClass)}>
              {Math.round(boardConfidence)}%
            </p>
            <PremiumProgress
              className="mt-1.5"
              size="sm"
              tone={boardConfidence > 50 ? 'emerald' : boardConfidence > 25 ? 'amber' : 'rose'}
              value={boardConfidence}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {boardConfidence > 70 ? 'Secure' : boardConfidence > 40 ? 'Under pressure' : 'Sacking risk!'}
            </p>
            {boardConfidence <= CONFIDENCE_LOW_THRESHOLD && boardConfidence > 25 && (
              <p className="text-[11px] text-destructive/80 mt-0.5">
                ~{Math.max(1, Math.ceil((boardConfidence - 25) / 4))} more loss{Math.ceil((boardConfidence - 25) / 4) !== 1 ? 'es' : ''} could mean the sack
              </p>
            )}
          </StatTile>

          <StatTile label={t('dashboard.more.openFinance')} onOpen={() => openFinance('all')}>
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-muted-foreground">Net Income</span>
            </div>
            <p className={cn('text-xl font-black tabular-nums', netWeeklyIncome >= 0 ? 'text-emerald-400' : 'text-destructive')}>
              {netWeeklyIncome >= 0 ? '+' : ''}{formatMoney(netWeeklyIncome)}
            </p>
            <p className="text-[11px] text-muted-foreground">per week</p>
          </StatTile>

          <StatTile label={t('dashboard.more.openClub')} onOpen={() => setScreen('club')}>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-sky-400" />
              <span className="text-xs text-muted-foreground">Fan Mood</span>
              <TipSlot text={HELP_TEXTS.fanMood} />
            </div>
            <p className={cn('text-xl font-black tabular-nums', getFanConfidenceColor(fanMood))}>{fanMood}%</p>
            <p className="text-[11px] text-muted-foreground">
              {fanMood >= FAN_MOOD_HIGH_THRESHOLD ? 'Buzzing' : fanMood >= FAN_MOOD_MID_THRESHOLD ? 'Content' : 'Restless'}
            </p>
          </StatTile>
        </div>
      </div>

      {/* This week — training focus, shortcuts and streaks. Chips are 44px
          tap targets (they were ~26px). */}
      {!seasonOver && !inPlayoffs && (
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setScreen('training')} className={cn(chip, 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20')}>
            <Dumbbell className="w-3.5 h-3.5" />
            {t('dashboard.more.trainingChip', { focus: TRAINING_LABELS[trainingFocus] || trainingFocus, familiarity: training.tacticalFamiliarity })}
          </button>
          {transferWindowOpen && (
            <button type="button" onClick={() => setScreen('transfers')} className={cn(chip, 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20')}>
              <UserPlus className="w-3.5 h-3.5" /> {t('dashboard.more.scoutTransfers')}
            </button>
          )}
          {scouting.reports.length > 0 && (
            <button type="button" onClick={() => setScreen('scouting')} className={cn(chip, 'bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50')}>
              <BarChart3 className="w-3.5 h-3.5" /> {t('dashboard.more.scoutReports', { count: scouting.reports.length })}
            </button>
          )}
          {winStreak >= STREAK_MORALE_THRESHOLD && (
            <span className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 rounded-full px-3 py-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-bold text-orange-400">{winStreak} Wins</span>
            </span>
          )}
          {unbeatenRun >= 5 && unbeatenRun > winStreak && (
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">{unbeatenRun} Unbeaten</span>
            </span>
          )}
          {cleanSheetStreak >= 2 && (
            <span className="inline-flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/30 rounded-full px-3 py-1.5">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-xs font-bold text-sky-400">{cleanSheetStreak} Clean Sheets</span>
            </span>
          )}
          {objectiveStreak >= 2 && (
            <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-amber-400">x{objectiveStreak} Obj. Streak</span>
            </span>
          )}
        </div>
      )}

      {/* Transfer window countdown (deadline day itself is a "Needs your attention" row). */}
      {showWindowBanner && (
        <button
          type="button"
          onClick={() => setScreen('transfers')}
          className={cn(
            'w-full min-h-11 rounded-xl px-3 py-2 flex items-center justify-between text-left transition-colors',
            windowUrgent ? 'bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15' : 'bg-primary/5 border border-primary/20 hover:bg-primary/10',
          )}
        >
          <span className="flex items-center gap-2">
            <ShoppingBag className={cn('w-4 h-4', windowUrgent ? 'text-amber-400' : 'text-primary')} />
            <span className={cn('text-xs font-semibold', windowUrgent ? 'text-amber-400' : 'text-primary')}>
              {week <= tw.summerEnd ? 'Summer' : 'Winter'} Transfer Window
            </span>
          </span>
          <span className={cn('text-[11px] font-medium', windowUrgent ? 'text-amber-400' : 'text-muted-foreground')}>
            {windowWeeksLeft} week{windowWeeksLeft !== 1 ? 's' : ''} remaining
          </span>
        </button>
      )}

      {/* Career Mode panel. One tap target — the inbox shortcut that used to be
          nested inside it is in the top bar. */}
      {gameMode === 'career' && careerManager && (
        <StatTile
          className="p-3"
          label={jobOffers.length > 0 ? t('dashboard.more.openJobMarket') : t('dashboard.more.openCareer')}
          onOpen={() => setScreen(jobOffers.length > 0 ? 'job-market' : 'career-overview')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Award className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{careerManager.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Age {careerManager.age} — {getReputationTierLabel(careerManager.reputationTier ?? 'unknown')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {careerManager.contract ? (
                <p className="text-[11px] text-muted-foreground">Contract ends S{careerManager.contract.endSeason}</p>
              ) : (
                <span className="text-[11px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-semibold">Unemployed</span>
              )}
              <ChevronRight className="w-4 h-4 text-muted-foreground/70 shrink-0" aria-hidden />
            </div>
          </div>
        </StatTile>
      )}

      {/* Monthly Objectives */}
      {!seasonOver && weeklyObjectives.length > 0 && !allObjectivesClaimed && (
        <GlassPanel className="p-4 border-amber-500/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">Monthly Objectives</p>
              <span className="text-[11px] text-muted-foreground">Week {Math.max(1, Math.min(week - (objectivesStartWeek || 1) + 1, OBJECTIVE_CYCLE_WEEKS))}/{OBJECTIVE_CYCLE_WEEKS}</span>
              {objectiveStreak >= OBJECTIVE_STREAK_THRESHOLD && (
                <span className="text-[11px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full">
                  {OBJECTIVE_STREAK_MULTIPLIER}x Bonus
                </span>
              )}
            </div>
            <span className="text-[11px] text-amber-400 font-semibold shrink-0">{claimedObjectives}/{weeklyObjectives.length}</span>
          </div>
          <div className="space-y-2 mt-3">
            {objectivesWithProgress.map((obj) => (
              <div
                key={obj.objectiveId}
                className={cn(
                  'relative flex items-center gap-2 rounded-lg px-3 py-2 transition-colors',
                  obj.claimed ? 'bg-emerald-500/10 border border-emerald-500/30'
                    : obj.completed ? 'bg-primary/10 border border-primary/40'
                    : 'bg-muted/30 border border-border/30',
                )}
              >
                <DynamicIcon name={obj.icon} className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn('text-xs font-semibold truncate', obj.claimed ? 'text-emerald-400 line-through' : 'text-foreground')}>{obj.title}</p>
                    {obj.rarity === 'rare' && (
                      <span className="text-[11px] font-bold text-blue-400 bg-blue-500/15 px-1 py-0.5 rounded shrink-0">RARE</span>
                    )}
                    {obj.rarity === 'legendary' && (
                      <span className="text-[11px] font-bold text-primary bg-primary/15 px-1 py-0.5 rounded shrink-0">LEGENDARY</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{obj.description}</p>
                  {!obj.completed && obj.progress && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <PremiumProgress className="flex-1" size="sm" animate={false} value={Math.min(100, (obj.progress.current / obj.progress.target) * 100)} />
                      <span className="text-[11px] text-muted-foreground tabular-nums">{obj.progress.current}/{obj.progress.target}</span>
                    </div>
                  )}
                </div>
                {obj.completed && !obj.claimed ? (
                  <button
                    type="button"
                    onClick={() => handleClaimObjective(obj.objectiveId)}
                    aria-label={t('dashboard.more.claimObjectiveAria', { xp: effectiveObjectiveXp(obj), title: obj.title })}
                    className="shrink-0 min-h-11 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-[0_0_10px_hsl(var(--primary)/0.4)] active:scale-95 transition-transform"
                  >
                    {t('dashboard.more.claimXp', { xp: effectiveObjectiveXp(obj) })}
                  </button>
                ) : (
                  <span className={cn('inline-flex items-center text-[11px] font-bold shrink-0', obj.claimed ? 'text-emerald-400' : 'text-sky-400')}>
                    {obj.claimed ? <PremiumCheck className="w-3 h-3" /> : `+${effectiveObjectiveXp(obj)} XP`}
                  </span>
                )}
                <FloatingXP amount={effectiveObjectiveXp(obj)} show={justClaimedObjective === obj.objectiveId} />
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Active Sagas */}
      {!seasonOver && activeSagas.length > 0 && (
        <GlassPanel className="p-4 border-amber-500/20">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-amber-400 uppercase tracking-wider font-semibold">Active Sagas</p>
            <span className="text-[11px] text-muted-foreground">{activeSagas.length} active</span>
          </div>
          <div className="space-y-2 mt-3">
            {activeSagas.map(saga => {
              if (!saga) return null;
              const { chain, def, targetPlayer } = saga;
              const currentStepDef = def.steps[chain.currentStep];
              const body = (
                <>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {currentStepDef && <DynamicIcon name={currentStepDef.icon} className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      <p className="text-xs font-semibold text-amber-400 truncate">{def.name}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">Step {chain.currentStep + 1}/{def.steps.length}</span>
                  </div>
                  {targetPlayer && (
                    <p className="text-[11px] text-muted-foreground mb-1.5">
                      Involving: <span className="text-foreground font-medium">{targetPlayer.firstName} {targetPlayer.lastName}</span>
                    </p>
                  )}
                  <div className="flex items-center gap-1 mb-1.5">
                    {def.steps.map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'h-1.5 flex-1 rounded-full transition-colors',
                          i < chain.currentStep ? 'bg-amber-400' : i === chain.currentStep ? 'bg-amber-400/60' : 'bg-muted/40',
                        )}
                      />
                    ))}
                  </div>
                  {currentStepDef && (
                    <p className="text-[11px] text-muted-foreground">
                      <span className="text-foreground font-medium">{currentStepDef.title}</span>{' — awaiting your decision'}
                    </p>
                  )}
                </>
              );
              const rowClass = 'rounded-lg px-3 py-2.5 bg-amber-500/5 border border-amber-500/20 w-full text-left';
              return targetPlayer ? (
                <button key={chain.chainId} type="button" onClick={() => selectPlayer(targetPlayer.id)} className={cn(rowClass, 'hover:bg-amber-500/10 transition-colors')}>
                  {body}
                </button>
              ) : (
                <div key={chain.chainId} className={rowClass}>{body}</div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Achievements In Progress */}
      {!seasonOver && achievementProgress.length > 0 && (
        <GlassPanel className="p-4 border-sky-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] text-sky-400 uppercase tracking-wider font-semibold">Achievements</p>
              <span className="text-[11px] text-muted-foreground">{(unlockedAchievements || []).length}/{VISIBLE_ACHIEVEMENT_COUNT}</span>
            </div>
            <button type="button" onClick={() => setScreen('trophy-cabinet')} className="min-h-11 -my-3 px-2 text-[11px] text-sky-400 font-semibold hover:text-sky-300">
              {t('dashboard.more.viewAll')}
            </button>
          </div>
          <div className="space-y-2 mt-3">
            {achievementProgress.map(a => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg px-3 py-2 bg-muted/30 border border-border/30">
                <DynamicIcon name={a.icon} className="w-4 h-4 text-sky-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-foreground truncate">{a.title}</p>
                    <span className={cn(
                      'text-[11px] font-bold uppercase px-1 py-0.5 rounded shrink-0',
                      a.tier === 'gold' ? 'text-primary bg-primary/15' : a.tier === 'silver' ? 'text-[hsl(var(--silver))] bg-[hsl(var(--silver))]/10' : 'text-[hsl(var(--bronze))] bg-[hsl(var(--bronze))]/10',
                    )}>
                      {a.tier}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{a.description}</p>
                  {a.prog && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <PremiumProgress className="flex-1" size="sm" tone="sky" animate={false} value={Math.min(100, (a.prog.current / a.prog.target) * 100)} />
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {a.prog.current}/{a.prog.target} · +{a.tier === 'gold' ? ACHIEVEMENT_XP_GOLD : a.tier === 'silver' ? ACHIEVEMENT_XP_SILVER : ACHIEVEMENT_XP_BRONZE} XP
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* XP Progress + Season Race */}
      {!seasonOver && (
        <div className="grid grid-cols-2 gap-3">
          <StatTile label={t('dashboard.more.openPerks')} onOpen={() => setScreen('perks')}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-muted-foreground">Manager Level</span>
            </div>
            <p className="text-2xl font-black text-amber-400 tabular-nums">{managerProgression.level}</p>
            <div className="mt-1.5">
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-muted-foreground">Next level</span>
                <span className="text-primary font-semibold tabular-nums">{xpProgress.current}/{xpProgress.needed}</span>
              </div>
              <PremiumProgress size="sm" value={xpProgress.percentage} />
            </div>
            {nextPerk && (
              <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                Next: <span className="text-primary font-semibold">{nextPerk.name}</span>
                {nextPerk.xpNeeded > 0 && <span> ({nextPerk.xpNeeded} XP)</span>}
                {nextPerk.xpNeeded === 0 && <span className="text-emerald-400"> Ready!</span>}
              </p>
            )}
          </StatTile>

          <StatTile label={t('dashboard.more.openLeagueTable')} onOpen={() => setScreen('league-table')}>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Season Race</span>
            </div>
            <div className="space-y-1">
              {seasonRace.slice(0, 4).map(team => (
                <div key={team.clubId} className={cn(
                  'flex items-center justify-between text-[11px] rounded px-1 py-0.5',
                  team.isPlayer ? 'bg-primary/10 font-bold text-primary' : 'text-muted-foreground',
                )}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 text-right tabular-nums">{team.position}</span>
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                    <span className="truncate max-w-[60px]">{team.shortName}</span>
                  </div>
                  <span className="font-semibold tabular-nums">{team.points}pts</span>
                </div>
              ))}
            </div>
          </StatTile>
        </div>
      )}

      {/* Coming Up */}
      {!seasonOver && weekPreviews.length > 0 && (
        <GlassPanel className="p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Coming Up</p>
          <div className="space-y-2">
            {weekPreviews.map((preview, i) => (
              <div
                key={`${preview.type}-${i}`}
                className={cn(
                  'flex items-center gap-2 text-xs rounded-lg px-3 py-2',
                  preview.type === 'positive' ? 'bg-emerald-500/10 text-emerald-400'
                    : preview.type === 'warning' ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-muted/30 text-muted-foreground',
                )}
              >
                <DynamicIcon name={preview.icon} className="w-4 h-4 shrink-0" />
                <span className="font-medium">{preview.text}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Cliffhangers — "one more week" hooks */}
      {!seasonOver && weekCliffhangers && weekCliffhangers.length > 0 && (
        <GlassPanel className="p-4 border-primary/20">
          <p className="text-[11px] text-primary uppercase tracking-wider font-semibold mb-2">What Happens Next...</p>
          <div className="space-y-2">
            {weekCliffhangers.map((hook, i) => (
              <div
                key={`${hook.intensity}-${i}`}
                className={cn(
                  'flex items-center gap-2 text-xs rounded-lg px-3 py-2',
                  hook.intensity === 'high' ? 'bg-red-500/10 text-red-400'
                    : hook.intensity === 'medium' ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-muted/30 text-muted-foreground',
                )}
              >
                <DynamicIcon name={hook.icon} className="w-4 h-4 shrink-0" />
                <span className="font-medium">{hook.text}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Record Chase */}
      {recordChases.length > 0 && (
        <GlassPanel className="p-3 border-primary/20">
          <div className="flex items-center gap-2 text-xs">
            <Award className="w-4 h-4 text-primary shrink-0" />
            <span className="text-foreground">
              <span className="font-bold">{recordChases[0].playerName}</span>
              {': '}
              {recordChases[0].current} {recordChases[0].label}. Club record: {recordChases[0].record}.{' '}
              <span className="text-primary font-semibold">{recordChases[0].record - recordChases[0].current} more to make history!</span>
            </span>
          </div>
        </GlassPanel>
      )}

      {/* Manager Tips */}
      {!seasonOver && managerTips.length > 0 && (
        <GlassPanel className="p-4 border-primary/20">
          <p className="text-[11px] text-primary uppercase tracking-wider font-semibold mb-2">Manager Tips</p>
          <div className="space-y-2">
            {managerTips.map(tip => {
              const target: GameScreen | undefined = tip.action;
              const inner = (
                <>
                  <DynamicIcon name={tip.icon} className={cn('w-4 h-4 shrink-0', TIP_ICON[tip.type])} />
                  <span className="text-xs text-foreground flex-1">{tip.text}</span>
                  {target && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                </>
              );
              const rowClass = cn('w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left', TIP_BG[tip.type]);
              return target ? (
                <button key={tip.text} type="button" onClick={() => setScreen(target)} className={cn(rowClass, 'min-h-11 hover:bg-white/5 transition-colors')}>
                  {inner}
                </button>
              ) : (
                <div key={tip.text} className={rowClass}>{inner}</div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Competitions — the header opens the hub, each row opens ITS competition.
          (The card used to be a clickable panel with row buttons inside it.) */}
      {activeCompetitions.length > 0 && (
        <GlassPanel className="p-2">
          <button
            type="button"
            onClick={() => setScreen('competitions')}
            className="w-full min-h-11 flex items-center justify-between px-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Competitions</span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <div>
            {activeCompetitions.map(comp => {
              const Icon = competitionRowIcon(comp);
              return (
                <button
                  type="button"
                  key={comp.screen}
                  onClick={() => setScreen(comp.screen)}
                  className="w-full min-h-11 flex items-center justify-between gap-3 px-2 text-left rounded-xl hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className={cn(
                      'w-4 h-4 shrink-0',
                      comp.outcome === 'won' ? 'text-primary' : comp.outcome === 'eliminated' ? 'text-destructive' : 'text-muted-foreground',
                    )} />
                    <span className="text-sm text-foreground truncate">{comp.title}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{comp.status}</span>
                </button>
              );
            })}
          </div>
        </GlassPanel>
      )}

      <BoardObjectivesCard boardObjectives={boardObjectives} onClick={() => setScreen('board')} />

      {/* Quick Links */}
      <div className="grid grid-cols-4 gap-2.5">
        {QUICK_LINKS.map(link => {
          const Icon = link.icon;
          const badge = link.screen === 'packs' ? packBadge : null;
          return (
            <button
              key={link.label}
              type="button"
              aria-label={t('dashboard.more.navigateTo', { screen: link.label })}
              onClick={() => setScreen(link.screen)}
              className={cn(
                'group relative overflow-hidden rounded-2xl px-2 py-3.5 flex flex-col items-center gap-2 border border-border/60',
                'bg-gradient-to-br from-card/70 to-card/30 transition-transform duration-150',
                !reduceMotion && 'active:scale-95',
              )}
            >
              <span className={cn('pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full blur-2xl opacity-30', link.glow)} />
              <div className={cn('relative p-1.5 rounded-lg border', link.chip)}>
                <Icon className={cn('w-5 h-5', link.color)} />
              </div>
              <span className="relative text-xs font-semibold tracking-wide text-foreground whitespace-nowrap">{link.label}</span>
              {badge && (badge.label ? (
                <span
                  className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full ring-2 ring-card flex items-center justify-center font-display font-black tabular-nums leading-none text-[11px] bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950"
                  aria-label={badge.label === '✦' ? 'Guarantee ready' : `${badge.label} packs to guarantee`}
                >
                  {badge.label}
                </span>
              ) : (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-card bg-emerald-500" />
              ))}
            </button>
          );
        })}
      </div>

      {/* Session Stats */}
      {sessionStats && sessionStats.weeksPlayed > 0 && (
        <div className="flex items-center justify-center gap-4 py-2 text-xs text-muted-foreground">
          <span>{sessionStats.weeksPlayed}w played</span>
          <span className="text-emerald-400">{sessionStats.matchesWon}W</span>
          <span className="text-destructive">{sessionStats.matchesLost}L</span>
          <span className="text-primary">+{sessionStats.xpEarned} XP</span>
        </div>
      )}

      <FinanceBreakdownSheet open={financeSheetOpen} onOpenChange={setFinanceSheetOpen} mode={financeSheetMode} />
    </div>
  );
}
