import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { getSuffix } from '@/utils/helpers';
import { getConfidenceColor, getFanConfidenceColor, getFanConfidence } from '@/utils/uiHelpers';
import { usePlayerClub, useLeaguePosition, useCurrentMatch, useUnreadCount } from '@/hooks/useGameSelectors';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PressConference } from '@/components/game/PressConference';
import { WelcomeOverlay } from '@/components/game/WelcomeOverlay';
import { Button } from '@/components/ui/button';
import {
  Play, ChevronRight, ChevronDown, TrendingUp, DollarSign, Heart, Trophy, Calendar, Mail, ShoppingBag,
  Dumbbell, AlertTriangle, Banknote, Users, Shield, Settings, BarChart3, UserPlus, Award, Flame, Zap, Loader2,
} from 'lucide-react';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { getRoundName } from '@/data/cup';
import { LEAGUES } from '@/data/league';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getNetWeeklyIncome } from '@/utils/financeHelpers';
import { checkCelebrations, getWinStreak, getUnbeatenRun, getCleanSheetStreak, getDramaCelebration } from '@/utils/celebrations';
import { STREAK_MORALE_THRESHOLD, OBJECTIVE_STREAK_THRESHOLD } from '@/config/gameBalance';
import { getXPProgress, MANAGER_PERKS, canUnlockPerk, getTotalXP } from '@/utils/managerPerks';
import { SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END } from '@/config/transfers';
import type { Celebration } from '@/utils/celebrations';
import { celebrationToast } from '@/utils/gameToast';
import { CELEBRATION_STAGGER_MS, ADVANCE_DONE_MS } from '@/config/ui';
import { CelebrationModal } from '@/components/game/CelebrationModal';
import { StorylineModal } from '@/components/game/StorylineModal';
import { PlayerTransferTalk } from '@/components/game/PlayerTransferTalk';
import { AchievementUnlockModal } from '@/components/game/AchievementUnlockModal';
import { PageHint } from '@/components/game/PageHint';
import { ACHIEVEMENTS } from '@/utils/achievements';
import type { Achievement } from '@/utils/achievements';
import { FarewellModal } from '@/components/game/FarewellModal';
import { GemRevealModal } from '@/components/game/GemRevealModal';
import { SessionRecap } from '@/components/game/SessionRecap';
import { BoardWarning } from '@/components/game/BoardWarning';
import { getWeekPreview, getFallbackPreview } from '@/utils/weekPreview';
import { hapticMedium, hapticHeavy } from '@/utils/haptics';
import { InfoTip } from '@/components/game/InfoTip';
import { WeeklyDigest } from '@/components/game/WeeklyDigest';
import { FinanceBreakdownSheet, FinanceSheetMode } from '@/components/game/FinanceBreakdownSheet';
import { AnimatedNumber } from '@/components/game/AnimatedNumber';
import { useFlash } from '@/hooks/useFlash';
import { HELP_TEXTS, MID_SEASON_WEEK, CONFIDENCE_CRITICAL_THRESHOLD, CONFIDENCE_LOW_THRESHOLD, FAN_MOOD_HIGH_THRESHOLD, FAN_MOOD_MID_THRESHOLD, HOT_STREAK_MIN_WINS } from '@/config/ui';
import { CONFIDENCE_CHANGE_DISMISS_THRESHOLD } from '@/config/gameBalance';
import { getManagerTips } from '@/utils/managerTips';
import { getActiveRecordChases } from '@/utils/records';
import { getFlag, setFlag } from '@/store/helpers/persistence';
import { MidSeasonReport } from '@/components/game/MidSeasonReport';
import { buildCoachTasks } from '@/utils/gameCoach';

const WELCOME_KEY = 'dynasty-welcome-shown';

const Dashboard = () => {
  // ── Deferred mount guard (React #185 fix) ──
  // On first render after initGame(), many store properties change simultaneously.
  // Rendering the full Dashboard (40+ subscriptions, 15+ memos, 5+ effects) in that
  // same synchronous cycle causes cascading re-renders that exceed React's 50-update limit.
  // By deferring the full render to the SECOND frame, we let the store stabilize first.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Use useShallow to only re-render when specific properties change (prevents React #185)
  const {
    playerClubId, clubs, players, week, season, fixtures, leagueTable,
    boardConfidence, boardObjectives,
    currentMatchResult, incomingOffers, trainingFocus, cup,
    leagueCup, championsCup, shieldCup, virtualClubs, domesticSuperCup, continentalSuperCup,
    weekCliffhangers, lastMatchDrama, objectiveStreak,
    facilities, scouting, divisionTables, playerDivision,
    managerProgression, clubRecords, transferWindowOpen, training,
    weeklyObjectives, shortlist, seasonPhase, totalWeeks,
    gameMode, careerManager, jobOffers,
    pendingPressConference, pendingStoryline, pendingTransferTalk,
    activeChallenge, youthAcademy, fanMood, sessionStats,
    pendingAchievementIds,
  } = useGameStore(useShallow(s => ({
    playerClubId: s.playerClubId, clubs: s.clubs, players: s.players,
    week: s.week, season: s.season, fixtures: s.fixtures, leagueTable: s.leagueTable,
    boardConfidence: s.boardConfidence, boardObjectives: s.boardObjectives,
    currentMatchResult: s.currentMatchResult, incomingOffers: s.incomingOffers,
    trainingFocus: s.trainingFocus, cup: s.cup,
    leagueCup: s.leagueCup, championsCup: s.championsCup,
    shieldCup: s.shieldCup, virtualClubs: s.virtualClubs,
    domesticSuperCup: s.domesticSuperCup, continentalSuperCup: s.continentalSuperCup,
    weekCliffhangers: s.weekCliffhangers, lastMatchDrama: s.lastMatchDrama,
    objectiveStreak: s.objectiveStreak,
    facilities: s.facilities, scouting: s.scouting,
    divisionTables: s.divisionTables, playerDivision: s.playerDivision,
    managerProgression: s.managerProgression, clubRecords: s.clubRecords,
    transferWindowOpen: s.transferWindowOpen, training: s.training,
    weeklyObjectives: s.weeklyObjectives, shortlist: s.shortlist,
    seasonPhase: s.seasonPhase, totalWeeks: s.totalWeeks,
    gameMode: s.gameMode, careerManager: s.careerManager, jobOffers: s.jobOffers,
    pendingPressConference: s.pendingPressConference, pendingStoryline: s.pendingStoryline,
    pendingTransferTalk: s.pendingTransferTalk, activeChallenge: s.activeChallenge,
    youthAcademy: s.youthAcademy, fanMood: s.fanMood, sessionStats: s.sessionStats,
    pendingAchievementIds: s.pendingAchievementIds,
  })));
  // Actions — stable references, individual selectors
  const setScreen = useGameStore(s => s.setScreen);
  const advanceWeek = useGameStore(s => s.advanceWeek);
  const endSeason = useGameStore(s => s.endSeason);
  const selectPlayer = useGameStore(s => s.selectPlayer);
  const club = usePlayerClub();
  const { match: nextMatch, isHome, opponent, competition } = useCurrentMatch();
  const pos = useLeaguePosition();
  const unread = useUnreadCount();
  const budgetFlash = useFlash(club?.budget || 0);

  const [showWelcome, setShowWelcome] = useState(() => {
    if (season === 1 && week === 1 && !getFlag(WELCOME_KEY)) return true;
    return false;
  });

  const dismissWelcome = () => {
    setShowWelcome(false);
    setFlag(WELCOME_KEY);
  };

  const [isAdvancing, setIsAdvancing] = useState(false);
  const [advanceDone, setAdvanceDone] = useState(false);
  const [boardWarningDismissed, setBoardWarningDismissed] = useState(false);
  const [midSeasonShown, setMidSeasonShown] = useState(() => getFlag(`dynasty-midseason-s${season}`));
  const showMidSeason = week === MID_SEASON_WEEK && !midSeasonShown;
  const dismissMidSeason = () => { setMidSeasonShown(true); setFlag(`dynasty-midseason-s${season}`); };
  const [financeSheetOpen, setFinanceSheetOpen] = useState(false);
  const [financeSheetMode, setFinanceSheetMode] = useState<FinanceSheetMode>('all');
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  // Reset board warning dismissal when confidence changes significantly
  const prevConfRef = useRef(boardConfidence);
  useEffect(() => {
    if (Math.abs(prevConfRef.current - boardConfidence) >= CONFIDENCE_CHANGE_DISMISS_THRESHOLD) {
      setBoardWarningDismissed(false);
      prevConfRef.current = boardConfidence;
    }
  }, [boardConfidence]);

  // Celebration toasts & modals: fire when week changes (after advanceWeek)
  const prevWeekRef = useRef(week);
  const shownCelebrationsRef = useRef<Set<string>>(new Set());
  const prevSeasonRef = useRef(season);
  const [majorCelebration, setMajorCelebration] = useState<Celebration | null>(null);
  const [pendingAchievementQueue, setPendingAchievementQueue] = useState<Achievement[]>([]);
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const prevAchievementRef = useRef<string[]>([]);

  // Achievement unlock modal queue — triggers when pendingAchievementIds changes
  // Uses getState() for the action to avoid dependency instability (React #185 fix)
  useEffect(() => {
    if (!pendingAchievementIds || pendingAchievementIds.length === 0) return;
    // Only process if we haven't already queued these
    const key = pendingAchievementIds.join(',');
    if (prevAchievementRef.current.join(',') === key) return;
    prevAchievementRef.current = pendingAchievementIds;

    const achievements = pendingAchievementIds
      .map(id => ACHIEVEMENTS.find(a => a.id === id))
      .filter(Boolean) as Achievement[];
    if (achievements.length > 0) {
      setPendingAchievementQueue(achievements);
      setCurrentAchievement(achievements[0]);
      hapticHeavy();
    }
    // Clear pending from store immediately so remounting the Dashboard
    // (e.g. navigating away and back) won't re-trigger the same popup.
    // Use getState() to avoid including the action in dependency array.
    useGameStore.getState().clearPendingAchievements();
  }, [pendingAchievementIds]);

  const dismissAchievement = () => {
    const remaining = pendingAchievementQueue.slice(1);
    setPendingAchievementQueue(remaining);
    if (remaining.length > 0) {
      setCurrentAchievement(remaining[0]);
    } else {
      setCurrentAchievement(null);
    }
  };

  useEffect(() => {
    if (prevSeasonRef.current !== season) {
      shownCelebrationsRef.current.clear();
      prevSeasonRef.current = season;
    }
  }, [season]);
  useEffect(() => {
    if (!mounted) return; // Skip until deferred mount completes (React #185 fix)
    if (prevWeekRef.current !== week && prevWeekRef.current > 0) {
      // Read current values from store to avoid broad object dependencies (React #185 fix)
      const s = useGameStore.getState();
      const currentClub = s.clubs[s.playerClubId];
      if (!currentClub) { prevWeekRef.current = week; return; }

      const celebrations = checkCelebrations(
        s.playerClubId, s.players, currentClub.playerIds, s.fixtures, s.leagueTable, s.season
      );

      // Add match drama celebrations
      if (s.lastMatchDrama) {
        const dramaCeleb = getDramaCelebration(s.lastMatchDrama);
        if (dramaCeleb) celebrations.push(dramaCeleb);
      }

      const unseen = celebrations.filter(c => {
        // Drama celebrations (type 'record' from getDramaCelebration) are per-week;
        // milestones/streaks are per-season to avoid re-triggering
        const key = c.type === 'record' ? `${c.title}-${s.season}-${week}` : `${c.title}-${s.season}`;
        if (shownCelebrationsRef.current.has(key)) return false;
        shownCelebrationsRef.current.add(key);
        return true;
      });
      // Route major/legendary to modal, minor to toast
      const majorOnes = unseen.filter(c => c.severity === 'major' || c.severity === 'legendary');
      const minorOnes = unseen.filter(c => c.severity === 'minor');
      if (majorOnes.length > 0) {
        setMajorCelebration(majorOnes[0]);
        hapticHeavy();
      }
      if (minorOnes.length > 0) hapticMedium();
      minorOnes.forEach((c, i) => {
        setTimeout(() => celebrationToast(c.title, c.description), i * CELEBRATION_STAGGER_MS);
      });
    }
    prevWeekRef.current = week;
  }, [week]); // Only depend on week — read other values from getState() to avoid cascading re-renders

  // ── Derived data (memoized) — must be above early return to avoid conditional hooks ──

  const lastResults = useMemo(() => fixtures
    .filter(m => m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId))
    .sort((a, b) => b.week - a.week)
    .slice(0, 5), [fixtures, playerClubId]);

  const entry = useMemo(() => leagueTable.find(e => e.clubId === playerClubId), [leagueTable, playerClubId]);

  const avgMorale = useMemo(() => club && club.playerIds.length > 0
    ? Math.round(club.playerIds.reduce((s, id) => s + (players[id]?.morale || 0), 0) / club.playerIds.length) : 0, [club, players]);

  const pendingOffers = incomingOffers.length;

  // Injured players
  const injuredPlayers = useMemo(() => (club?.playerIds || [])
    .map(id => players[id])
    .filter(Boolean)
    .filter(p => p.injured && p.clubId === playerClubId), [club, players, playerClubId]);

  // Expiring contracts (end this season)
  const expiringPlayers = useMemo(() => (club?.playerIds || [])
    .map(id => players[id])
    .filter(Boolean)
    .filter(p => p.contractEnd <= season && !p.injured), [club, players, season]);

  // Net weekly income
  const netWeeklyIncome = useMemo(() => club ? getNetWeeklyIncome(club) : 0, [club]);

  // Streak stats
  const winStreak = useMemo(() => getWinStreak(playerClubId, fixtures), [playerClubId, fixtures]);
  const unbeatenRun = useMemo(() => getUnbeatenRun(playerClubId, fixtures), [playerClubId, fixtures]);
  const cleanSheetStreak = useMemo(() => getCleanSheetStreak(playerClubId, fixtures), [playerClubId, fixtures]);

  // Week preview teasers (with fallback so there's always something forward-looking)
  const weekPreviews = useMemo(() => {
    if (!club) return [];
    const ctx = { playerClubId, players, clubs, fixtures, facilities: facilities, scouting: scouting, week, season, boardObjectives, divisionTables: divisionTables, playerDivision: playerDivision };
    const items = getWeekPreview(ctx);
    if (items.length > 0) return items;
    return getFallbackPreview(ctx);
  }, [playerClubId, players, clubs, fixtures, facilities, scouting, week, season, club, boardObjectives, divisionTables, playerDivision]);

  // XP progress to next level
  const xpProgress = useMemo(() => getXPProgress(managerProgression), [managerProgression]);

  // Next unlockable perk preview
  const nextPerk = useMemo(() => {
    const totalXP = getTotalXP(managerProgression);
    // Find cheapest perk that can be unlocked (has prerequisite met, not yet owned)
    const available = MANAGER_PERKS
      .filter(p => !managerProgression.unlockedPerks.includes(p.id))
      .filter(p => {
        const { canUnlock, reason } = canUnlockPerk(p, managerProgression);
        // Show perks that are either unlockable or only blocked by XP (not by prerequisites)
        return canUnlock || (reason && reason.startsWith('Need'));
      })
      .sort((a, b) => a.cost - b.cost);
    if (available.length === 0) return null;
    const perk = available[0];
    const xpNeeded = Math.max(0, perk.cost - totalXP);
    return { name: perk.name, xpNeeded, icon: perk.icon };
  }, [managerProgression]);

  // Record chase — is a player close to a club record?
  const recordChases = useMemo(() => {
    if (!club) return [];
    const squad = club.playerIds.map(id => players[id]).filter(Boolean);
    return getActiveRecordChases(clubRecords, squad, fixtures, playerClubId);
  }, [club, players, fixtures, playerClubId, clubRecords]);

  // Season race — top 3 teams nearest to player in table
  const seasonRace = useMemo(() => {
    if (!entry || leagueTable.length < 3) return [];
    const playerIdx = leagueTable.indexOf(entry);
    // Show teams within 2 positions above and below, plus the leader if not visible
    const nearby = new Set<number>();
    if (playerIdx > 0) nearby.add(0); // Always show leader
    for (let i = Math.max(0, playerIdx - 2); i <= Math.min(leagueTable.length - 1, playerIdx + 2); i++) {
      nearby.add(i);
    }
    return [...nearby].sort((a, b) => a - b).slice(0, 5).map(i => ({
      clubId: leagueTable[i].clubId,
      shortName: clubs[leagueTable[i].clubId]?.shortName || '?',
      color: clubs[leagueTable[i].clubId]?.color,
      points: leagueTable[i].points,
      position: i + 1,
      isPlayer: leagueTable[i].clubId === playerClubId,
    }));
  }, [leagueTable, entry, clubs, playerClubId]);

  // Fan confidence
  const _fanConfidence = useMemo(() => club ? getFanConfidence(club.fanBase, boardConfidence) : 0, [club, boardConfidence]);

  // Manager tips
  const managerTips = useMemo(() => club ? getManagerTips({
    week, season, club, players, fixtures,
    transferWindowOpen: transferWindowOpen,
    boardConfidence, incomingOffers: incomingOffers.length,
    tacticalFamiliarity: training.tacticalFamiliarity,
  }) : [], [week, season, club, players, fixtures, transferWindowOpen, boardConfidence, incomingOffers.length, training.tacticalFamiliarity]);

  const coachTasks = useMemo(() => {
    if (!club) return [];
    return buildCoachTasks({
      club,
      fixtures,
      playerClubId,
      unreadMessages: unread,
      objectives: weeklyObjectives,
      players,
      transferWindowOpen: transferWindowOpen,
      scoutAssignments: scouting.assignments,
      scoutReportsCount: scouting.reports.length,
      shortlistCount: shortlist.length,
      week,
    });
  }, [club, fixtures, playerClubId, unread, weeklyObjectives, players, transferWindowOpen, scouting.assignments, scouting.reports.length, shortlist.length, week]);
  const completedCoachTasks = coachTasks.filter(task => task.completed).length;

  // Last played match
  const lastMatchInfo = useMemo(() => {
    const lastMatch = fixtures
      .filter(m => m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId))
      .sort((a, b) => b.week - a.week)[0];
    if (!lastMatch) return null;
    const isH = lastMatch.homeClubId === playerClubId;
    const oppId = isH ? lastMatch.awayClubId : lastMatch.homeClubId;
    const oppClub = clubs[oppId];
    const pGoals = isH ? lastMatch.homeGoals : lastMatch.awayGoals;
    const oGoals = isH ? lastMatch.awayGoals : lastMatch.homeGoals;
    const result = pGoals > oGoals ? 'W' : pGoals < oGoals ? 'L' : 'D';
    return { oppName: oppClub?.shortName || '?', score: `${lastMatch.homeGoals}-${lastMatch.awayGoals}`, result };
  }, [fixtures, playerClubId, clubs]);

  // Next 3 unplayed fixtures for player club
  const upcomingFixtures = useMemo(() => fixtures
    .filter(m => !m.played && (m.homeClubId === playerClubId || m.awayClubId === playerClubId) && m.week > week)
    .sort((a, b) => a.week - b.week)
    .slice(0, 3), [fixtures, playerClubId, week]);

  const inPlayoffs = seasonPhase === 'playoffs';

  // Season over check — 46-week season, but only when all player matches done and not in playoffs
  const seasonOver = useMemo(() => {
    const allMatchesPlayed = fixtures
      .filter(m => m.homeClubId === playerClubId || m.awayClubId === playerClubId)
      .every(m => m.played);
    return !inPlayoffs && (week > totalWeeks || (allMatchesPlayed && fixtures.filter(m => m.played).length > 0));
  }, [fixtures, playerClubId, week, inPlayoffs, totalWeeks]);

  // Title race / relegation battle mode — special UI in final 10 weeks
  const raceMode = useMemo(() => {
    if (seasonOver || inPlayoffs) return null;
    const weeksLeft = totalWeeks - week;
    if (weeksLeft > 10 || !entry) return null;
    const playerPos = leagueTable.indexOf(entry) + 1;
    const totalTeams = leagueTable.length;
    // Title contender: top 2 and within 6 points of leader
    if (playerPos <= 2) {
      const leaderPts = leagueTable[0]?.points || 0;
      const gap = leaderPts - (entry.points || 0);
      if (gap <= 6) return 'title' as const;
    }
    // Relegation battle: bottom 3
    if (playerPos >= totalTeams - 2) return 'relegation' as const;
    return null;
  }, [seasonOver, inPlayoffs, totalWeeks, week, entry, leagueTable]);

  // Deferred mount guard — show spinner on first frame to break render cascade (React #185)
  if (!mounted || !club) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }
  const careerReputationTier = careerManager?.reputationTier ?? 'unknown';

  // Training focus label map
  const trainingLabels: Record<string, string> = {
    fitness: 'Fitness',
    attacking: 'Attacking',
    defending: 'Defending',
    mentality: 'Mentality',
  };

  // Quick links
  const quickLinks = [
    { label: 'Schedule', screen: 'calendar' as const, icon: Calendar },
    { label: 'League', screen: 'league-table' as const, icon: Trophy },
    { label: 'Squad', screen: 'squad' as const, icon: Users },
    { label: 'Tactics', screen: 'tactics' as const, icon: Shield },
    { label: 'Training', screen: 'training' as const, icon: Dumbbell },
    { label: 'Club', screen: 'club' as const, icon: Settings },
    { label: 'Transfers', screen: 'transfers' as const, icon: UserPlus },
    { label: 'Cup', screen: 'cup' as const, icon: BarChart3 },
  ];

  return (
    <>
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Welcome overlay for first-time players */}
      {showWelcome && <WelcomeOverlay onComplete={dismissWelcome} />}

      <PageHint
        screen="dashboard"
        title="Your Dashboard"
        body="This is your weekly hub. Check upcoming matches, review finances, track objectives, and advance to the next week. Visit Squad to manage players, Tactics to set formations, and Transfers to buy or sell."
      />

      {/* Mid-Season Report (shown at week 23, once per season) */}
      {showMidSeason && <MidSeasonReport onDismiss={dismissMidSeason} />}

      {/* Weekly Digest (post-advanceWeek summary) */}
      <WeeklyDigest />

      {/* Career Mode Info Panel */}
      {gameMode === 'career' && careerManager && (
        <GlassPanel className="p-3 cursor-pointer" onClick={() => setScreen(jobOffers.length > 0 ? 'job-market' : 'career-overview')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Award className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{careerManager.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  Age {careerManager.age} — {careerReputationTier.replace('_', ' ')}
                </p>
              </div>
            </div>
            <div className="text-right">
              {careerManager.contract ? (
                <p className="text-[10px] text-muted-foreground">
                  Contract ends S{careerManager.contract.endSeason}
                </p>
              ) : (
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                  Unemployed
                </span>
              )}
            </div>
          </div>
          {jobOffers.length > 0 && (
            <div className="mt-2 bg-primary/10 rounded-lg px-3 py-1.5">
              <p className="text-[10px] text-primary font-semibold">
                {jobOffers.length} job offer{jobOffers.length > 1 ? 's' : ''} waiting
              </p>
            </div>
          )}
        </GlassPanel>
      )}

      {/* Press Conference (shown after matches) */}
      {pendingPressConference && <PressConference />}

      {/* Storyline Event (shown when triggered) */}
      {pendingStoryline && <StorylineModal />}

      {/* Transfer Talk (shown when player requests transfer) */}
      {pendingTransferTalk && <PlayerTransferTalk />}

      {/* Farewell Modal (shown when a long-serving player departs) */}
      <FarewellModal />

      {/* Hidden Gem Scouting Reveal */}
      <GemRevealModal />

      {/* Session Start Recap — "Welcome back" overlay */}
      <SessionRecap />

      {/* Board Warning (low confidence) */}
      {!boardWarningDismissed && boardConfidence <= CONFIDENCE_CRITICAL_THRESHOLD && (
        <BoardWarning confidence={boardConfidence} onDismiss={() => setBoardWarningDismissed(true)} />
      )}

      {/* Major Celebration Modal */}
      <CelebrationModal
        open={!!majorCelebration}
        onClose={() => setMajorCelebration(null)}
        title={majorCelebration?.title || ''}
        description={majorCelebration?.description || ''}
        icon={majorCelebration?.icon}
      />

      {/* Achievement Unlock Modal */}
      <AchievementUnlockModal
        open={!!currentAchievement}
        onClose={dismissAchievement}
        achievement={currentAchievement}
      />

      {/* Title Race / Relegation Battle Banner */}
      {raceMode && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'rounded-xl px-3 py-2 flex items-center justify-between border',
            raceMode === 'title'
              ? 'bg-primary/10 border-primary/40 shadow-[0_0_12px_hsl(43_96%_46%/0.15)]'
              : 'bg-destructive/10 border-destructive/40 shadow-[0_0_12px_hsl(0_84%_60%/0.15)]'
          )}
        >
          <div className="flex items-center gap-2">
            {raceMode === 'title' ? (
              <Trophy className="w-4 h-4 text-primary" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-destructive" />
            )}
            <span className={cn(
              'text-xs font-black uppercase tracking-wider',
              raceMode === 'title' ? 'text-primary' : 'text-destructive'
            )}>
              {raceMode === 'title' ? 'Title Race' : 'Relegation Battle'}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {totalWeeks - week} weeks left
          </span>
        </motion.div>
      )}

      {/* Active Challenge Banner */}
      {activeChallenge && !activeChallenge.completed && !activeChallenge.failed && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-primary">Challenge Active</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{activeChallenge.seasonsRemaining} season(s) left</span>
        </div>
      )}

      {/* Transfer Window Countdown / Deadline Day */}
      {(week === SUMMER_WINDOW_END || week === WINTER_WINDOW_END) ? (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-xs font-bold text-destructive uppercase tracking-wide">Deadline Day!</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Transfer window closes today</span>
        </div>
      ) : transferWindowOpen && (() => {
        const windowEnd = week <= SUMMER_WINDOW_END ? SUMMER_WINDOW_END : WINTER_WINDOW_END;
        const weeksLeft = windowEnd - week;
        const windowName = week <= SUMMER_WINDOW_END ? 'Summer' : 'Winter';
        const isUrgent = weeksLeft <= 2;
        return (
          <div className={cn(
            'rounded-xl px-3 py-2 flex items-center justify-between',
            isUrgent ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-primary/5 border border-primary/20'
          )} onClick={() => setScreen('transfers')}>
            <div className="flex items-center gap-2">
              <ShoppingBag className={cn('w-4 h-4', isUrgent ? 'text-amber-400' : 'text-primary')} />
              <span className={cn('text-xs font-semibold', isUrgent ? 'text-amber-400' : 'text-primary')}>
                {windowName} Transfer Window
              </span>
            </div>
            <span className={cn('text-[10px] font-medium', isUrgent ? 'text-amber-400' : 'text-muted-foreground')}>
              {weeksLeft} week{weeksLeft !== 1 ? 's' : ''} remaining
            </span>
          </div>
        );
      })()}
      {activeChallenge?.completed && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 text-center">
          <span className="text-xs font-bold text-emerald-400">Challenge Complete!</span>
        </div>
      )}
      {activeChallenge?.failed && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 text-center">
          <span className="text-xs font-bold text-destructive">Challenge Failed</span>
        </div>
      )}

      {/* Season End */}
      {seasonOver && (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <GlassPanel className="p-5 border-primary/40 text-center">
            <Trophy className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-lg font-black text-foreground font-display">Season {season} Complete!</p>
            <p className="text-sm text-muted-foreground mb-3">Final Position: {pos}{getSuffix(pos)}</p>
            <Button className="w-full gap-2" onClick={() => { hapticHeavy(); endSeason(); }}>
              View Season Summary
            </Button>
          </GlassPanel>
        </motion.div>
      )}

      {/* Playoff Banner */}
      {inPlayoffs && (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Promotion Playoffs</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Week {week} / Season {season}</span>
          </div>
        </motion.div>
      )}

      {/* Last Match Result */}
      {lastMatchInfo && !seasonOver && (
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
        <GlassPanel className="p-3 flex items-center justify-between" onClick={() => setScreen('match-review')} aria-label="View match review">
          <div className="flex items-center gap-2">
            <span className={cn(
              'w-6 h-6 rounded-md flex items-center justify-center text-xs font-black',
              lastMatchInfo.result === 'W' ? 'bg-emerald-500/20 text-emerald-400' :
              lastMatchInfo.result === 'L' ? 'bg-destructive/20 text-destructive' :
              'bg-amber-500/20 text-amber-400'
            )}>{lastMatchInfo.result}</span>
            <div>
              <p className="text-xs font-semibold text-foreground">Last Result: {lastMatchInfo.score} vs {lastMatchInfo.oppName}</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </GlassPanel>
        </motion.div>
      )}

      {/* Next Match */}
      {!seasonOver && nextMatch && opponent ? (
        <GlassPanel className="p-5" onClick={() => setScreen('match-prep')}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">{competition || (inPlayoffs ? 'Playoff Match' : 'Match Day')} — Week {week}</p>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div
                className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-xs"
                style={{ backgroundColor: club.color, color: club.secondaryColor }}
              >
                {club.shortName}
              </div>
              <p className="text-sm font-bold text-foreground">{club.shortName}</p>
              <p className="text-[10px] text-muted-foreground">{isHome ? 'HOME' : 'AWAY'}</p>
            </div>
            <div className="px-4">
              <p className="text-2xl font-black text-muted-foreground">VS</p>
            </div>
            <div className="text-center flex-1">
              <div
                className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-xs"
                style={{ backgroundColor: opponent.color, color: opponent.secondaryColor }}
              >
                {opponent.shortName}
              </div>
              <p className="text-sm font-bold text-foreground">{opponent.shortName}</p>
              <p className="text-[10px] text-muted-foreground">{isHome ? 'AWAY' : 'HOME'}</p>
            </div>
          </div>
          <Button
            className="w-full mt-4 gap-2"
            onClick={(e) => { e.stopPropagation(); setScreen('match-prep'); }}
          >
            <Play className="w-4 h-4" /> Match Prep
          </Button>
        </GlassPanel>
      ) : !seasonOver && (
        <GlassPanel className="p-5 space-y-3">
          <p className="text-sm text-muted-foreground text-center">No match this week</p>
          {/* Activity suggestions */}
          <div className="flex flex-wrap gap-2 justify-center">
            {transferWindowOpen && (
              <button onClick={() => setScreen('transfers')} className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-full px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                <UserPlus className="w-3 h-3" /> Scout Transfers
              </button>
            )}
            <button onClick={() => setScreen('training')} className="inline-flex items-center gap-1 bg-muted/30 border border-border/50 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
              <Dumbbell className="w-3 h-3" /> Training
            </button>
            {youthAcademy.prospects.some(p => p.readyToPromote) && (
              <button onClick={() => setScreen('youth-academy')} className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                <Users className="w-3 h-3" /> Youth Ready
              </button>
            )}
            {scouting.reports.length > 0 && (
              <button onClick={() => setScreen('scouting')} className="inline-flex items-center gap-1 bg-muted/30 border border-border/50 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                <BarChart3 className="w-3 h-3" /> Scout Reports
              </button>
            )}
          </div>
          <Button className={cn(
            "w-full gap-2 active:scale-[0.97] transition-all",
            isAdvancing && "animate-pulse shadow-[0_0_12px_hsl(43_96%_46%/0.3)]",
            advanceDone && "scale-[1.03] shadow-[0_0_16px_hsl(43_96%_46%/0.4)]"
          )} disabled={isAdvancing} onClick={() => {
            hapticMedium();
            setIsAdvancing(true);
            setTimeout(() => {
              advanceWeek();
              setIsAdvancing(false);
              setAdvanceDone(true);
              hapticHeavy();
              setTimeout(() => setAdvanceDone(false), ADVANCE_DONE_MS);
            }, 50);
          }}>
            {isAdvancing ? <><Loader2 className="w-4 h-4 animate-spin" /> Advancing...</> : <><ChevronRight className="w-4 h-4" /> Advance to Week {week + 1}</>}
          </Button>
        </GlassPanel>
      )}

      {/* Quick Links - Horizontal scrollable row */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-3 w-max pb-1">
          {quickLinks.map((link, i) => {
            const Icon = link.icon;
            return (
              <motion.div
                key={link.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
              >
                <GlassPanel
                  className="px-4 py-3 flex flex-col items-center gap-1.5 min-w-[80px]"
                  onClick={() => setScreen(link.screen)}
                >
                  <Icon className="w-5 h-5 text-primary" />
                  <span className="text-[11px] font-medium text-foreground whitespace-nowrap">{link.label}</span>
                </GlassPanel>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Training Status Chip + Streaks */}
      {!seasonOver && !inPlayoffs && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
              <Dumbbell className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">
                Training: {trainingLabels[trainingFocus] || trainingFocus}
              </span>
              <span className="text-[10px] text-primary/60">|</span>
              <span className="text-[10px] font-medium text-primary/70">Fam {training.tacticalFamiliarity}%</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Wk {week} / S{season} · {week <= SUMMER_WINDOW_END ? 'Pre-Season' : week < WINTER_WINDOW_START ? 'Autumn' : week <= WINTER_WINDOW_END ? 'Winter' : week <= 38 ? 'Spring' : 'Run-In'}
            </span>
          </div>

          {/* Active Streaks */}
          {(winStreak >= STREAK_MORALE_THRESHOLD || unbeatenRun >= 5 || cleanSheetStreak >= 2 || objectiveStreak >= 2) && (
            <div className="flex items-center gap-2 flex-wrap">
              {winStreak >= STREAK_MORALE_THRESHOLD && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 rounded-full px-3 py-1.5"
                >
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-bold text-orange-400">{winStreak} Wins</span>
                </motion.div>
              )}
              {unbeatenRun >= 5 && unbeatenRun > winStreak && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.05 }}
                  className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1.5"
                >
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400">{unbeatenRun} Unbeaten</span>
                </motion.div>
              )}
              {cleanSheetStreak >= 2 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/30 rounded-full px-3 py-1.5"
                >
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-xs font-bold text-sky-400">{cleanSheetStreak} Clean Sheets</span>
                </motion.div>
              )}
              {objectiveStreak >= 2 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1.5"
                >
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400">x{objectiveStreak} Obj. Streak</span>
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Manager Tips */}
      {!seasonOver && managerTips.length > 0 && (
        <GlassPanel className="p-4 border-primary/20">
          <p className="text-[10px] text-primary uppercase tracking-wider font-semibold mb-2">Manager Tips</p>
          <div className="space-y-2">
            {managerTips.map((tip, i) => (
              <motion.div
                key={tip.text}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors',
                  tip.action ? 'cursor-pointer hover:bg-primary/5' : '',
                  'bg-muted/20'
                )}
                onClick={() => tip.action && setScreen(tip.action)}
              >
                <DynamicIcon name={tip.icon} className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs text-foreground flex-1">{tip.text}</span>
                {tip.action && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              </motion.div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Guided checklist for new careers */}
      {!seasonOver && season <= 2 && coachTasks.length > 0 && (
        <GlassPanel className="p-4 border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-primary uppercase tracking-wider font-semibold">Coach Checklist</p>
            <span className="text-[10px] text-muted-foreground">{completedCoachTasks}/{coachTasks.length} done</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden mb-3">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${Math.round((completedCoachTasks / coachTasks.length) * 100)}%` }}
            />
          </div>
          <div className="space-y-2">
            {coachTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                disabled={!task.screen}
                onClick={() => task.screen && setScreen(task.screen)}
                className={cn(
                  'w-full text-left rounded-lg px-3 py-2 border transition-colors',
                  task.completed
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-muted/20 border-border/40 hover:bg-primary/5'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('text-xs font-semibold', task.completed ? 'text-emerald-400' : 'text-foreground')}>{task.title}</p>
                  <span className={cn(
                    'text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded',
                    task.priority === 'high' ? 'bg-destructive/15 text-destructive' : task.priority === 'medium' ? 'bg-amber-500/15 text-amber-400' : 'bg-muted text-muted-foreground'
                  )}>
                    {task.priority}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{task.description}</p>
              </button>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Weekly Objectives */}
      {!seasonOver && weeklyObjectives.length > 0 && (
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">Weekly Objectives</p>
              {objectiveStreak >= OBJECTIVE_STREAK_THRESHOLD && (
                <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full">
                  2x XP
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-primary font-semibold">
                {weeklyObjectives.filter(o => o.completed).length}/{weeklyObjectives.length}
              </span>
              {objectiveStreak > 0 && (
                <span className="text-[10px] text-amber-400 font-bold">
                  Streak: {objectiveStreak}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {weeklyObjectives.map((obj) => (
              <div
                key={obj.objectiveId}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 transition-colors',
                  obj.completed ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-muted/30 border border-border/30'
                )}
              >
                <DynamicIcon name={obj.icon} className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn('text-xs font-semibold truncate', obj.completed ? 'text-emerald-400 line-through' : 'text-foreground')}>{obj.title}</p>
                    {obj.rarity === 'rare' && (
                      <span className="text-[8px] font-bold text-blue-400 bg-blue-500/15 px-1 py-0.5 rounded shrink-0">RARE</span>
                    )}
                    {obj.rarity === 'legendary' && (
                      <span className="text-[8px] font-bold text-primary bg-primary/15 px-1 py-0.5 rounded shrink-0 animate-pulse">LEGENDARY</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{obj.description}</p>
                </div>
                <span className={cn('text-[10px] font-bold shrink-0', obj.completed ? 'text-emerald-400' : 'text-primary')}>
                  {obj.completed ? '✓' : `+${obj.xpReward} XP`}
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* XP Progress + Season Race — engagement widgets */}
      {!seasonOver && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.2 }}
          className="grid grid-cols-2 gap-3"
        >
          {/* XP Progress Widget */}
          <GlassPanel className="p-4" onClick={() => setScreen('perks')}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Manager Level</span>
            </div>
            <p className="text-2xl font-black text-primary tabular-nums">
              {managerProgression.level}
            </p>
            <div className="mt-1.5">
              <div className="flex items-center justify-between text-[9px] mb-0.5">
                <span className="text-muted-foreground">Next level</span>
                <span className="text-primary font-semibold tabular-nums">{xpProgress.current}/{xpProgress.needed}</span>
              </div>
              <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress.percentage}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
            {nextPerk && (
              <p className="text-[9px] text-muted-foreground mt-1.5 truncate">
                Next: <span className="text-primary font-semibold">{nextPerk.name}</span>
                {nextPerk.xpNeeded > 0 && <span> ({nextPerk.xpNeeded} XP)</span>}
                {nextPerk.xpNeeded === 0 && <span className="text-emerald-400"> Ready!</span>}
              </p>
            )}
          </GlassPanel>

          {/* Season Race Mini Widget */}
          <GlassPanel className="p-4" onClick={() => setScreen('league-table')}>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Season Race</span>
            </div>
            <div className="space-y-1">
              {seasonRace.slice(0, 4).map((team) => (
                <div key={team.clubId} className={cn(
                  'flex items-center justify-between text-[10px] rounded px-1 py-0.5',
                  team.isPlayer ? 'bg-primary/10 font-bold text-primary' : 'text-muted-foreground'
                )}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 text-right tabular-nums">{team.position}</span>
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: team.color }}
                    />
                    <span className="truncate max-w-[60px]">{team.shortName}</span>
                  </div>
                  <span className="font-semibold tabular-nums">{team.points}pts</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      )}

      {/* Week Preview Teasers */}
      {!seasonOver && weekPreviews.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.2 }}>
        <GlassPanel className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Coming Up</p>
          <div className="space-y-2">
            {weekPreviews.map((preview, i) => (
              <div
                key={`${preview.type}-${i}`}
                className={cn(
                  'flex items-center gap-2 text-xs rounded-lg px-3 py-2',
                  preview.type === 'positive' ? 'bg-emerald-500/10 text-emerald-400' :
                  preview.type === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-muted/30 text-muted-foreground'
                )}
              >
                <DynamicIcon name={preview.icon} className="w-4 h-4 shrink-0" />
                <span className="font-medium">{preview.text}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
        </motion.div>
      )}

      {/* Cliffhangers — "one more week" hooks */}
      {!seasonOver && weekCliffhangers && weekCliffhangers.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <GlassPanel className="p-4 border-primary/20">
            <p className="text-[10px] text-primary uppercase tracking-wider font-semibold mb-2">What Happens Next...</p>
            <div className="space-y-2">
              {weekCliffhangers.map((hook, i) => (
                <div
                  key={`${hook.intensity}-${i}`}
                  className={cn(
                    'flex items-center gap-2 text-xs rounded-lg px-3 py-2',
                    hook.intensity === 'high' ? 'bg-red-500/10 text-red-400 animate-pulse' :
                    hook.intensity === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-muted/30 text-muted-foreground'
                  )}
                >
                  <DynamicIcon name={hook.icon} className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{hook.text}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      )}

      {/* Objective streak XP multiplier notification */}
      {objectiveStreak >= 2 && (
        <GlassPanel className={cn('p-3', objectiveStreak >= OBJECTIVE_STREAK_THRESHOLD ? 'border-amber-500/30 bg-amber-500/5' : 'border-primary/20 bg-primary/5')}>
          <div className="flex items-center gap-2 text-xs">
            <Flame className={cn('w-4 h-4', objectiveStreak >= OBJECTIVE_STREAK_THRESHOLD ? 'text-amber-400' : 'text-primary')} />
            <span className={cn('font-bold', objectiveStreak >= OBJECTIVE_STREAK_THRESHOLD ? 'text-amber-400' : 'text-primary')}>
              {objectiveStreak >= OBJECTIVE_STREAK_THRESHOLD
                ? `Streak x${objectiveStreak} — 2x XP Multiplier Active!`
                : `${objectiveStreak}-week objective streak! ${OBJECTIVE_STREAK_THRESHOLD - objectiveStreak} more for 2x XP.`}
            </span>
          </div>
        </GlassPanel>
      )}

      {/* Record Chase — player approaching a club record */}
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

      {/* Last match result */}
      {currentMatchResult && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <GlassPanel className="p-4 border-primary/30" onClick={() => setScreen('match-review')}>
            <p className="text-[10px] text-primary uppercase tracking-wider mb-1">Last Result</p>
            <p className="text-lg font-black text-foreground tabular-nums">
              {clubs[currentMatchResult.homeClubId]?.shortName} {currentMatchResult.homeGoals} - {currentMatchResult.awayGoals} {clubs[currentMatchResult.awayClubId]?.shortName}
            </p>
          </GlassPanel>
        </motion.div>
      )}

      {/* Alerts Row */}
      {(unread > 0 || pendingOffers > 0) && (
        <div className="flex gap-3">
          {unread > 0 && (
            <GlassPanel className="flex-1 p-3 flex items-center gap-2" onClick={() => setScreen('inbox')}>
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground font-medium">{unread} unread</span>
            </GlassPanel>
          )}
          {pendingOffers > 0 && (
            <GlassPanel className="flex-1 p-3 flex items-center gap-2" onClick={() => setScreen('transfers')}>
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground font-medium">{pendingOffers} offer{pendingOffers > 1 ? 's' : ''}</span>
            </GlassPanel>
          )}
        </div>
      )}

      {/* Injury Alert Panel */}
      {injuredPlayers.length > 0 && (
        <GlassPanel className="p-4 border-destructive/30" onClick={() => setScreen('squad')}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <p className="text-xs text-destructive uppercase tracking-wider font-semibold">
              Injuries ({injuredPlayers.length})
            </p>
          </div>
          <div className="space-y-1.5">
            {injuredPlayers.map(p => (
              <div key={p.id} role="button" tabIndex={0} className="flex items-center justify-between cursor-pointer hover:bg-white/5 rounded px-1 -mx-1 py-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); selectPlayer(p.id); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); selectPlayer(p.id); } }}>
                <span className="text-sm text-foreground">
                  {p.firstName[0]}. {p.lastName}
                  <span className="text-xs text-muted-foreground ml-1.5">({p.position})</span>
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full bg-destructive" style={{ width: `${Math.max(10, 100 - (p.injuryWeeks / 5) * 100)}%` }} />
                  </div>
                  <span className="text-xs text-destructive font-medium tabular-nums">
                    {p.injuryWeeks} wk{p.injuryWeeks !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Contract Expiry Warning */}
      {expiringPlayers.length > 0 && (
        <GlassPanel className="p-4 border-amber-500/30" onClick={() => setScreen('squad')}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-amber-400 uppercase tracking-wider font-semibold">
              Expiring Contracts ({expiringPlayers.length})
            </p>
          </div>
          <div className="space-y-1.5">
            {expiringPlayers.slice(0, 3).map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-sm text-foreground">
                  {p.firstName[0]}. {p.lastName}
                  <span className="text-xs text-muted-foreground ml-1.5">({p.position})</span>
                </span>
                <span className="text-xs text-amber-400 font-medium">End of season</span>
              </div>
            ))}
            {expiringPlayers.length > 3 && (
              <p className="text-xs text-muted-foreground">+{expiringPlayers.length - 3} more</p>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Tap to view squad and renew contracts</p>
        </GlassPanel>
      )}

      {/* Transfer Alerts Card */}
      {pendingOffers > 0 && (
        <GlassPanel className="p-4 border-primary/20" onClick={() => setScreen('transfers')}>
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Incoming Offers</span>
          </div>
          <p className="text-2xl font-black text-foreground mt-1 tabular-nums">
            {pendingOffers}
            <span className="text-sm text-muted-foreground font-normal ml-1">
              pending offer{pendingOffers !== 1 ? 's' : ''}
            </span>
          </p>
        </GlassPanel>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <GlassPanel className="p-4" onClick={() => setScreen('league-table')}>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">League Pos</span>
          </div>
          <p className="text-2xl font-black text-foreground tabular-nums">
            {pos}<span className="text-sm text-muted-foreground">/{leagueTable.length}</span>
          </p>
          <p className="text-[10px] text-muted-foreground truncate">{LEAGUES.find(d => d.id === playerDivision)?.shortName || ''} {'\u2022'} {entry?.points || 0} pts</p>
        </GlassPanel>

        <GlassPanel className="p-4 cursor-pointer" onClick={() => { setFinanceSheetMode('budget'); setFinanceSheetOpen(true); }}>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Budget</span>
            <InfoTip text={HELP_TEXTS.budget} />
          </div>
          <p className={cn("text-2xl font-black text-foreground tabular-nums", budgetFlash)}>
            £<AnimatedNumber value={club.budget / 1e6} formatFn={(n) => n.toFixed(1)} /><span className="text-sm">M</span>
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            Wage: £{(club.wageBill / 1e3).toFixed(0)}K/w
          </p>
        </GlassPanel>

        <GlassPanel className="p-4" onClick={() => setScreen('squad')}>
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Morale</span>
            <InfoTip text={HELP_TEXTS.morale} />
          </div>
          <p className={cn(
            'text-2xl font-black tabular-nums',
            avgMorale > 70 ? 'text-emerald-400' : avgMorale > 40 ? 'text-amber-400' : 'text-destructive'
          )}>
            {avgMorale}%
          </p>
          <p className="text-[10px] text-muted-foreground">
            {avgMorale > 70 ? 'Excellent' : avgMorale > 40 ? 'Decent' : 'Low — affects performance'}
          </p>
        </GlassPanel>

        <GlassPanel className={cn("p-4 cursor-pointer", boardConfidence <= CONFIDENCE_CRITICAL_THRESHOLD && "border-destructive/50 animate-pulse")} onClick={() => setScreen('board')}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Board</span>
            <InfoTip text={HELP_TEXTS.boardConfidence} />
          </div>
          <p className={cn(
            'text-2xl font-black tabular-nums',
            getConfidenceColor(boardConfidence).textClass
          )}>
            {boardConfidence}%
          </p>
          <div className="w-full h-1.5 rounded-full bg-muted/40 mt-1.5 overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                boardConfidence > 50 ? "bg-emerald-500" : boardConfidence > 25 ? "bg-amber-500" : "bg-destructive"
              )}
              animate={{ width: `${boardConfidence}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {boardConfidence > 70 ? 'Secure' : boardConfidence > 40 ? 'Under pressure' : 'Sacking risk!'}
          </p>
          {boardConfidence <= CONFIDENCE_LOW_THRESHOLD && boardConfidence > 25 && (
            <p className="text-[9px] text-destructive/80 mt-0.5">
              ~{Math.max(1, Math.ceil((boardConfidence - 25) / 4))} more loss{Math.ceil((boardConfidence - 25) / 4) !== 1 ? 'es' : ''} could mean the sack
            </p>
          )}
        </GlassPanel>
      </div>

      {/* Finance Snapshot + Fan Confidence Row */}
      <div className="grid grid-cols-2 gap-3">
        <GlassPanel className="p-4 cursor-pointer" onClick={() => { setFinanceSheetMode('all'); setFinanceSheetOpen(true); }}>
          <div className="flex items-center gap-2 mb-1">
            <Banknote className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Net Income</span>
          </div>
          <p className={cn(
            'text-xl font-black tabular-nums',
            netWeeklyIncome >= 0 ? 'text-emerald-400' : 'text-destructive'
          )}>
            {netWeeklyIncome >= 0 ? '+' : ''}£{(Math.abs(netWeeklyIncome) / 1e3).toFixed(0)}K
          </p>
          <p className="text-[10px] text-muted-foreground">per week</p>
        </GlassPanel>

        <GlassPanel className="p-4" onClick={() => setScreen('club')}>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Fan Mood</span>
            <InfoTip text={HELP_TEXTS.fanMood} />
          </div>
          <p className={cn(
            'text-xl font-black tabular-nums',
            getFanConfidenceColor(fanMood)
          )}>
            {fanMood}%
          </p>
          <p className="text-[10px] text-muted-foreground">
            {fanMood >= FAN_MOOD_HIGH_THRESHOLD ? 'Buzzing' : fanMood >= FAN_MOOD_MID_THRESHOLD ? 'Content' : 'Restless'}
          </p>
        </GlassPanel>
      </div>

      {/* Show More / Less toggle for secondary details */}
      <button
        type="button"
        onClick={() => setShowMoreDetails(prev => !prev)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showMoreDetails && 'rotate-180')} />
        {showMoreDetails ? 'Show Less' : 'Show More Details'}
      </button>

      {showMoreDetails && <>
      {/* Recent Form with Momentum */}
      {lastResults.length > 0 && (() => {
        const recent = lastResults.slice(0, 5).map(m => {
          const isH = m.homeClubId === playerClubId;
          return (isH ? m.homeGoals > m.awayGoals : m.awayGoals > m.homeGoals) ? 'W' : (isH ? m.homeGoals < m.awayGoals : m.awayGoals < m.homeGoals) ? 'L' : 'D';
        });
        const recentWins = recent.filter(r => r === 'W').length;
        const recentLosses = recent.filter(r => r === 'L').length;
        const momentum = recentWins >= 3 ? 'hot' : recentLosses >= 3 ? 'cold' : 'stable';
        // Form guide narrative — compute best win streak this season for context
        const allForm = entry?.form || [];
        let bestStreak = 0;
        let currentStreak = 0;
        for (const r of allForm) {
          if (r === 'W') { currentStreak++; bestStreak = Math.max(bestStreak, currentStreak); } else { currentStreak = 0; }
        }
        const formNarrative = winStreak >= 5 && winStreak >= bestStreak
          ? `Your best run this season — ${winStreak} wins in a row!`
          : winStreak >= 3 && bestStreak > winStreak
          ? `${winStreak} wins in a row (season best: ${bestStreak})`
          : unbeatenRun >= 8
          ? `${unbeatenRun} matches unbeaten — an incredible run`
          : recentLosses >= 4
          ? 'Time to turn things around — fans are worried'
          : allForm.length >= 10 && recentWins >= HOT_STREAK_MIN_WINS
          ? `Strong form — ${recentWins} wins in last 5`
          : null;
        return (
          <GlassPanel className={cn('p-4', momentum === 'hot' ? 'border-emerald-500/20' : momentum === 'cold' ? 'border-destructive/20' : '')} onClick={() => setScreen('league-table')}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Recent Form</p>
              {momentum !== 'stable' && (
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', momentum === 'hot' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-destructive/15 text-destructive')}>
                  {momentum === 'hot' ? 'HOT STREAK' : 'POOR RUN'}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {lastResults.map((m) => {
                const isH = m.homeClubId === playerClubId;
                const won = isH ? m.homeGoals > m.awayGoals : m.awayGoals > m.homeGoals;
                const lost = isH ? m.homeGoals < m.awayGoals : m.awayGoals < m.homeGoals;
                return (
                  <div key={m.id} className={cn(
                    'w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold',
                    won ? 'bg-emerald-500/20 text-emerald-400' : lost ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
                  )}>
                    {won ? 'W' : lost ? 'L' : 'D'}
                  </div>
                );
              })}
            </div>
            {formNarrative && (
              <p className={cn(
                'text-[10px] mt-2 font-medium',
                momentum === 'hot' ? 'text-emerald-400' : momentum === 'cold' ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {formNarrative}
              </p>
            )}
          </GlassPanel>
        );
      })()}

      {/* Next 3 Fixtures */}
      {upcomingFixtures.length > 0 && (
        <GlassPanel className="p-4" onClick={() => setScreen('calendar')}>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Upcoming Fixtures</p>
          <div className="space-y-2">
            {upcomingFixtures.map((fix) => {
              const fixIsHome = fix.homeClubId === playerClubId;
              const oppClub = clubs[fixIsHome ? fix.awayClubId : fix.homeClubId];
              return (
                <div key={fix.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                      style={{ backgroundColor: oppClub?.color, color: oppClub?.secondaryColor }}
                    >
                      {oppClub?.shortName?.slice(0, 2)}
                    </div>
                    <span className="text-sm text-foreground font-medium">{oppClub?.shortName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                      fixIsHome ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'
                    )}>
                      {fixIsHome ? 'H' : 'A'}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">Wk {fix.week}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Cup Status */}
      {cup.currentRound && (
        <GlassPanel className="p-4" onClick={() => setScreen('cup')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award className={cn('w-5 h-5', cup.winner === playerClubId ? 'text-primary' : cup.eliminated ? 'text-destructive' : 'text-muted-foreground')} />
              <div>
                <p className="text-sm font-semibold text-foreground">Domestic Cup</p>
                <p className="text-xs text-muted-foreground">
                  {cup.winner ? `Winner: ${clubs[cup.winner]?.shortName}` : cup.eliminated ? 'Eliminated' : getRoundName(cup.currentRound)}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </GlassPanel>
      )}

      {/* League Cup Status */}
      {leagueCup && leagueCup.currentRound && (
        <GlassPanel className="p-4" onClick={() => setScreen('league-cup')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award className={cn('w-5 h-5', leagueCup.winner === playerClubId ? 'text-emerald-400' : leagueCup.eliminated ? 'text-destructive' : 'text-muted-foreground')} />
              <div>
                <p className="text-sm font-semibold text-foreground">League Cup</p>
                <p className="text-xs text-muted-foreground">
                  {leagueCup.winner ? `Winner: ${clubs[leagueCup.winner]?.shortName}` : leagueCup.eliminated ? 'Eliminated' : getRoundName(leagueCup.currentRound)}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </GlassPanel>
      )}

      {/* Champions Cup Status */}
      {championsCup && (
        <GlassPanel className="p-4" onClick={() => setScreen('champions-cup')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className={cn('w-5 h-5', championsCup.winnerId === playerClubId ? 'text-primary' : championsCup.playerEliminated ? 'text-destructive' : 'text-primary/70')} />
              <div>
                <p className="text-sm font-semibold text-foreground">Champions Cup</p>
                <p className="text-xs text-muted-foreground">
                  {championsCup.winnerId
                    ? `Winner: ${(clubs[championsCup.winnerId] || virtualClubs[championsCup.winnerId])?.shortName || '?'}`
                    : championsCup.playerEliminated ? 'Eliminated'
                    : championsCup.currentPhase === 'group' ? 'Group Stage'
                    : championsCup.currentRound || 'Knockout'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </GlassPanel>
      )}

      {/* Shield Cup Status */}
      {shieldCup && (
        <GlassPanel className="p-4" onClick={() => setScreen('shield-cup')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className={cn('w-5 h-5', shieldCup.winnerId === playerClubId ? 'text-accent' : shieldCup.playerEliminated ? 'text-destructive' : 'text-accent/70')} />
              <div>
                <p className="text-sm font-semibold text-foreground">Shield Cup</p>
                <p className="text-xs text-muted-foreground">
                  {shieldCup.winnerId
                    ? `Winner: ${(clubs[shieldCup.winnerId] || virtualClubs[shieldCup.winnerId])?.shortName || '?'}`
                    : shieldCup.playerEliminated ? 'Eliminated'
                    : shieldCup.currentPhase === 'group' ? 'Group Stage'
                    : shieldCup.currentRound || 'Knockout'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </GlassPanel>
      )}

      {/* Super Cup Status */}
      {(domesticSuperCup || continentalSuperCup) && (
        <GlassPanel className="p-4" onClick={() => setScreen('super-cup')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className={cn('w-5 h-5', (domesticSuperCup?.winnerId === playerClubId || continentalSuperCup?.winnerId === playerClubId) ? 'text-amber-400' : 'text-muted-foreground')} />
              <div>
                <p className="text-sm font-semibold text-foreground">Super Cup</p>
                <p className="text-xs text-muted-foreground">
                  {domesticSuperCup?.winnerId
                    ? `Winner: ${clubs[domesticSuperCup.winnerId]?.shortName || '?'}`
                    : domesticSuperCup?.played === false ? `Week ${domesticSuperCup.week}`
                    : 'View matches'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </GlassPanel>
      )}

      {/* Board Objectives */}
      <GlassPanel className="p-4" onClick={() => setScreen('board')}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Board Objectives</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {boardObjectives.filter(o => o.completed).length}/{boardObjectives.length} completed
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${boardObjectives.length > 0 ? (boardObjectives.filter(o => o.completed).length / boardObjectives.length) * 100 : 0}%` }}
          />
        </div>
        <div className="space-y-2">
          {boardObjectives.map(obj => (
            <div key={obj.id} className="flex items-center gap-2">
              <div className={cn(
                'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                obj.completed
                  ? 'bg-emerald-500 border-emerald-500'
                  : obj.priority === 'critical' ? 'border-destructive' : obj.priority === 'important' ? 'border-primary' : 'border-muted-foreground'
              )}>
                {obj.completed && <span className="text-[8px] text-white font-bold">✓</span>}
              </div>
              <span className={cn(
                'text-sm',
                obj.completed ? 'text-muted-foreground line-through' : 'text-foreground'
              )}>{obj.description}</span>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Session Stats */}
      {sessionStats && sessionStats.weeksPlayed > 0 && (
        <div className="flex items-center justify-center gap-4 py-2 text-xs text-muted-foreground">
          <span>{sessionStats.weeksPlayed}w played</span>
          <span className="text-emerald-400">{sessionStats.matchesWon}W</span>
          <span className="text-destructive">{sessionStats.matchesLost}L</span>
          <span className="text-primary">+{sessionStats.xpEarned} XP</span>
        </div>
      )}
      </>}

    </div>
    <FinanceBreakdownSheet open={financeSheetOpen} onOpenChange={setFinanceSheetOpen} mode={financeSheetMode} />
    </>
  );
};

export default Dashboard;
