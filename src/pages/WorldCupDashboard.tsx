import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { FlagIcon } from '@/components/game/FlagIcon';
import { LIQUID_GLASS_SURFACE } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { guardAsync } from '@/utils/asyncGuard';
import { useMatchLocked } from '@/hooks/useGameSelectors';
import { getPlayerNextWorldCupMatch } from '@/utils/internationalMatch';
import { getNation } from '@/data/nations';
import { Play, Users, Target, Trophy, ListOrdered, ChevronRight, Swords } from 'lucide-react';

/**
 * World Cup mode home. The national team is the player's "club", so Squad and
 * Tactics work natively — this hub is the nation-adapted replacement for the
 * club Dashboard: a next-match card (the only thing you ever "do"), the
 * nation's live group standings, and quick links into the squad/tactics/full
 * bracket. The tournament IS the season; there's no league/finance/board.
 */
const WorldCupDashboard = () => {
  const { nation, tournament, club, players } = useGameStore(useShallow(s => ({
    nation: s.managerNationality,
    tournament: s.internationalTournament,
    club: s.clubs[s.playerClubId],
    players: s.players,
  })));
  const advanceWeek = useGameStore(s => s.advanceWeek);
  const setScreen = useGameStore(s => s.setScreen);
  const matchLocked = useMatchLocked();

  const nextMatch = useMemo(
    () => (nation ? getPlayerNextWorldCupMatch(tournament, nation) : null),
    [tournament, nation],
  );

  // The nation's group (group phase only) for the inline standings card.
  const nationGroup = useMemo(() => {
    if (!tournament || tournament.phase !== 'group' || !nation) return null;
    return tournament.groups.find(g => g.teams.includes(nation)) ?? null;
  }, [tournament, nation]);

  // Average overall of the starting XI — a quick "squad strength" readout so
  // the hub mirrors the club Dashboard's at-a-glance team feel.
  const squadOVR = useMemo(() => {
    if (!club) return 0;
    const ids = club.lineup?.length >= 7 ? club.lineup : club.playerIds;
    const objs = ids.map(id => players[id]).filter(Boolean);
    if (objs.length === 0) return 0;
    return Math.round(objs.reduce((s, p) => s + (p.overall || 0), 0) / objs.length);
  }, [club, players]);

  if (!nation || !tournament) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        Loading World Cup…
      </div>
    );
  }

  const nationData = getNation(nation);
  const eliminated = tournament.playerEliminated && tournament.winner !== nation;
  const isChampion = tournament.phase === 'complete' && tournament.winner === nation;

  const roundLabel = tournament.phase === 'group' ? 'Group Stage'
    : tournament.phase === 'complete' ? 'Final Result'
    : ({ R16: 'Round of 16', QF: 'Quarter-Finals', SF: 'Semi-Finals', F: 'Final' }[tournament.currentRound || ''] || 'Knockout');

  const play = () => guardAsync(
    advanceWeek(),
    'WorldCupDashboard.advanceWeek',
    { title: 'Could not play the match', body: 'Please try again.' },
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-5 pb-28 space-y-4">
      {/* Nation hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(LIQUID_GLASS_SURFACE, 'border border-primary/30 p-5 shadow-[0_0_24px_hsl(var(--primary)/0.12)]')}
      >
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ background: `linear-gradient(135deg, ${nationData?.color || '#1f2937'} 0%, transparent 60%)` }}
        />
        <div className="relative flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border border-white/15"
            style={{ backgroundColor: nationData?.color || '#1f2937' }}
          >
            <FlagIcon nationality={nation} size={40} className="rounded-md" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-primary font-bold uppercase tracking-[0.2em]">World Cup</p>
            <h1 className="text-xl font-bold text-foreground font-display truncate">{nation}</h1>
            <p className="text-xs text-amber-400 font-medium">{roundLabel}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Squad</p>
            <p className={cn(
              'text-2xl font-bold font-display leading-none',
              squadOVR >= 80 ? 'text-emerald-400' : squadOVR >= 70 ? 'text-primary' : squadOVR >= 60 ? 'text-amber-400' : 'text-muted-foreground',
            )}>{squadOVR}</p>
          </div>
        </div>
      </motion.div>

      {/* Champion / eliminated banner takes over the next-match slot */}
      {isChampion ? (
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setScreen('world-cup-result')}
          className="w-full bg-gradient-to-br from-primary/25 via-amber-500/10 to-transparent border border-primary/40 rounded-2xl p-5 text-center shadow-[0_0_30px_rgba(234,179,8,0.18)]"
        >
          <Trophy className="w-10 h-10 text-primary mx-auto mb-2" />
          <h2 className="text-lg font-bold text-foreground font-display">World Champions!</h2>
          <p className="text-sm text-primary font-medium">Tap to see your final result</p>
        </motion.button>
      ) : eliminated ? (
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setScreen('world-cup-result')}
          className="w-full bg-destructive/10 border border-destructive/30 rounded-2xl p-5 text-center"
        >
          <h2 className="text-base font-bold text-foreground font-display">Knocked Out</h2>
          <p className="text-sm text-destructive font-medium mt-0.5">
            {tournament.winner ? `${tournament.winner} went on to win it.` : 'Your World Cup run is over.'} Tap for the summary.
          </p>
        </motion.button>
      ) : nextMatch ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={cn(LIQUID_GLASS_SURFACE, 'border border-white/10 p-5')}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.18em] font-bold flex items-center gap-1.5">
              <Swords className="w-3 h-3 text-primary" /> Next Match
            </p>
            <span className="text-[10px] text-amber-400 font-semibold">{nextMatch.roundLabel}{nextMatch.group ? ` · Group ${nextMatch.group}` : ''}</span>
          </div>
          <div className="flex items-center justify-center gap-4 py-2">
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <FlagIcon nationality={nextMatch.isHome ? nation : nextMatch.opponent} size={40} className="rounded-md" />
              <span className="text-xs font-semibold text-foreground truncate max-w-full">{nextMatch.isHome ? nation : nextMatch.opponent}</span>
            </div>
            <span className="text-sm font-bold text-muted-foreground shrink-0">vs</span>
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <FlagIcon nationality={nextMatch.isHome ? nextMatch.opponent : nation} size={40} className="rounded-md" />
              <span className="text-xs font-semibold text-foreground truncate max-w-full">{nextMatch.isHome ? nextMatch.opponent : nation}</span>
            </div>
          </div>
          <Button className="w-full mt-3" disabled={matchLocked} onClick={play}>
            <Play className="w-4 h-4 mr-2" />
            Play Match
          </Button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(LIQUID_GLASS_SURFACE, 'border border-white/10 p-5 text-center')}
        >
          <p className="text-sm text-muted-foreground mb-3">Waiting on the other results in this round…</p>
          <Button className="w-full" disabled={matchLocked} onClick={play}>
            <Play className="w-4 h-4 mr-2" />
            Advance to Next Round
          </Button>
        </motion.div>
      )}

      {/* Nation's group standings (group phase only) */}
      {nationGroup && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(LIQUID_GLASS_SURFACE, 'border border-white/10')}
        >
          <button
            className="w-full px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center justify-between"
            onClick={() => setScreen('international-tournament')}
          >
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">{nationGroup.name}</h3>
            <span className="text-[10px] text-primary flex items-center gap-0.5">Full table <ChevronRight className="w-3 h-3" /></span>
          </button>
          <div className="px-4 py-2">
            <div className="grid grid-cols-[1fr_24px_24px_40px_32px] gap-1 text-[10px] text-muted-foreground mb-1">
              <span>Team</span>
              <span className="text-center">P</span>
              <span className="text-center">W</span>
              <span className="text-center">GD</span>
              <span className="text-center font-bold">Pts</span>
            </div>
            {nationGroup.table.map((entry, i) => {
              const isPlayer = entry.nationality === nation;
              const qualifies = i < 2;
              return (
                <div
                  key={entry.nationality}
                  className={cn(
                    'grid grid-cols-[1fr_24px_24px_40px_32px] gap-1 py-1.5 text-xs items-center border-l-2',
                    isPlayer && 'bg-primary/5 -mx-1 px-1 rounded',
                    qualifies ? 'border-emerald-500/50' : 'border-transparent',
                  )}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <FlagIcon nationality={entry.nationality} size={14} />
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
        </motion.div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-2">
        <QuickLink icon={Users} label="Squad" onClick={() => setScreen('squad')} />
        <QuickLink icon={Target} label="Tactics" onClick={() => setScreen('tactics')} />
        <QuickLink icon={ListOrdered} label="Bracket" onClick={() => setScreen('international-tournament')} />
      </div>
    </div>
  );
};

const QuickLink = ({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(LIQUID_GLASS_SURFACE, 'border border-white/10 p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform')}
  >
    <Icon className="w-5 h-5 text-primary" />
    <span className="text-xs font-medium text-foreground">{label}</span>
  </button>
);

export default WorldCupDashboard;
