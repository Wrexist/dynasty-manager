import * as Sentry from '@sentry/react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubstitutionSheet } from '@/components/game/SubstitutionSheet';
import { Button } from '@/components/ui/button';
import { MatchEvent, Match, Club, ContinentalTournamentState, TeamTalkType } from '@/types/game';
import { resolveClub } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, FastForward, Pause, RefreshCw, Zap, Flame, Shield, AlertTriangle, Calendar, MapPin, Trophy, Hand, Clock, type LucideIcon } from 'lucide-react';
import { hapticHeavy, hapticMedium, hapticLight, hapticSuccess } from '@/utils/haptics';
import { KEY_MOMENT_LOSING_MINUTE, KEY_MOMENT_TIGHT_FINISH_MINUTE, MAX_SUBSTITUTIONS, KEY_MOMENT_DOMINANT_POSSESSION_MIN, KEY_MOMENT_POSSESSION_THRESHOLD, KEY_MOMENT_NEAR_MISS_COUNT, SHOUT_DURATION, SHOUT_COOLDOWN, MAX_SHOUTS_PER_MATCH, MATCH_LOW_FITNESS_THRESHOLD, FITNESS_DEGRADE_PER_MINUTE, PRESSING_FITNESS_DRAIN_PER_POINT, PRESSING_FITNESS_DRAIN_BASELINE, TEMPO_FAST_FITNESS_DRAIN_MOD, TEMPO_SLOW_FITNESS_DRAIN_MOD } from '@/config/matchEngine';
import { MOTIVATE_FITNESS_DRAIN_MULT, CALM_FITNESS_DRAIN_MULT, DEMAND_FITNESS_DRAIN_MULT } from '@/config/teamTalk';
import type { HalfState } from '@/engine/match';
import type { ShoutType, KeyMomentChoice } from '@/types/game';
import { useCurrentMatch } from '@/hooks/useGameSelectors';
import { getCompetitionInfo } from '@/utils/competitionBadge';
import { PostMatchPopup } from '@/components/game/PostMatchPopup';
import { TacticalPanel } from '@/components/game/TacticalPanel';
import { enrichDescription } from '@/utils/matchCommentary';
import { CommentaryRow } from '@/components/game/CommentaryRow';
import { isStructuredEvent } from '@/utils/matchEventDisplay';
import { MATCH_SPEEDS, DEFAULT_MATCH_SPEED } from '@/config/matchSpeed';
import { analyzeHalftime } from '@/config/halftimeAnalysis';
import { TEAM_TALK_OPTIONS } from '@/config/ui';
import { MENTALITIES, getAvailableFormations } from '@/config/tactics';
import { KEY_MOMENT_CHOICES } from '@/config/keyMoments';
import { infoToast } from '@/utils/gameToast';
import { PageHint } from '@/components/game/PageHint';
import { ScoreHeader } from '@/components/matchday/ScoreHeader';
import { MatchSpeedPicker } from '@/components/matchday/MatchSpeedPicker';
import { PAGE_HINTS, GOAL_FLASH_MS } from '@/config/ui';
import { getActiveCosmetic, isPro } from '@/utils/monetization';
import { hasPerk } from '@/utils/managerPerks';
import { areColorsSimilar } from '@/utils/uiHelpers';
import { PenaltyShootout } from '@/components/game/PenaltyShootout';
import { Megaphone, BarChart3, Activity, ChevronDown, ChevronUp, Users, ShieldCheck, Layers } from 'lucide-react';

import { GOAL_EVENT_TYPES, GOAL_SHOT_TYPES } from '@/config/matchEngine';
const isGoalEvent = (e: MatchEvent) => (GOAL_EVENT_TYPES as readonly string[]).includes(e.type);
const isScoreChangingEvent = (e: MatchEvent) => isGoalEvent(e) || e.type === 'own_goal';

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
    if (isScoreChangingEvent(e)) {
      if (e.clubId === homeClubId) hg++; else ag++;
    }
    if (e === ev) break;
  }
  return enrichDescription(ev, { homeGoals: hg, awayGoals: ag, homeClubId, isPlayerHome, minute: ev.minute });
}

/** Build a short summary of non-default tactical settings, e.g. "Attacking · Fast · Wide" */
function getTacticsSummary(t: { mentality: string; tempo: string; width: string; defensiveLine: string; pressingIntensity: number }): string {
  const parts: string[] = [];
  if (t.mentality !== 'balanced') parts.push(t.mentality === 'all-out-attack' ? 'All-Out' : t.mentality.charAt(0).toUpperCase() + t.mentality.slice(1));
  if (t.tempo !== 'normal') parts.push(t.tempo === 'fast' ? 'Fast' : 'Slow');
  if (t.width !== 'normal') parts.push(t.width === 'wide' ? 'Wide' : 'Narrow');
  if (t.defensiveLine !== 'normal') parts.push(t.defensiveLine === 'high' ? 'High Line' : 'Deep');
  if (t.pressingIntensity > 62) parts.push('Heavy Press');
  else if (t.pressingIntensity < 38) parts.push('Low Press');
  return parts.length ? parts.join(' · ') : 'Balanced';
}

const MatchDayInner = () => {
  const { playerClubId, week, clubs, matchSubsUsed, tactics, cup, leagueCup, championsCup, shieldCup, conferenceCup, virtualClubs, currentCupTieId, domesticSuperCup, continentalSuperCup, monetization, matchPhase, matchTeamTalk, penaltyShootoutKicks } = useGameStore(useShallow(s => ({
    playerClubId: s.playerClubId,
    week: s.week,
    clubs: s.clubs,
    matchSubsUsed: s.matchSubsUsed,
    tactics: s.tactics,
    cup: s.cup,
    leagueCup: s.leagueCup,
    championsCup: s.championsCup,
    shieldCup: s.shieldCup,
    conferenceCup: s.conferenceCup,
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
  const settings = useGameStore(s => s.settings);
  const updateSettings = useGameStore(s => s.updateSettings);

  const [phase, setPhase] = useState<'pre' | 'first_half' | 'half_time' | 'second_half' | 'extra_time_break' | 'extra_time' | 'penalties' | 'post'>('pre');
  const [firstHalfState, setFirstHalfState] = useState<HalfState | null>(null);
  const [allEvents, setAllEvents] = useState<MatchEvent[]>([]);
  const [currentMin, setCurrentMin] = useState(0);
  const currentMinRef = useRef(0);
  const [visibleEvents, setVisibleEvents] = useState<MatchEvent[]>([]);
  const [speed, setSpeed] = useState(settings.matchSpeed || DEFAULT_MATCH_SPEED);
  const [paused, setPaused] = useState(false);
  const [subSheetOpen, setSubSheetOpen] = useState(false);
  // showTacticUI removed — tactical controls now embedded directly in key moment and half-time UIs
  const [keyMoment, setKeyMoment] = useState<{ type: string; description: string; playerId?: string } | null>(null);
  const [injurySubMode, setInjurySubMode] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showFitness, setShowFitness] = useState(false);
  const [showCustomTactics, setShowCustomTactics] = useState(false);
  const [selectedHalftimePreset, setSelectedHalftimePreset] = useState<string | null>(null);
  const [showHalftimeCustomTactics, setShowHalftimeCustomTactics] = useState(false);
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

  const { match: liveMatch, competition: liveCompetition } = useCurrentMatch();

  // Detect cup match if no league match this week
  const cupTie = !liveMatch ? cup.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;
  const cupMatch = cupTie ? { id: cupTie.id, week: cupTie.week, homeClubId: cupTie.homeClubId, awayClubId: cupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match : null;

  // Detect League Cup match
  const leagueCupTie = !liveMatch && !cupTie ? leagueCup?.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;
  const leagueCupMatch = leagueCupTie ? { id: leagueCupTie.id, week: leagueCupTie.week, homeClubId: leagueCupTie.homeClubId, awayClubId: leagueCupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match : null;

  // Detect continental match (Champions Cup / Shield Cup)
  const champMatch = !liveMatch && !cupTie && !leagueCupTie ? findPlayerContinentalMatchForUI(championsCup, week, playerClubId) : null;
  const shieldMatch = !liveMatch && !cupTie && !leagueCupTie && !champMatch ? findPlayerContinentalMatchForUI(shieldCup, week, playerClubId) : null;
  const confMatch = !liveMatch && !cupTie && !leagueCupTie && !champMatch && !shieldMatch ? findPlayerContinentalMatchForUI(conferenceCup, week, playerClubId) : null;
  const continentalMatchInfo = champMatch || shieldMatch || confMatch;
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
  const competitionBadge = liveCompetition === 'Pre-Season Friendly' ? getCompetitionInfo('Pre-Season Friendly')
    : cupTie ? getCompetitionInfo('Dynasty Cup')
    : leagueCupTie ? getCompetitionInfo('League Cup')
    : champMatch ? getCompetitionInfo('Champions Cup')
    : shieldMatch ? getCompetitionInfo('Shield Cup')
    : confMatch ? getCompetitionInfo('Conference Cup')
    : superCupMatch ? getCompetitionInfo(domesticSuperCup?.week === week ? 'Super Cup' : 'Continental Super Cup')
    : null;
  const competitionRound = cupTie?.round ?? leagueCupTie?.round ?? champMatch?.roundLabel ?? shieldMatch?.roundLabel ?? confMatch?.roundLabel ?? (superCupMatch ? 'Final' : '');
  const competitionInfo = competitionBadge ? { ...competitionBadge, round: competitionRound } : null;

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
    setSelectedHalftimePreset(null);
    setShowHalftimeCustomTactics(false);
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
      Sentry.captureException(err, { tags: { context: 'resumeSecondHalf' } });
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
  const managerProgression = useGameStore(s => s.managerProgression);
  const hasPuppetMaster = hasPerk(managerProgression, 'puppet_master');
  const checkKeyMoment = useCallback((minute: number, events: MatchEvent[]) => {
    if (!match) return false;
    const playerGoals = events.filter(e => isScoreChangingEvent(e) && e.clubId === playerClubId).length;
    const opponentGoals = events.filter(e => isScoreChangingEvent(e) && e.clubId !== playerClubId).length;
    const isLosing = opponentGoals > playerGoals;
    const deficit = opponentGoals - playerGoals;

    // Check for opponent goal just scored
    const justConceded = events.filter(e => isScoreChangingEvent(e) && e.clubId !== playerClubId && e.minute === minute);
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
    const justScored = events.filter(e => isScoreChangingEvent(e) && e.clubId === playerClubId && e.minute === minute);
    if (justScored.length > 0 && deficit === 1) {
      // Check if we were down by 2+ before this goal
      const prevPlayerGoals = events.filter(e => isScoreChangingEvent(e) && e.clubId === playerClubId && e.minute < minute).length;
      if (opponentGoals - prevPlayerGoals >= 2) {
        const key = `comeback-${minute}`;
        if (!dismissedMomentsRef.current.has(key)) {
          dismissedMomentsRef.current.add(key);
          return { type: 'comeback', description: `You've pulled one back! Just one goal behind now. Push for the equalizer?` };
        }
      }
    }

    // Losing late — offer tactical push (puppet_master: also triggers at 55)
    const losingMinute = hasPuppetMaster ? KEY_MOMENT_LOSING_MINUTE - 15 : KEY_MOMENT_LOSING_MINUTE;
    if ((minute === losingMinute || minute === KEY_MOMENT_LOSING_MINUTE) && isLosing) {
      const key = `losing-${minute}`;
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
  }, [match, playerClubId, hasPuppetMaster]);

  // Use refs to avoid unstable dependencies in the animation effect.
  // checkKeyMoment and matchPhase are read inside the interval callback,
  // but we don't want changes to them to tear down and re-create the interval.
  const checkKeyMomentRef = useRef(checkKeyMoment);
  checkKeyMomentRef.current = checkKeyMoment;
  const matchPhaseRef = useRef(matchPhase);
  matchPhaseRef.current = matchPhase;

  // Forward-only pointer into allEvents so each tick advances by O(k) where k
  // is the number of events at the new minute, instead of O(n) where n is the
  // full event list. Reset whenever allEvents reference changes (new half).
  const eventCursorRef = useRef(0);
  useEffect(() => { eventCursorRef.current = 0; }, [allEvents]);

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

      // Advance the cursor while events are at-or-before the new minute. The
      // engine emits events in chronological order, so this is equivalent to
      // `allEvents.filter(e => e.minute <= next)` but O(k) per tick instead
      // of O(n). At "Instant" speed (20ms) this matters: the previous filter
      // was 50× n ops/sec — meaningful on low-end Android.
      let cursor = eventCursorRef.current;
      const total = allEvents.length;
      while (cursor < total && allEvents[cursor].minute <= next) cursor++;
      const cursorChanged = cursor !== eventCursorRef.current;
      eventCursorRef.current = cursor;
      currentMinRef.current = next;
      setCurrentMin(next);
      // Only allocate a new visibleEvents slice when the cursor actually
      // moved. Most ticks have no new events, especially on Instant speed.
      const events = cursorChanged ? allEvents.slice(0, cursor) : null;
      if (events) setVisibleEvents(events);

      // Check for key moment at this minute. Pass the cursor-truncated slice
      // when we computed one; otherwise re-use the last visibleEvents reference
      // (key-moment heuristics only care about events up to `next`).
      const moment = checkKeyMomentRef.current(next, events ?? allEvents.slice(0, cursor));
      if (moment) {
        clearInterval(intervalRef.current!);
        setKeyMoment(moment);
      }
    }, speed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, allEvents, speed, keyMoment, paused]);

  // Persist speed preference to settings so it carries across matches.
  // Intentionally depends only on `speed`: `settings.matchSpeed` would cause
  // a feedback loop after updateSettings lands, and `updateSettings` is a
  // stable Zustand action (referentially stable across renders).
  useEffect(() => {
    if (speed !== settings.matchSpeed) updateSettings({ matchSpeed: speed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  // Haptic feedback + goal flash for goals and final whistle.
  // Differentiate by which side scored: success "ding" when the user's club
  // scores, heavy impact when the opponent does. For every score-changing
  // event (goals AND own_goals) the engine writes ev.clubId as the
  // BENEFITING team, so a simple equality check is correct — no inversion.
  // (match.ts:1637 pushes own_goal with clubId: club.id, where `club` is
  // the attacking side that gets credited.)
  const prevGoalCountRef = useRef(0);
  const [goalFlash, setGoalFlash] = useState(false);
  const goalFlashTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const scoreChangingEvents = useMemo(
    () => visibleEvents.filter(e => isScoreChangingEvent(e)),
    [visibleEvents],
  );
  const currentGoalCount = scoreChangingEvents.length;
  useEffect(() => {
    if (currentGoalCount > prevGoalCountRef.current) {
      const latest = scoreChangingEvents[scoreChangingEvents.length - 1];
      const userScored = latest?.clubId === playerClubId;
      if (userScored) hapticSuccess(); else hapticHeavy();
      setGoalFlash(true);
      clearTimeout(goalFlashTimerRef.current);
      goalFlashTimerRef.current = setTimeout(() => setGoalFlash(false), GOAL_FLASH_MS);
    }
    prevGoalCountRef.current = currentGoalCount;
  }, [currentGoalCount, scoreChangingEvents, playerClubId]);

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

  // Force-close SubstitutionSheet when match ends to prevent overlay blocking PostMatchPopup
  useEffect(() => {
    if (phase === 'post') {
      setSubSheetOpen(false);
      setInjurySubMode(false);
    }
  }, [phase]);

  useEffect(() => {
    // Auto-scroll the live event feed. At Instant match speed the event
    // count climbs many times per second; stacking smooth-scroll animations
    // janks low-end Android. `behavior: 'instant'` snaps without queueing
    // animations — the feed still tracks the latest event, just without the
    // compounding-animation cost.
    eventsEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
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
      if ((GOAL_SHOT_TYPES as readonly string[]).includes(ev.type)) {
        if (isHomeEv) { hShots++; hSoT++; } else { aShots++; aSoT++; }
      } else if (ev.type === 'shot_saved' || ev.type === 'goal_line_clearance') {
        if (isHomeEv) { hShots++; hSoT++; } else { aShots++; aSoT++; }
      } else if (ev.type === 'shot_missed' || ev.type === 'hit_woodwork') {
        if (isHomeEv) hShots++; else aShots++;
      } else if (ev.type === 'foul' || ev.type === 'yellow_card' || ev.type === 'red_card') {
        if (isHomeEv) hFouls++; else aFouls++;
      }
      if (isScoreChangingEvent(ev)) { if (isHomeEv) hGoals++; else aGoals++; }
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

  const userIsPro = isPro(monetization);
  const stadiumTheme = getActiveCosmetic(monetization, 'stadium_theme');
  const pitchSkin = getActiveCosmetic(monetization, 'pitch_skin');
  const isPlayerHome = match?.homeClubId === playerClubId;
  const venueClub = match ? clubs[match.homeClubId] : null;
  const awayBarColor = homeClub && awayClub && areColorsSimilar(homeClub.color, awayClub.color) ? '#FFFFFF' : awayClub?.color;

  const FormationPicker = () => (
    <div>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Formation</p>
      <div className="flex gap-1 flex-wrap">
        {getAvailableFormations(hasPerk(managerProgression, 'formation_master')).map(f => (
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
      <ScoreHeader
        phase={phase}
        week={week}
        currentMin={currentMin}
        isLive={isLive}
        isCupMatch={isCupMatch}
        homeClub={homeClub}
        awayClub={awayClub}
        homeGoals={homeGoals}
        awayGoals={awayGoals}
        htHomeGoals={htHomeGoals}
        htAwayGoals={htAwayGoals}
        homeYellowCards={homeYellowCards}
        homeRedCards={homeRedCards}
        awayYellowCards={awayYellowCards}
        awayRedCards={awayRedCards}
        homePlayersOnPitch={homePlayersOnPitch}
        awayPlayersOnPitch={awayPlayersOnPitch}
        liveHomeXG={liveHomeXG}
        liveAwayXG={liveAwayXG}
        goalFlash={goalFlash}
      />

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
                  {competitionInfo.round && (
                    <>
                      <span className="text-muted-foreground/60">—</span>
                      <span className={competitionInfo.color}>{competitionInfo.round}</span>
                    </>
                  )}
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
            <MatchSpeedPicker
              speed={speed}
              userIsPro={userIsPro}
              onSelect={setSpeed}
              onLockedSelect={() => setScreen('shop')}
            />
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

          {/* Halftime Tactics — compact merged panel */}
          {firstHalfState && match && (() => {
            const analysis = analyzeHalftime(firstHalfState, playerClubId, match.homeClubId);
            return (
              <GlassPanel className="p-4">
                {/* Header: label + current tactical summary */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tactics</p>
                  </div>
                  <p className="text-[10px] text-primary font-medium">{clubs[playerClubId]?.formation} · {getTacticsSummary(tactics)}</p>
                </div>

                {/* Situational headline */}
                <p className="text-xs font-bold text-foreground mb-2.5">{analysis.headline}</p>

                {/* Quick-apply preset pills */}
                <div className="flex gap-1.5 mb-3">
                  {analysis.choices.map((choice, idx) => {
                    const isActive = selectedHalftimePreset === choice.label;
                    const ChoiceIcon = choice.icon === 'Flame' ? Flame : choice.icon === 'Shield' ? Shield : choice.icon === 'ShieldCheck' ? ShieldCheck : choice.icon === 'Zap' ? Zap : choice.icon === 'RefreshCw' ? RefreshCw : choice.icon === 'Layers' ? Layers : Zap;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          hapticLight();
                          if (choice.openSubSheet) setSubSheetOpen(true);
                          if (choice.tactics) {
                            setTactics(choice.tactics);
                            setSelectedHalftimePreset(choice.label);
                            infoToast(`Tactical change: ${choice.label}`);
                          }
                          if (choice.suggestFormation) {
                            setFormation(choice.suggestFormation);
                            infoToast(`Formation changed to ${choice.suggestFormation}`);
                          }
                          if (!choice.tactics && !choice.suggestFormation) {
                            setSelectedHalftimePreset(choice.label);
                          }
                        }}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[10px] font-semibold transition-all active:scale-[0.97]",
                          isActive
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border/30'
                        )}
                      >
                        <ChoiceIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{choice.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Inline formation picker */}
                <FormationPicker />

                {/* Expandable custom tactics */}
                <button
                  onClick={() => setShowHalftimeCustomTactics(!showHalftimeCustomTactics)}
                  className="w-full text-[10px] text-muted-foreground/60 hover:text-muted-foreground py-1.5 mt-2 transition-colors flex items-center justify-center gap-1"
                >
                  {showHalftimeCustomTactics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showHalftimeCustomTactics ? 'Hide custom tactics' : 'Fine-tune tactics...'}
                </button>
                {showHalftimeCustomTactics && (
                  <div className="mt-2">
                    <TacticalPanel variant="compact" tactics={tactics} setTactics={(partial) => { setSelectedHalftimePreset(null); setTactics(partial); }} />
                  </div>
                )}
              </GlassPanel>
            );
          })()}

          {/* Team Talk */}
          <GlassPanel className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Team Talk</p>
              <p className="text-[9px] text-muted-foreground/60">Your words affect intensity & energy</p>
            </div>
            <div className="space-y-2">
              {TEAM_TALK_OPTIONS.map(talk => {
                const TalkIcon = talk.id === 'motivate' ? Flame : talk.id === 'calm' ? Shield : AlertTriangle;
                const isSelected = matchTeamTalk === talk.id;
                return (
                  <button
                    key={talk.id}
                    onClick={() => {
                      hapticLight();
                      setTeamTalk(talk.id as TeamTalkType);
                      infoToast(`"${talk.description}"`);
                    }}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-xl transition-all text-left",
                      isSelected
                        ? 'bg-primary/15 border border-primary/50 shadow-[0_0_12px_rgba(var(--primary-rgb,234,179,8),0.1)]'
                        : 'bg-muted/20 border border-transparent hover:bg-muted/40'
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 p-1.5 rounded-lg shrink-0",
                      isSelected ? 'bg-primary/20' : 'bg-muted/30'
                    )}>
                      <TalkIcon className={cn("w-4 h-4", isSelected ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-semibold", isSelected ? 'text-primary' : 'text-foreground')}>{talk.label}</span>
                        {isSelected && <span className="text-[8px] text-primary/70 uppercase tracking-wider font-medium">Selected</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 italic">"{talk.description}"</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {talk.effects.map((effect, i) => (
                          <span
                            key={i}
                            className={cn(
                              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium",
                              effect.type === 'positive' && 'bg-emerald-500/15 text-emerald-400',
                              effect.type === 'negative' && 'bg-red-500/15 text-red-400',
                              effect.type === 'warning' && 'bg-amber-500/15 text-amber-400',
                            )}
                          >
                            {(effect.label.toLowerCase().includes('energy') || effect.label.toLowerCase().includes('drain')) && (
                              <Zap className="w-2.5 h-2.5" />
                            )}
                            {effect.label}
                          </span>
                        ))}
                      </div>
                    </div>
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

          {/* First half events recap */}
          {visibleEvents.length > 0 && (
            <GlassPanel className="p-4 max-h-40 overflow-y-auto">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">First Half</p>
              <div className="space-y-1.5">
                {visibleEvents
                  .filter(e => !['kickoff', 'half_time', 'commentary'].includes(e.type))
                  .map((ev, i) => (
                    <CommentaryRow
                      key={i}
                      event={ev}
                      players={players}
                      clubs={clubs}
                      fallbackColor={virtualClubs?.[ev.clubId]?.color}
                      compact
                    />
                  ))}
              </div>
            </GlassPanel>
          )}

          {/* Match Speed at half-time */}
          <GlassPanel className="p-3">
            <MatchSpeedPicker
              speed={speed}
              userIsPro={userIsPro}
              onSelect={setSpeed}
              onLockedSelect={() => setScreen('shop')}
            />
          </GlassPanel>

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

          {/* Team Talk before extra time */}
          <GlassPanel className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Team Talk</p>
              <p className="text-[9px] text-muted-foreground/60">Rally the squad before extra time</p>
            </div>
            <div className="space-y-2">
              {TEAM_TALK_OPTIONS.map(talk => {
                const TalkIcon = talk.id === 'motivate' ? Flame : talk.id === 'calm' ? Shield : AlertTriangle;
                const isSelected = matchTeamTalk === talk.id;
                return (
                  <button
                    key={talk.id}
                    onClick={() => {
                      hapticLight();
                      setTeamTalk(talk.id as TeamTalkType);
                      infoToast(`"${talk.description}"`);
                    }}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-xl transition-all text-left",
                      isSelected
                        ? 'bg-primary/15 border border-primary/50 shadow-[0_0_12px_rgba(var(--primary-rgb,234,179,8),0.1)]'
                        : 'bg-muted/20 border border-transparent hover:bg-muted/40'
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 p-1.5 rounded-lg shrink-0",
                      isSelected ? 'bg-primary/20' : 'bg-muted/30'
                    )}>
                      <TalkIcon className={cn("w-4 h-4", isSelected ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-semibold", isSelected ? 'text-primary' : 'text-foreground')}>{talk.label}</span>
                        {isSelected && <span className="text-[8px] text-primary/70 uppercase tracking-wider font-medium">Selected</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 italic">"{talk.description}"</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {talk.effects.map((effect, i) => (
                          <span
                            key={i}
                            className={cn(
                              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium",
                              effect.type === 'positive' && 'bg-emerald-500/15 text-emerald-400',
                              effect.type === 'negative' && 'bg-red-500/15 text-red-400',
                              effect.type === 'warning' && 'bg-amber-500/15 text-amber-400',
                            )}
                          >
                            {(effect.label.toLowerCase().includes('energy') || effect.label.toLowerCase().includes('drain')) && (
                              <Zap className="w-2.5 h-2.5" />
                            )}
                            {effect.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassPanel>

          {/* Sub button before extra time */}
          {matchSubsUsed < MAX_SUBSTITUTIONS && (
            <GlassPanel className="p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Substitutions</p>
              <Button className="w-full gap-2" onClick={() => setSubSheetOpen(true)}>
                <RefreshCw className="w-4 h-4" /> Make Substitution ({MAX_SUBSTITUTIONS - matchSubsUsed} left)
              </Button>
            </GlassPanel>
          )}

          {/* Tactical changes before extra time */}
          <GlassPanel className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tactics</p>
              </div>
              <p className="text-[10px] text-primary font-medium">{clubs[playerClubId]?.formation} · {getTacticsSummary(tactics)}</p>
            </div>
            <FormationPicker />
            <button
              onClick={() => setShowHalftimeCustomTactics(!showHalftimeCustomTactics)}
              className="w-full text-[10px] text-muted-foreground/60 hover:text-muted-foreground py-1.5 mt-2 transition-colors flex items-center justify-center gap-1"
            >
              {showHalftimeCustomTactics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showHalftimeCustomTactics ? 'Hide custom tactics' : 'Fine-tune tactics...'}
            </button>
            {showHalftimeCustomTactics && (
              <div className="mt-2">
                <TacticalPanel variant="compact" tactics={tactics} setTactics={setTactics} />
              </div>
            )}
          </GlassPanel>

          {/* Match Speed before extra time */}
          <GlassPanel className="p-3">
            <MatchSpeedPicker
              speed={speed}
              userIsPro={userIsPro}
              onSelect={setSpeed}
              onLockedSelect={() => setScreen('shop')}
            />
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
              <GlassPanel className="p-4 border-primary/40 space-y-4">
                {/* Header — centered with thin divider for a calmer pause moment */}
                <div className="flex flex-col items-center gap-1 pb-3 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <Pause className="w-4 h-4 text-primary" />
                    <p className="text-sm font-bold text-foreground tracking-wide">Match Paused</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{currentMin}'</p>
                </div>

                {/* Tactical sliders — same Liquid Glass control as the Tactics page */}
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold">Adjustments</p>
                  <TacticalPanel variant="compact" tactics={tactics} setTactics={setTactics} />
                </div>

                {/* Formation */}
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider font-semibold">Formation</p>
                  <FormationPicker />
                </div>

                {/* Primary action — substitution */}
                {matchSubsUsed < MAX_SUBSTITUTIONS && (
                  <button
                    onClick={() => setSubSheetOpen(true)}
                    className="w-full py-2.5 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.985] transition-all"
                  >
                    <RefreshCw className="w-4 h-4" /> Make Substitution
                    <span className="text-[10px] font-medium opacity-70">({MAX_SUBSTITUTIONS - matchSubsUsed} left)</span>
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
                  {showFitness && latestFitness && (() => {
                    // Compute current drain multiplier for display and predictions
                    const talkMult = matchTeamTalk === 'motivate' ? MOTIVATE_FITNESS_DRAIN_MULT
                      : matchTeamTalk === 'demand' ? DEMAND_FITNESS_DRAIN_MULT
                      : matchTeamTalk === 'calm' ? CALM_FITNESS_DRAIN_MULT : 1;
                    let tacticalMult = 1;
                    if (tactics.pressingIntensity > PRESSING_FITNESS_DRAIN_BASELINE) {
                      tacticalMult += (tactics.pressingIntensity - PRESSING_FITNESS_DRAIN_BASELINE) * PRESSING_FITNESS_DRAIN_PER_POINT;
                    }
                    if (tactics.tempo === 'fast') tacticalMult *= TEMPO_FAST_FITNESS_DRAIN_MOD;
                    else if (tactics.tempo === 'slow') tacticalMult *= TEMPO_SLOW_FITNESS_DRAIN_MOD;
                    const totalMult = talkMult * tacticalMult;
                    const endMin = phase === 'extra_time' ? 120 : 90;
                    const remainingMin = Math.max(0, endMin - currentMin);
                    return (
                      <div className="mt-2 space-y-1.5">
                        {/* Drain context label */}
                        {(phase === 'second_half' || phase === 'extra_time') && totalMult !== 1 && (
                          <div className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium",
                            totalMult > 1.05 ? 'bg-red-500/10 text-red-400' : totalMult < 0.95 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted/20 text-muted-foreground'
                          )}>
                            <Zap className="w-2.5 h-2.5" />
                            Energy drain: {totalMult.toFixed(2)}x
                            {matchTeamTalk !== 'none' && (
                              <span className="text-muted-foreground/60 ml-1">
                                ({matchTeamTalk === 'demand' ? 'Demand More' : matchTeamTalk === 'calm' ? 'Stay Calm' : 'Motivate'}
                                {tacticalMult !== 1 ? ` + tactics` : ''})
                              </span>
                            )}
                          </div>
                        )}
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {clubs[playerClubId]?.lineup.filter(Boolean).map(pid => {
                            const p = players[pid];
                            if (!p) return null;
                            const fit = latestFitness[pid] ?? p.fitness;
                            const predicted = Math.max(0, Math.round(fit - remainingMin * FITNESS_DEGRADE_PER_MINUTE * totalMult));
                            const fitColor = fit > 70 ? 'bg-emerald-500' : fit > MATCH_LOW_FITNESS_THRESHOLD ? 'bg-amber-500' : 'bg-red-500';
                            return (
                              <div key={pid} className="flex items-center gap-2 text-[10px]">
                                <span className="w-5 text-muted-foreground">{p.position}</span>
                                <span className="w-16 truncate text-foreground">{p.lastName}</span>
                                <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                                  <div className={cn('h-full rounded-full transition-all', fitColor)} style={{ width: `${fit}%` }} />
                                </div>
                                <span className={cn('w-7 text-right tabular-nums', fit <= MATCH_LOW_FITNESS_THRESHOLD ? 'text-red-400' : 'text-muted-foreground')}>{Math.round(fit)}%</span>
                                {remainingMin > 5 && (
                                  <span className={cn('w-10 text-right tabular-nums text-[9px]', predicted <= MATCH_LOW_FITNESS_THRESHOLD ? 'text-red-400/70' : 'text-muted-foreground/50')}>
                                    ~{predicted}%
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
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

                <div className="flex gap-2 pt-1">
                  <Button className="flex-1 h-11 text-sm font-bold gap-2" onClick={handleResume}>
                    <Play className="w-4 h-4" /> Resume
                  </Button>
                  <button
                    onClick={() => {
                      const available = MATCH_SPEEDS.filter(s => !s.pro || userIsPro);
                      const idx = available.findIndex(s => s.value === speed);
                      const next = available[(idx + 1) % available.length];
                      setSpeed(next.value);
                    }}
                    className="flex items-center gap-1.5 px-4 h-11 rounded-xl text-xs font-semibold bg-muted/40 text-foreground hover:bg-muted/60 border border-border/30 transition-all"
                  >
                    <FastForward className="w-3.5 h-3.5" /> {MATCH_SPEEDS.find(s => s.value === speed)?.label ?? 'Normal'}
                  </button>
                </div>
              </GlassPanel>
            </motion.div>
          ) : (
            <div className="space-y-2">
              {/* Active Team Talk indicator — shows effect badges during live play */}
              {matchTeamTalk !== 'none' && (phase === 'second_half' || phase === 'extra_time') && (() => {
                const activeTalk = TEAM_TALK_OPTIONS.find(t => t.id === matchTeamTalk);
                if (!activeTalk) return null;
                const TalkIcon = activeTalk.id === 'motivate' ? Flame : activeTalk.id === 'calm' ? Shield : AlertTriangle;
                return (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                    <TalkIcon className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-[9px] font-semibold text-primary">{activeTalk.label}</span>
                    <div className="flex flex-wrap gap-1 ml-auto">
                      {activeTalk.effects.map((effect, i) => (
                        <span
                          key={i}
                          className={cn(
                            "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-medium",
                            effect.type === 'positive' && 'bg-emerald-500/15 text-emerald-400',
                            effect.type === 'negative' && 'bg-red-500/15 text-red-400',
                            effect.type === 'warning' && 'bg-amber-500/15 text-amber-400',
                          )}
                        >
                          {(effect.label.toLowerCase().includes('energy') || effect.label.toLowerCase().includes('drain')) && (
                            <Zap className="w-2 h-2" />
                          )}
                          {effect.label}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Mentality — connected segmented pill with endpoint icons */}
              <div className="relative flex items-center bg-muted/20 rounded-lg border border-border/30 p-0.5">
                <Shield className="w-3 h-3 text-muted-foreground/30 ml-1.5 shrink-0" />
                {MENTALITIES.map((m, idx) => (
                  <button
                    key={m.value}
                    onClick={() => { hapticLight(); setTactics({ mentality: m.value }); }}
                    aria-label={`Set mentality to ${m.label}`}
                    className={cn(
                      'relative z-10 flex-1 py-1.5 text-[9px] font-semibold capitalize transition-all',
                      idx === 0 && 'rounded-l-md',
                      idx === MENTALITIES.length - 1 && 'rounded-r-md',
                      tactics.mentality === m.value
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tactics.mentality === m.value && (
                      <motion.div
                        layoutId="mentality-indicator"
                        className="absolute inset-0 bg-primary/15 border border-primary/30 rounded-md"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{m.label}</span>
                  </button>
                ))}
                <Flame className="w-3 h-3 text-muted-foreground/30 mr-1.5 shrink-0" />
              </div>

              {/* Unified control row: Pause, Shouts, Speed */}
              <div className="flex items-center gap-1.5">
                {/* Pause */}
                <button
                  onClick={handlePause}
                  aria-label="Pause match"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-muted/30 text-foreground hover:bg-muted/50 active:scale-[0.97] border border-border/30 transition-all"
                >
                  <Pause className="w-3 h-3" /> Pause
                </button>

                {/* Touchline Shouts — compact icon buttons */}
                <div className="flex-1 flex items-center justify-center gap-1">
                  {shoutsRemaining > 0 && !shoutOnCooldown ? ([
                    { type: 'push_forward' as ShoutType, label: 'Push', Icon: Flame },
                    { type: 'hold_the_line' as ShoutType, label: 'Hold', Icon: Shield },
                    { type: 'calm_down' as ShoutType, label: 'Calm', Icon: Hand },
                    ...(currentMin >= 80 ? [{ type: 'time_waste' as ShoutType, label: 'Waste', Icon: Clock }] : []),
                  ] as { type: ShoutType; label: string; Icon: LucideIcon }[]).map(s => (
                    <button
                      key={s.type}
                      onClick={() => {
                        hapticMedium();
                        const success = activateShout(s.type, currentMin);
                        if (success) infoToast(`${s.label} — Effect active for ${SHOUT_DURATION} minutes`);
                      }}
                      className={cn(
                        "p-1.5 rounded-lg active:scale-[0.93] transition-all border",
                        activeShout?.type === s.type
                          ? 'bg-amber-500/25 border-amber-500/40 text-amber-300'
                          : 'bg-amber-500/10 border-amber-500/15 text-amber-400 hover:bg-amber-500/15'
                      )}
                      title={s.label}
                      aria-label={`Shout: ${s.label}`}
                    >
                      <s.Icon className="w-3.5 h-3.5" />
                    </button>
                  )) : (
                    <span className="text-[9px] text-muted-foreground/40">
                      {shoutsRemaining === 0 ? 'No shouts left' : `Cooldown (${SHOUT_COOLDOWN - (currentMin - (lastShout?.startMinute ?? 0))}')`}
                    </span>
                  )}
                  {shoutsRemaining > 0 && !shoutOnCooldown && (
                    <span className="text-[8px] text-muted-foreground/40 ml-0.5">{shoutsRemaining}</span>
                  )}
                </div>

                {/* Speed */}
                <button
                  onClick={() => {
                    const available = MATCH_SPEEDS.filter(s => !s.pro || userIsPro);
                    const idx = available.findIndex(s => s.value === speed);
                    const next = available[(idx + 1) % available.length];
                    setSpeed(next.value);
                  }}
                  aria-label={`Match speed: ${MATCH_SPEEDS.find(s => s.value === speed)?.label ?? 'Normal'}. Tap to change.`}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold active:scale-[0.97] border transition-all",
                    speed < DEFAULT_MATCH_SPEED
                      ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/20'
                      : 'bg-muted/30 text-foreground border-border/30 hover:bg-muted/50'
                  )}
                >
                  <FastForward className="w-3 h-3" /> {MATCH_SPEEDS.find(s => s.value === speed)?.shortLabel ?? '1x'}
                </button>
              </div>
            </div>
          )}

          {/* Event Log */}
          <GlassPanel className="p-4 max-h-[30vh] overflow-y-auto">
            <div className="space-y-2" aria-live="polite" aria-label="Match events">
              {visibleEvents.filter(e => e.type !== 'kickoff').map((ev, i) => {
                // Structured events (goals, cards, shots, subs...) render as
                // clear label-pill + player-chip rows. Ambient commentary and
                // tactical prompts keep their prose styling via CommentaryRow's
                // fallback branch.
                const description = isStructuredEvent(ev.type)
                  ? undefined
                  : getEnrichedDescription(ev, visibleEvents, match.homeClubId, playerClubId === match.homeClubId);
                return (
                  <CommentaryRow
                    key={i}
                    event={ev}
                    players={players}
                    clubs={clubs}
                    fallbackColor={virtualClubs?.[ev.clubId]?.color}
                    description={description}
                  />
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
                          setSelectedHalftimePreset(null);
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
            setSubSheetOpen(false);
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

// Scoped ErrorBoundary so a match-engine render crash falls back to "Return
// to Menu" with telemetry tagged `match`, without taking down the surrounding
// game shell (top bar, bottom nav remain mounted).
const MatchDay = () => (
  <ErrorBoundary scope="match"><MatchDayInner /></ErrorBoundary>
);

export default MatchDay;
