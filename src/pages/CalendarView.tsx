import { useRef, useEffect, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ArrowLeft, Calendar, Trophy, Flame, AlertTriangle, Globe, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRoundName, CUP_BYE_MARKER } from '@/data/cup';
import { getDerbyIntensity } from '@/data/league';
import { SUMMER_WINDOW_END, WINTER_WINDOW_START, WINTER_WINDOW_END } from '@/config/transfers';
import { PageHint } from '@/components/game/PageHint';
import { TOTAL_WEEKS, BOARD_REVIEW_WEEKS } from '@/config/gameBalance';
import type { CupRound, Match, CupTie } from '@/types/game';

interface CalendarEntry {
  week: number;
  type: 'league' | 'cup' | 'international' | 'bye';
  match: Match | null;
  cupTie: CupTie | null;
  intlLabel?: string;
}

interface PhaseGroup {
  id: string;
  label: string;
  startWeek: number;
  endWeek: number;
  entries: CalendarEntry[];
  phaseSummary: { wins: number; draws: number; losses: number; total: number };
}

const CalendarView = () => {
  const {
    week, season, fixtures, clubs, playerClubId, setScreen,
    transferWindowOpen, cup, totalWeeks, internationalTournament,
    nationalTeam, currentMatchResult,
  } = useGameStore();
  const currentWeekRef = useRef<HTMLDivElement>(null);
  const phaseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const weekCount = totalWeeks || TOTAL_WEEKS;

  // Build unified calendar: league + cup + international merged by week
  const { entries, stats } = useMemo(() => {
    const playerFixtures = fixtures
      .filter(m => m.homeClubId === playerClubId || m.awayClubId === playerClubId);

    // Filter cup ties, excluding BYE matches
    const playerCupTies = (cup?.ties || [])
      .filter(t =>
        (t.homeClubId === playerClubId || t.awayClubId === playerClubId) &&
        t.awayClubId !== CUP_BYE_MARKER && t.homeClubId !== CUP_BYE_MARKER
      );

    // Map week -> entries
    const weekMap = new Map<number, CalendarEntry[]>();

    for (const match of playerFixtures) {
      const existing = weekMap.get(match.week) || [];
      existing.push({ week: match.week, type: 'league', match, cupTie: null });
      weekMap.set(match.week, existing);
    }

    for (const tie of playerCupTies) {
      const existing = weekMap.get(tie.week) || [];
      existing.push({ week: tie.week, type: 'cup', match: null, cupTie: tie });
      weekMap.set(tie.week, existing);
    }

    // Add international tournament matches (weeks 47+)
    if (internationalTournament && nationalTeam) {
      const managerNation = nationalTeam.nationality;

      // Group stage
      for (const group of internationalTournament.groups) {
        for (const fixture of group.fixtures) {
          if (fixture.homeNation === managerNation || fixture.awayNation === managerNation) {
            const w = fixture.week;
            const existing = weekMap.get(w) || [];
            const oppNation = fixture.homeNation === managerNation ? fixture.awayNation : fixture.homeNation;
            existing.push({
              week: w,
              type: 'international',
              match: null,
              cupTie: null,
              intlLabel: `vs ${oppNation} (${group.name})`,
            });
            weekMap.set(w, existing);
          }
        }
      }

      // Knockout stage
      for (const tie of internationalTournament.knockoutTies) {
        if (tie.homeNation === managerNation || tie.awayNation === managerNation) {
          const w = tie.week;
          const existing = weekMap.get(w) || [];
          const oppNation = tie.homeNation === managerNation ? tie.awayNation : tie.homeNation;
          const roundLabel = tie.round === 'R16' ? 'Round of 16' : tie.round === 'QF' ? 'Quarter-Final' : tie.round === 'SF' ? 'Semi-Final' : 'Final';
          existing.push({
            week: w,
            type: 'international',
            match: null,
            cupTie: null,
            intlLabel: `vs ${oppNation} (${roundLabel})`,
          });
          weekMap.set(w, existing);
        }
      }
    }

    // Determine max week (include international weeks if active)
    const maxWeek = internationalTournament ? Math.max(weekCount, 52) : weekCount;

    // Build flat list ordered by week, with bye weeks included
    const allEntries: CalendarEntry[] = [];
    for (let w = 1; w <= maxWeek; w++) {
      const weekEntries = weekMap.get(w);
      if (weekEntries) {
        // Sort: league first, then cup, then international
        const typeOrder = { league: 0, cup: 1, international: 2, bye: 3 };
        allEntries.push(...weekEntries.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]));
      } else {
        allEntries.push({ week: w, type: 'bye', match: null, cupTie: null });
      }
    }

    // Compute season stats from played league matches only
    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
    for (const m of playerFixtures) {
      if (!m.played) continue;
      const isHome = m.homeClubId === playerClubId;
      const pG = isHome ? m.homeGoals : m.awayGoals;
      const oG = isHome ? m.awayGoals : m.homeGoals;
      goalsFor += pG;
      goalsAgainst += oG;
      if (pG > oG) wins++;
      else if (pG < oG) losses++;
      else draws++;
    }

    return {
      entries: allEntries,
      stats: { wins, draws, losses, goalsFor, goalsAgainst, played: wins + draws + losses },
    };
  }, [fixtures, cup, playerClubId, weekCount, internationalTournament, nationalTeam]);

  // Recent form (last 5 league results)
  const recentForm = useMemo(() => {
    const played = entries
      .filter(e => e.type === 'league' && e.match?.played)
      .slice(-5);
    return played.map(e => {
      const m = e.match!;
      const isHome = m.homeClubId === playerClubId;
      const pG = isHome ? m.homeGoals : m.awayGoals;
      const oG = isHome ? m.awayGoals : m.homeGoals;
      if (pG > oG) return 'W';
      if (pG < oG) return 'L';
      return 'D';
    });
  }, [entries, playerClubId]);

  // Weeks that have both league AND cup (congested fixtures)
  const congestedWeeks = useMemo(() => {
    const weekCounts = new Map<number, Set<string>>();
    for (const e of entries) {
      if (e.type === 'league' || e.type === 'cup') {
        const types = weekCounts.get(e.week) || new Set();
        types.add(e.type);
        weekCounts.set(e.week, types);
      }
    }
    const congested = new Set<number>();
    for (const [w, types] of weekCounts) {
      if (types.size >= 2) congested.add(w);
    }
    return congested;
  }, [entries]);

  // Group entries by phase for section headers
  const phases = useMemo(() => {
    const groups: PhaseGroup[] = [];

    const addPhase = (id: string, label: string, start: number, end: number) => {
      const phaseEntries = entries.filter(e => e.week >= start && e.week <= end);
      if (phaseEntries.length === 0) return;

      // Compute phase W/D/L from league matches only
      let wins = 0, draws = 0, losses = 0, total = 0;
      for (const e of phaseEntries) {
        if (e.type !== 'league' || !e.match?.played) continue;
        total++;
        const isHome = e.match.homeClubId === playerClubId;
        const pG = isHome ? e.match.homeGoals : e.match.awayGoals;
        const oG = isHome ? e.match.awayGoals : e.match.homeGoals;
        if (pG > oG) wins++;
        else if (pG < oG) losses++;
        else draws++;
      }

      groups.push({
        id,
        label,
        startWeek: start,
        endWeek: end,
        entries: phaseEntries,
        phaseSummary: { wins, draws, losses, total },
      });
    };

    addPhase('early', 'Early Season', 1, SUMMER_WINDOW_END);
    addPhase('autumn', 'Autumn', SUMMER_WINDOW_END + 1, WINTER_WINDOW_START - 1);
    addPhase('winter', 'Winter', WINTER_WINDOW_START, WINTER_WINDOW_END);
    addPhase('spring', 'Spring', WINTER_WINDOW_END + 1, 38);
    if (weekCount > 38) {
      addPhase('runin', 'Season Run-In', 39, weekCount);
    }
    // International break
    if (internationalTournament) {
      addPhase('intl', internationalTournament.name || 'International', weekCount + 1, 52);
    }

    return groups;
  }, [entries, weekCount, playerClubId, internationalTournament]);

  // Active phase for quick-jump
  const activePhaseId = useMemo(() => {
    for (const p of phases) {
      if (week >= p.startWeek && week <= p.endWeek) return p.id;
    }
    return phases[phases.length - 1]?.id;
  }, [phases, week]);

  // Auto-scroll to current week on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      currentWeekRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  const cupEliminated = cup?.eliminated;

  // Helper: check if a match at the current week is the "next" match
  const isNextMatch = (matchWeek: number, played: boolean) =>
    matchWeek === week && !played;

  // Helper: get opponent club reputation for strength indicator
  const getOpponentStrength = (oppId: string) => {
    const opp = clubs[oppId];
    const playerClub = clubs[playerClubId];
    if (!opp || !playerClub) return null;
    const diff = opp.reputation - playerClub.reputation;
    if (diff >= 15) return { label: 'Strong', color: 'text-destructive' };
    if (diff >= 5) return { label: 'Tough', color: 'text-amber-400' };
    if (diff <= -15) return { label: 'Weak', color: 'text-emerald-400' };
    return null;
  };

  const scrollToPhase = (phaseId: string) => {
    phaseRefs.current[phaseId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <button onClick={() => setScreen('dashboard')} className="flex items-center gap-1 text-muted-foreground text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <PageHint
        screen="calendar"
        title="Season Calendar"
        body="View your full fixture list across league, cup, and continental competitions. The current week is highlighted — scroll down to see upcoming matches and bye weeks."
      />

      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground font-display">Season {season} Schedule</h2>
        <span className="text-xs text-muted-foreground ml-auto">Week {week}</span>
      </div>

      {/* Season Stats Bar */}
      {stats.played > 0 && (
        <GlassPanel className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">League Record</span>
            {recentForm.length > 0 && (
              <div className="flex gap-1 items-center">
                <span className="text-[10px] text-muted-foreground mr-1">Form</span>
                {recentForm.map((r, i) => (
                  <span
                    key={i}
                    className={cn(
                      'w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold',
                      r === 'W' && 'bg-emerald-500/20 text-emerald-400',
                      r === 'D' && 'bg-muted/50 text-muted-foreground',
                      r === 'L' && 'bg-destructive/20 text-destructive',
                    )}
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2 text-center">
            <div>
              <span className="text-lg font-bold text-foreground">{stats.played}</span>
              <p className="text-[10px] text-muted-foreground">P</p>
            </div>
            <div>
              <span className="text-lg font-bold text-emerald-400">{stats.wins}</span>
              <p className="text-[10px] text-muted-foreground">W</p>
            </div>
            <div>
              <span className="text-lg font-bold text-muted-foreground">{stats.draws}</span>
              <p className="text-[10px] text-muted-foreground">D</p>
            </div>
            <div>
              <span className="text-lg font-bold text-destructive">{stats.losses}</span>
              <p className="text-[10px] text-muted-foreground">L</p>
            </div>
            <div>
              <span className="text-lg font-bold text-foreground">{stats.goalsFor}<span className="text-muted-foreground">-</span>{stats.goalsAgainst}</span>
              <p className="text-[10px] text-muted-foreground">GF-GA</p>
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Transfer Window + Cup Status */}
      <div className="grid grid-cols-2 gap-2">
        <GlassPanel className="p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Transfer Window</span>
          <div className="mt-1">
            <span className={cn('text-xs font-bold px-2 py-0.5 rounded', transferWindowOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-destructive/20 text-destructive')}>
              {transferWindowOpen ? 'Open' : 'Closed'}
            </span>
          </div>
        </GlassPanel>
        <GlassPanel className="p-3">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Dynasty Cup</span>
          <div className="mt-1">
            {cupEliminated ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-destructive/20 text-destructive">Eliminated</span>
            ) : cup?.winner === playerClubId ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/20 text-primary">Winners!</span>
            ) : (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                {cup?.currentRound ? getRoundName(cup.currentRound) : 'Active'}
              </span>
            )}
          </div>
        </GlassPanel>
      </div>

      {/* Quick Jump Nav */}
      {phases.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {phases.map(phase => (
            <button
              key={phase.id}
              onClick={() => scrollToPhase(phase.id)}
              className={cn(
                'text-[10px] px-2.5 py-1.5 rounded-full whitespace-nowrap shrink-0 font-medium transition-colors',
                phase.id === activePhaseId
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-card/40 text-muted-foreground border border-transparent'
              )}
            >
              {phase.label}
            </button>
          ))}
        </div>
      )}

      {/* Unified Calendar by Phase */}
      {phases.map(phase => {
        const hasCurrentWeek = phase.entries.some(e => e.week === week);
        const allPast = phase.entries.every(e => e.week < week);
        const { phaseSummary } = phase;

        return (
          <div key={phase.id} ref={el => { phaseRefs.current[phase.id] = el; }}>
            {/* Phase Header */}
            <div className="flex items-center gap-2 mb-2 mt-1">
              <div className={cn(
                'h-px flex-1',
                hasCurrentWeek ? 'bg-primary/40' : 'bg-border/30'
              )} />
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  'text-[10px] uppercase tracking-wider font-bold',
                  hasCurrentWeek ? 'text-primary' : allPast ? 'text-muted-foreground/50' : 'text-muted-foreground'
                )}>
                  {phase.label}
                </span>
                {phaseSummary.total > 0 && (
                  <span className="text-[9px] text-muted-foreground/60">
                    {phaseSummary.wins}W {phaseSummary.draws}D {phaseSummary.losses}L
                  </span>
                )}
              </div>
              <div className={cn(
                'h-px flex-1',
                hasCurrentWeek ? 'bg-primary/40' : 'bg-border/30'
              )} />
            </div>

            <div className="space-y-1">
              {phase.entries.map((entry) => {
                const isCurrentWeek = entry.week === week;
                const isCongested = congestedWeeks.has(entry.week);
                const isBoardReview = (BOARD_REVIEW_WEEKS as readonly number[]).includes(entry.week);

                // Bye week
                if (entry.type === 'bye') {
                  // Show byes only for current week or immediate next
                  if (!isCurrentWeek && entry.week !== week + 1) return null;
                  return (
                    <div
                      key={`bye-${entry.week}`}
                      ref={isCurrentWeek ? currentWeekRef : undefined}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg',
                        isCurrentWeek ? 'bg-primary/10 border border-primary/30' : 'bg-card/20'
                      )}
                    >
                      <span className={cn('text-xs font-mono w-10 shrink-0', isCurrentWeek ? 'text-primary font-bold' : 'text-muted-foreground/50')}>
                        W{entry.week}
                      </span>
                      <span className="text-xs text-muted-foreground/50 italic flex-1">No match</span>
                      {isBoardReview && (
                        <span className="text-[9px] text-amber-400/70 flex items-center gap-0.5">
                          <Briefcase className="w-3 h-3" /> Board Review
                        </span>
                      )}
                      {isCurrentWeek && <span className="text-[10px] text-primary font-bold">THIS WEEK</span>}
                    </div>
                  );
                }

                // International match
                if (entry.type === 'international') {
                  return (
                    <div
                      key={`intl-${entry.week}-${entry.intlLabel}`}
                      ref={isCurrentWeek ? currentWeekRef : undefined}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border-l-2 border-l-blue-400/50',
                        isCurrentWeek ? 'bg-blue-500/10 border border-blue-400/30' : 'bg-card/40',
                      )}
                    >
                      <span className={cn('text-xs font-mono w-10 shrink-0', isCurrentWeek ? 'text-blue-400 font-bold' : 'text-muted-foreground')}>
                        W{entry.week}
                      </span>
                      <span className="text-[10px] w-6 shrink-0 font-bold rounded px-1 py-0.5 text-center bg-blue-500/15 text-blue-400">
                        <Globe className="w-3 h-3 inline" />
                      </span>
                      <span className={cn('text-sm flex-1 min-w-0 truncate', isCurrentWeek ? 'text-foreground font-bold' : 'text-foreground/80')}>
                        {entry.intlLabel}
                      </span>
                      {isCurrentWeek && <span className="text-xs text-blue-400 font-bold animate-pulse">INTL</span>}
                    </div>
                  );
                }

                // League match
                if (entry.type === 'league' && entry.match) {
                  return renderLeagueMatch(entry.match, isCurrentWeek, isCongested, isBoardReview);
                }

                // Cup tie
                if (entry.type === 'cup' && entry.cupTie) {
                  return renderCupTie(entry.cupTie, isCurrentWeek, isCongested);
                }

                return null;
              })}
            </div>
          </div>
        );
      })}

      {/* Season Progress */}
      <GlassPanel className="p-3 mt-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Season Progress</span>
          <span className="text-xs text-muted-foreground">{week} / {weekCount} weeks</span>
        </div>
        <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary/70 rounded-full transition-all"
            style={{ width: `${Math.min((week / weekCount) * 100, 100)}%` }}
          />
        </div>
      </GlassPanel>
    </div>
  );

  function renderLeagueMatch(match: Match, isCurrentWeek: boolean, isCongested: boolean, isBoardReview: boolean) {
    const isHome = match.homeClubId === playerClubId;
    const oppId = isHome ? match.awayClubId : match.homeClubId;
    const opp = clubs[oppId];
    const isCurrent = isNextMatch(match.week, match.played);
    const isPast = match.played;
    const isDerby = getDerbyIntensity(match.homeClubId, match.awayClubId) > 0;

    let result = '';
    let resultColor = '';
    let resultLabel = '';
    if (isPast) {
      const pGoals = isHome ? match.homeGoals : match.awayGoals;
      const oGoals = isHome ? match.awayGoals : match.homeGoals;
      result = `${pGoals}-${oGoals}`;
      if (pGoals > oGoals) { resultColor = 'text-emerald-400'; resultLabel = 'W'; }
      else if (pGoals < oGoals) { resultColor = 'text-destructive'; resultLabel = 'L'; }
      else { resultColor = 'text-muted-foreground'; resultLabel = 'D'; }
    }

    // Strength indicator for upcoming matches
    const strength = !isPast ? getOpponentStrength(oppId) : null;

    // Tappable for played matches → navigate to match-review
    const handleClick = isPast && match.week === currentMatchResult?.week
      ? () => setScreen('match-review')
      : undefined;

    return (
      <div
        key={match.id}
        ref={isCurrentWeek ? currentWeekRef : undefined}
        onClick={handleClick}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
          isCurrent && 'bg-primary/10 border border-primary/30 shadow-sm shadow-primary/10',
          !isCurrent && !isPast && 'bg-card/40',
          isPast && 'bg-card/20 opacity-60',
          isDerby && !isCurrent && 'border-l-2 border-l-amber-500/70',
          handleClick && 'cursor-pointer active:scale-[0.98]',
        )}
      >
        {/* Week number */}
        <span className={cn('text-xs font-mono w-10 shrink-0', isCurrent ? 'text-primary font-bold' : 'text-muted-foreground')}>
          W{match.week}
        </span>

        {/* Home/Away badge */}
        <span className={cn(
          'text-[10px] w-6 shrink-0 font-bold rounded px-1 py-0.5 text-center',
          isHome ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'
        )}>
          {isHome ? 'H' : 'A'}
        </span>

        {/* Opponent */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: opp?.color }} />
          <span className={cn('text-sm truncate', isCurrent ? 'text-foreground font-bold' : 'text-foreground/80')}>
            {opp?.shortName || '?'}
          </span>
          {isDerby && <Flame className="w-3 h-3 text-amber-500 shrink-0" />}
          {strength && !isPast && (
            <span className={cn('text-[9px] font-medium', strength.color)}>{strength.label}</span>
          )}
        </div>

        {/* Markers */}
        <div className="flex items-center gap-1">
          {isCongested && !isPast && (
            <AlertTriangle className="w-3 h-3 text-amber-500/70 shrink-0" title="Congested fixture week" />
          )}
          {isBoardReview && !isPast && (
            <Briefcase className="w-3 h-3 text-amber-400/60 shrink-0" title="Board review week" />
          )}
        </div>

        {/* Result / Status */}
        {isPast ? (
          <div className="flex items-center gap-1.5">
            <span className={cn('text-[10px] font-bold rounded px-1 py-0.5',
              resultLabel === 'W' && 'bg-emerald-500/15 text-emerald-400',
              resultLabel === 'D' && 'bg-muted/50 text-muted-foreground',
              resultLabel === 'L' && 'bg-destructive/15 text-destructive',
            )}>{resultLabel}</span>
            <span className={cn('text-sm font-mono font-bold', resultColor)}>{result}</span>
          </div>
        ) : isCurrent ? (
          <span className="text-xs text-primary font-bold animate-pulse">NEXT</span>
        ) : null}
      </div>
    );
  }

  function renderCupTie(tie: CupTie, isCurrentWeek: boolean, isCongested: boolean) {
    const isHome = tie.homeClubId === playerClubId;
    const oppId = isHome ? tie.awayClubId : tie.homeClubId;
    const opp = clubs[oppId];
    const isCurrent = isNextMatch(tie.week, tie.played);
    const isPast = tie.played;

    let result = '';
    let resultColor = '';
    let resultLabel = '';
    let penaltyNote = '';
    if (isPast) {
      const pGoals = isHome ? tie.homeGoals : tie.awayGoals;
      const oGoals = isHome ? tie.awayGoals : tie.homeGoals;
      result = `${pGoals}-${oGoals}`;
      if (tie.penaltyShootout) {
        const pPens = isHome ? tie.penaltyShootout.home : tie.penaltyShootout.away;
        const oPens = isHome ? tie.penaltyShootout.away : tie.penaltyShootout.home;
        penaltyNote = `(${pPens}-${oPens} pens)`;
        if (pPens > oPens) { resultColor = 'text-emerald-400'; resultLabel = 'W'; }
        else { resultColor = 'text-destructive'; resultLabel = 'L'; }
      } else if (tie.winnerId) {
        // winnerId set on extra time / resolved ties
        if (tie.winnerId === playerClubId) { resultColor = 'text-emerald-400'; resultLabel = 'W'; }
        else { resultColor = 'text-destructive'; resultLabel = 'L'; }
      } else {
        if (pGoals > oGoals) { resultColor = 'text-emerald-400'; resultLabel = 'W'; }
        else if (pGoals < oGoals) { resultColor = 'text-destructive'; resultLabel = 'L'; }
        else { resultColor = 'text-muted-foreground'; resultLabel = 'D'; }
      }
    }

    // Strength indicator
    const strength = !isPast ? getOpponentStrength(oppId) : null;

    return (
      <div
        key={tie.id}
        ref={isCurrentWeek ? currentWeekRef : undefined}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border-l-2 border-l-primary/50',
          isCurrent && 'bg-primary/10 border border-primary/30 shadow-sm shadow-primary/10',
          !isCurrent && !isPast && 'bg-card/40',
          isPast && 'bg-card/20 opacity-60',
        )}
      >
        {/* Week number */}
        <span className={cn('text-xs font-mono w-10 shrink-0', isCurrent ? 'text-primary font-bold' : 'text-muted-foreground')}>
          W{tie.week}
        </span>

        {/* Cup round badge */}
        <span className="text-[10px] w-6 shrink-0 font-bold rounded px-1 py-0.5 text-center bg-primary/15 text-primary">
          <Trophy className="w-3 h-3 inline" />
        </span>

        {/* Opponent + round name */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: opp?.color }} />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={cn('text-sm truncate', isCurrent ? 'text-foreground font-bold' : 'text-foreground/80')}>
                {opp?.shortName || '?'}
              </span>
              {strength && !isPast && (
                <span className={cn('text-[9px] font-medium', strength.color)}>{strength.label}</span>
              )}
            </div>
            <span className="text-[10px] text-primary/70">{getRoundName(tie.round as CupRound)}</span>
          </div>
        </div>

        {/* Markers */}
        {isCongested && !isPast && (
          <AlertTriangle className="w-3 h-3 text-amber-500/70 shrink-0" title="Congested fixture week" />
        )}

        {/* Result / Status */}
        {isPast ? (
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5">
              <span className={cn('text-[10px] font-bold rounded px-1 py-0.5',
                resultLabel === 'W' && 'bg-emerald-500/15 text-emerald-400',
                resultLabel === 'L' && 'bg-destructive/15 text-destructive',
                resultLabel === 'D' && 'bg-muted/50 text-muted-foreground',
              )}>{resultLabel}</span>
              <span className={cn('text-sm font-mono font-bold', resultColor)}>{result}</span>
            </div>
            {penaltyNote && <span className="text-[9px] text-muted-foreground">{penaltyNote}</span>}
          </div>
        ) : isCurrent ? (
          <span className="text-xs text-primary font-bold animate-pulse">CUP</span>
        ) : null}
      </div>
    );
  }
};

export default CalendarView;
