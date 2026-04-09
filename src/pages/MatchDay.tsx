import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubstitutionSheet } from '@/components/game/SubstitutionSheet';
import { Button } from '@/components/ui/button';
import { MatchEvent, Match, Club, ContinentalTournamentState, TeamTalkType } from '@/types/game';
import { resolveClub } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, FastForward, Pause, RefreshCw, Zap, Flame, Shield, AlertTriangle, Calendar, MapPin, Trophy } from 'lucide-react';
import { hapticHeavy, hapticMedium, hapticLight } from '@/utils/haptics';
import { KEY_MOMENT_LOSING_MINUTE, KEY_MOMENT_TIGHT_FINISH_MINUTE, MAX_SUBSTITUTIONS, KEY_MOMENT_DOMINANT_POSSESSION_MIN, KEY_MOMENT_POSSESSION_THRESHOLD, KEY_MOMENT_NEAR_MISS_COUNT, SHOUT_DURATION, SHOUT_COOLDOWN, MAX_SHOUTS_PER_MATCH, MATCH_LOW_FITNESS_THRESHOLD } from '@/config/matchEngine';
import type { HalfState } from '@/engine/match';
import type { ShoutType, KeyMomentChoice } from '@/types/game';
import { useCurrentMatch } from '@/hooks/useGameSelectors';
import { PostMatchPopup } from '@/components/game/PostMatchPopup';
import { TacticalPanel } from '@/components/game/TacticalPanel';
import { getCommentaryStyle, enrichDescription } from '@/utils/matchCommentary';
import { TEAM_TALK_OPTIONS } from '@/config/ui';
import { MENTALITIES, FORMATIONS } from '@/config/tactics';
import { KEY_MOMENT_CHOICES } from '@/config/keyMoments';
import { infoToast } from '@/utils/gameToast';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS, GOAL_FLASH_MS } from '@/config/ui';
import { getActiveCosmetic } from '@/utils/monetization';
import { areColorsSimilar } from '@/utils/uiHelpers';
import { YellowCardIcon, RedCardIcon } from '@/components/game/PlayerAvatar';
import { PenaltyShootout } from '@/components/game/PenaltyShootout';
import { Megaphone, BarChart3, Activity, ChevronDown, ChevronUp, Users, ShieldCheck, Layers } from 'lucide-react';

import { GOAL_EVENT_TYPES, GOAL_DISPLAY_TYPES } from '@/config/matchEngine';
const isGoalEvent = (e: MatchEvent) => (GOAL_DISPLAY_TYPES as readonly string[]).includes(e.type);

/** Find player's continental match this week and return display-friendly info */
function findPlayerContinentalMatchForUI(
  tournament: ContinentalTournamentState | null,
  week: number,
  playerClubId: string,
): { id: string; homeClubId: string; awayClubId: string; roundLabel: string } | null {
  if (!tournament) return null;
  // Check group stage
  for (let gi = 0; gi < tournament.groups.length; gi++) {
    const group = tournament.groups[gi];
    for (let mi = 0; mi < group.matches.length; mi++) {
      const m = group.matches[mi];
      if (m.played || m.week !== week) continue;
      if (m.homeClubId === playerClubId || m.awayClubId === playerClubId) {
        return { id: m.id, homeClubId: m.homeClubId, awayClubId: m.awayClubId, roundLabel: `Group ${String.fromCharCode(65 + gi)} - MD${mi + 1}` };
      }
    }
  }
  // Check knockout
  for (let ti = 0; ti < tournament.knockoutTies.length; ti++) {
    const tie = tournament.knockoutTies[ti];
    if (tie.homeClubId !== playerClubId && tie.awayClubId !== playerClubId) continue;
    const roundNames: Record<string, string> = { R16: 'Round of 16', QF: 'Quarter-Final', SF: 'Semi-Final', F: 'Final' };
    const roundLabel = roundNames[tie.round] || tie.round;
    if (tie.round === 'F') {
      if (!tie.leg1Played && tie.week1 === week) return { id: tie.id, homeClubId: tie.homeClubId, awayClubId: tie.awayClubId, roundLabel };
    } else {
      if (!tie.leg1Played && tie.week1 === week) return { id: tie.id, homeClubId: tie.homeClubId, awayClubId: tie.awayClubId, roundLabel: `${roundLabel} - Leg 1` };
      if (tie.leg1Played && !tie.leg2Played && tie.week2 === week) return { id: tie.id, homeClubId: tie.awayClubId, awayClubId: tie.homeClubId, roundLabel: `${roundLabel} - Leg 2` };
    }
  }
  return null;
}

/** Compute enriched description with running score context */
function getEnrichedDescription(ev: MatchEvent, events: MatchEvent[], homeClubId: string, isPlayerHome: boolean): string {
  let hg = 0, ag = 0;
  for (const e of events) {
    if (isGoalEvent(e)) {
      if (e.clubId === homeClubId) hg++; else ag++;
    }
    if (e === ev) break;
  }
  return enrichDescription(ev, { homeGoals: hg, awayGoals: ag, homeClubId, isPlayerHome, minute: ev.minute });
}

const MatchDay = () => {
  const { playerClubId, week, clubs, matchSubsUsed, tactics, cup, leagueCup, championsCup, shieldCup, virtualClubs, currentCupTieId, domesticSuperCup, continentalSuperCup, monetization, matchPhase, matchTeamTalk, penaltyShootoutKicks } = useGameStore(useShallow(s => ({
    playerClubId: s.playerClubId,
    week: s.week,
    clubs: s.clubs,
    matchSubsUsed: s.matchSubsUsed,
    tactics: s.tactics,
    cup: s.cup,
    leagueCup: s.leagueCup,
    championsCup: s.championsCup,
    shieldCup: s.shieldCup,
    virtualClubs: s.virtualClubs,
    currentCupTieId: s.currentCupTieId,
    domesticSuperCup: s.domesticSuperCup,
    continentalSuperCup: s.continentalSuperCup,
    monetization: s.monetization,
    matchPhase: s.matchPhase,
    matchTeamTalk: s.matchTeamTalk,
    penaltyShootoutKicks: s.penaltyShootoutKicks,
  })));
  const playFirstHalf = useGameStore(s => s.playFirstHalf);
  const playSecondHalf = useGameStore(s => s.playSecondHalf);
  const playExtraTime = useGameStore(s => s.playExtraTime);
  const playPenalties = useGameStore(s => s.playPenalties);
  const setScreen = useGameStore(s => s.setScreen);
  const setTactics = useGameStore(s => s.setTactics);
  const setFormation = useGameStore(s => s.setFormation);
  const cleanupAbandonedMatch = useGameStore(s => s.cleanupAbandonedMatch);
  const setTeamTalk = useGameStore(s => s.setTeamTalk);
  const activateShout = useGameStore(s => s.useShout);
  const matchShouts = useGameStore(s => s.matchShouts);
  const players = useGameStore(s => s.players);

  const [phase, setPhase] = useState<'pre' | 'first_half' | 'half_time' | 'second_half' | 'extra_time_break' | 'extra_time' | 'penalties' | 'post'>('pre');
  const [firstHalfState, setFirstHalfState] = useState<HalfState | null>(null);
  const [allEvents, setAllEvents] = useState<MatchEvent[]>([]);
  const [currentMin, setCurrentMin] = useState(0);
  const currentMinRef = useRef(0);
  const [visibleEvents, setVisibleEvents] = useState<MatchEvent[]>([]);
  const [speed, setSpeed] = useState(200);
  const [paused, setPaused] = useState(false);
  const [subSheetOpen, setSubSheetOpen] = useState(false);
  // showTacticUI removed — tactical controls now embedded directly in key moment and half-time UIs
  const [keyMoment, setKeyMoment] = useState<{ type: string; description: string; playerId?: string } | null>(null);
  const [injurySubMode, setInjurySubMode] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showFitness, setShowFitness] = useState(false);
  const [showCustomTactics, setShowCustomTactics] = useState(false);
  // Full Time screen removed — PostMatchPopup navigates directly to Match Review
  const dismissedMomentsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Clean up ephemeral club data if user navigates away mid-match
  useEffect(() => {
    return () => {
      if (phaseRef.current !== 'pre' && phaseRef.current !== 'post') {
        cleanupAbandonedMatch();
      }
    };
  }, [cleanupAbandonedMatch]);

  const { match: liveMatch } = useCurrentMatch();

  // Detect cup match if no league match this week
  const cupTie = !liveMatch ? cup.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;
  const cupMatch = cupTie ? { id: cupTie.id, week: cupTie.week, homeClubId: cupTie.homeClubId, awayClubId: cupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match : null;

  // Detect League Cup match
  const leagueCupTie = !liveMatch && !cupTie ? leagueCup?.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;
  const leagueCupMatch = leagueCupTie ? { id: leagueCupTie.id, week: leagueCupTie.week, homeClubId: leagueCupTie.homeClubId, awayClubId: leagueCupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match : null;

  // Detect continental match (Champions Cup / Shield Cup)
  const champMatch = !liveMatch && !cupTie && !leagueCupTie ? findPlayerContinentalMatchForUI(championsCup, week, playerClubId) : null;
  const shieldMatch = !liveMatch && !cupTie && !leagueCupTie && !champMatch ? findPlayerContinentalMatchForUI(shieldCup, week, playerClubId) : null;
  const continentalMatchInfo = champMatch || shieldMatch;
  const continentalMatch = continentalMatchInfo ? { id: continentalMatchInfo.id, week, homeClubId: continentalMatchInfo.homeClubId, awayClubId: continentalMatchInfo.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match : null;

  // Detect super cup match
  const superCupMatch = !liveMatch && !cupTie && !leagueCupTie && !continentalMatch ? (() => {
    const dsc = domesticSuperCup;
    const csc = continentalSuperCup;
    const sc = dsc && !dsc.played && dsc.week === week && (dsc.homeClubId === playerClubId || dsc.awayClubId === playerClubId) ? dsc
      : csc && !csc.played && csc.week === week && (csc.homeClubId === playerClubId || csc.awayClubId === playerClubId) ? csc : null;
    return sc ? { id: `super-cup-${sc.type}`, week, homeClubId: sc.homeClubId, awayClubId: sc.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match : null;
  })() : null;

  const isCupMatch = !!cupTie || !!leagueCupTie || !!continentalMatch || !!superCupMatch || !!currentCupTieId;

  // Competition context for display
  const competitionInfo = cupTie ? { name: 'Dynasty Cup', round: cupTie.round, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' }
    : leagueCupTie ? { name: 'League Cup', round: leagueCupTie.round, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' }
    : champMatch ? { name: 'Champions Cup', round: champMatch.roundLabel, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' }
    : shieldMatch ? { name: 'Shield Cup', round: shieldMatch.roundLabel, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' }
    : superCupMatch ? { name: domesticSuperCup?.week === week ? 'Super Cup' : 'Continental Super Cup', round: 'Final', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' }
    : null;

  // Cache match data when kickoff starts — playSecondHalf() marks the fixture
  // as played which makes useCurrentMatch() return undefined mid-animation.
  const matchCacheRef = useRef<{ match: Match; homeClub: Club; awayClub: Club } | null>(null);

  const match = matchCacheRef.current?.match ?? liveMatch ?? cupMatch ?? leagueCupMatch ?? continentalMatch ?? superCupMatch;
  const homeClub = matchCacheRef.current?.homeClub ?? (match ? resolveClub(clubs, virtualClubs, match.homeClubId) : null);
  const awayClub = matchCacheRef.current?.awayClub ?? (match ? resolveClub(clubs, virtualClubs, match.awayClubId) : null);
  // Clear dismissed moments when match changes (e.g. multi-match sessions)
  useEffect(() => { dismissedMomentsRef.current.clear(); }, [match]);
  // No useEffect needed — PostMatchPopup now navigates directly to Match Review

  // No auto-start — show "Ready to Kick Off?" screen instead

  const kickOff = () => {
    if (!match || !homeClub || !awayClub) return;
    // Cache match data so it survives the fixture being marked as played
    matchCacheRef.current = { match, homeClub, awayClub };
    const halfState = playFirstHalf();
    if (!halfState) return;
    setFirstHalfState(halfState);
    setAllEvents(halfState.events);
    setPhase('first_half');
    currentMinRef.current = 0;
    setCurrentMin(0);
    setVisibleEvents([]);
    setPaused(false);
  };

  const resumingRef = useRef(false);
  const resumeSecondHalf = () => {
    // Guard against double-tap
    if (resumingRef.current) return;
    resumingRef.current = true;
    try {
      // Simulate second half with potentially updated lineup/tactics
      const result = playSecondHalf();
      if (!result) { resumingRef.current = false; return; }
      // Pre-populate visibleEvents with first-half events to avoid stale references
      const firstHalfEvents = result.events.filter((e: MatchEvent) => e.minute <= 45);
      setVisibleEvents(firstHalfEvents);
      setAllEvents(result.events);
      setPhase('second_half');
      // Continue from minute 46
      currentMinRef.current = 45;
      setCurrentMin(45);
      setPaused(false);
      resumingRef.current = false;
    } catch (err) {
      console.error('[resumeSecondHalf] Failed:', err);
      resumingRef.current = false;
    }
  };

  const resumeExtraTime = () => {
    const result = playExtraTime();
    if (!result) return;
    setAllEvents(result.events);
    currentMinRef.current = 90;
    setCurrentMin(90);
    setPhase('extra_time');
    setPaused(false);
  };

  const handlePenalties = () => {
    // playPenalties() now only pre-computes kicks and stores them for kick-by-kick reveal.
    // The phase stays 'penalties' until the shootout is finalized via revealNextPenaltyKick / skipPenaltyShootout.
    playPenalties();
  };

  // Detect key moments that should pause the match for player decisions
  const checkKeyMoment = useCallback((minute: number, events: MatchEvent[]) => {
    if (!match) return false;
    const playerGoals = events.filter(e => isGoalEvent(e) && e.clubId === playerClubId).length;
    const opponentGoals = events.filter(e => isGoalEvent(e) && e.clubId !== playerClubId).length;
    const isLosing = opponentGoals > playerGoals;
    const deficit = opponentGoals - playerGoals;

    // Check for opponent goal just scored
    const justConceded = events.filter(e => isGoalEvent(e) && e.clubId !== playerClubId && e.minute === minute);
    if (justConceded.length > 0) {
      const key = `goal-conceded-${minute}`;
      if (!dismissedMomentsRef.current.has(key)) {
        dismissedMomentsRef.current.add(key);
        return { type: 'goal_conceded', description: `Goal conceded! You're now ${isLosing ? 'behind' : 'level'}. React?` };
      }
    }

    // Check for red card against player's team
    const redCard = events.filter(e => e.type === 'red_card' && e.clubId === playerClubId && e.minute === minute);
    if (redCard.length > 0) {
      const key = `red-${minute}`;
      if (!dismissedMomentsRef.current.has(key)) {
        dismissedMomentsRef.current.add(key);
        return { type: 'red_card', description: 'Red card! Down to 10 men. Adjust tactics?' };
      }
    }

    // Injury to a player on your team — always notify, auto-open sub sheet
    const injury = events.filter(e => e.type === 'injury' && e.clubId === playerClubId && e.minute === minute);
    if (injury.length > 0) {
      const key = `injury-${minute}`;
      if (!dismissedMomentsRef.current.has(key)) {
        dismissedMomentsRef.current.add(key);
        return { type: 'injury', description: `${injury[0].description} Make a substitution.`, playerId: injury[0].playerId };
      }
    }

    // Comeback: was down 2+, just scored to narrow gap to 1
    const justScored = events.filter(e => isGoalEvent(e) && e.clubId === playerClubId && e.minute === minute);
    if (justScored.length > 0 && deficit === 1) {
      // Check if we were down by 2+ before this goal
      const prevPlayerGoals = events.filter(e => isGoalEvent(e) && e.clubId === playerClubId && e.minute < minute).length;
      if (opponentGoals - prevPlayerGoals >= 2) {
        const key = `comeback-${minute}`;
        if (!dismissedMomentsRef.current.has(key)) {
          dismissedMomentsRef.current.add(key);
          return { type: 'comeback', description: `You've pulled one back! Just one goal behind now. Push for the equalizer?` };
        }
      }
    }

    // Losing late — offer tactical push
    if (minute === KEY_MOMENT_LOSING_MINUTE && isLosing) {
      const key = 'losing-70';
      if (!dismissedMomentsRef.current.has(key)) {
        dismissedMomentsRef.current.add(key);
        return { type: 'losing_late', description: `You trail with 20 minutes left. Time for changes?` };
      }
    }

    // Tight finish — scores level late (including 0-0)
    if (minute === KEY_MOMENT_TIGHT_FINISH_MINUTE && playerGoals === opponentGoals) {
      const key = 'level-80';
      if (!dismissedMomentsRef.current.has(key)) {
        dismissedMomentsRef.current.add(key);
        const desc = playerGoals === 0
          ? `Still goalless with 10 minutes left. Go all-out or hold for the draw?`
          : `Scores level with 10 minutes left. Go for the win or hold firm?`;
        return { type: 'tight_finish', description: desc };
      }
    }

    // Dominant possession but scoreless — offer tactical change
    if (minute === KEY_MOMENT_DOMINANT_POSSESSION_MIN && playerGoals === 0 && opponentGoals === 0) {
      const shotEvents = events.filter(e => e.type === 'shot_saved' || e.type === 'shot_missed' || e.type === 'hit_woodwork' || e.type === 'goal_line_clearance');
      const playerShots = shotEvents.filter(e => e.clubId === playerClubId).length;
      const totalShots = shotEvents.length;
      if (totalShots > 0 && playerShots / totalShots >= KEY_MOMENT_POSSESSION_THRESHOLD) {
        const key = 'dominant-possession';
        if (!dismissedMomentsRef.current.has(key)) {
          dismissedMomentsRef.current.add(key);
          return { type: 'dominant_possession', description: `You're dominating but can't break through. Change approach?` };
        }
      }
    }

    // Near-miss flurry — opponent creating many dangerous chances in 0-0
    if (playerGoals === 0 && opponentGoals === 0 && minute >= 25) {
      const nearMisses = events.filter(e =>
        (e.type === 'hit_woodwork' || e.type === 'goal_line_clearance') && e.clubId !== playerClubId
      ).length;
      if (nearMisses >= KEY_MOMENT_NEAR_MISS_COUNT) {
        const key = `near-miss-flurry-${nearMisses}`;
        if (!dismissedMomentsRef.current.has(key)) {
          dismissedMomentsRef.current.add(key);
          return { type: 'near_miss_flurry', description: `You're under pressure! ${nearMisses} close calls. Shore up your defence?` };
        }
      }
    }

    return false;
  }, [match, playerClubId]);

  // Use refs to avoid unstable dependencies in the animation effect.
  // checkKeyMoment and matchPhase are read inside the interval callback,
  // but we don't want changes to them to tear down and re-create the interval.
  const checkKeyMomentRef = useRef(checkKeyMoment);
  checkKeyMomentRef.current = checkKeyMoment;
  const matchPhaseRef = useRef(matchPhase);
  matchPhaseRef.current = matchPhase;

  // Animate events for current half
  useEffect(() => {
    if (phase !== 'first_half' && phase !== 'second_half' && phase !== 'extra_time') return;
    if (allEvents.length === 0) return;
    if (keyMoment || paused) return; // Paused for key moment or manual pause

    intervalRef.current = setInterval(() => {
      const next = currentMinRef.current + 1;
      const maxMin = phase === 'first_half' ? 45 : phase === 'extra_time' ? 120 : 90;

      if (next > maxMin) {
        clearInterval(intervalRef.current!);
        if (phase === 'first_half') {
          setPhase('half_time');
        } else if (phase === 'second_half') {
          // Check if cup match needs extra time
          const storePhase = matchPhaseRef.current;
          setPhase(storePhase === 'extra_time' ? 'extra_time_break' : 'post');
        } else {
          // extra_time animation finished
          const storePhase = matchPhaseRef.current;
          setPhase(storePhase === 'penalties' ? 'penalties' : 'post');
        }
        currentMinRef.current = maxMin;
        setCurrentMin(maxMin);
        return;
      }

      const events = allEvents.filter(e => e.minute <= next);
      currentMinRef.current = next;
      setCurrentMin(next);
      setVisibleEvents(events);

      // Check for key moment at this minute
      const moment = checkKeyMomentRef.current(next, events);
      if (moment) {
        clearInterval(intervalRef.current!);
        setKeyMoment(moment);
      }
    }, speed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, allEvents, speed, keyMoment, paused]);

  // Haptic feedback + goal flash for goals and final whistle
  const prevGoalCountRef = useRef(0);
  const [goalFlash, setGoalFlash] = useState(false);
  const goalFlashTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const currentGoalCount = visibleEvents.filter(e => isGoalEvent(e)).length;
  useEffect(() => {
    if (currentGoalCount > prevGoalCountRef.current) {
      hapticHeavy();
      setGoalFlash(true);
      clearTimeout(goalFlashTimerRef.current);
      goalFlashTimerRef.current = setTimeout(() => setGoalFlash(false), GOAL_FLASH_MS);
    }
    prevGoalCountRef.current = currentGoalCount;
  }, [currentGoalCount]);

  useEffect(() => {
    if (phase === 'post') hapticMedium();
  }, [phase]);

  // When penalty shootout finalization completes (matchPhase becomes 'full_time'),
  // transition the local phase from 'penalties' to 'post'
  useEffect(() => {
    if (phase === 'penalties' && matchPhase === 'full_time') {
      setPhase('post');
    }
  }, [matchPhase, phase]);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleEvents.length]);

  const handlePause = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setPaused(true);
  };

  const handleResume = () => {
    setPaused(false);
    // Effect will restart the interval since paused becomes false
  };

  const handleContinue = () => {
    setScreen('match-review');
  };

  const dismissKeyMoment = () => {
    setKeyMoment(null);
    // Resume will happen via useEffect since keyMoment becomes null
  };

  // Memoize injured player IDs to avoid creating new array references on every render
  const injuredPlayerIds = useMemo(
    () => visibleEvents.filter(e => e.type === 'injury' && e.clubId === playerClubId && e.playerId).map(e => e.playerId!),
    [visibleEvents, playerClubId]
  );

  // Per-player card status (yellow or red) for the substitution sheet
  const playerCardStatus = useMemo(() => {
    const map = new Map<string, 'yellow' | 'red'>();
    for (const e of visibleEvents) {
      if (e.type === 'red_card' && e.playerId) {
        map.set(e.playerId, 'red');
      } else if (e.type === 'yellow_card' && e.playerId) {
        const yellowCount = visibleEvents.filter(ev => ev.type === 'yellow_card' && ev.playerId === e.playerId).length;
        map.set(e.playerId, yellowCount >= 2 ? 'red' : 'yellow');
      }
    }
    return map;
  }, [visibleEvents]);

  // Per-player match stats (goals & assists) for the substitution sheet
  const playerMatchStats = useMemo(() => {
    const map = new Map<string, { goals: number; assists: number }>();
    for (const e of visibleEvents) {
      if (isGoalEvent(e) && e.playerId) {
        const prev = map.get(e.playerId) || { goals: 0, assists: 0 };
        prev.goals++;
        map.set(e.playerId, prev);
      }
      if (isGoalEvent(e) && e.assistPlayerId) {
        const prev = map.get(e.assistPlayerId) || { goals: 0, assists: 0 };
        prev.assists++;
        map.set(e.assistPlayerId, prev);
      }
    }
    return map;
  }, [visibleEvents]);

  // Players who were subbed on during this match
  const subbedOnPlayerIds = useMemo(
    () => new Set(visibleEvents.filter(e => e.type === 'substitution' && e.playerId).map(e => e.playerId!)),
    [visibleEvents]
  );

  // Auto-open substitution sheet when an injury key moment fires
  useEffect(() => {
    if (keyMoment?.type === 'injury' && keyMoment.playerId) {
      setSubSheetOpen(true);
      setInjurySubMode(true);
    }
  }, [keyMoment]);

  // Live match stats derived from visible events (must be before early return for hooks rules)
  const matchHomeClubId = match?.homeClubId;
  const liveStats = useMemo(() => {
    let hShots = 0, aShots = 0, hSoT = 0, aSoT = 0, hFouls = 0, aFouls = 0;
    let hGoals = 0, aGoals = 0, hYellows = 0, aYellows = 0, hReds = 0, aReds = 0;
    let lastMomentum = 0, lastHomeXG = 0, lastAwayXG = 0;
    for (const ev of visibleEvents) {
      if (!matchHomeClubId) continue;
      const isHomeEv = ev.clubId === matchHomeClubId;
      if (isGoalEvent(ev)) {
        if (isHomeEv) { hShots++; hSoT++; } else { aShots++; aSoT++; }
      } else if (ev.type === 'shot_saved' || ev.type === 'goal_line_clearance') {
        if (isHomeEv) { hShots++; hSoT++; } else { aShots++; aSoT++; }
      } else if (ev.type === 'shot_missed' || ev.type === 'hit_woodwork') {
        if (isHomeEv) hShots++; else aShots++;
      } else if (ev.type === 'foul' || ev.type === 'yellow_card' || ev.type === 'red_card') {
        if (isHomeEv) hFouls++; else aFouls++;
      }
      if (isGoalEvent(ev)) { if (isHomeEv) hGoals++; else aGoals++; }
      if (ev.type === 'yellow_card') { if (isHomeEv) hYellows++; else aYellows++; }
      if (ev.type === 'red_card') { if (isHomeEv) hReds++; else aReds++; }
      if (ev.momentum !== undefined) lastMomentum = ev.momentum;
      if (ev.homeXG !== undefined) { lastHomeXG = ev.homeXG; lastAwayXG = ev.awayXG ?? 0; }
    }
    return {
      hShots, aShots, hSoT, aSoT, hFouls, aFouls,
      hGoals, aGoals, hYellows, aYellows, hReds, aReds,
      lastMomentum, lastHomeXG, lastAwayXG,
    };
  }, [visibleEvents, matchHomeClubId]);

  // Latest fitness snapshot from events
  const latestFitness = useMemo(() => {
    for (let i = visibleEvents.length - 1; i >= 0; i--) {
      if (visibleEvents[i].playerFitness) return visibleEvents[i].playerFitness!;
    }
    return null;
  }, [visibleEvents]);

  // Tactical insights: first-half from state, second-half from kickoff event (must be before early return)
  const tacticalInsights = useMemo(() => {
    if (phase === 'second_half' || phase === 'extra_time') {
      const secondKickoff = visibleEvents.find(e => e.type === 'kickoff' && e.minute >= 46 && e.tacticalInsight);
      return secondKickoff?.tacticalInsight ? [secondKickoff.tacticalInsight] : [];
    }
    return firstHalfState?.tacticalInsights ?? [];
  }, [phase, visibleEvents, firstHalfState]);

  if (!match || !homeClub || !awayClub) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <GlassPanel className="p-8 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No match scheduled this week.</p>
            <Button className="mt-4" onClick={() => setScreen('dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </GlassPanel>
        </motion.div>
      </div>
    );
  }

  const isLive = phase === 'first_half' || phase === 'second_half' || phase === 'extra_time';
  const homeGoals = phase === 'pre' ? 0 : liveStats.hGoals;
  const awayGoals = phase === 'pre' ? 0 : liveStats.aGoals;
  const homeYellowCards = liveStats.hYellows;
  const awayYellowCards = liveStats.aYellows;
  const homeRedCards = liveStats.hReds;
  const awayRedCards = liveStats.aReds;
  const homePlayersOnPitch = Math.max(7, 11 - homeRedCards);
  const awayPlayersOnPitch = Math.max(7, 11 - awayRedCards);

  // Use firstHalfState for half-time display
  const htHomeGoals = firstHalfState?.homeGoals ?? homeGoals;
  const htAwayGoals = firstHalfState?.awayGoals ?? awayGoals;

  // Momentum & xG: derived from memoized liveStats scan
  const currentMomentum = liveStats.lastMomentum; // -100 (away) to +100 (home)
  const homeMomPct = Math.round(50 + currentMomentum / 2); // 0-100 scale
  const liveHomeXG = liveStats.lastHomeXG;
  const liveAwayXG = liveStats.lastAwayXG;

  // Shout cooldown check
  const lastShout = matchShouts[matchShouts.length - 1];
  const shoutOnCooldown = lastShout ? currentMin - lastShout.startMinute < SHOUT_COOLDOWN : false;
  const shoutsRemaining = MAX_SHOUTS_PER_MATCH - matchShouts.length;
  const activeShout = matchShouts.find(s => currentMin >= s.startMinute && currentMin < s.startMinute + SHOUT_DURATION);

  const stadiumTheme = getActiveCosmetic(monetization, 'stadium_theme');
  const pitchSkin = getActiveCosmetic(monetization, 'pitch_skin');
  const isPlayerHome = match?.homeClubId === playerClubId;
  const venueClub = match ? clubs[match.homeClubId] : null;
  const awayBarColor = homeClub && awayClub && areColorsSimilar(homeClub.color, awayClub.color) ? '#FFFFFF' : awayClub?.color;

  const FormationPicker = () => (
    <div>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Formation</p>
      <div className="flex gap-1 flex-wrap">
        {FORMATIONS.map(f => (
          <button
            key={f}
            onClick={() => { hapticLight(); setFormation(f); infoToast(`Switched to ${f}`); }}
            className={cn(
              'px-2 py-1 rounded text-[9px] font-semibold transition-all',
              clubs[playerClubId]?.formation === f
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/40'
            )}
          >{f}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={cn("max-w-lg mx-auto px-4 py-4 space-y-3", stadiumTheme && `stadium-${stadiumTheme.replace('stadium-', '')}`, pitchSkin && `pitch-${pitchSkin.replace('pitch-', '')}`)}>
      {phase === 'pre' && <PageHint screen="matchDay" title={PAGE_HINTS.matchDay.title} body={PAGE_HINTS.matchDay.body} />}
      {/* Score Header */}
      <GlassPanel className={cn("p-5 transition-all duration-300", goalFlash && "border-primary/60 shadow-[0_0_20px_hsl(var(--primary)/0.3)]")}>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider text-center mb-1">
          {phase === 'pre' ? `Week ${week}${isCupMatch ? ' — Cup' : ''}` : phase === 'half_time' ? 'Half Time' : phase === 'extra_time_break' ? 'Extra Time' : phase === 'penalties' ? 'Penalties' : isLive ? `${currentMin}'` : 'Full Time'}
        </p>
        {currentMatchResult?.weather && (
          <p className="text-[9px] text-muted-foreground/60 text-center mb-2">
            {currentMatchResult.weather.weather === 'rain' ? '🌧 Rain' : currentMatchResult.weather.weather === 'snow' ? '❄️ Snow' : currentMatchResult.weather.weather === 'wind' ? '💨 Wind' : '☀️ Clear'}
            {currentMatchResult.weather.pitch !== 'good' && currentMatchResult.weather.pitch !== 'excellent' ? ` · ${currentMatchResult.weather.pitch} pitch` : ''}
          </p>
        )}
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-bold" style={{ backgroundColor: homeClub.color, color: homeClub.secondaryColor }}>{homeClub.shortName}</div>
            <p className="text-xs font-bold text-foreground">{homeClub.shortName}</p>
            {(homeYellowCards > 0 || homeRedCards > 0) && (
              <div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-semibold">
                {homeYellowCards > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-1.5 py-0.5 text-amber-300">
                    <YellowCardIcon size={10} /> {homeYellowCards}
                  </span>
                )}
                {homeRedCards > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-400/50 bg-red-500/20 px-1.5 py-0.5 text-red-300 animate-pulse">
                    <RedCardIcon size={10} /> {homeRedCards}
                  </span>
                )}
              </div>
            )}
            {homeRedCards > 0 && (
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-red-300">
                {homePlayersOnPitch} men
              </p>
            )}
          </div>
          <div className="text-center">
            <p className="text-4xl font-black text-foreground tabular-nums font-display flex items-center justify-center gap-1">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={phase === 'half_time' ? `ht-h-${htHomeGoals}` : `h-${homeGoals}`}
                  initial={{ scale: 1.4, color: 'hsl(160, 84%, 39%)' }}
                  animate={{ scale: 1, color: 'hsl(0, 0%, 95%)' }}
                  transition={{ duration: 0.4, type: 'spring', stiffness: 300 }}
                >
                  {phase === 'half_time' ? htHomeGoals : homeGoals}
                </motion.span>
              </AnimatePresence>
              <span>-</span>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={phase === 'half_time' ? `ht-a-${htAwayGoals}` : `a-${awayGoals}`}
                  initial={{ scale: 1.4, color: 'hsl(160, 84%, 39%)' }}
                  animate={{ scale: 1, color: 'hsl(0, 0%, 95%)' }}
                  transition={{ duration: 0.4, type: 'spring', stiffness: 300 }}
                >
                  {phase === 'half_time' ? htAwayGoals : awayGoals}
                </motion.span>
              </AnimatePresence>
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-bold" style={{ backgroundColor: awayClub.color, color: awayClub.secondaryColor }}>{awayClub.shortName}</div>
            <p className="text-xs font-bold text-foreground">{awayClub.shortName}</p>
            {(awayYellowCards > 0 || awayRedCards > 0) && (
              <div className="mt-1 flex items-center justify-center gap-1 text-[9px] font-semibold">
                {awayYellowCards > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-1.5 py-0.5 text-amber-300">
                    <YellowCardIcon size={10} /> {awayYellowCards}
                  </span>
                )}
                {awayRedCards > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-400/50 bg-red-500/20 px-1.5 py-0.5 text-red-300 animate-pulse">
                    <RedCardIcon size={10} /> {awayRedCards}
                  </span>
                )}
              </div>
            )}
            {awayRedCards > 0 && (
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-red-300">
                {awayPlayersOnPitch} men
              </p>
            )}
          </div>
        </div>

        {/* Live xG Tracker */}
        {(isLive || phase === 'half_time' || phase === 'extra_time_break') && (liveHomeXG > 0 || liveAwayXG > 0) && (
          <div className="flex justify-between mt-2 text-[9px] text-muted-foreground/70 tabular-nums">
            <span>xG: {liveHomeXG.toFixed(2)}</span>
            <span>xG: {liveAwayXG.toFixed(2)}</span>
          </div>
        )}

        {(isLive || phase === 'half_time' || phase === 'extra_time_break') && (
          <div className="mt-2">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${(currentMin / (phase === 'extra_time' ? 120 : 90)) * 100}%` }} />
            </div>
          </div>
        )}
      </GlassPanel>

      {/* Momentum Meter & Tactical Insights */}
      {isLive && (
        <div className="px-1 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Possession</span>
            <span className="tabular-nums">{homeMomPct}% - {100 - homeMomPct}%</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
            <motion.div
              className={cn('rounded-full', currentMomentum > 70 && 'animate-pulse')}
              animate={{ width: `${homeMomPct}%` }}
              transition={{ duration: 0.7 }}
              style={{ backgroundColor: homeClub.color, ...(currentMomentum > 70 ? { boxShadow: `0 0 12px ${homeClub.color}` } : {}) }}
            />
            <motion.div
              className={cn('rounded-full flex-1', currentMomentum < -70 && 'animate-pulse')}
              style={{ backgroundColor: awayBarColor, ...(currentMomentum < -70 ? { boxShadow: `0 0 12px ${awayBarColor}` } : {}) }}
            />
          </div>
          {/* Momentum label */}
          {Math.abs(currentMomentum) > 40 && (
            <p className="text-[9px] text-center font-semibold" style={{ color: currentMomentum > 0 ? homeClub.color : awayBarColor }}>
              <Activity className="w-3 h-3 inline mr-0.5" />
              {Math.abs(currentMomentum) > 70 ? 'Dominant' : 'Building'} momentum for {currentMomentum > 0 ? homeClub.shortName : awayClub.shortName}
            </p>
          )}
          {/* Tactical Insight Pill */}
          {tacticalInsights.length > 0 && (currentMin <= 10 || (currentMin >= 46 && currentMin <= 55)) && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-primary/15 text-primary border border-primary/25">
                <Zap className="w-2.5 h-2.5" />
                {tacticalInsights[0]}
              </span>
            </motion.div>
          )}
          {/* Active Shout Indicator */}
          {activeShout && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Megaphone className="w-2.5 h-2.5" />
                {activeShout.type === 'push_forward' ? 'PUSH FORWARD!' : activeShout.type === 'hold_the_line' ? 'HOLD THE LINE!' : activeShout.type === 'calm_down' ? 'CALM DOWN!' : 'TIME WASTE!'}
                <span className="text-amber-400/60 ml-1">({activeShout.startMinute + SHOUT_DURATION - currentMin}' left)</span>
              </span>
            </motion.div>
          )}
        </div>
      )}

      {/* Pre-match — Ready to Kick Off */}
      {phase === 'pre' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassPanel className="p-5 space-y-4 overflow-hidden relative">
            {/* Club-colored accent line */}
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: clubs[playerClubId]?.color }} />

            {/* Competition Badge */}
            {competitionInfo && (
              <div className="text-center mb-1">
                <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border', competitionInfo.bg)}>
                  <Trophy className="w-3 h-3" />
                  <span className={competitionInfo.color}>{competitionInfo.name}</span>
                  <span className="text-muted-foreground/60">—</span>
                  <span className={competitionInfo.color}>{competitionInfo.round}</span>
                </span>
              </div>
            )}

            {/* Home/Away Badge */}
            <div className="text-center space-y-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest',
                  isPlayerHome
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-muted/40 text-muted-foreground border border-border/50'
                )}
              >
                {isPlayerHome ? (
                  <><Shield className="w-3 h-3" /> Home</>
                ) : (
                  <><ArrowLeft className="w-3 h-3" /> Away</>
                )}
              </span>
            </div>

            {/* Stadium info */}
            {venueClub?.stadiumName && (
              <div className="text-center space-y-0.5">
                <div className="flex items-center justify-center gap-1.5 text-xs text-foreground/80">
                  <MapPin className="w-3.5 h-3.5 text-primary/70" />
                  <span className="font-medium">{venueClub.stadiumName}</span>
                </div>
                {venueClub.stadiumCapacity && (
                  <p className="text-[10px] text-muted-foreground/60">
                    Capacity: {venueClub.stadiumCapacity.toLocaleString()}
                  </p>
                )}
              </div>
            )}

            <p className="text-sm font-bold text-foreground text-center">Ready to Kick Off?</p>

            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span>{homeClub.shortName}: {clubs[match.homeClubId]?.formation || '4-3-3'}</span>
              <span className="text-primary font-bold">vs</span>
              <span>{awayClub.shortName}: {clubs[match.awayClubId]?.formation || '4-3-3'}</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-[10px] text-muted-foreground">Speed:</span>
              <button
                type="button"
                onClick={() => setSpeed(200)}
                className={cn('px-2.5 py-1 rounded text-[10px] font-medium transition-all', speed === 200 ? 'bg-primary/20 text-primary' : 'bg-muted/30 text-muted-foreground')}
              >Normal</button>
              <button
                type="button"
                onClick={() => setSpeed(50)}
                className={cn('px-2.5 py-1 rounded text-[10px] font-medium transition-all', speed === 50 ? 'bg-primary/20 text-primary' : 'bg-muted/30 text-muted-foreground')}
              >Fast</button>
            </div>
            <Button className="w-full h-12 text-base font-bold gap-2" onClick={() => { hapticLight(); kickOff(); }}>
              <Play className="w-5 h-5" /> Kick Off
            </Button>
          </GlassPanel>
        </motion.div>
      )}

      {/* Half Time — subs and tactical changes */}
      {phase === 'half_time' && (
        <>
          <GlassPanel className="p-4 text-center">
            <p className="text-sm font-bold text-primary mb-2">Half Time</p>
            <p className="text-xs text-muted-foreground">
              {homeGoals === 0 && awayGoals === 0
                ? 'Neither side has broken through. This is a tactical battle — consider changing your approach.'
                : 'Make substitutions and tactical changes before the second half.'}
            </p>
          </GlassPanel>

          {/* Team Talk */}
          <GlassPanel className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Team Talk</p>
            <div className="flex gap-2">
              {TEAM_TALK_OPTIONS.map(talk => {
                const TalkIcon = talk.id === 'motivate' ? Flame : talk.id === 'calm' ? Shield : AlertTriangle;
                return (
                  <button
                    key={talk.id}
                    onClick={() => {
                      hapticLight();
                      setTeamTalk(talk.id as TeamTalkType);
                      infoToast(`"${talk.description}"`);
                    }}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-lg transition-colors",
                      matchTeamTalk === talk.id
                        ? 'bg-primary/20 border border-primary/40'
                        : 'bg-muted/30 hover:bg-primary/10'
                    )}
                  >
                    <TalkIcon className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-semibold text-foreground">{talk.label}</span>
                  </button>
                );
              })}
            </div>
          </GlassPanel>

          {/* Sub button at half-time */}
          {matchSubsUsed < MAX_SUBSTITUTIONS && (
            <GlassPanel className="p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Substitutions</p>
              <Button className="w-full gap-2" onClick={() => setSubSheetOpen(true)}>
                <RefreshCw className="w-4 h-4" /> Make Substitution ({MAX_SUBSTITUTIONS - matchSubsUsed} left)
              </Button>
            </GlassPanel>
          )}

          {/* Tactical changes at half-time */}
          <GlassPanel className="p-4 space-y-3">
            {/* Formation Switch at Half-Time */}
            <FormationPicker />
            <TacticalPanel variant="full" tactics={tactics} setTactics={setTactics} />
          </GlassPanel>

          {/* First half events recap */}
          {visibleEvents.length > 0 && (
            <GlassPanel className="p-4 max-h-40 overflow-y-auto">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">First Half</p>
              <div className="space-y-1">
                {visibleEvents.filter(e => !['kickoff', 'half_time'].includes(e.type)).map((ev, i) => {
                  const style = getCommentaryStyle(ev);
                  return (
                    <div key={i} className={cn('flex items-start gap-2 text-xs', style.textClass)}>
                      <span className="font-mono w-6 shrink-0 text-primary tabular-nums">{ev.minute}'</span>
                      <span className="flex-1">{getEnrichedDescription(ev, visibleEvents, match.homeClubId, playerClubId === match.homeClubId)}</span>
                    </div>
                  );
                })}
              </div>
            </GlassPanel>
          )}

          <div className="h-16" /> {/* spacer for sticky button */}
          <div className="fixed left-0 right-0 z-30 px-4 pb-2 pt-2 bg-gradient-to-t from-background via-background to-transparent" style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="max-w-lg mx-auto">
              <Button className="w-full h-12 text-base font-bold gap-2" onClick={resumeSecondHalf}>
                <Play className="w-5 h-5" /> Start 2nd Half
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Extra Time Break — cup match drawn after 90 mins */}
      {phase === 'extra_time_break' && (
        <>
          <GlassPanel className="p-4 text-center">
            <p className="text-sm font-bold text-primary mb-2">Extra Time</p>
            <p className="text-xs text-muted-foreground">The scores are level after 90 minutes. 30 minutes of extra time will be played.</p>
          </GlassPanel>

          {/* Sub button before extra time */}
          {matchSubsUsed < MAX_SUBSTITUTIONS && (
            <Button className="w-full gap-2" onClick={() => setSubSheetOpen(true)}>
              <RefreshCw className="w-4 h-4" /> Make Substitution ({MAX_SUBSTITUTIONS - matchSubsUsed} left)
            </Button>
          )}

          {/* Tactical changes before extra time */}
          <GlassPanel className="p-4">
            <TacticalPanel variant="full" tactics={tactics} setTactics={setTactics} />
          </GlassPanel>

          <div className="h-16" /> {/* spacer for sticky button */}
          <div className="fixed left-0 right-0 z-30 px-4 pb-2 pt-2 bg-gradient-to-t from-background via-background to-transparent" style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="max-w-lg mx-auto">
              <Button className="w-full h-12 text-base font-bold gap-2" onClick={resumeExtraTime}>
                <Play className="w-5 h-5" /> Play Extra Time
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Penalties — cup match still drawn after extra time */}
      {phase === 'penalties' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {penaltyShootoutKicks.length === 0 ? (
            <GlassPanel className="p-5 space-y-4 text-center mb-20">
              <p className="text-sm font-bold text-primary">Penalty Shootout</p>
              <p className="text-xs text-muted-foreground">Still level after extra time. This match will be decided by penalties.</p>
              <Button className="w-full h-12 text-base font-bold gap-2" onClick={handlePenalties}>
                <Play className="w-5 h-5" /> Take Penalties
              </Button>
            </GlassPanel>
          ) : (
            <div className="mb-20">
              <PenaltyShootout />
            </div>
          )}
        </motion.div>
      )}

      {/* Live Controls (first or second half) — hidden during key moments */}
      {isLive && !keyMoment && (
        <>
          {paused ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
              <GlassPanel className="p-4 border-primary/40 space-y-3">
                <div className="flex items-center gap-2">
                  <Pause className="w-4 h-4 text-primary" />
                  <p className="text-sm font-bold text-foreground">Match Paused — {currentMin}'</p>
                </div>

                <TacticalPanel variant="compact" tactics={tactics} setTactics={setTactics} />

                {/* In-Match Formation Switch */}
                <FormationPicker />

                {matchSubsUsed < MAX_SUBSTITUTIONS && (
                  <button
                    onClick={() => setSubSheetOpen(true)}
                    className="w-full py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" /> Make Substitution ({MAX_SUBSTITUTIONS - matchSubsUsed} left)
                  </button>
                )}

                {/* Player Fitness Dashboard */}
                <div>
                  <button
                    onClick={() => setShowFitness(!showFitness)}
                    className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider w-full"
                  >
                    <Users className="w-3 h-3" /> Squad Fitness
                    {showFitness ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                  </button>
                  {showFitness && latestFitness && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {clubs[playerClubId]?.lineup.filter(Boolean).map(pid => {
                        const p = players[pid];
                        if (!p) return null;
                        const fit = latestFitness[pid] ?? p.fitness;
                        const fitColor = fit > 70 ? 'bg-emerald-500' : fit > MATCH_LOW_FITNESS_THRESHOLD ? 'bg-amber-500' : 'bg-red-500';
                        return (
                          <div key={pid} className="flex items-center gap-2 text-[10px]">
                            <span className="w-5 text-muted-foreground">{p.position}</span>
                            <span className="w-20 truncate text-foreground">{p.lastName}</span>
                            <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full transition-all', fitColor)} style={{ width: `${fit}%` }} />
                            </div>
                            <span className={cn('w-8 text-right tabular-nums', fit <= MATCH_LOW_FITNESS_THRESHOLD ? 'text-red-400' : 'text-muted-foreground')}>{Math.round(fit)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Live Match Stats */}
                <div>
                  <button
                    onClick={() => setShowStats(!showStats)}
                    className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider w-full"
                  >
                    <BarChart3 className="w-3 h-3" /> Match Stats
                    {showStats ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                  </button>
                  {showStats && (
                    <div className="mt-2 space-y-1.5">
                      {[
                        { label: 'Shots', home: liveStats.hShots, away: liveStats.aShots },
                        { label: 'On Target', home: liveStats.hSoT, away: liveStats.aSoT },
                        { label: 'Fouls', home: liveStats.hFouls, away: liveStats.aFouls },
                        { label: 'xG', home: liveHomeXG, away: liveAwayXG, decimal: true },
                      ].map(stat => {
                        const total = (stat.home as number) + (stat.away as number) || 1;
                        const homePct = ((stat.home as number) / total) * 100;
                        return (
                          <div key={stat.label} className="text-[10px]">
                            <div className="flex justify-between text-muted-foreground mb-0.5">
                              <span className="tabular-nums">{stat.decimal ? (stat.home as number).toFixed(2) : stat.home}</span>
                              <span className="text-foreground/60">{stat.label}</span>
                              <span className="tabular-nums">{stat.decimal ? (stat.away as number).toFixed(2) : stat.away}</span>
                            </div>
                            <div className="flex h-1 rounded-full overflow-hidden gap-0.5">
                              <div className="rounded-full transition-all" style={{ width: `${homePct}%`, backgroundColor: homeClub.color }} />
                              <div className="rounded-full flex-1" style={{ backgroundColor: awayBarColor }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={handleResume}>
                    <Play className="w-3.5 h-3.5 mr-1.5" /> Resume
                  </Button>
                  <button
                    onClick={() => setSpeed(s => s === 200 ? 50 : 200)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted/40 text-foreground hover:bg-muted/60 border border-border/30 transition-all"
                  >
                    <FastForward className="w-3.5 h-3.5" /> {speed === 50 ? 'Normal' : 'Fast'}
                  </button>
                </div>
              </GlassPanel>
            </motion.div>
          ) : (
            <div className="space-y-2">
              {/* Quick Mentality Strip — change on the fly without pausing */}
              <div className="flex gap-1">
                {MENTALITIES.map(m => (
                  <button
                    key={m.value}
                    onClick={() => { hapticLight(); setTactics({ mentality: m.value }); }}
                    className={cn(
                      'flex-1 py-1 rounded-md text-[9px] font-semibold capitalize transition-all',
                      tactics.mentality === m.value
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-muted/30 text-muted-foreground'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Touchline Shouts */}
              {shoutsRemaining > 0 && !shoutOnCooldown && (
                <div className="flex gap-1">
                  {([
                    { type: 'push_forward' as ShoutType, label: 'Push!', icon: '🔥' },
                    { type: 'hold_the_line' as ShoutType, label: 'Hold!', icon: '🛡️' },
                    { type: 'calm_down' as ShoutType, label: 'Calm!', icon: '✋' },
                    ...(currentMin >= 80 ? [{ type: 'time_waste' as ShoutType, label: 'Waste!', icon: '⏰' }] : []),
                  ]).map(s => (
                    <button
                      key={s.type}
                      onClick={() => {
                        hapticMedium();
                        const success = activateShout(s.type, currentMin);
                        if (success) infoToast(`${s.label} — Effect active for ${SHOUT_DURATION} minutes`);
                      }}
                      className="flex-1 py-1.5 rounded-md text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 active:scale-[0.97] transition-all"
                    >
                      <Megaphone className="w-3 h-3 mx-auto mb-0.5" />
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              {shoutOnCooldown && shoutsRemaining > 0 && (
                <p className="text-[9px] text-center text-muted-foreground/50">Shout on cooldown ({shoutsRemaining} left)</p>
              )}
              {shoutsRemaining === 0 && (
                <p className="text-[9px] text-center text-muted-foreground/50">No shouts remaining</p>
              )}

              <div className="flex justify-between items-center">
                <button
                  onClick={handlePause}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted/40 text-foreground hover:bg-muted/60 active:scale-[0.97] border border-border/30 transition-all"
                >
                  <Pause className="w-3.5 h-3.5" /> Pause
                </button>
                <button
                  onClick={() => setSpeed(s => s === 200 ? 50 : 200)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted/40 text-foreground hover:bg-muted/60 active:scale-[0.97] border border-border/30 transition-all"
                >
                  <FastForward className="w-3.5 h-3.5" /> {speed === 50 ? 'Normal' : 'Fast'}
                </button>
              </div>
            </div>
          )}

          {/* Event Log */}
          <GlassPanel className="p-4 max-h-[30vh] overflow-y-auto">
            <div className="space-y-2" aria-live="polite" aria-label="Match events">
              {visibleEvents.filter(e => e.type !== 'kickoff').map((ev, i) => {
                const style = getCommentaryStyle(ev);
                const isCardEvent = ev.type === 'yellow_card' || ev.type === 'red_card';
                const isAITactical = ev.type === 'ai_tactical_change';
                const cardStyle = ev.type === 'yellow_card'
                  ? 'border-amber-400/45 bg-amber-500/10 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
                  : ev.type === 'red_card'
                    ? 'border-red-500/55 bg-red-500/15 shadow-[0_0_14px_rgba(239,68,68,0.25)]'
                    : '';
                const aiTacticalStyle = isAITactical ? 'border-blue-400/30 bg-blue-500/10 rounded-lg border px-2 py-1.5' : '';
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-2 text-sm animate-[fadeSlideIn_0.2s_ease-out]',
                      isCardEvent && 'rounded-lg border px-2 py-1.5',
                      cardStyle,
                      aiTacticalStyle,
                      style.textClass
                    )}
                  >
                    <span className="text-xs font-mono w-8 shrink-0 text-primary tabular-nums">{ev.minute}'</span>
                    {ev.type === 'yellow_card' && <span className="leading-none mt-0.5"><YellowCardIcon size={12} /></span>}
                    {ev.type === 'red_card' && <span className="leading-none mt-0.5"><RedCardIcon size={12} /></span>}
                    {isAITactical && <span className="leading-none mt-0.5"><Layers className="w-3 h-3 text-blue-400" /></span>}
                    <span className={cn('flex-1', isAITactical && 'text-blue-300 italic')}>{getEnrichedDescription(ev, visibleEvents, match.homeClubId, playerClubId === match.homeClubId)}</span>
                    <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: clubs[ev.clubId]?.color || '#888' }} />
                  </div>
                );
              })}
              <div ref={eventsEndRef} />
            </div>
          </GlassPanel>
        </>
      )}

      {/* Key Moment Decision Overlay — injury moments handled by SubstitutionSheet directly */}
      {keyMoment && keyMoment.type !== 'injury' && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
          <GlassPanel className="p-4 border-primary/40">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold text-foreground">Key Moment — {currentMin}'</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{keyMoment.description}</p>

            {/* Branching Choices */}
            {KEY_MOMENT_CHOICES[keyMoment.type] && (
              <div className="space-y-2 mb-3">
                {KEY_MOMENT_CHOICES[keyMoment.type].map((choice: KeyMomentChoice, idx: number) => {
                  const ChoiceIcon = choice.icon === 'Flame' ? Flame : choice.icon === 'Shield' ? Shield : choice.icon === 'ShieldCheck' ? ShieldCheck : choice.icon === 'Zap' ? Zap : choice.icon === 'RefreshCw' ? RefreshCw : choice.icon === 'Layers' ? Layers : choice.icon === 'AlertTriangle' ? AlertTriangle : Zap;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        hapticLight();
                        if (choice.openSubSheet) {
                          setSubSheetOpen(true);
                        }
                        if (choice.tactics) {
                          setTactics(choice.tactics);
                          infoToast(`Tactical change: ${choice.label}`);
                        }
                        if (choice.suggestFormation) {
                          setFormation(choice.suggestFormation);
                          infoToast(`Formation changed to ${choice.suggestFormation}`);
                        }
                        if (!choice.openSubSheet) {
                          dismissKeyMoment();
                        }
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 active:scale-[0.98] border border-border/30 transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                        <ChoiceIcon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">{choice.label}</p>
                        <p className="text-[10px] text-muted-foreground">{choice.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Customize option — expand to full tactical panel */}
            <button
              onClick={() => setShowCustomTactics(!showCustomTactics)}
              className="w-full text-[10px] text-muted-foreground/60 hover:text-muted-foreground py-1 mb-2 transition-colors"
            >
              {showCustomTactics ? 'Hide custom tactics' : 'Customize tactics manually...'}
            </button>
            {showCustomTactics && (
              <div className="mb-3">
                <TacticalPanel variant="compact" tactics={tactics} setTactics={setTactics} />
              </div>
            )}

            {/* Quick sub button */}
            {matchSubsUsed < MAX_SUBSTITUTIONS && (
              <button
                onClick={() => setSubSheetOpen(true)}
                className="w-full py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground hover:bg-muted/50 mb-2 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" /> Make Substitution ({MAX_SUBSTITUTIONS - matchSubsUsed} left)
              </button>
            )}

            <Button size="sm" className="w-full" onClick={() => { setShowCustomTactics(false); dismissKeyMoment(); }}>
              <Play className="w-3.5 h-3.5 mr-1.5" /> Continue Match
            </Button>
          </GlassPanel>
        </motion.div>
      )}

      {/* Post-match popup → navigates directly to Match Review */}
      {phase === 'post' && (
        <PostMatchPopup onContinue={handleContinue} />
      )}

      {/* Substitution Sheet — used from half-time, key moments, injuries, and paused play */}
      <SubstitutionSheet
        open={subSheetOpen}
        onOpenChange={(open) => {
          if (!open && injurySubMode) return; // prevent dismissal in injury mode
          setSubSheetOpen(open);
        }}
        onSubMade={() => {
          if (injurySubMode) {
            setInjurySubMode(false);
            dismissKeyMoment();
          }
        }}
        preSelectedOutId={keyMoment?.type === 'injury' ? keyMoment.playerId : undefined}
        forceMode={injurySubMode}
        onDismissWithoutSub={() => {
          setInjurySubMode(false);
          setSubSheetOpen(false);
          dismissKeyMoment();
        }}
        injuredPlayerIds={injuredPlayerIds}
        playerGoals={playerClubId === match?.homeClubId ? homeGoals : awayGoals}
        opponentGoals={playerClubId === match?.homeClubId ? awayGoals : homeGoals}
        matchMinute={currentMin}
        homeGoals={homeGoals}
        awayGoals={awayGoals}
        homeShortName={homeClub?.shortName}
        awayShortName={awayClub?.shortName}
        isPlayerHome={playerClubId === match?.homeClubId}
        playerCardStatus={playerCardStatus}
        playerMatchStats={playerMatchStats}
        subbedOnPlayerIds={subbedOnPlayerIds}
      />
    </div>
  );
};

export default MatchDay;
