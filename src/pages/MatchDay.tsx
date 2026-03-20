import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PitchView } from '@/components/game/PitchView';
import { SubstitutionSheet } from '@/components/game/SubstitutionSheet';
import { Button } from '@/components/ui/button';
import { MatchEvent } from '@/types/game';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, FastForward, Pause, RefreshCw, Zap } from 'lucide-react';
import { hapticHeavy, hapticMedium } from '@/utils/haptics';
import type { HalfState } from '@/engine/match';
import { useCurrentMatch, usePlayerClub } from '@/hooks/useGameSelectors';

const MatchDay = () => {
  const store = useGameStore();
  const { playerClubId, week, fixtures, clubs, players, playFirstHalf, playSecondHalf, setScreen, clearMatchResult, matchSubsUsed, tactics, setTactics } = store;

  const [phase, setPhase] = useState<'pre' | 'first_half' | 'half_time' | 'second_half' | 'post'>('pre');
  const [firstHalfState, setFirstHalfState] = useState<HalfState | null>(null);
  const [allEvents, setAllEvents] = useState<MatchEvent[]>([]);
  const [currentMin, setCurrentMin] = useState(0);
  const [visibleEvents, setVisibleEvents] = useState<MatchEvent[]>([]);
  const [speed, setSpeed] = useState(200);
  const [paused, setPaused] = useState(false);
  const [subSheetOpen, setSubSheetOpen] = useState(false);
  const [showTacticUI, setShowTacticUI] = useState(false);
  const [keyMoment, setKeyMoment] = useState<{ type: string; description: string } | null>(null);
  const dismissedMomentsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  const { match } = useCurrentMatch();

  const homeClub = match ? clubs[match.homeClubId] : null;
  const awayClub = match ? clubs[match.awayClubId] : null;
  const playerClub = usePlayerClub();

  const kickOff = () => {
    const halfState = playFirstHalf();
    if (!halfState) return;
    setFirstHalfState(halfState);
    setAllEvents(halfState.events);
    setPhase('first_half');
    setCurrentMin(0);
    setVisibleEvents([]);
    setPaused(false);
  };

  const resumeSecondHalf = () => {
    setShowTacticUI(false);
    // Simulate second half with potentially updated lineup/tactics
    const result = playSecondHalf();
    if (!result) return;
    setAllEvents(result.events);
    setPhase('second_half');
    // Continue from minute 46
    setCurrentMin(45);
    setPaused(false);
  };

  // Detect key moments that should pause the match for player decisions
  const checkKeyMoment = useCallback((minute: number, events: MatchEvent[]) => {
    if (!match || keyMoment) return false;
    const playerGoals = events.filter(e => e.type === 'goal' && e.clubId === playerClubId).length;
    const opponentGoals = events.filter(e => e.type === 'goal' && e.clubId !== playerClubId).length;
    const isLosing = opponentGoals > playerGoals;

    // Check for opponent goal just scored
    const justScored = events.filter(e => e.type === 'goal' && e.clubId !== playerClubId && e.minute === minute);
    if (justScored.length > 0) {
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

    // 70th minute and losing — offer tactical push
    if (minute === 70 && isLosing) {
      const key = 'losing-70';
      if (!dismissedMomentsRef.current.has(key)) {
        dismissedMomentsRef.current.add(key);
        return { type: 'losing_late', description: `You trail with 20 minutes left. Time for changes?` };
      }
    }

    return false;
  }, [match, playerClubId, keyMoment]);

  // Animate events for current half
  useEffect(() => {
    if (phase !== 'first_half' && phase !== 'second_half') return;
    if (allEvents.length === 0) return;
    if (keyMoment || paused) return; // Paused for key moment or manual pause

    intervalRef.current = setInterval(() => {
      setCurrentMin(prev => {
        const next = prev + 1;
        if (next > (phase === 'first_half' ? 45 : 90)) {
          clearInterval(intervalRef.current!);
          if (phase === 'first_half') {
            setPhase('half_time');
          } else {
            setPhase('post');
          }
          return phase === 'first_half' ? 45 : 90;
        }
        const events = allEvents.filter(e => e.minute <= next);
        setVisibleEvents(events);

        // Check for key moment at this minute
        const moment = checkKeyMoment(next, events);
        if (moment) {
          clearInterval(intervalRef.current!);
          setKeyMoment(moment);
        }

        return next;
      });
    }, speed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, allEvents, speed, keyMoment, paused, checkKeyMoment]);

  // Haptic feedback for goals and final whistle
  const prevGoalCountRef = useRef(0);
  useEffect(() => {
    const goalCount = visibleEvents.filter(e => e.type === 'goal').length;
    if (goalCount > prevGoalCountRef.current) {
      hapticHeavy();
    }
    prevGoalCountRef.current = goalCount;
  }, [visibleEvents]);

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
    setShowTacticUI(false);
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

  if (!match || !homeClub || !awayClub) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <GlassPanel className="p-8 text-center">
          <p className="text-muted-foreground">No match scheduled this week.</p>
          <Button className="mt-4" onClick={() => setScreen('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </GlassPanel>
      </div>
    );
  }

  const isLive = phase === 'first_half' || phase === 'second_half';
  const homeGoals = phase === 'pre' ? 0 : visibleEvents.filter(e => e.type === 'goal' && e.clubId === match.homeClubId).length;
  const awayGoals = phase === 'pre' ? 0 : visibleEvents.filter(e => e.type === 'goal' && e.clubId === match.awayClubId).length;

  // Use firstHalfState for half-time display
  const htHomeGoals = firstHalfState?.homeGoals ?? homeGoals;
  const htAwayGoals = firstHalfState?.awayGoals ?? awayGoals;

  // Momentum: count events in last 10 minutes per side
  const recentEvents = visibleEvents.filter(e => e.minute > currentMin - 10);
  const homeMomentum = recentEvents.filter(e => e.clubId === match.homeClubId && ['goal', 'shot_saved', 'shot_missed'].includes(e.type)).length;
  const awayMomentum = recentEvents.filter(e => e.clubId === match.awayClubId && ['goal', 'shot_saved', 'shot_missed'].includes(e.type)).length;
  const totalMomentum = homeMomentum + awayMomentum || 1;
  const homeMomPct = Math.round((homeMomentum / totalMomentum) * 100);

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      {/* Score Header */}
      <GlassPanel className="p-5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider text-center mb-3">
          {phase === 'pre' ? `Week ${week}` : phase === 'half_time' ? 'Half Time' : isLive ? `${currentMin}'` : 'Full Time'}
        </p>
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-bold" style={{ backgroundColor: homeClub.color, color: homeClub.secondaryColor }}>{homeClub.shortName}</div>
            <p className="text-xs font-bold text-foreground">{homeClub.shortName}</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-black text-foreground tabular-nums font-display">
              {phase === 'half_time' ? htHomeGoals : homeGoals} - {phase === 'half_time' ? htAwayGoals : awayGoals}
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-bold" style={{ backgroundColor: awayClub.color, color: awayClub.secondaryColor }}>{awayClub.shortName}</div>
            <p className="text-xs font-bold text-foreground">{awayClub.shortName}</p>
          </div>
        </div>

        {(isLive || phase === 'half_time') && (
          <div className="mt-3">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${(currentMin / 90) * 100}%` }} />
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
            <div className="rounded-full transition-all duration-700" style={{ width: `${homeMomPct}%`, backgroundColor: homeClub.color }} />
            <div className="rounded-full transition-all duration-700 flex-1" style={{ backgroundColor: awayClub.color }} />
          </div>
        </div>
      )}

      {/* Pre-match */}
      {phase === 'pre' && (
        <>
          <PitchView
            formation={homeClub.formation}
            homeColor={homeClub.color}
            awayColor={awayClub.color}
            awayFormation={awayClub.formation}
            showAway
          />
          <Button className="w-full h-12 text-base font-bold gap-2" onClick={kickOff}>
            <Play className="w-5 h-5" /> Kick Off
          </Button>
        </>
      )}

      {/* Half Time — subs and tactical changes */}
      {phase === 'half_time' && (
        <>
          <GlassPanel className="p-4 text-center">
            <p className="text-sm font-bold text-primary mb-2">Half Time</p>
            <p className="text-xs text-muted-foreground">Make substitutions and tactical changes before the second half.</p>
          </GlassPanel>

          {/* Sub button at half-time */}
          {matchSubsUsed < 3 && (
            <Button variant="outline" className="w-full gap-2" onClick={() => setSubSheetOpen(true)}>
              <RefreshCw className="w-4 h-4" /> Make Substitution ({3 - matchSubsUsed} left)
            </Button>
          )}

          {/* Tactical changes at half-time */}
          <GlassPanel className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Adjust Mentality</p>
            <div className="flex gap-1.5">
              {(['defensive', 'cautious', 'balanced', 'attacking', 'all-out-attack'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setTactics({ mentality: m })}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-[10px] font-semibold capitalize transition-all',
                    tactics.mentality === m
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  {m === 'all-out-attack' ? 'All Out' : m}
                </button>
              ))}
            </div>
          </GlassPanel>

          {/* First half events recap */}
          {visibleEvents.length > 0 && (
            <GlassPanel className="p-4 max-h-40 overflow-y-auto">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">First Half</p>
              <div className="space-y-1">
                {visibleEvents.filter(e => !['kickoff', 'half_time'].includes(e.type)).map((ev, i) => (
                  <div key={i} className={cn('flex items-start gap-2 text-xs', ev.type === 'goal' ? 'font-bold text-foreground' : 'text-muted-foreground')}>
                    <span className="font-mono w-6 shrink-0 text-primary tabular-nums">{ev.minute}'</span>
                    <span className="flex-1">{ev.description}</span>
                  </div>
                ))}
              </div>
            </GlassPanel>
          )}

          <Button className="w-full h-12 text-base font-bold gap-2" onClick={resumeSecondHalf}>
            <Play className="w-5 h-5" /> Start 2nd Half
          </Button>
        </>
      )}

      {/* Live Controls (first or second half) — hidden during key moments */}
      {isLive && !keyMoment && (
        <>
          <div className="flex justify-between items-center">
            <div className="flex gap-3">
              {paused ? (
                <>
                  <button onClick={handleResume} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-semibold">
                    <Play className="w-3 h-3" /> Resume
                  </button>
                  {matchSubsUsed < 3 && (
                    <button onClick={() => setSubSheetOpen(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <RefreshCw className="w-3 h-3" /> Sub ({3 - matchSubsUsed})
                    </button>
                  )}
                </>
              ) : (
                <button onClick={handlePause} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Pause className="w-3 h-3" /> Pause
                </button>
              )}
            </div>
            <button onClick={() => setSpeed(s => s === 200 ? 50 : 200)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <FastForward className="w-3 h-3" /> {speed === 50 ? 'Normal' : 'Fast'}
            </button>
          </div>

          {/* Event Log */}
          <GlassPanel className="p-4 max-h-[30vh] overflow-y-auto">
            <div className="space-y-2">
              {visibleEvents.filter(e => e.type !== 'kickoff').map((ev, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2 text-sm animate-[fadeSlideIn_0.2s_ease-out]',
                    ev.type === 'goal' ? 'font-bold text-foreground' : 'text-muted-foreground'
                  )}
                >
                  <span className="text-xs font-mono w-8 shrink-0 text-primary tabular-nums">{ev.minute}'</span>
                  <span className="flex-1">{ev.description}</span>
                  <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: clubs[ev.clubId]?.color }} />
                </div>
              ))}
              <div ref={eventsEndRef} />
            </div>
          </GlassPanel>
        </>
      )}

      {/* Key Moment Decision Overlay */}
      {keyMoment && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
          <GlassPanel className="p-4 border-primary/40">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold text-foreground">Key Moment — {currentMin}'</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{keyMoment.description}</p>

            {/* Quick mentality change */}
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Mentality</p>
            <div className="flex gap-1 mb-3">
              {(['defensive', 'cautious', 'balanced', 'attacking', 'all-out-attack'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setTactics({ mentality: m })}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-[9px] font-semibold capitalize transition-all',
                    tactics.mentality === m
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  {m === 'all-out-attack' ? 'All Out' : m}
                </button>
              ))}
            </div>

            {/* Quick sub button */}
            {matchSubsUsed < 3 && (
              <button
                onClick={() => setSubSheetOpen(true)}
                className="w-full py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground hover:bg-muted/50 mb-2 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" /> Make Substitution ({3 - matchSubsUsed} left)
              </button>
            )}

            <Button size="sm" className="w-full" onClick={dismissKeyMoment}>
              <Play className="w-3.5 h-3.5 mr-1.5" /> Continue Match
            </Button>
          </GlassPanel>
        </motion.div>
      )}

      {/* Post-match → redirect to Match Review */}
      {phase === 'post' && (
        <>
          <GlassPanel className="p-5 text-center">
            <p className="text-sm font-bold text-muted-foreground mb-1">Full Time</p>
            <p className="text-3xl font-black text-foreground font-display tabular-nums">
              {store.currentMatchResult?.homeGoals ?? 0} - {store.currentMatchResult?.awayGoals ?? 0}
            </p>
          </GlassPanel>
          <Button className="w-full h-12 text-base font-bold gap-2" onClick={handleContinue}>
            Match Review
          </Button>
        </>
      )}

      {/* Substitution Sheet — used from half-time, key moments, and paused play */}
      <SubstitutionSheet open={subSheetOpen} onOpenChange={setSubSheetOpen} />
    </div>
  );
};

export default MatchDay;
