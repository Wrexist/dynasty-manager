import { useState, useMemo, type ReactNode } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import type { Club, Player } from '@/types/game';
import { resolveClub } from '@/utils/helpers';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ChevronRight, Flame, Calendar, HeartPulse, Star, TrendingUp, TrendingDown, Minus, MapPin, Shield, ArrowLeft, Trophy, ArrowUp, ArrowDown } from 'lucide-react';
import { AdRewardButton } from '@/components/game/AdRewardButton';
import { cn } from '@/lib/utils';

import { isPro } from '@/utils/monetization';
import { GOAL_SCORING_TYPES, GOAL_EVENT_TYPES } from '@/config/matchEngine';
import { INJURY_TYPES } from '@/config/gameBalance';
import type { MatchEvent, MatchHighlightTone } from '@/types/game';

// ── Key Highlights display maps (kept near the component to stay readable) ──
const HIGHLIGHT_TYPES: readonly MatchEvent['type'][] = [
  'goal', 'own_goal', 'penalty_scored', 'penalty_missed', 'red_card', 'injury',
  'free_kick_goal', 'long_range_goal', 'counter_attack_goal', 'header_goal',
  'solo_goal', 'goalkeeper_error', 'var_check', 'var_disallowed', 'substitution',
];
const HIGHLIGHT_TONE: Partial<Record<MatchEvent['type'], MatchHighlightTone>> = {
  goal: 'goal', penalty_scored: 'goal', free_kick_goal: 'goal', long_range_goal: 'goal',
  counter_attack_goal: 'goal', header_goal: 'goal', solo_goal: 'goal', goalkeeper_error: 'goal',
  red_card: 'card',
  var_check: 'var',
  var_disallowed: 'disallowed',
  own_goal: 'own-goal',
  substitution: 'sub',
};
const HIGHLIGHT_TONE_CLASS: Record<MatchHighlightTone, { dot: string; text: string }> = {
  goal:       { dot: 'bg-emerald-400', text: 'text-emerald-400' },
  card:       { dot: 'bg-red-500',     text: 'text-red-400' },
  var:        { dot: 'bg-blue-400',    text: 'text-blue-400' },
  disallowed: { dot: 'bg-red-500',     text: 'text-red-400' },
  neutral:    { dot: 'bg-amber-400',   text: 'text-amber-400' },
  'own-goal': { dot: 'bg-amber-500',   text: 'text-amber-400' },
  sub:        { dot: 'bg-indigo-400',  text: 'text-indigo-400' },
};
const HIGHLIGHT_LABEL: Partial<Record<MatchEvent['type'], string>> = {
  goal: 'GOAL', free_kick_goal: 'FREE KICK', long_range_goal: 'LONG RANGE',
  counter_attack_goal: 'COUNTER', header_goal: 'HEADER', solo_goal: 'SOLO GOAL',
  goalkeeper_error: 'GK ERROR', var_check: 'VAR', var_disallowed: 'DISALLOWED',
  penalty_scored: 'PENALTY', own_goal: 'OWN GOAL', penalty_missed: 'PEN MISSED',
  red_card: 'RED CARD', injury: 'INJURY', substitution: 'SUB',
};
/** Strip the "VAR CHECK — " prefix so it isn't shown next to the VAR label pill. */
const stripVarPrefix = (text: string): string => text.replace(/^VAR CHECK\s*—\s*/, '');

/** Stable empty-events sentinel for the useMemo fallback. Using `?? []` inline
 *  would create a fresh array reference on every render when no match is
 *  loaded, defeating the memo. */
const EMPTY_EVENTS: MatchEvent[] = [];
import { ProUpsell } from '@/components/game/ProUpsell';
import { Button } from '@/components/ui/button';
import { getConfidenceColor, getMatchRatingColor, areColorsSimilar, getRatingHex } from '@/utils/uiHelpers';
import { FlagIcon } from '@/components/game/FlagIcon';
import { generateMatchInsights } from '@/utils/matchInsights';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import { getDerbyName, getDerbyIntensity } from '@/data/league';
import { getCompetitionInfo } from '@/utils/competitionBadge';
import { YellowCardIcon, RedCardIcon } from '@/components/game/PlayerAvatar';
import { getSuffix } from '@/utils/helpers';
import { PageHint } from '@/components/game/PageHint';
import { findTournamentMatch } from '@/hooks/useGameSelectors';
import { motion, useReducedMotion } from 'framer-motion';

const MatchReview = () => {
  const { currentMatchResult, clubs, players, playerClubId, boardConfidence, matchPlayerRatings, week, divisionFixtures, playerDivision, divisionTables, boardObjectives, monetization, lastMatchCompetition, virtualClubs } = useGameStore(useShallow(s => ({
    currentMatchResult: s.currentMatchResult, clubs: s.clubs, players: s.players,
    playerClubId: s.playerClubId, boardConfidence: s.boardConfidence,
    matchPlayerRatings: s.matchPlayerRatings, week: s.week,
    divisionFixtures: s.divisionFixtures, playerDivision: s.playerDivision,
    divisionTables: s.divisionTables, boardObjectives: s.boardObjectives,
    monetization: s.monetization, lastMatchCompetition: s.lastMatchCompetition,
    virtualClubs: s.virtualClubs,
  })));
  const advanceWeek = useGameStore(s => s.advanceWeek);
  const setScreen = useGameStore(s => s.setScreen);
  const selectPlayer = useGameStore(s => s.selectPlayer);
  const userIsPro = isPro(monetization);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [highlightFilter, setHighlightFilter] = useState<'all' | 'us' | 'goals'>('all');

  const reducedMotion = useReducedMotion();

  const matchInsights = useMemo(
    () => currentMatchResult ? generateMatchInsights(currentMatchResult, playerClubId) : [],
    [currentMatchResult, playerClubId]
  );

  const matchEvents = currentMatchResult?.events;
  const allHighlights = useMemo(
    () => (matchEvents ?? []).filter(e => (HIGHLIGHT_TYPES as readonly string[]).includes(e.type)),
    [matchEvents]
  );
  const highlights = useMemo(
    () => allHighlights.filter(e => {
      if (highlightFilter === 'us') return e.clubId === playerClubId;
      if (highlightFilter === 'goals') return (GOAL_SCORING_TYPES as readonly string[]).includes(e.type) || e.type === 'goalkeeper_error';
      return true;
    }),
    [allHighlights, highlightFilter, playerClubId]
  );
  const highlightCounts = useMemo(() => ({
    all: allHighlights.length,
    us: allHighlights.filter(e => e.clubId === playerClubId).length,
    goals: allHighlights.filter(e => (GOAL_SCORING_TYPES as readonly string[]).includes(e.type) || e.type === 'goalkeeper_error').length,
  }), [allHighlights, playerClubId]);

  // Single-pass partition over match.events, memoized on the events array.
  // Replaces three sequential .filter() calls that re-walked events on every
  // render — match.events can hold 60+ items for a full-time review. Must be
  // called unconditionally (Rules of Hooks) — the early returns below guard
  // the render path, not the data derivation.
  const matchEventsForReview = currentMatchResult?.events ?? EMPTY_EVENTS;
  const { goals, injuries, cards } = useMemo(() => {
    const g: MatchEvent[] = [];
    const inj: MatchEvent[] = [];
    const c: MatchEvent[] = [];
    const goalTypes = GOAL_SCORING_TYPES as readonly string[];
    for (const e of matchEventsForReview) {
      if (goalTypes.includes(e.type)) g.push(e);
      else if (e.type === 'injury') inj.push(e);
      else if (e.type === 'yellow_card' || e.type === 'red_card') c.push(e);
    }
    g.sort((a, b) => a.minute - b.minute);
    return { goals: g, injuries: inj, cards: c };
  }, [matchEventsForReview]);

  if (!currentMatchResult) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <GlassPanel className="p-6 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No match to review</p>
            <Button variant="secondary" className="mt-3" onClick={() => setScreen('dashboard')}>Back to Dashboard</Button>
          </GlassPanel>
        </motion.div>
      </div>
    );
  }

  const match = currentMatchResult;
  const homeClub = resolveClub(clubs, virtualClubs, match.homeClubId);
  const awayClub = resolveClub(clubs, virtualClubs, match.awayClubId);
  if (!homeClub || !awayClub) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <GlassPanel className="p-6 text-center">
          <Calendar className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Unable to load match data</p>
          <Button variant="secondary" className="mt-3" onClick={() => setScreen('dashboard')}>Back to Dashboard</Button>
        </GlassPanel>
      </div>
    );
  }
  const isHome = match.homeClubId === playerClubId;
  const homeBarColor = homeClub.color;
  const awayBarColor = areColorsSimilar(homeClub.color, awayClub.color) ? '#FFFFFF' : awayClub.color;
  const won = isHome ? match.homeGoals > match.awayGoals : match.awayGoals > match.homeGoals;
  const drew = match.homeGoals === match.awayGoals;
  const lost = !won && !drew;
  const xpDoubleClaimContext = `match_w${week}_${match.homeClubId}_${match.awayClubId}_${match.homeGoals}-${match.awayGoals}_${lastMatchCompetition || 'league'}`;

  // goals/injuries/cards are memoized above the early-return guard.

  // Historical review = match from a past week (e.g. opened from inbox)
  const isHistoricalReview = match.week !== week;

  const handleContinue = () => {
    if (isHistoricalReview) {
      // Reviewing a past match — just go back, never advance the week
      setScreen('dashboard');
      return;
    }
    setIsAdvancing(true);
    setTimeout(() => {
      // Read fresh state from the store (not stale closure from render time)
      const s = useGameStore.getState();
      const hasUnplayedLeague = s.fixtures.some(
        m => m.week === s.week && !m.played && (m.homeClubId === s.playerClubId || m.awayClubId === s.playerClubId)
      );
      const hasUnplayedTournament = !!findTournamentMatch({
        week: s.week, playerClubId: s.playerClubId, cup: s.cup,
        leagueCup: s.leagueCup, championsCup: s.championsCup,
        shieldCup: s.shieldCup, conferenceCup: s.conferenceCup,
        domesticSuperCup: s.domesticSuperCup,
        continentalSuperCup: s.continentalSuperCup,
      });

      if (hasUnplayedLeague || hasUnplayedTournament) {
        // Another match this week — return to dashboard without advancing
        setScreen('dashboard');
      } else {
        advanceWeek();
        setScreen('dashboard');
      }
      setIsAdvancing(false);
    }, 50);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      <PageHint
        screen="match-review"
        title="Match Review"
        body="Analyse your last match — check player ratings, key stats, and tactical insights. Top performers get highlighted. Use the insights to adjust your tactics for the next game."
      />

      {/* Result Header */}
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
        <GlassPanel className={cn('p-6 text-center', won ? 'border-emerald-500/30' : lost ? 'border-destructive/30' : 'border-amber-500/30')}>
          <motion.p
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className={cn('text-sm font-semibold mb-1',
              won ? 'text-emerald-400' : lost ? 'text-destructive' : 'text-amber-400'
            )}
          >
            {won ? 'VICTORY' : lost ? 'DEFEAT' : 'DRAW'}
          </motion.p>
          {lastMatchCompetition && (() => {
            const compInfo = getCompetitionInfo(lastMatchCompetition);
            return (
              <div className="flex justify-center mb-1">
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                  compInfo.bg
                )}>
                  <Trophy className="w-2.5 h-2.5" />
                  <span className={compInfo.color}>{compInfo.name}</span>
                </span>
              </div>
            );
          })()}
          {/* Home/Away + Venue */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest',
              isHome
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-muted/40 text-muted-foreground border border-border/50'
            )}>
              {isHome ? <><Shield className="w-2.5 h-2.5" /> Home</> : <><ArrowLeft className="w-2.5 h-2.5" /> Away</>}
            </span>
            {homeClub.stadiumName && (
              <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground/60">
                <MapPin className="w-2.5 h-2.5" /> {homeClub.stadiumName}
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-4 my-3">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-1" style={{ backgroundColor: homeClub.color }} />
              <p className="text-xs font-bold text-foreground">{homeClub.shortName}</p>
            </div>
            <motion.p
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4, type: 'spring', stiffness: 200 }}
              className="text-4xl font-black text-foreground font-display tabular-nums"
            >
              {match.homeGoals} - {match.awayGoals}
            </motion.p>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-1" style={{ backgroundColor: awayClub.color }} />
              <p className="text-xs font-bold text-foreground">{awayClub.shortName}</p>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Continue — sticky at top so player doesn't have to scroll */}
      <div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-2 bg-gradient-to-b from-background via-background to-transparent">
        <Button size="lg" className="w-full h-12 text-base font-bold gap-2" disabled={isAdvancing} onClick={handleContinue}>
          {isAdvancing ? 'Advancing...' : isHistoricalReview ? 'Back to Dashboard' : 'Continue'} {!isAdvancing && <ChevronRight className="w-5 h-5" />}
        </Button>
      </div>

      {/* Key Highlights — animated two-lane timeline of the biggest moments */}
      {(() => {
        if (allHighlights.length === 0) return null;

        const renderPlayerPill = (p: Player, variant: 'scorer' | 'gk' | 'own-goal') => {
          const accentColor = variant === 'gk'
            ? '#f87171'
            : variant === 'own-goal'
              ? '#f59e0b'
              : getRatingHex(p.overall);
          return (
            <button
              type="button"
              onClick={() => selectPlayer(p.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md border bg-background/40 hover:bg-background/70 transition-colors focus:outline-none focus:ring-1 focus:ring-primary/50',
                variant === 'gk' && 'opacity-85',
                variant === 'own-goal' && 'border-dashed'
              )}
              style={{ borderColor: accentColor }}
              aria-label={`View ${p.firstName} ${p.lastName}`}
            >
              {variant === 'gk' && <span className="text-[9px] font-bold text-red-400 uppercase">GK</span>}
              <FlagIcon nationality={p.nationality} size={12} />
              <span className="text-[11px] font-semibold text-foreground leading-none">
                {p.firstName} {p.lastName}
              </span>
              <span
                className="text-[10px] font-bold tabular-nums leading-none"
                style={{ color: accentColor }}
              >
                {p.overall}
              </span>
            </button>
          );
        };

        return (
          <GlassPanel className="p-4">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">Key Highlights</h3>
              <div className="flex items-center gap-1 p-0.5 rounded-full bg-muted/30 border border-border/40">
                {(['all', 'us', 'goals'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setHighlightFilter(f)}
                    className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-colors',
                      highlightFilter === f
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    aria-label={`${f === 'us' ? 'Us' : f === 'goals' ? 'Goals' : 'All'} — ${highlightCounts[f]} event${highlightCounts[f] === 1 ? '' : 's'}`}
                  >
                    <span>{f === 'us' ? 'Us' : f === 'goals' ? 'Goals' : 'All'}</span>
                    <span className={cn(
                      'text-[9px] font-bold tabular-nums',
                      highlightFilter === f ? 'opacity-80' : 'opacity-50'
                    )}>
                      {highlightCounts[f]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {highlights.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No events match this filter.</p>
            ) : (
              <div className="relative">
                {/* Center timeline */}
                <div className="absolute top-2 bottom-2 left-1/2 w-px bg-border/50 -translate-x-1/2" aria-hidden />
                <div className="space-y-3">
                  {highlights.map((ev, i) => {
                    const evPlayer = ev.playerId ? players[ev.playerId] : null;
                    const assistPlayer = ev.assistPlayerId ? players[ev.assistPlayerId] : null;
                    const gkPlayer = ev.goalkeeperId ? players[ev.goalkeeperId] : null;
                    const evClub = clubs[ev.clubId] ?? (virtualClubs?.[ev.clubId] ? { color: virtualClubs[ev.clubId].color } as Partial<Club> : null);
                    const tone = HIGHLIGHT_TONE[ev.type] ?? 'neutral';
                    const toneClass = HIGHLIGHT_TONE_CLASS[tone];
                    const label = HIGHLIGHT_LABEL[ev.type] ?? ev.type.toUpperCase();
                    const descriptionText = (ev.type === 'var_check' || ev.type === 'var_disallowed')
                      ? stripVarPrefix(ev.description)
                      : ev.description;
                    const isOurs = ev.clubId === playerClubId;
                    const isHomeTeamEvent = ev.clubId === match.homeClubId;
                    const isSubstitution = ev.type === 'substitution';
                    const isOwnGoal = ev.type === 'own_goal';
                    // Primary signal: sibling injury event at the same minute for the outgoing
                    // player (engine always emits these together for forced subs). Fallback to
                    // a string probe so the UI stays correct even if the engine re-orders events.
                    const forcedSub = isSubstitution && !!ev.assistPlayerId && (
                      match.events.some(other =>
                        other.type === 'injury'
                        && other.playerId === ev.assistPlayerId
                        && other.minute === ev.minute
                      )
                      || (typeof ev.description === 'string' && ev.description.toLowerCase().includes('injured'))
                    );
                    const benefitingClubShort = isOwnGoal
                      ? (clubs[ev.clubId]?.shortName ?? virtualClubs?.[ev.clubId]?.shortName ?? null)
                      : null;

                    let inner: ReactNode = null;
                    if (isSubstitution) {
                      if (evPlayer && assistPlayer) {
                        const subAriaLabel = `Substitution at ${ev.minute}': ${evPlayer.firstName} ${evPlayer.lastName} on for ${forcedSub ? 'injured ' : ''}${assistPlayer.firstName} ${assistPlayer.lastName}`;
                        inner = (
                          <motion.div
                            role="group"
                            aria-label={subAriaLabel}
                            className={cn('flex flex-col gap-1', isHomeTeamEvent ? 'items-end' : 'items-start')}
                            initial={reducedMotion ? false : 'hidden'}
                            animate="show"
                            variants={{
                              hidden: {},
                              show: { transition: { staggerChildren: reducedMotion ? 0 : 0.08, delayChildren: reducedMotion ? 0 : 0.05 } },
                            }}
                          >
                            <motion.div
                              className={cn('flex items-center gap-1.5', isHomeTeamEvent && 'flex-row-reverse')}
                              variants={{
                                hidden: { opacity: 0, y: reducedMotion ? 0 : -4 },
                                show: { opacity: 1, y: 0, transition: { duration: reducedMotion ? 0 : 0.3, ease: 'easeOut' } },
                              }}
                            >
                              <ArrowUp className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden />
                              {renderPlayerPill(evPlayer, 'scorer')}
                            </motion.div>
                            <motion.div
                              className={cn('flex items-center gap-1.5 opacity-75', isHomeTeamEvent && 'flex-row-reverse')}
                              variants={{
                                hidden: { opacity: 0, y: reducedMotion ? 0 : 4 },
                                show: { opacity: 0.75, y: 0, transition: { duration: reducedMotion ? 0 : 0.3, ease: 'easeOut' } },
                              }}
                            >
                              <ArrowDown className="w-3 h-3 text-red-400 shrink-0" aria-hidden />
                              {forcedSub && <HeartPulse className="w-3 h-3 text-destructive shrink-0" aria-label="injured" />}
                              {renderPlayerPill(assistPlayer, 'scorer')}
                            </motion.div>
                          </motion.div>
                        );
                      } else if (descriptionText) {
                        inner = <p className="text-xs text-muted-foreground">{descriptionText}</p>;
                      }
                    } else if (evPlayer) {
                      inner = (
                        <div
                          className={cn('flex items-center gap-1.5 flex-wrap', isHomeTeamEvent ? 'justify-end' : 'justify-start')}
                          {...(isOwnGoal ? { role: 'group', 'aria-label': `Own goal by ${evPlayer.firstName} ${evPlayer.lastName}${benefitingClubShort ? ` — benefits ${benefitingClubShort}` : ''}` } : {})}
                        >
                          {renderPlayerPill(evPlayer, isOwnGoal ? 'own-goal' : 'scorer')}
                          {isOwnGoal && (
                            <>
                              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider" aria-hidden>(OG)</span>
                              {benefitingClubShort && (
                                <span className="text-[10px] text-muted-foreground/80 font-medium tabular-nums" aria-hidden>
                                  → {benefitingClubShort}
                                </span>
                              )}
                            </>
                          )}
                          {ev.type === 'goalkeeper_error' && gkPlayer && renderPlayerPill(gkPlayer, 'gk')}
                          {(GOAL_EVENT_TYPES as readonly string[]).includes(ev.type) && assistPlayer && (
                            <button
                              type="button"
                              onClick={() => selectPlayer(assistPlayer.id)}
                              className="inline-flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary transition-colors focus:outline-none"
                              aria-label={`View ${assistPlayer.firstName} ${assistPlayer.lastName}`}
                            >
                              <span>assist</span>
                              <FlagIcon nationality={assistPlayer.nationality} size={10} />
                              <span>{assistPlayer.lastName}</span>
                            </button>
                          )}
                        </div>
                      );
                    } else if (descriptionText) {
                      inner = <p className="text-xs text-muted-foreground">{descriptionText}</p>;
                    }

                    const content = (
                      <div className={cn('flex flex-col gap-1 min-w-0', isHomeTeamEvent ? 'items-end text-right' : 'items-start text-left')}>
                        <div className={cn('flex items-center gap-2', isHomeTeamEvent && 'flex-row-reverse')}>
                          <span className="text-[10px] font-mono text-primary tabular-nums">{ev.minute}'</span>
                          <span className={cn('text-[10px] font-bold uppercase tracking-wider', toneClass.text)}>{label}</span>
                          {evClub && (
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: evClub.color }} />
                          )}
                        </div>
                        {inner}
                      </div>
                    );

                    return (
                      <motion.div
                        key={`${ev.minute}-${ev.type}-${ev.playerId ?? 'none'}-${ev.assistPlayerId ?? 'x'}`}
                        initial={reducedMotion ? false : { opacity: 0, x: isHomeTeamEvent ? 10 : -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: reducedMotion ? 0 : Math.min(i * 0.08, 0.6), duration: reducedMotion ? 0 : 0.3 }}
                        className="relative grid grid-cols-[1fr_12px_1fr] gap-2 items-start"
                      >
                        <div className="min-w-0">{isHomeTeamEvent && content}</div>
                        <div className="flex justify-center pt-1">
                          <div className={cn(
                            'w-2.5 h-2.5 rounded-full border-2 border-background',
                            toneClass.dot,
                            isOurs && 'ring-1 ring-primary/50 ring-offset-1 ring-offset-background'
                          )} />
                        </div>
                        <div className="min-w-0">{!isHomeTeamEvent && content}</div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </GlassPanel>
        );
      })()}

      {/* Scorers */}
      {goals.length > 0 && (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Goals</h3>
          <div className="space-y-1.5">
            {goals.map((g, i) => {
              const scorer = g.playerId ? players[g.playerId] : null;
              const assister = g.assistPlayerId ? players[g.assistPlayerId] : null;
              return (
                <div key={`goal-${g.minute}-${g.playerId || i}`} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums w-6 shrink-0">{g.minute}'</span>
                  {scorer ? (
                    <FlagIcon nationality={scorer.nationality} size={12} className="shrink-0" />
                  ) : null}
                  <span className="text-xs text-foreground truncate">
                    {scorer ? `${scorer.firstName} ${scorer.lastName}` : 'Unknown'}
                    {g.type === 'penalty_scored' && <span className="text-muted-foreground"> (pen)</span>}
                    {g.type === 'own_goal' && <span className="text-amber-400"> (OG)</span>}
                    {g.type === 'free_kick_goal' && <span className="text-muted-foreground"> (FK)</span>}
                    {g.type === 'long_range_goal' && <span className="text-muted-foreground"> (LR)</span>}
                    {g.type === 'counter_attack_goal' && <span className="text-muted-foreground"> (cnt)</span>}
                    {g.type === 'header_goal' && <span className="text-muted-foreground"> (hdr)</span>}
                    {g.type === 'solo_goal' && <span className="text-muted-foreground"> (solo)</span>}
                    {g.type === 'goalkeeper_error' && <span className="text-muted-foreground"> (GKE)</span>}
                    {(GOAL_EVENT_TYPES as readonly string[]).includes(g.type) && g.type !== 'penalty_scored' && assister && <span className="text-muted-foreground"> (assist: {assister.lastName})</span>}
                  </span>
                  {scorer && (
                    <span
                      className="text-[10px] font-bold tabular-nums shrink-0"
                      style={{ color: getRatingHex(scorer.overall) }}
                    >
                      {scorer.overall}
                    </span>
                  )}
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: clubs[g.clubId]?.color || virtualClubs?.[g.clubId]?.color || '#6b7280' }} />
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Match Stats */}
      {match.stats && (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Match Stats</h3>
          <div className="flex items-center justify-between text-[10px] font-bold mb-3">
            <span style={{ color: homeBarColor }}>{homeClub.shortName}</span>
            <span className="text-muted-foreground/40 uppercase tracking-widest text-[8px]">vs</span>
            <span style={{ color: awayBarColor }}>{awayClub.shortName}</span>
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'Possession', home: `${match.stats.homePossession}%`, away: `${match.stats.awayPossession}%`, homeVal: match.stats.homePossession, awayVal: match.stats.awayPossession },
              ...(match.stats.homeXG != null ? [{ label: 'xG', home: match.stats.homeXG.toFixed(1), away: (match.stats.awayXG ?? 0).toFixed(1), homeVal: match.stats.homeXG, awayVal: match.stats.awayXG ?? 0 }] : []),
              { label: 'Shots', home: match.stats.homeShots, away: match.stats.awayShots, homeVal: match.stats.homeShots, awayVal: match.stats.awayShots },
              { label: 'On Target', home: match.stats.homeShotsOnTarget, away: match.stats.awayShotsOnTarget, homeVal: match.stats.homeShotsOnTarget, awayVal: match.stats.awayShotsOnTarget },
              { label: 'Fouls', home: match.stats.homeFouls, away: match.stats.awayFouls, homeVal: match.stats.homeFouls, awayVal: match.stats.awayFouls },
              { label: 'Corners', home: match.stats.homeCorners, away: match.stats.awayCorners, homeVal: match.stats.homeCorners, awayVal: match.stats.awayCorners },
            ].map(({ label, home, away, homeVal, awayVal }) => {
              const total = (homeVal as number) + (awayVal as number) || 1;
              const homePct = ((homeVal as number) / total) * 100;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="tabular-nums font-medium" style={{ color: homeBarColor }}>{home}</span>
                    <span className="text-muted-foreground text-[10px]">{label}</span>
                    <span className="tabular-nums font-medium" style={{ color: awayBarColor }}>{away}</span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
                    <div className="rounded-full transition-all duration-500" style={{ width: `${homePct}%`, backgroundColor: homeBarColor }} />
                    <div className="rounded-full flex-1 transition-all duration-500" style={{ backgroundColor: `${awayBarColor}40` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Match Insights (Pro) */}
      {match.stats && !userIsPro && (
        <ProUpsell feature="Advanced Match Insights" />
      )}
      {match.stats && userIsPro && matchInsights.length > 0 && (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Match Insights</h3>
          <div className="space-y-2">
            {matchInsights.map((insight, i) => (
              <div key={`${insight.type}-${i}`} className={cn(
                'flex items-start gap-2 text-xs rounded-lg px-3 py-2 border',
                insight.type === 'positive' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
                insight.type === 'negative' ? 'bg-destructive/10 border-destructive/20 text-red-300' :
                'bg-muted/30 border-border/30 text-muted-foreground'
              )}>
                <DynamicIcon name={insight.icon} className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{insight.text}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Player Ratings */}
      {matchPlayerRatings.length > 0 && (() => {
        const clubRatings = matchPlayerRatings
          .filter(r => players[r.playerId]?.clubId === playerClubId)
          .sort((a, b) => b.rating - a.rating);
        const motmId = clubRatings[0]?.playerId;
        return (
          <GlassPanel className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Player Ratings</h3>
            <div className="space-y-1.5">
              {clubRatings.map(r => {
                const player = players[r.playerId];
                if (!player) return null;
                const isMotm = r.playerId === motmId;
                return (
                  <div
                    key={r.playerId}
                    className={cn('flex items-center gap-2 border-l-2 pl-2', isMotm && 'bg-primary/10 rounded-lg py-1')}
                    style={{ borderLeftColor: getRatingHex(player.overall) }}
                  >
                    <span className={cn(
                      'w-6 text-center text-xs font-bold',
                      getMatchRatingColor(r.rating)
                    )}>
                      {r.rating.toFixed(1)}
                    </span>
                    <FlagIcon nationality={player.nationality} size={12} className="shrink-0" />
                    <span className="text-xs text-foreground flex-1 truncate">{player.lastName}</span>
                    <span
                      className="text-[10px] font-bold tabular-nums shrink-0"
                      style={{ color: getRatingHex(player.overall) }}
                    >
                      {player.overall}
                    </span>
                    {isMotm && <Star className="w-3.5 h-3.5 text-primary shrink-0" />}
                    {r.goals > 0 && <span className="text-[10px] text-emerald-400">{r.goals}G</span>}
                    {r.assists > 0 && <span className="text-[10px] text-primary">{r.assists}A</span>}
                  </div>
                );
              })}
            </div>
          </GlassPanel>
        );
      })()}

      {/* Injuries & Cards */}
      {(injuries.length > 0 || cards.length > 0) && (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Incidents</h3>
          <div className="space-y-1.5">
            {injuries.map((e, i) => {
              const p = e.playerId ? players[e.playerId] : null;
              const injDetails = p?.injuryDetails;
              const injLabel = injDetails ? (INJURY_TYPES[injDetails.type]?.label ?? 'Injured') : 'Injured';
              const injWeeks = p?.injuryWeeks;
              return (
                <div key={`inj-${i}`} className="flex items-center gap-2 text-xs">
                  <HeartPulse className="w-3.5 h-3.5 text-destructive shrink-0" />
                  {p && <FlagIcon nationality={p.nationality} size={11} className="shrink-0" />}
                  <span className="text-foreground">
                    {p?.lastName || 'Unknown'} — {injLabel}
                    {injWeeks ? <span className="text-muted-foreground"> ({injWeeks} wk{injWeeks !== 1 ? 's' : ''})</span> : null}
                  </span>
                  <span className="text-muted-foreground ml-auto tabular-nums">{e.minute}'</span>
                </div>
              );
            })}
            {cards.map((e, i) => {
              const p = e.playerId ? players[e.playerId] : null;
              const banWeeks = (e.type === 'red_card' && p?.suspendedUntilWeek)
                ? p.suspendedUntilWeek - week
                : null;
              const isSecondYellow = e.type === 'red_card' && (e.description?.includes('Second yellow') || e.description?.includes('second booking'));
              return (
                <div key={`card-${i}`} className="flex items-center gap-2 text-xs">
                  {e.type === 'yellow_card' ? (
                    <YellowCardIcon size={10} />
                  ) : isSecondYellow ? (
                    <span className="flex items-center gap-0.5"><YellowCardIcon size={10} /><RedCardIcon size={10} /></span>
                  ) : (
                    <RedCardIcon size={10} />
                  )}
                  {p && <FlagIcon nationality={p.nationality} size={11} className="shrink-0" />}
                  <span className="text-foreground">
                    {p?.lastName || 'Unknown'}
                    {banWeeks != null && banWeeks > 0 && <span className="text-muted-foreground"> — {banWeeks} match ban</span>}
                  </span>
                  <span className="text-muted-foreground ml-auto tabular-nums">{e.minute}'</span>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}

      {/* Performance Summary (Pro) */}
      {match.stats && userIsPro && (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Performance Summary</h3>
          <div className="space-y-1.5">
            {(() => {
              const insights: { text: string; tone: 'good' | 'bad' | 'neutral' }[] = [];
              const myPoss = isHome ? match.stats.homePossession : match.stats.awayPossession;
              const myShots = isHome ? match.stats.homeShots : match.stats.awayShots;
              const mySoT = isHome ? match.stats.homeShotsOnTarget : match.stats.awayShotsOnTarget;
              const oppSoT = isHome ? match.stats.awayShotsOnTarget : match.stats.homeShotsOnTarget;
              const myGoals = isHome ? match.homeGoals : match.awayGoals;
              const oppGoals = isHome ? match.awayGoals : match.homeGoals;

              if (myPoss >= 60) insights.push({ text: 'Dominated possession — your midfield controlled the game.', tone: 'good' });
              else if (myPoss <= 40) insights.push({ text: 'Lost the possession battle — opponent dictated the tempo.', tone: 'bad' });

              if (myShots > 0 && mySoT / myShots < 0.3) insights.push({ text: 'Poor shot accuracy — too many wayward efforts.', tone: 'bad' });
              else if (myShots > 0 && mySoT / myShots >= 0.6) insights.push({ text: 'Clinical finishing — most shots tested the keeper.', tone: 'good' });

              if (myGoals > 0 && mySoT > 0 && myGoals / mySoT >= 0.5) insights.push({ text: 'Lethal conversion rate — made the most of your chances.', tone: 'good' });
              else if (mySoT >= 5 && myGoals === 0) insights.push({ text: 'Created chances but couldn\'t find the net. Unlucky or poor finishing.', tone: 'bad' });

              if (oppSoT <= 2 && oppGoals === 0) insights.push({ text: 'Defensive masterclass — barely gave them a sniff.', tone: 'good' });
              else if (oppSoT >= 6) insights.push({ text: 'Defensively exposed — opponent had too many clear sights on goal.', tone: 'bad' });

              if (insights.length === 0) insights.push({ text: 'A balanced contest with nothing to separate the sides.', tone: 'neutral' });

              return insights.map((ins, i) => (
                <div key={`${ins.tone}-${i}`} className="flex items-start gap-2">
                  <span className={cn('mt-0.5 shrink-0', ins.tone === 'good' ? 'text-emerald-400' : ins.tone === 'bad' ? 'text-amber-400' : 'text-muted-foreground')}>
                    {ins.tone === 'good' ? <TrendingUp className="w-3 h-3" /> : ins.tone === 'bad' ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  </span>
                  <p className="text-xs text-muted-foreground">{ins.text}</p>
                </div>
              ));
            })()}
          </div>
        </GlassPanel>
      )}

      {/* Man of the Match */}
      {matchPlayerRatings.length > 0 && (() => {
        const myRatings = matchPlayerRatings.filter(r => players[r.playerId]?.clubId === playerClubId);
        const best = myRatings.sort((a, b) => b.rating - a.rating)[0];
        const bestPlayer = best ? players[best.playerId] : null;
        if (!bestPlayer || best.rating < 7.0) return null;
        return (
          <GlassPanel className="p-3 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center"
                style={{ boxShadow: `inset 0 0 0 2px ${getRatingHex(bestPlayer.overall)}` }}
              >
                <span className="text-sm font-black text-primary">{best.rating.toFixed(1)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-primary uppercase tracking-wider font-semibold">Man of the Match</p>
                <div className="flex items-center gap-1.5">
                  <FlagIcon nationality={bestPlayer.nationality} size={14} className="shrink-0" />
                  <p className="text-sm font-bold text-foreground truncate">{bestPlayer.firstName} {bestPlayer.lastName}</p>
                  <span
                    className="text-[10px] font-bold tabular-nums shrink-0"
                    style={{ color: getRatingHex(bestPlayer.overall) }}
                  >
                    {bestPlayer.overall}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {best.goals > 0 ? `${best.goals}G ` : ''}{best.assists > 0 ? `${best.assists}A ` : ''}{bestPlayer.position}
                </p>
              </div>
            </div>
          </GlassPanel>
        );
      })()}

      {/* Board Reaction */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">Board Reaction</h3>
        <p className="text-xs text-muted-foreground">
          {boardConfidence >= 70
            ? won ? 'The board is delighted with this result. Keep it up!' : 'A solid position overall. The board trusts your process.'
            : boardConfidence >= 40
            ? won ? 'A much-needed result. The board is cautiously optimistic.' : 'The board expects improvement in upcoming fixtures.'
            : 'The board is concerned. Results must improve immediately.'}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-muted-foreground">Confidence:</span>
          <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', getConfidenceColor(boardConfidence).bgClass)}
              style={{ width: `${boardConfidence}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-foreground tabular-nums">{boardConfidence}%</span>
        </div>
      </GlassPanel>

      {/* League Position Movement — league matches only */}
      {!lastMatchCompetition && (() => {
        const table = divisionTables[playerDivision] || [];
        const newPos = table.findIndex(e => e.clubId === playerClubId) + 1;
        const { preMatchLeaguePosition } = useGameStore.getState();
        const oldPos = preMatchLeaguePosition || newPos;
        const delta = oldPos - newPos; // positive = moved up
        if (newPos <= 0) return null;
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.3 }}
          >
            <GlassPanel className={cn(
              'p-3 flex items-center gap-3',
              delta > 0 ? 'border-emerald-500/30' : delta < 0 ? 'border-destructive/30' : 'border-border/50'
            )}>
              {delta > 0 ? <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0" /> : delta < 0 ? <TrendingDown className="w-5 h-5 text-destructive shrink-0" /> : <Minus className="w-4 h-4 text-muted-foreground shrink-0" />}
              <div className="flex-1">
                <p className={cn('text-sm font-bold', delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-destructive' : 'text-foreground')}>
                  {delta > 0
                    ? `Up to ${newPos}${getSuffix(newPos)}!`
                    : delta < 0
                    ? `Down to ${newPos}${getSuffix(newPos)}`
                    : `Holding ${newPos}${getSuffix(newPos)}`}
                </p>
                {delta !== 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {oldPos}{getSuffix(oldPos)} → {newPos}{getSuffix(newPos)} in the table
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{table.find(e => e.clubId === playerClubId)?.points ?? 0} pts</span>
            </GlassPanel>
          </motion.div>
        );
      })()}

      {/* Next Up Preview */}
      {(() => {
        const nextFixture = divisionFixtures[playerDivision]?.find(
          f => !f.played && f.week > week && (f.homeClubId === playerClubId || f.awayClubId === playerClubId)
        );
        if (!nextFixture) {
          // Season context when no next fixture
          const remainingMatches = (divisionFixtures[playerDivision] || [])
            .filter(f => !f.played && (f.homeClubId === playerClubId || f.awayClubId === playerClubId)).length;
          const table = divisionTables[playerDivision] || [];
          const myPos = table.findIndex(e => e.clubId === playerClubId) + 1;
          if (remainingMatches <= 0 && myPos <= 0) return null;
          const posLabel = myPos > 0 ? `${myPos}${getSuffix(myPos)} place` : '';
          return (
            <GlassPanel className="p-4 border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Season Progress</p>
              </div>
              <p className="text-sm text-foreground">
                {remainingMatches > 0
                  ? `${remainingMatches} match${remainingMatches !== 1 ? 'es' : ''} remaining${posLabel ? ` — currently ${posLabel}` : ''}`
                  : `Season complete${posLabel ? ` — finished ${posLabel}` : ''}`}
              </p>
              {boardObjectives.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Board target: {boardObjectives[0].description}
                </p>
              )}
            </GlassPanel>
          );
        }

        const opponentId = nextFixture.homeClubId === playerClubId ? nextFixture.awayClubId : nextFixture.homeClubId;
        const opponent = resolveClub(clubs, virtualClubs, opponentId);
        const isNextHome = nextFixture.homeClubId === playerClubId;
        if (!opponent) return null;

        const derbyName = getDerbyName(playerClubId, opponentId);
        const derbyIntensity = getDerbyIntensity(playerClubId, opponentId);

        // Build a contextual hook line
        const table = divisionTables[playerDivision] || [];
        const myPos = table.findIndex(e => e.clubId === playerClubId) + 1;
        const oppPos = table.findIndex(e => e.clubId === opponentId) + 1;
        const oppForm = table.find(e => e.clubId === opponentId)?.form?.slice(-5) || [];

        let hookLine = '';
        if (derbyName) {
          hookLine = `${derbyName}!`;
        } else if (myPos > 0 && myPos <= 4 && oppPos > 0 && oppPos <= 4) {
          hookLine = 'Top of the table clash!';
        } else if (myPos > 0 && myPos > 3 && oppPos > 0 && myPos - 1 === oppPos) {
          hookLine = `Win this and you climb to ${myPos - 1}${getSuffix(myPos - 1)}!`;
        } else if (myPos > table.length - 4) {
          hookLine = 'Must-win in the battle for survival.';
        } else if (oppForm.filter(f => f === 'W').length >= 4) {
          hookLine = `${opponent.shortName} are on a hot streak.`;
        } else if (oppForm.filter(f => f === 'L').length >= 4) {
          hookLine = `${opponent.shortName} are struggling — time to pounce.`;
        } else {
          hookLine = isNextHome ? 'Home advantage awaits.' : 'A tough trip on the road.';
        }

        return (
          <GlassPanel className="p-4 border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Coming Up — Week {nextFixture.week}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: opponent.color, color: opponent.secondaryColor }}>
                  {opponent.shortName}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{opponent.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {isNextHome ? 'Home' : 'Away'}{oppPos > 0 ? ` · ${oppPos}${getSuffix(oppPos)} in table` : ''}
                  </p>
                </div>
              </div>
              {oppForm.length > 0 && (
                <div className="flex gap-0.5">
                  {oppForm.map((f, i) => (
                    <span key={`${f}-${i}`} className={cn(
                      'w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-bold',
                      f === 'W' ? 'bg-emerald-500/20 text-emerald-400' :
                      f === 'L' ? 'bg-destructive/20 text-destructive' :
                      'bg-amber-500/20 text-amber-400'
                    )}>{f}</span>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-primary font-semibold mt-2">
              {derbyIntensity > 0 && <Flame className="w-3 h-3 inline mr-1 text-amber-400" />}
              {hookLine}
            </p>
          </GlassPanel>
        );
      })()}

      {/* Ad Reward: Double XP */}
      <AdRewardButton
        rewardType="xp_double"
        claimContext={xpDoubleClaimContext}
        onRewardClaimed={() => { useGameStore.getState().applyDoubleXP(); }}
      />

    </div>
  );
};

export default MatchReview;
