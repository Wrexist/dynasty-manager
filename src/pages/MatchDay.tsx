import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubstitutionSheet } from '@/components/game/SubstitutionSheet';
import { Button } from '@/components/ui/button';
import { MatchEvent, Match, Club, ContinentalTournamentState, VirtualClub } from '@/types/game';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, FastForward, Pause, RefreshCw, Zap, Flame, Shield, AlertTriangle, Calendar, MapPin, Trophy } from 'lucide-react';
import { hapticHeavy, hapticMedium, hapticLight } from '@/utils/haptics';
import { KEY_MOMENT_LOSING_MINUTE, KEY_MOMENT_TIGHT_FINISH_MINUTE, MAX_SUBSTITUTIONS, KEY_MOMENT_DOMINANT_POSSESSION_MIN, KEY_MOMENT_POSSESSION_THRESHOLD, KEY_MOMENT_NEAR_MISS_COUNT } from '@/config/matchEngine';
import type { HalfState } from '@/engine/match';
import { useCurrentMatch } from '@/hooks/useGameSelectors';
import { PostMatchPopup } from '@/components/game/PostMatchPopup';
import { TacticalPanel } from '@/components/game/TacticalPanel';
import { getCommentaryStyle, enrichDescription } from '@/utils/matchCommentary';
import { TEAM_TALK_OPTIONS } from '@/config/ui';
import { infoToast } from '@/utils/gameToast';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS, GOAL_FLASH_MS } from '@/config/ui';
import { getActiveCosmetic } from '@/utils/monetization';
import { areColorsSimilar } from '@/utils/uiHelpers';

const isGoalEvent = (e: MatchEvent) => e.type === 'goal' || e.type === 'own_goal' || e.type === 'penalty_scored';

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

/** Build a minimal Club object from virtualClubs data when clubs[] doesn't have the entry */
function buildVirtualClubFallback(virtualClubs: Record<string, VirtualClub> | undefined, clubId: string): Club | null {
  const vc = virtualClubs?.[clubId];
  if (!vc) return null;
  return { id: clubId, name: vc.name, shortName: vc.shortName, color: vc.color, secondaryColor: vc.secondaryColor, stadiumName: '' } as Club;
}

const MatchDay = () => {
  const store = useGameStore();
  const { playerClubId, week, clubs, playFirstHalf, playSecondHalf, playExtraTime, playPenalties, setScreen, matchSubsUsed, tactics, setTactics, cup, cleanupAbandonedMatch } = store;

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
  const leagueCupTie = !liveMatch && !cupTie ? store.leagueCup?.ties.find(t => t.week === week && !t.played && (t.homeClubId === playerClubId || t.awayClubId === playerClubId)) : null;
  const leagueCupMatch = leagueCupTie ? { id: leagueCupTie.id, week: leagueCupTie.week, homeClubId: leagueCupTie.homeClubId, awayClubId: leagueCupTie.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match : null;

  // Detect continental match (Champions Cup / Shield Cup)
  const champMatch = !liveMatch && !cupTie && !leagueCupTie ? findPlayerContinentalMatchForUI(store.championsCup, week, playerClubId) : null;
  const shieldMatch = !liveMatch && !cupTie && !leagueCupTie && !champMatch ? findPlayerContinentalMatchForUI(store.shieldCup, week, playerClubId) : null;
  const continentalMatchInfo = champMatch || shieldMatch;
  const continentalMatch = continentalMatchInfo ? { id: continentalMatchInfo.id, week, homeClubId: continentalMatchInfo.homeClubId, awayClubId: continentalMatchInfo.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match : null;

  // Detect super cup match
  const superCupMatch = !liveMatch && !cupTie && !leagueCupTie && !continentalMatch ? (() => {
    const dsc = store.domesticSuperCup;
    const csc = store.continentalSuperCup;
    const sc = dsc && !dsc.played && dsc.week === week && (dsc.homeClubId === playerClubId || dsc.awayClubId === playerClubId) ? dsc
      : csc && !csc.played && csc.week === week && (csc.homeClubId === playerClubId || csc.awayClubId === playerClubId) ? csc : null;
    return sc ? { id: `super-cup-${sc.type}`, week, homeClubId: sc.homeClubId, awayClubId: sc.awayClubId, played: false, homeGoals: 0, awayGoals: 0, events: [] } as Match : null;
  })() : null;

  const isCupMatch = !!cupTie || !!leagueCupTie || !!continentalMatch || !!superCupMatch || !!store.currentCupTieId;

  // Competition context for display
  const competitionInfo = cupTie ? { name: 'Dynasty Cup', round: cupTie.round, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' }
    : leagueCupTie ? { name: 'League Cup', round: leagueCupTie.round, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' }
    : champMatch ? { name: 'Champions Cup', round: champMatch.roundLabel, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' }
    : shieldMatch ? { name: 'Shield Cup', round: shieldMatch.roundLabel, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' }
    : superCupMatch ? { name: store.domesticSuperCup?.week === week ? 'Super Cup' : 'Continental Super Cup', round: 'Final', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' }
    : null;

  // Cache match data when kickoff starts — playSecondHalf() marks the fixture
  // as played which makes useCurrentMatch() return undefined mid-animation.
  const matchCacheRef = useRef<{ match: Match; homeClub: Club; awayClub: Club } | null>(null);

  const match = matchCacheRef.current?.match ?? liveMatch ?? cupMatch ?? leagueCupMatch ?? continentalMatch ?? superCupMatch;
  const homeClub = matchCacheRef.current?.homeClub ?? (match ? (clubs[match.homeClubId] || buildVirtualClubFallback(store.virtualClubs, match.homeClubId)) : null);
  const awayClub = matchCacheRef.current?.awayClub ?? (match ? (clubs[match.awayClubId] || buildVirtualClubFallback(store.virtualClubs, match.awayClubId)) : null);
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

  const resumeSecondHalf = () => {
    // Simulate second half with potentially updated lineup/tactics
    const result = playSecondHalf();
    if (!result) return;
    setAllEvents(result.events);
    setPhase('second_half');
    // Continue from minute 46
    currentMinRef.current = 45;
    setCurrentMin(45);
    setPaused(false);
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
    const result = playPenalties();
    if (!result) return;
    // Show all events including penalty events immediately
    setAllEvents(result.events);
    setVisibleEvents(result.events);
    setPhase('post');
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
  const matchPhaseRef = useRef(store.matchPhase);
  matchPhaseRef.current = store.matchPhase;

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

  // Auto-open substitution sheet when an injury key moment fires
  useEffect(() => {
    if (keyMoment?.type === 'injury' && keyMoment.playerId) {
      setSubSheetOpen(true);
      setInjurySubMode(true);
    }
  }, [keyMoment]);

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
  const homeGoals = phase === 'pre' ? 0 : visibleEvents.filter(e => isGoalEvent(e) && e.clubId === match.homeClubId).length;
  const awayGoals = phase === 'pre' ? 0 : visibleEvents.filter(e => isGoalEvent(e) && e.clubId === match.awayClubId).length;

  // Use firstHalfState for half-time display
  const htHomeGoals = firstHalfState?.homeGoals ?? homeGoals;
  const htAwayGoals = firstHalfState?.awayGoals ?? awayGoals;

  // Momentum: use engine-calculated momentum from events, or fall back to event counting
  const latestMomentumEvent = [...visibleEvents].reverse().find(e => e.momentum !== undefined);
  const currentMomentum = latestMomentumEvent?.momentum ?? 0; // -100 (away) to +100 (home)
  const homeMomPct = Math.round(50 + currentMomentum / 2); // 0-100 scale
  const stadiumTheme = getActiveCosmetic(store.monetization, 'stadium_theme');
  const isPlayerHome = match?.homeClubId === playerClubId;
  const venueClub = match ? clubs[match.homeClubId] : null;
  const awayBarColor = homeClub && awayClub && areColorsSimilar(homeClub.color, awayClub.color) ? '#FFFFFF' : awayClub?.color;

  return (
    <div className={cn("max-w-lg mx-auto px-4 py-4 space-y-3", stadiumTheme && `stadium-${stadiumTheme.replace('stadium-', '')}`)}>
      {phase === 'pre' && <PageHint screen="matchDay" title={PAGE_HINTS.matchDay.title} body={PAGE_HINTS.matchDay.body} />}
      {/* Score Header */}
      <GlassPanel className={cn("p-5 transition-all duration-300", goalFlash && "border-primary/60 shadow-[0_0_20px_hsl(43_96%_46%/0.3)]")}>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider text-center mb-3">
          {phase === 'pre' ? `Week ${week}${isCupMatch ? ' — Cup' : ''}` : phase === 'half_time' ? 'Half Time' : phase === 'extra_time_break' ? 'Extra Time' : phase === 'penalties' ? 'Penalties' : isLive ? `${currentMin}'` : 'Full Time'}
        </p>
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-bold" style={{ backgroundColor: homeClub.color, color: homeClub.secondaryColor }}>{homeClub.shortName}</div>
            <p className="text-xs font-bold text-foreground">{homeClub.shortName}</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-black text-foreground tabular-nums font-display flex items-center justify-center gap-1">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={phase === 'half_time' ? `ht-h-${htHomeGoals}` : `h-${homeGoals}`}
                  initial={{ scale: 1.4, color: 'hsl(43, 96%, 46%)' }}
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
                  initial={{ scale: 1.4, color: 'hsl(43, 96%, 46%)' }}
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
          </div>
        </div>

        {(isLive || phase === 'half_time' || phase === 'extra_time_break') && (
          <div className="mt-3">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${(currentMin / (phase === 'extra_time' ? 120 : 90)) * 100}%` }} />
            </div>
          </div>
        )}
      </GlassPanel>

      {/* Momentum Bar */}
      {isLive && currentMin > 5 && (
        <div className="px-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Momentum</span>
            <span>{homeMomPct}% - {100 - homeMomPct}%</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
            <div
              className={cn('rounded-full transition-all duration-700', currentMomentum > 70 && 'animate-pulse')}
              style={{ width: `${homeMomPct}%`, backgroundColor: homeClub.color, ...(currentMomentum > 70 ? { boxShadow: `0 0 12px ${homeClub.color}` } : {}) }}
            />
            <div
              className={cn('rounded-full transition-all duration-700 flex-1', currentMomentum < -70 && 'animate-pulse')}
              style={{ backgroundColor: awayBarColor, ...(currentMomentum < -70 ? { boxShadow: `0 0 12px ${awayBarColor}` } : {}) }}
            />
          </div>
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
              <span>{homeClub.shortName}: {store.clubs[match.homeClubId]?.formation || '4-3-3'}</span>
              <span className="text-primary font-bold">vs</span>
              <span>{awayClub.shortName}: {store.clubs[match.awayClubId]?.formation || '4-3-3'}</span>
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
                      infoToast(`"${talk.description}"`);
                    }}
                    className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-lg bg-muted/30 hover:bg-primary/10 transition-colors"
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
          <GlassPanel className="p-4">
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
          <GlassPanel className="p-5 space-y-4 text-center mb-20">
            <p className="text-sm font-bold text-primary">Penalty Shootout</p>
            <p className="text-xs text-muted-foreground">Still level after extra time. This match will be decided by penalties.</p>
            <Button className="w-full h-12 text-base font-bold gap-2" onClick={handlePenalties}>
              <Play className="w-5 h-5" /> Take Penalties
            </Button>
          </GlassPanel>
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

                {matchSubsUsed < MAX_SUBSTITUTIONS && (
                  <button
                    onClick={() => setSubSheetOpen(true)}
                    className="w-full py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" /> Make Substitution ({MAX_SUBSTITUTIONS - matchSubsUsed} left)
                  </button>
                )}

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
          )}

          {/* Event Log */}
          <GlassPanel className="p-4 max-h-[30vh] overflow-y-auto">
            <div className="space-y-2" aria-live="polite" aria-label="Match events">
              {visibleEvents.filter(e => e.type !== 'kickoff').map((ev, i) => {
                const style = getCommentaryStyle(ev);
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-2 text-sm animate-[fadeSlideIn_0.2s_ease-out]',
                      style.textClass
                    )}
                  >
                    <span className="text-xs font-mono w-8 shrink-0 text-primary tabular-nums">{ev.minute}'</span>
                    <span className="flex-1">{getEnrichedDescription(ev, visibleEvents, match.homeClubId, playerClubId === match.homeClubId)}</span>
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

            <TacticalPanel variant="compact" tactics={tactics} setTactics={setTactics} />

            {/* Quick sub button */}
            {matchSubsUsed < MAX_SUBSTITUTIONS && (
              <button
                onClick={() => setSubSheetOpen(true)}
                className="w-full py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground hover:bg-muted/50 mb-2 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" /> Make Substitution ({MAX_SUBSTITUTIONS - matchSubsUsed} left)
              </button>
            )}

            <Button size="sm" className="w-full" onClick={dismissKeyMoment}>
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
        injuredPlayerIds={visibleEvents.filter(e => e.type === 'injury' && e.clubId === playerClubId && e.playerId).map(e => e.playerId!)}
        playerGoals={playerClubId === match?.homeClubId ? homeGoals : awayGoals}
        opponentGoals={playerClubId === match?.homeClubId ? awayGoals : homeGoals}
        matchMinute={currentMin}
        homeGoals={homeGoals}
        awayGoals={awayGoals}
        homeShortName={homeClub?.shortName}
        awayShortName={awayClub?.shortName}
        isPlayerHome={playerClubId === match?.homeClubId}
      />
    </div>
  );
};

export default MatchDay;
