/**
 * Dashboard — the weekly hub.
 *
 * Layout, top to bottom, and why:
 *   1. Header + the ONE Continue button (Match Prep / Advance / Season
 *      Summary — `selectPrimaryAction`). The core loop is the first thing on
 *      the page.
 *   2. "Needs your attention" — only things with an action behind them
 *      (`selectAttentionItems`), each row tapping to the screen that resolves
 *      it. Injuries and expiring contracts used to render below the XP bar,
 *      sagas, objectives, achievements and cliffhangers. A pending storyline
 *      decision is a row here too, opening its choices in a sheet — it used
 *      to be a big card above the Continue button.
 *   3. The Getting Started checklist (new careers only) — also the page's
 *      one guide entry ("Take the tour"); the separate "Your Dashboard" hint
 *      card that sat above the Continue button is gone.
 *   4. The next match.
 *   5. Live-event and starter-kit banners, and the one-line Manager Pass
 *      entry (tier + a count badge when rewards are collectable).
 *   6. "More" — everything else (club overview, objectives, sagas,
 *      achievements, tips, quick links…), collapsed, remembered per device.
 *
 * The post-advance overlays are mounted here and sequenced by the
 * presentation queue, which also caps them per advance (see
 * `utils/presentationQueue.ts`); the converters below file the overflow to
 * the inbox.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { getSuffix } from '@/utils/helpers';
import { usePlayerClub, useLeaguePosition, useCurrentMatch, findTournamentMatch } from '@/hooks/useGameSelectors';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { PressConference } from '@/components/game/PressConference';
import { Button } from '@/components/ui/button';
import {
  Play, ChevronRight, ChevronDown, Trophy, AlertTriangle, Loader2, FastForward, Swords, Gavel, TrendingDown,
  Users, Activity, FileText, DollarSign, Clock, UserPlus, UserMinus, Briefcase, Sprout, Flag, BookOpen,
} from 'lucide-react';
import { LEAGUES, getDerbyIntensity, getDerbyName } from '@/data/league';
import { cn } from '@/lib/utils';
import { checkCelebrations, getDramaCelebration, detectTrophyMoments } from '@/utils/celebrations';
import type { Celebration, TrophyMoment } from '@/utils/celebrations';
import { getTransferWindows } from '@/config/transfers';
import { celebrationToast } from '@/utils/gameToast';
import { guardAsync } from '@/utils/asyncGuard';
import { CELEBRATION_STAGGER_MS, ADVANCE_DONE_MS, MID_SEASON_WEEK } from '@/config/ui';
import { CelebrationModal } from '@/components/game/CelebrationModal';
import { TrophyCeremonyModal } from '@/components/game/TrophyCeremonyModal';
import { StorylineModal } from '@/components/game/StorylineModal';
import { PlayerTransferTalk } from '@/components/game/PlayerTransferTalk';
import { AchievementUnlockModal } from '@/components/game/AchievementUnlockModal';
import { OnboardingChecklist } from '@/components/game/OnboardingChecklist';
import { StarterKitBanner } from '@/components/game/StarterKitBanner';
import { DailyRewardModal } from '@/components/game/DailyRewardModal';
import { FestivalBanner } from '@/components/game/FestivalBanner';
import { NotifPermissionModal } from '@/components/game/NotifPermissionModal';
import { ACHIEVEMENTS } from '@/utils/achievements';
import type { Achievement } from '@/utils/achievements';
import { FarewellModal } from '@/components/game/FarewellModal';
import { GemRevealModal } from '@/components/game/GemRevealModal';
import { SessionRecap } from '@/components/game/SessionRecap';
import { NationalTeamOfferModal } from '@/components/game/NationalTeamOfferModal';
import { hapticLight, hapticMedium, hapticHeavy } from '@/utils/haptics';
import { WeeklyDigest } from '@/components/game/WeeklyDigest';
import { DashboardMore } from '@/components/game/dashboard/DashboardMore';
import { DashboardPassRow } from '@/components/game/dashboard/DashboardPassRow';
import { getFlag, setFlag, removeFlag, STORAGE_KEYS } from '@/store/helpers/persistence';
import { MidSeasonReport } from '@/components/game/MidSeasonReport';
import { usePresentationOverflow } from '@/hooks/usePresentationQueue';
import { digestNote, gemNote, farewellNotes, celebrationNote, achievementNote, midSeasonNote } from '@/utils/overlayInbox';
import {
  isSeasonOver, getRaceMode, getSeasonStage, selectPrimaryAction, selectAttentionItems, selectNextFixture,
  effectiveObjectiveXp, countClaimableObjectives, type SeasonStage, type AttentionId, type AttentionItem,
} from '@/utils/dashboardSelectors';
import { getCompetitionInfo } from '@/utils/competitionBadge';
import type { TranslationKey } from '@/i18n';

const SEASON_STAGE_KEY: Record<SeasonStage, TranslationKey> = {
  preSeason: 'dashboard.stage.preSeason',
  autumn: 'dashboard.stage.autumn',
  winter: 'dashboard.stage.winter',
  spring: 'dashboard.stage.spring',
  runIn: 'dashboard.stage.runIn',
};

const ATTENTION_ICON: Record<AttentionId, React.ElementType> = {
  ultimatum: Gavel,
  board: TrendingDown,
  lineup: Users,
  injuries: Activity,
  contracts: FileText,
  offers: DollarSign,
  deadline: Clock,
  'squad-short': UserPlus,
  'squad-full': UserMinus,
  'job-offers': Briefcase,
  youth: Sprout,
  storyline: BookOpen,
};

const ATTENTION_COPY: Record<AttentionId, { title: TranslationKey; detail: TranslationKey }> = {
  ultimatum: { title: 'dashboard.attention.ultimatum', detail: 'dashboard.attention.ultimatumDetail' },
  board: { title: 'dashboard.attention.board', detail: 'dashboard.attention.boardDetail' },
  lineup: { title: 'dashboard.attention.lineup', detail: 'dashboard.attention.lineupDetail' },
  injuries: { title: 'dashboard.attention.injuries', detail: 'dashboard.attention.injuriesDetail' },
  contracts: { title: 'dashboard.attention.contracts', detail: 'dashboard.attention.contractsDetail' },
  offers: { title: 'dashboard.attention.offers', detail: 'dashboard.attention.offersDetail' },
  deadline: { title: 'dashboard.attention.deadline', detail: 'dashboard.attention.deadlineDetail' },
  'squad-short': { title: 'dashboard.attention.squadShort', detail: 'dashboard.attention.squadShortDetail' },
  'squad-full': { title: 'dashboard.attention.squadFull', detail: 'dashboard.attention.squadFullDetail' },
  'job-offers': { title: 'dashboard.attention.jobOffers', detail: 'dashboard.attention.jobOffersDetail' },
  youth: { title: 'dashboard.attention.youth', detail: 'dashboard.attention.youthDetail' },
  storyline: { title: 'dashboard.attention.storyline', detail: 'dashboard.attention.storylineDetail' },
};

const SEVERITY_TONE: Record<AttentionItem['severity'], string> = {
  critical: 'text-destructive bg-destructive/15',
  warning: 'text-amber-400 bg-amber-500/15',
  info: 'text-sky-400 bg-sky-500/15',
};

const Dashboard = () => {
  const { t } = useTranslation();
  // Use useShallow to only re-render when specific properties change (prevents React #185)
  const {
    playerClubId, clubs, players, week, season, fixtures, leagueTable, boardConfidence, boardUltimatum,
    incomingOffers, cup, leagueCup, championsCup, shieldCup, conferenceCup, domesticSuperCup, continentalSuperCup,
    playerDivision, transferWindowOpen, weeklyObjectives, seasonPhase, totalWeeks, gameMode, jobOffers,
    pendingPressConference, pendingStoryline, pendingTransferTalk, activeChallenge, youthAcademy,
    pendingAchievementIds,
  } = useGameStore(useShallow(s => ({
    playerClubId: s.playerClubId, clubs: s.clubs, players: s.players,
    week: s.week, season: s.season, fixtures: s.fixtures, leagueTable: s.leagueTable,
    boardConfidence: s.boardConfidence, boardUltimatum: s.boardUltimatum,
    incomingOffers: s.incomingOffers, cup: s.cup,
    leagueCup: s.leagueCup, championsCup: s.championsCup,
    shieldCup: s.shieldCup, conferenceCup: s.conferenceCup,
    domesticSuperCup: s.domesticSuperCup, continentalSuperCup: s.continentalSuperCup,
    playerDivision: s.playerDivision, transferWindowOpen: s.transferWindowOpen,
    weeklyObjectives: s.weeklyObjectives, seasonPhase: s.seasonPhase, totalWeeks: s.totalWeeks,
    gameMode: s.gameMode, jobOffers: s.jobOffers,
    pendingPressConference: s.pendingPressConference, pendingStoryline: s.pendingStoryline,
    pendingTransferTalk: s.pendingTransferTalk, activeChallenge: s.activeChallenge,
    youthAcademy: s.youthAcademy, pendingAchievementIds: s.pendingAchievementIds,
  })));
  const tw = getTransferWindows(totalWeeks);
  // Actions — stable references, individual selectors
  const setScreen = useGameStore(s => s.setScreen);
  const loadMatchForReview = useGameStore(s => s.loadMatchForReview);
  const advanceWeek = useGameStore(s => s.advanceWeek);
  const advanceToNextMatch = useGameStore(s => s.advanceToNextMatch);
  const endSeason = useGameStore(s => s.endSeason);
  const club = usePlayerClub();
  const { match: nextMatch, isHome, opponent, competition } = useCurrentMatch();
  const hasCupMatchToo = useMemo(() => {
    if (competition) return false;
    return !!findTournamentMatch({
      week, playerClubId, cup, leagueCup, championsCup, shieldCup, conferenceCup, domesticSuperCup, continentalSuperCup,
    });
  }, [competition, week, playerClubId, cup, leagueCup, championsCup, shieldCup, conferenceCup, domesticSuperCup, continentalSuperCup]);
  const pos = useLeaguePosition();

  const [isAdvancing, setIsAdvancing] = useState(false);
  const [advanceDone, setAdvanceDone] = useState(false);
  // Refs for the two nested setTimeouts in the Advance Week handler so a
  // fast navigation during the 50ms / ADVANCE_DONE_MS window doesn't fire
  // setState on an unmounted Dashboard.
  const advanceKickoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (advanceKickoffTimerRef.current) clearTimeout(advanceKickoffTimerRef.current);
    if (advanceDoneTimerRef.current) clearTimeout(advanceDoneTimerRef.current);
  }, []);
  const [midSeasonShown, setMidSeasonShown] = useState(() => getFlag(`dynasty-midseason-s${season}`));
  const showMidSeason = week === MID_SEASON_WEEK && !midSeasonShown;
  const dismissMidSeason = () => { setMidSeasonShown(true); setFlag(`dynasty-midseason-s${season}`); };
  // Week-23 double-modal guard: the Mid-Season Report is the richer summary
  // beat, so the weekly digest is dropped (not deferred) on that one week —
  // previously the player dismissed two consecutive summary overlays.
  const pendingDigest = useGameStore(s => s.weeklyDigest);
  const dismissWeeklyDigest = useGameStore(s => s.dismissWeeklyDigest);
  useEffect(() => {
    if (showMidSeason && pendingDigest) dismissWeeklyDigest();
  }, [showMidSeason, pendingDigest, dismissWeeklyDigest]);

  // The storyline decision sheet — opened from its "Needs your attention" row.
  const [storylineOpen, setStorylineOpen] = useState(false);

  // "More" — collapsed by default, remembered per device.
  const [moreOpen, setMoreOpen] = useState(() => getFlag(STORAGE_KEYS.DASHBOARD_MORE_EXPANDED));
  const toggleMore = () => {
    hapticLight();
    const next = !moreOpen;
    if (next) setFlag(STORAGE_KEYS.DASHBOARD_MORE_EXPANDED);
    else removeFlag(STORAGE_KEYS.DASHBOARD_MORE_EXPANDED);
    setMoreOpen(next);
  };

  // Celebration toasts & modals: fire when week changes (after advanceWeek)
  const prevWeekRef = useRef(week);
  const [majorCelebration, setMajorCelebration] = useState<Celebration | null>(null);
  // Trophy ceremonies (G4) — a small queue so a league+cup double both play,
  // sequenced by the presentation queue. Dedupe keys live in the STORE
  // (`recordCelebrationKeys`), not in a ref: GameShell renders only the active
  // screen, so this component unmounts on every navigation and a ref-held Set
  // was thrown away — which is why "Top of the Table!" re-fired ~20x a season.
  const [pendingTrophy, setPendingTrophy] = useState<TrophyMoment | null>(null);
  const trophyQueueRef = useRef<TrophyMoment[]>([]);
  const [pendingAchievementQueue, setPendingAchievementQueue] = useState<Achievement[]>([]);
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const prevAchievementRef = useRef<string[]>([]);
  // Track staggered celebration-toast timers so they can be cancelled on
  // unmount — otherwise toasts fire on a Dashboard that's been navigated
  // away from, dispatching state to a torn-down component.
  const celebrationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => {
    for (const t of celebrationTimersRef.current) clearTimeout(t);
    celebrationTimersRef.current = [];
  }, []);

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
      // Interruption budget: one modal per advance. The highest-tier unlock
      // gets the full celebration; the rest surface as staggered toasts
      // instead of a chain of sequential dismiss-tap modals.
      const tierRank = { gold: 0, silver: 1, bronze: 2 } as const;
      const sorted = [...achievements].sort((a, b) => tierRank[a.tier] - tierRank[b.tier]);
      setPendingAchievementQueue([sorted[0]]);
      setCurrentAchievement(sorted[0]);
      sorted.slice(1).forEach((a, i) => {
        const t = setTimeout(() => celebrationToast(`Achievement: ${a.title}`, a.description), (i + 1) * CELEBRATION_STAGGER_MS);
        celebrationTimersRef.current.push(t);
      });
      // Haptic fires inside AchievementUnlockModal when it actually becomes
      // visible (presentation queue, G3) — not here at queue time.
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

  const dismissTrophy = () => {
    setPendingTrophy(trophyQueueRef.current.shift() ?? null);
  };

  // ── Popup cap ── One advance may put BLOCKING_POPUPS_PER_ADVANCE popups on
  // screen; informational ones past that are filed to the inbox instead of
  // queueing behind each other (utils/presentationQueue.ts). Each converter
  // files the message AND clears the popup's state, so it stops asking for
  // the screen. Decisions and trophy lifts are never filed.
  const fileOverflowToInbox = useGameStore(s => s.fileOverflowToInbox);
  usePresentationOverflow('weeklyDigest', () => {
    const s = useGameStore.getState();
    if (s.weeklyDigest) fileOverflowToInbox('weeklyDigest', [digestNote(s.weeklyDigest, s.week)]);
  });
  usePresentationOverflow('gemReveal', () => {
    const s = useGameStore.getState();
    if (s.pendingGemReveal) {
      fileOverflowToInbox('gemReveal', [gemNote(s.pendingGemReveal, s.players[s.pendingGemReveal.playerId])]);
    }
  });
  usePresentationOverflow('farewell', () => {
    fileOverflowToInbox('farewell', farewellNotes(useGameStore.getState().pendingFarewell));
  });
  usePresentationOverflow('celebration', () => {
    if (majorCelebration) fileOverflowToInbox('celebration', [celebrationNote(majorCelebration)]);
    setMajorCelebration(null);
  });
  usePresentationOverflow('achievement', () => {
    fileOverflowToInbox('achievement', pendingAchievementQueue.map(achievementNote));
    setPendingAchievementQueue([]);
    setCurrentAchievement(null);
  });
  usePresentationOverflow('midSeason', () => {
    const s = useGameStore.getState();
    const idx = s.leagueTable.findIndex(e => e.clubId === s.playerClubId);
    fileOverflowToInbox('midSeason', idx === -1 ? [] : [midSeasonNote({
      position: idx + 1, points: s.leagueTable[idx].points, boardConfidence: s.boardConfidence,
    })]);
    dismissMidSeason();
  });

  // No season-reset effect: `recordCelebrationKeys` buckets by season and
  // resets itself when the season changes, so the keys expire correctly even
  // though this component is not mounted across the rollover.
  useEffect(() => {
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

      // Drama celebrations (type 'record' from getDramaCelebration) are per-week;
      // milestones/streaks are per-season to avoid re-triggering. The dedupe
      // bucket is season-scoped in the store, so the season suffix is implicit.
      const celebrationKey = (c: Celebration) =>
        c.type === 'record' ? `${c.title}-w${week}` : c.title;
      const freshKeys = new Set(
        s.recordCelebrationKeys(s.season, celebrations.map(celebrationKey)),
      );
      // Consume on match so two celebrations sharing a key surface once, which
      // is what the old add-to-Set-while-filtering loop did.
      const unseen = celebrations.filter(c => {
        const key = celebrationKey(c);
        if (!freshKeys.has(key)) return false;
        freshKeys.delete(key);
        return true;
      });
      // Route major/legendary to modal, minor to toast
      const majorOnes = unseen.filter(c => c.severity === 'major' || c.severity === 'legendary');
      const minorOnes = unseen.filter(c => c.severity === 'minor');
      if (majorOnes.length > 0) {
        setMajorCelebration(majorOnes[0]);
        // Haptic fires inside CelebrationModal on visibility (queue, G3).
      }
      if (minorOnes.length > 0) hapticMedium();
      minorOnes.forEach((c, i) => {
        const t = setTimeout(() => celebrationToast(c.title, c.description), i * CELEBRATION_STAGGER_MS);
        celebrationTimersRef.current.push(t);
      });

      // Trophy ceremonies (G4): every confirmed trophy — league title, both
      // domestic cups, all three continental cups and both Super Cups. Keyed
      // per season so each fires exactly once; queued so a double (or a
      // treble) plays them all, sequenced by the presentation queue.
      const trophies = detectTrophyMoments({
        playerClubId: s.playerClubId,
        clubName: currentClub.name ?? 'Your club',
        leagueTable: s.leagueTable,
        cupWinnerId: s.cup?.winner,
        leagueCupWinnerId: s.leagueCup?.winner,
        championsCupWinnerId: s.championsCup?.winnerId,
        shieldCupWinnerId: s.shieldCup?.winnerId,
        conferenceCupWinnerId: s.conferenceCup?.winnerId,
        domesticSuperCupWinnerId: s.domesticSuperCup?.winnerId,
        continentalSuperCupWinnerId: s.continentalSuperCup?.winnerId,
      });
      const freshTrophyKeys = new Set(
        s.recordCelebrationKeys(s.season, trophies.map(t => `trophy-${t.id}`)),
      );
      const unseenTrophies = trophies.filter(t => freshTrophyKeys.has(`trophy-${t.id}`));
      if (unseenTrophies.length > 0) {
        trophyQueueRef.current.push(...unseenTrophies);
        setPendingTrophy(prev => prev ?? trophyQueueRef.current.shift() ?? null);
      }
    }
    prevWeekRef.current = week;
  }, [week]); // Only depend on week — read other values from getState() to avoid cascading re-renders


  // Toast when an objective completes. Its Claim button lives in "More", so
  // the toast says where to find it and the More toggle carries the count.
  const prevCompletedObjRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const done = new Set(weeklyObjectives.filter(o => o.completed).map(o => o.objectiveId));
    const prev = prevCompletedObjRef.current;
    prevCompletedObjRef.current = done;
    if (!prev) return;
    const newlyDone = weeklyObjectives.filter(o => o.completed && !prev.has(o.objectiveId));
    if (newlyDone.length === 0) return;
    hapticLight();
    if (weeklyObjectives.every(o => o.completed)) {
      celebrationToast(t('dashboard.objectives.allDoneTitle'), t('dashboard.objectives.allDoneBody'));
    } else {
      for (const obj of newlyDone) {
        celebrationToast(t('dashboard.objectives.doneTitle'), t('dashboard.objectives.doneBody', { title: obj.title, xp: effectiveObjectiveXp(obj) }));
      }
    }
  }, [weeklyObjectives, t]);
  const claimableObjectives = countClaimableObjectives(weeklyObjectives);

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
    return { oppName: oppClub?.shortName || '?', score: `${lastMatch.homeGoals}-${lastMatch.awayGoals}`, result, week: lastMatch.week };
  }, [fixtures, playerClubId, clubs]);


  // NB: the phase is 'playoff', not 'playoffs' — see `isSeasonOver`.
  const inPlayoffs = seasonPhase === 'playoff';
  const competitionInfo = getCompetitionInfo(competition, {
    inPlayoffs,
    leagueName: LEAGUES.find(d => d.id === playerDivision)?.shortName,
  });

  const seasonOver = useMemo(
    () => isSeasonOver({ fixtures, playerClubId, week, totalWeeks, seasonPhase }),
    [fixtures, playerClubId, week, totalWeeks, seasonPhase],
  );
  const relegationSpots = LEAGUES.find(d => d.id === playerDivision)?.relegationSpots ?? 0;
  const raceMode = useMemo(
    () => getRaceMode({ seasonOver, seasonPhase, week, totalWeeks, leagueTable, playerClubId, relegationSpots }),
    [seasonOver, seasonPhase, week, totalWeeks, leagueTable, playerClubId, relegationSpots],
  );
  const hasMatchThisWeek = !!nextMatch && !!opponent;
  const primary = selectPrimaryAction({
    seasonOver, hasMatchThisWeek, hasFixtureThisWeek: !!nextMatch, seasonPhase, week, totalWeeks,
  });
  const nextFixture = useMemo(
    () => (hasMatchThisWeek ? null : selectNextFixture(fixtures, playerClubId, week)),
    [hasMatchThisWeek, fixtures, playerClubId, week],
  );
  const youthReady = youthAcademy.prospects.filter(p => p.readyToPromote).length;
  const storylineRow = useMemo(
    () => (pendingStoryline ? { title: pendingStoryline.title, choices: pendingStoryline.options.length } : null),
    [pendingStoryline],
  );
  const attention = useMemo(() => (club ? selectAttentionItems({
    club, players, playerClubId, season, week,
    incomingOffers: incomingOffers.length, boardConfidence, boardUltimatum, leaguePosition: pos,
    transferWindowOpen, windows: tw, jobOffers: gameMode === 'career' ? jobOffers.length : 0, youthReady, hasMatchThisWeek,
    storyline: storylineRow,
  }) : []), [club, players, playerClubId, season, week, incomingOffers.length, boardConfidence, boardUltimatum, pos,
    transferWindowOpen, tw, gameMode, jobOffers.length, youthReady, hasMatchThisWeek, storylineRow]);

  if (!club) {
    // `playerClubId` no longer resolves. In career mode `setScreen` redirects an
    // unemployed manager, so reaching here means a save whose club is gone —
    // and a bare spinner with no timeout and no escape left the player staring
    // at it forever. Offer the same way out the root ErrorBoundary does.
    return (
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground">{t('dashboard.clubUnavailable')}</p>
        <LiquidButton onClick={() => { window.location.hash = '#/'; }}>
          {t('dashboard.returnToMenu')}
        </LiquidButton>
      </div>
    );
  }

  const handleAdvance = () => {
    hapticMedium();
    setIsAdvancing(true);
    if (advanceKickoffTimerRef.current) clearTimeout(advanceKickoffTimerRef.current);
    advanceKickoffTimerRef.current = setTimeout(() => {
      const advancePromise = advanceWeek();
      guardAsync(
        advancePromise,
        'Dashboard.advanceWeek',
        { title: 'Could not advance week', body: 'Please try again.' },
      );
      // Re-enable only after the (async) advance settles — otherwise a fast
      // second tap fires a concurrent advanceWeek() and double-processes the
      // week (double income/stats/fixtures). Promise.resolve handles the sync path.
      Promise.resolve(advancePromise).finally(() => {
        setIsAdvancing(false);
        setAdvanceDone(true);
        hapticHeavy();
        if (advanceDoneTimerRef.current) clearTimeout(advanceDoneTimerRef.current);
        advanceDoneTimerRef.current = setTimeout(() => setAdvanceDone(false), ADVANCE_DONE_MS);
      });
    }, 50);
  };

  const handleSkipToNextMatch = () => {
    hapticMedium();
    // Same double-fire hazard as Advance: without setting isAdvancing before
    // the call, a fast double-tap runs two concurrent multi-week advances.
    setIsAdvancing(true);
    const skipPromise = advanceToNextMatch();
    guardAsync(
      skipPromise,
      'Dashboard.advanceToNextMatch',
      { title: 'Could not advance', body: 'Please try again.' },
    );
    Promise.resolve(skipPromise).finally(() => setIsAdvancing(false));
  };

  const nextFixtureOpponent = nextFixture
    ? clubs[nextFixture.homeClubId === playerClubId ? nextFixture.awayClubId : nextFixture.homeClubId]
    : null;
  const isDerby = hasMatchThisWeek && getDerbyIntensity(playerClubId, opponent.id) > 0;
  const challengeLabel = activeChallenge
    ? activeChallenge.completed ? t('dashboard.pill.challengeComplete')
      : activeChallenge.failed ? t('dashboard.pill.challengeFailed')
      : t('dashboard.pill.challengeActive', { seasons: activeChallenge.seasonsRemaining })
    : null;
  const weeksLeft = totalWeeks - week;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* ── Overlays (no layout space; sequenced + capped by the presentation queue) ── */}
      <DailyRewardModal />
      <NotifPermissionModal />
      {showMidSeason && <MidSeasonReport onDismiss={dismissMidSeason} />}
      <WeeklyDigest />
      <NationalTeamOfferModal />
      {pendingPressConference && <PressConference />}
      {/* A storyline is a row in "Needs your attention", not a card above the
          Continue button (it pushed Continue to y≈650); the row opens this. */}
      {pendingStoryline && storylineOpen && <StorylineModal onClose={() => setStorylineOpen(false)} />}
      {pendingTransferTalk && <PlayerTransferTalk />}
      <FarewellModal />
      <GemRevealModal />
      <SessionRecap />
      <TrophyCeremonyModal
        open={!!pendingTrophy}
        onClose={dismissTrophy}
        title={pendingTrophy?.title || ''}
        subtitle={pendingTrophy?.subtitle || ''}
      />
      <CelebrationModal
        open={!!majorCelebration}
        onClose={() => setMajorCelebration(null)}
        title={majorCelebration?.title || ''}
        description={majorCelebration?.description || ''}
        icon={majorCelebration?.icon}
        severity={majorCelebration?.severity}
      />
      <AchievementUnlockModal
        open={!!currentAchievement}
        onClose={dismissAchievement}
        achievement={currentAchievement}
      />

      {/* ── 1. Header + Continue ── */}
      <GlassPanel className="p-4 space-y-3">
        <div className="h-1 rounded-full" style={{ background: `linear-gradient(to right, ${club.color}, transparent)` }} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold font-display text-foreground truncate">{club.name}</h1>
            <p className="text-[11px] text-muted-foreground">
              {t('dashboard.header.seasonWeek', { season, week })} · {t(SEASON_STAGE_KEY[getSeasonStage(week, tw)])}
            </p>
          </div>
          {pos > 0 && (
            <button
              type="button"
              onClick={() => setScreen('league-table')}
              aria-label={t('dashboard.header.positionAria', { position: `${pos}${getSuffix(pos)}` })}
              className="shrink-0 min-h-11 min-w-11 px-3 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center hover:bg-white/10 transition-colors"
            >
              <span className="text-base font-black tabular-nums text-foreground leading-none">{pos}<span className="text-[11px] font-bold text-muted-foreground">{getSuffix(pos)}</span></span>
              <span className="text-[11px] text-muted-foreground tabular-nums leading-tight">{t('dashboard.header.points', { points: leagueTable.find(e => e.clubId === playerClubId)?.points ?? 0 })}</span>
            </button>
          )}
        </div>

        {(raceMode || inPlayoffs || challengeLabel) && (
          <div className="flex flex-wrap gap-2">
            {raceMode && (
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border',
                raceMode === 'title' ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-destructive/10 border-destructive/40 text-destructive',
              )}>
                {raceMode === 'title' ? <Trophy className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {raceMode === 'title' ? t('dashboard.pill.titleRace', { weeks: weeksLeft }) : t('dashboard.pill.relegationBattle', { weeks: weeksLeft })}
              </span>
            )}
            {inPlayoffs && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border bg-amber-500/10 border-amber-500/30 text-amber-400">
                <Trophy className="w-3.5 h-3.5" /> {t('dashboard.pill.playoffs')}
              </span>
            )}
            {challengeLabel && (
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border',
                activeChallenge?.failed ? 'bg-destructive/10 border-destructive/30 text-destructive'
                  : activeChallenge?.completed ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-primary/10 border-primary/30 text-primary',
              )}>
                <Flag className="w-3.5 h-3.5" /> {challengeLabel}
              </span>
            )}
          </div>
        )}

        {primary.kind === 'season-summary' && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              {t('dashboard.cta.seasonComplete', { season, position: `${pos}${getSuffix(pos)}` })}
            </p>
            <Button className="w-full h-12 gap-2 text-base font-bold" onClick={() => { hapticHeavy(); endSeason(); }}>
              <Trophy className="w-5 h-5" /> {t('dashboard.cta.viewSeasonSummary')}
            </Button>
          </div>
        )}
        {primary.kind === 'match-prep' && (
          <Button className="w-full h-12 gap-2 text-base font-bold" onClick={() => setScreen('match-prep')}>
            <Play className="w-5 h-5" /> {t('dashboard.cta.matchPrep', { opponent: opponent?.shortName ?? '' })}
          </Button>
        )}
        {primary.kind === 'advance' && (
          <div className="space-y-1">
            <Button
              className={cn(
                'w-full h-12 gap-2 text-base font-bold active:scale-[0.97] transition-all',
                isAdvancing && 'animate-pulse shadow-[0_0_12px_hsl(var(--primary)/0.3)]',
                advanceDone && 'scale-[1.03] shadow-[0_0_16px_hsl(var(--primary)/0.4)]',
              )}
              disabled={isAdvancing}
              onClick={handleAdvance}
            >
              {isAdvancing
                ? <><Loader2 className="w-5 h-5 animate-spin" /> {t('dashboard.cta.advancing')}</>
                : <><ChevronRight className="w-5 h-5" /> {t('dashboard.cta.advance', { week: primary.nextWeek })}</>}
            </Button>
            {primary.canSkipToNextMatch && (
              <button
                type="button"
                className="w-full min-h-11 text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                disabled={isAdvancing}
                onClick={handleSkipToNextMatch}
              >
                <FastForward className="w-3.5 h-3.5 inline mr-1 align-[-2px]" /> {t('dashboard.cta.skipToNextMatch')}
              </button>
            )}
          </div>
        )}
      </GlassPanel>

      {/* ── 2. Needs your attention — actionable items only ── */}
      {attention.length > 0 && (
        <section aria-labelledby="dashboard-attention-title" className="space-y-2">
          <h2 id="dashboard-attention-title" className="px-1 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            {t('dashboard.attention.title', { count: attention.length })}
          </h2>
          <GlassPanel className="p-1.5">
            <ul className="divide-y divide-white/5">
              {attention.map(item => {
                const Icon = ATTENTION_ICON[item.id];
                const copy = ATTENTION_COPY[item.id];
                const detailKey = item.id === 'board' && item.severity === 'critical' ? 'dashboard.attention.boardCriticalDetail' : copy.detail;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        if (item.id === 'storyline') setStorylineOpen(true);
                        else setScreen(item.screen);
                      }}
                      className="w-full min-h-[52px] flex items-center gap-3 px-2.5 py-2 text-left rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors"
                    >
                      <span className={cn('shrink-0 w-8 h-8 rounded-lg flex items-center justify-center', SEVERITY_TONE[item.severity])}>
                        <Icon className="w-4 h-4" aria-hidden />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-foreground truncate">{t(copy.title, item.params)}</span>
                        <span className="block text-[11px] text-muted-foreground truncate">{t(detailKey, item.params)}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </GlassPanel>
        </section>
      )}

      {/* ── 3. Getting Started (new careers; self-hides) ── */}
      <OnboardingChecklist />

      {/* ── 4. The next match ── */}
      {!seasonOver && (
        <GlassPanel className={cn('p-4 space-y-3', hasMatchThisWeek && competitionInfo.borderAccent)}>
          {hasMatchThisWeek ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border',
                  competitionInfo.bg,
                )}>
                  <Trophy className="w-3 h-3" />
                  <span className={competitionInfo.color}>{competitionInfo.name}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">{t('dashboard.match.thisWeek', { week })}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <div
                    className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-xs"
                    style={{ backgroundColor: club.color, color: club.secondaryColor }}
                  >
                    {club.shortName}
                  </div>
                  <p className="text-sm font-bold text-foreground">{club.shortName}</p>
                  <p className="text-[11px] text-muted-foreground">{isHome ? t('dashboard.match.home') : t('dashboard.match.away')}</p>
                </div>
                <p className="px-4 text-2xl font-black text-muted-foreground">{t('dashboard.match.vs')}</p>
                <div className="text-center flex-1">
                  <div
                    className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-xs"
                    style={{ backgroundColor: opponent.color, color: opponent.secondaryColor }}
                  >
                    {opponent.shortName}
                  </div>
                  <p className="text-sm font-bold text-foreground">{opponent.shortName}</p>
                  <p className="text-[11px] text-muted-foreground">{isHome ? t('dashboard.match.away') : t('dashboard.match.home')}</p>
                </div>
              </div>
              {hasCupMatchToo && (
                <p className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-medium text-primary">
                  <Trophy className="w-3 h-3" /> {t('dashboard.match.cupAlso')}
                </p>
              )}
              {isDerby && (
                <button
                  type="button"
                  onClick={() => setScreen('rivalries')}
                  className="w-full min-h-11 flex items-center gap-2 px-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-left hover:bg-orange-500/15 transition-colors"
                >
                  <Swords className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-orange-400">{t('dashboard.match.rivalryWeek')}</span>
                    <span className="block text-xs font-semibold text-foreground truncate">{getDerbyName(playerClubId, opponent.id) || `vs ${opponent.shortName}`}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{t('dashboard.match.nextLeagueMatch')}</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {nextFixture && nextFixtureOpponent
                    ? t('dashboard.match.nextFixture', {
                      opponent: nextFixtureOpponent.shortName,
                      venue: nextFixture.homeClubId === playerClubId ? t('dashboard.match.homeShort') : t('dashboard.match.awayShort'),
                      week: nextFixture.week,
                    })
                    : t('dashboard.match.noFixture')}
                </p>
              </div>
              {nextFixtureOpponent && (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0"
                  style={{ backgroundColor: nextFixtureOpponent.color, color: nextFixtureOpponent.secondaryColor }}
                >
                  {nextFixtureOpponent.shortName}
                </div>
              )}
            </div>
          )}
          {lastMatchInfo && (
            <button
              type="button"
              onClick={() => { loadMatchForReview(lastMatchInfo.week); setScreen('match-review'); }}
              className="w-full min-h-11 flex items-center justify-between gap-2 px-2 rounded-xl bg-white/[0.03] text-left hover:bg-white/[0.06] transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className={cn(
                  'w-6 h-6 rounded-md flex items-center justify-center text-xs font-black shrink-0',
                  lastMatchInfo.result === 'W' ? 'bg-emerald-500/20 text-emerald-400'
                    : lastMatchInfo.result === 'L' ? 'bg-destructive/20 text-destructive'
                    : 'bg-amber-500/20 text-amber-400',
                )}>{lastMatchInfo.result}</span>
                <span className="text-xs font-semibold text-foreground truncate">
                  {t('dashboard.match.lastResult', { score: lastMatchInfo.score, opponent: lastMatchInfo.oppName })}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          )}
        </GlassPanel>
      )}

      {/* ── 5. Live event + starter-kit offer (both self-hide), Manager Pass ── */}
      <FestivalBanner />
      <StarterKitBanner />
      <DashboardPassRow />

      {/* ── 6. More — everything else, collapsed, remembered per device ── */}
      <button
        type="button"
        onClick={toggleMore}
        aria-expanded={moreOpen}
        aria-controls="dashboard-more"
        className="w-full min-h-11 flex items-center justify-between gap-3 px-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{t('dashboard.more.title')}</span>
          {claimableObjectives > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
              {t('dashboard.more.toClaim', { count: claimableObjectives })}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {!moreOpen && <span className="hidden min-[360px]:inline">{t('dashboard.more.hint')}</span>}
          <ChevronDown className={cn('w-4 h-4 transition-transform', moreOpen && 'rotate-180')} aria-hidden />
        </span>
      </button>
      {moreOpen && (
        <div id="dashboard-more">
          <DashboardMore seasonOver={seasonOver} inPlayoffs={inPlayoffs} />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
