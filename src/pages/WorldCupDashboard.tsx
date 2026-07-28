import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { getFlag } from '@/utils/nationality';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { guardAsync } from '@/utils/asyncGuard';
import { hapticMedium } from '@/utils/haptics';
import { useMatchLocked } from '@/hooks/useGameSelectors';
import { getPlayerNextWorldCupMatch } from '@/utils/internationalMatch';
import { getNation } from '@/data/nations';
import { GameScreen } from '@/types/game';
import { Play, Users, Shield, Trophy, Mail, ChevronRight, Flag } from 'lucide-react';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';

// Exact same icons/colors as the club Dashboard's QUICK_LINKS — Squad (Users,
// sky), Tactics (Shield, blue) — with the League tile reformatted to the
// tournament Bracket (Trophy, amber). Inbox replaces the club-only tiles
// (Training/Packs/Transfers/Cup) that don't exist in a one-off World Cup.
const QUICK_LINKS: { label: string; screen: GameScreen; icon: React.ElementType; color: string; glow: string; chip: string }[] = [
  { label: 'Squad',   screen: 'squad',                    icon: Users,  color: 'text-sky-400',   glow: 'bg-sky-500',   chip: 'bg-sky-500/10 border-sky-500/30' },
  { label: 'Tactics', screen: 'tactics',                  icon: Shield, color: 'text-blue-400',  glow: 'bg-blue-500',  chip: 'bg-blue-500/10 border-blue-500/30' },
  { label: 'Bracket', screen: 'international-tournament',  icon: Trophy, color: 'text-amber-400', glow: 'bg-amber-500', chip: 'bg-amber-500/10 border-amber-500/30' },
  { label: 'Inbox',   screen: 'inbox',                    icon: Mail,   color: 'text-cyan-400',  glow: 'bg-cyan-500',  chip: 'bg-cyan-500/10 border-cyan-500/30' },
];

const PHASE_STEPS = [
  { key: 'group', label: 'Groups' },
  { key: 'R32', label: 'R32' },
  { key: 'R16', label: 'R16' },
  { key: 'QF', label: 'QF' },
  { key: 'SF', label: 'SF' },
  { key: 'F', label: 'Final' },
] as const;

function phaseIndex(phase: string, round: string | null): number {
  if (phase === 'group') return 0;
  if (phase === 'complete') return 5;
  return ({ R32: 1, R16: 2, QF: 3, SF: 4, F: 5 } as Record<string, number>)[round || ''] ?? 0;
}

/**
 * World Cup mode home. Built to mirror the club Dashboard's layout — nation
 * identity hero, a Next Match card with the same badge→crests→VS→Play grammar,
 * a 4-up quick-links grid, and your group standings — so a player who knows the
 * normal game instantly recognises what to do. The national team is the
 * player's club, so Squad/Tactics work natively.
 */
const WorldCupDashboard = () => {
  const { nation, tournament, club, players, unread } = useGameStore(useShallow(s => ({
    nation: s.managerNationality,
    tournament: s.internationalTournament,
    club: s.clubs[s.playerClubId],
    players: s.players,
    unread: s.messages.filter(m => !m.read).length,
  })));
  const advanceWeek = useGameStore(s => s.advanceWeek);
  const setScreen = useGameStore(s => s.setScreen);
  const matchLocked = useMatchLocked();
  const reduceMotion = useReducedMotionPref();

  const nextMatch = useMemo(
    () => (nation ? getPlayerNextWorldCupMatch(tournament, nation) : null),
    [tournament, nation],
  );

  const nationGroup = useMemo(() => {
    if (!tournament || tournament.phase !== 'group' || !nation) return null;
    return tournament.groups.find(g => g.teams.includes(nation)) ?? null;
  }, [tournament, nation]);

  const squadOVR = useMemo(() => {
    if (!club) return 0;
    const ids = club.lineup?.length >= 7 ? club.lineup : club.playerIds;
    const objs = ids.map(id => players[id]).filter(Boolean);
    if (objs.length === 0) return 0;
    return Math.round(objs.reduce((s, p) => s + (p.overall || 0), 0) / objs.length);
  }, [club, players]);

  if (!nation || !tournament) {
    return <div className="max-w-lg mx-auto px-4 py-8 text-center text-sm text-muted-foreground">Loading World Cup…</div>;
  }

  const nationData = getNation(nation);
  const nationColor = nationData?.color || '#1f2937';
  const eliminated = tournament.playerEliminated && tournament.winner !== nation;
  const isChampion = tournament.phase === 'complete' && tournament.winner === nation;
  const pIdx = phaseIndex(tournament.phase, tournament.currentRound);

  const roundLabel = tournament.phase === 'group' ? 'Group Stage'
    : tournament.phase === 'complete' ? 'Final Result'
    : ({ R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-Finals', SF: 'Semi-Finals', F: 'Final' }[tournament.currentRound || ''] || 'Knockout');

  const ovrColor = squadOVR >= 80 ? 'text-emerald-400' : squadOVR >= 70 ? 'text-primary' : squadOVR >= 60 ? 'text-amber-400' : 'text-muted-foreground';

  // Play the next match live through the real engine (MatchDay handles WC mode).
  const playLive = () => {
    hapticMedium();
    setScreen('match');
  };
  // Between rounds (no player tie this round) — fast-forward via the pipeline.
  const advance = () => {
    hapticMedium();
    guardAsync(advanceWeek(), 'WorldCupDashboard.advanceWeek', { title: 'Could not advance', body: 'Please try again.' });
  };

  // Flag crest used in the Next Match card — the nation's flag (emoji renders
  // instantly and natively, no CDN dependency).
  const FlagCrest = ({ n }: { n: string }) => (
    <div className="mx-auto mb-2 text-center text-[56px] leading-none drop-shadow-lg">{getFlag(n)}</div>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Nation identity hero — mirrors the club identity hero */}
      <motion.div initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
        <div className="h-1 rounded-full" style={{ background: `linear-gradient(to right, ${nationColor}, transparent)` }} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[28px] leading-none shrink-0">{getFlag(nation)}</span>
            <div className="min-w-0">
              <p className="text-lg font-bold font-display text-foreground truncate">{nation}</p>
              <p className="text-[10px] text-muted-foreground">World Cup · {roundLabel}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Squad</p>
            <p className={cn('text-xl font-bold font-display leading-none', ovrColor)}>{squadOVR}</p>
          </div>
        </div>
        {/* Phase progress — same Groups→Final ladder as the Bracket page */}
        <div className="flex items-center gap-1 pt-1">
          {PHASE_STEPS.map((step, i) => (
            <div key={step.key} className="flex flex-col items-center flex-1">
              <div className={cn('w-full h-1.5 rounded-full transition-colors',
                i <= pIdx ? 'bg-primary' : 'bg-border/40',
                i === pIdx && tournament.phase !== 'complete' && 'animate-pulse')} />
              <span className={cn('text-[9px] mt-1 font-medium', i <= pIdx ? 'text-primary' : 'text-muted-foreground/50')}>{step.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Champion / eliminated takes the Next Match slot */}
      {isChampion ? (
        <motion.div initial={reduceMotion ? false : { scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <GlassPanel className="p-5 border-primary/40 text-center" onClick={() => setScreen('world-cup-result')} aria-label="View final result">
            <motion.div animate={reduceMotion ? undefined : { scale: [1, 1.12, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
              <Trophy className="w-9 h-9 text-primary mx-auto mb-2" />
            </motion.div>
            <p className="text-lg font-bold text-foreground font-display">World Champions!</p>
            <p className="text-xs text-primary font-medium mt-0.5">Tap to lift the trophy</p>
          </GlassPanel>
        </motion.div>
      ) : eliminated ? (
        <GlassPanel className="p-5 border-destructive/30 text-center" onClick={() => setScreen('world-cup-result')} aria-label="View summary">
          <p className="text-base font-bold text-foreground font-display">Knocked Out</p>
          <p className="text-xs text-destructive font-medium mt-0.5">
            {tournament.winner ? `${tournament.winner} went on to win it.` : 'Your run is over.'} Tap for the summary.
          </p>
        </GlassPanel>
      ) : nextMatch ? (
        <GlassPanel className="p-5 border-primary/30">
          {/* Competition badge — same pill the league Next Match card uses */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-primary/10 border-primary/30">
              <Trophy className="w-3 h-3 text-primary" />
              <span className="text-primary">World Cup</span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              {nextMatch.roundLabel}{nextMatch.group ? ` · Group ${nextMatch.group}` : ''}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1 min-w-0">
              <FlagCrest n={nextMatch.isHome ? nation : nextMatch.opponent} />
              <p className="text-sm font-bold text-foreground truncate">{nextMatch.isHome ? nation : nextMatch.opponent}</p>
              <p className="text-[10px] text-muted-foreground">{nextMatch.isHome ? 'HOME' : 'AWAY'}</p>
            </div>
            <div className="px-4"><p className="text-2xl font-black text-muted-foreground">VS</p></div>
            <div className="text-center flex-1 min-w-0">
              <FlagCrest n={nextMatch.isHome ? nextMatch.opponent : nation} />
              <p className="text-sm font-bold text-foreground truncate">{nextMatch.isHome ? nextMatch.opponent : nation}</p>
              <p className="text-[10px] text-muted-foreground">{nextMatch.isHome ? 'AWAY' : 'HOME'}</p>
            </div>
          </div>
          <Button className="w-full mt-4 gap-2" disabled={matchLocked} onClick={playLive}>
            <Play className="w-4 h-4" /> Play Match
          </Button>
        </GlassPanel>
      ) : (
        <GlassPanel className="p-5 space-y-3 text-center">
          <p className="text-sm font-semibold text-foreground">Round in progress</p>
          <p className="text-[11px] text-muted-foreground">The other ties are being decided. Advance to continue your run.</p>
          <Button className="w-full gap-2" disabled={matchLocked} onClick={advance}>
            <Play className="w-4 h-4" /> Advance Tournament
          </Button>
        </GlassPanel>
      )}

      {/* Quick links — same 4-up grid + colored chips as the club Dashboard */}
      <div className="grid grid-cols-4 gap-2.5">
        {QUICK_LINKS.map((link, i) => {
          const Icon = link.icon;
          const showBadge = link.screen === 'inbox' && unread > 0;
          return (
            <motion.div
              key={link.label}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { delay: i * 0.03, duration: 0.2 }}
            >
              <GlassPanel
                aria-label={`Navigate to ${link.label}`}
                className="group relative overflow-hidden px-2 py-3.5 flex flex-col items-center gap-2 bg-gradient-to-br from-card/70 to-card/30 border-border/60 active:scale-95 transition-transform duration-150"
                onClick={() => setScreen(link.screen)}
              >
                <span className={cn('pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full blur-2xl opacity-30', link.glow)} />
                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
                <div className={cn('relative p-1.5 rounded-lg border', link.chip)}>
                  <Icon className={cn('w-5 h-5', link.color)} />
                </div>
                <span className="relative text-xs font-semibold tracking-wide text-foreground whitespace-nowrap">{link.label}</span>
                {showBadge && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full ring-2 ring-card bg-cyan-500 text-white flex items-center justify-center font-display font-black tabular-nums leading-none text-[10px]">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </GlassPanel>
            </motion.div>
          );
        })}
      </div>

      {/* Group standings — your group at a glance, tappable to the full bracket */}
      {nationGroup && (
        <GlassPanel className="overflow-hidden" onClick={() => setScreen('international-tournament')} aria-label="Open full bracket">
          <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/10">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5 text-primary" /> {nationGroup.name}
            </h3>
            <span className="text-[10px] text-primary flex items-center gap-0.5">Full bracket <ChevronRight className="w-3 h-3" /></span>
          </div>
          <div className="px-4 py-2">
            <div className="grid grid-cols-[1fr_24px_24px_40px_32px] gap-1 text-[10px] text-muted-foreground mb-1">
              <span>Team</span><span className="text-center">P</span><span className="text-center">W</span><span className="text-center">GD</span><span className="text-center font-bold">Pts</span>
            </div>
            {nationGroup.table.map((entry, i) => {
              const isPlayer = entry.nationality === nation;
              const qualifies = i < 2;
              return (
                <div key={entry.nationality}
                  className={cn('grid grid-cols-[1fr_24px_24px_40px_32px] gap-1 py-1.5 text-xs items-center border-l-2',
                    isPlayer && 'bg-primary/5 -mx-1 px-1 rounded',
                    qualifies ? 'border-emerald-500/50' : 'border-transparent')}>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base leading-none shrink-0">{getFlag(entry.nationality)}</span>
                    <span className={cn('truncate', isPlayer ? 'font-bold text-foreground' : 'text-foreground/80')}>{entry.nationality}</span>
                  </span>
                  <span className="text-center text-muted-foreground">{entry.played}</span>
                  <span className="text-center text-muted-foreground">{entry.won}</span>
                  <span className="text-center text-muted-foreground">{entry.goalsFor - entry.goalsAgainst >= 0 ? '+' : ''}{entry.goalsFor - entry.goalsAgainst}</span>
                  <span className="text-center font-bold text-foreground">{entry.points}</span>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      )}
    </div>
  );
};

export default WorldCupDashboard;
