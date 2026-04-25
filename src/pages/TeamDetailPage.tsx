import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { Shield, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getRatingColor, posBadgeColor } from '@/utils/uiHelpers';
import { FlagIcon } from '@/components/game/FlagIcon';
import { PlayerCard } from '@/components/game/PlayerCard';
import { HeartPulse } from 'lucide-react';
import { LEAGUES } from '@/data/league';
import { getSuffix } from '@/utils/helpers';
import type { Player, Position } from '@/types/game';

const POSITION_GROUPS: { label: string; positions: Position[] }[] = [
  { label: 'Goalkeepers', positions: ['GK'] },
  { label: 'Defenders', positions: ['CB', 'LB', 'RB'] },
  { label: 'Midfielders', positions: ['CDM', 'CM', 'CAM', 'LM', 'RM'] },
  { label: 'Attackers', positions: ['LW', 'RW', 'ST'] },
];

const formatValue = (v: number): string => {
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `£${(v / 1_000).toFixed(0)}K`;
  return `£${v}`;
};

const TeamDetailPage = () => {
  const { selectedClubId, clubs, players, playerClubId, divisionTables, season } = useGameStore(useShallow(s => ({
    selectedClubId: s.selectedClubId, clubs: s.clubs, players: s.players,
    playerClubId: s.playerClubId, divisionTables: s.divisionTables, season: s.season,
  })));
  const setScreen = useGameStore(s => s.setScreen);
  const selectPlayer = useGameStore(s => s.selectPlayer);

  const club = selectedClubId ? clubs[selectedClubId] : null;

  // Squad (hooks must be called unconditionally)
  const squadPlayers = useMemo(() => {
    const ids = club?.playerIds || [];
    return ids.map(id => players[id]).filter(Boolean) as Player[];
  }, [club?.playerIds, players]);

  const grouped = useMemo(() =>
    POSITION_GROUPS.map(g => ({
      ...g,
      players: squadPlayers
        .filter(p => g.positions.includes(p.position))
        .sort((a, b) => b.overall - a.overall),
    })),
    [squadPlayers]
  );

  if (!club) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center space-y-3">
        <p className="text-muted-foreground">This club is no longer available.</p>
        <Button variant="secondary" onClick={() => setScreen('league-table')}>Back to League Table</Button>
      </div>
    );
  }

  const isOwnClub = selectedClubId === playerClubId;
  const division = LEAGUES.find(d => d.id === club.divisionId);

  // League table entry for this club
  const tableEntries = divisionTables[club.divisionId] || [];
  const tableIndex = tableEntries.findIndex(e => e.clubId === selectedClubId);
  const tableEntry = tableIndex >= 0 ? tableEntries[tableIndex] : null;
  const leaguePosition = tableIndex >= 0 ? tableIndex + 1 : null;

  // Squad stats
  const avgOverall = squadPlayers.length > 0 ? Math.round(squadPlayers.reduce((s, p) => s + p.overall, 0) / squadPlayers.length) : 0;
  const avgAge = squadPlayers.length > 0 ? (squadPlayers.reduce((s, p) => s + p.age, 0) / squadPlayers.length).toFixed(1) : '0';
  const totalValue = squadPlayers.reduce((s, p) => s + p.value, 0);

  // Manager info
  const managerName = isOwnClub ? 'You' : (club.aiManagerProfile?.name || 'Unknown');
  const managerStyle = club.aiManagerProfile?.style
    ? club.aiManagerProfile.style.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : null;

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      {/* Club Header */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }}>
        <GlassPanel className="p-5">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center border-2 shrink-0"
              style={{ backgroundColor: club.color, borderColor: club.secondaryColor }}
            >
              <Shield className="w-8 h-8 text-white/80" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-foreground font-display truncate">{club.name}</h1>
              <p className="text-sm text-muted-foreground">
                {division?.name || club.divisionId}
                {leaguePosition && <span className="text-foreground font-medium"> — {leaguePosition}{getSuffix(leaguePosition)}</span>}
              </p>
              {isOwnClub && (
                <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold bg-primary/20 text-primary rounded-full">
                  Your Club
                </span>
              )}
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Manager & Tactics */}
      <GlassPanel className="p-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Manager</p>
            <p className="text-sm font-medium text-foreground truncate">{managerName}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Style</p>
            <p className="text-sm font-medium text-foreground truncate">{managerStyle || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Formation</p>
            <p className="text-sm font-bold text-foreground">{club.formation}</p>
          </div>
        </div>
      </GlassPanel>

      {/* Squad Overview */}
      <GlassPanel className="p-4">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg OVR</p>
            <p className={cn('text-lg font-mono font-black tabular-nums', getRatingColor(avgOverall))}>{avgOverall}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avg Age</p>
            <p className="text-lg font-mono font-bold text-foreground tabular-nums">{avgAge}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Squad</p>
            <p className="text-lg font-mono font-bold text-foreground tabular-nums">{squadPlayers.length}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Value</p>
            <p className="text-lg font-mono font-bold text-foreground tabular-nums">{formatValue(totalValue)}</p>
          </div>
        </div>
      </GlassPanel>

      {/* Season Record */}
      {tableEntry && (
        <GlassPanel className="p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Season Record</p>
          <div className="grid grid-cols-4 gap-3 text-center mb-3">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">W-D-L</p>
              <p className="text-sm font-mono font-bold text-foreground tabular-nums">{tableEntry.won}-{tableEntry.drawn}-{tableEntry.lost}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Points</p>
              <p className="text-sm font-mono font-bold text-primary tabular-nums">{tableEntry.points}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">GF / GA</p>
              <p className="text-sm font-mono font-bold text-foreground tabular-nums">{tableEntry.goalsFor} / {tableEntry.goalsAgainst}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">GD</p>
              <p className={cn(
                'text-sm font-mono font-bold tabular-nums',
                tableEntry.goalDifference > 0 ? 'text-emerald-400' : tableEntry.goalDifference < 0 ? 'text-destructive' : 'text-foreground'
              )}>
                {tableEntry.goalDifference > 0 ? '+' : ''}{tableEntry.goalDifference}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase">Form</span>
            <div className="flex gap-0.5">
              {tableEntry.form.map((r, i) => (
                <span key={i} className={cn(
                  'w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-bold',
                  r === 'W' ? 'bg-emerald-500/20 text-emerald-400' : r === 'L' ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
                )}>{r}</span>
              ))}
            </div>
            {tableEntry.cleanSheets > 0 && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {tableEntry.cleanSheets} clean sheet{tableEntry.cleanSheets !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </GlassPanel>
      )}

      {/* Squad Roster */}
      {grouped.map(group => group.players.length > 0 && (
        <GlassPanel key={group.label} className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{group.label}</p>
            <span className="text-[10px] text-muted-foreground/60 ml-auto">{group.players.length}</span>
          </div>
          <div className="space-y-1">
            {group.players.map(p => {
              const contractYears = Math.max(0, p.contractEnd - season);
              const isStarter = club.lineup.includes(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => selectPlayer(p.id)}
                  className="flex items-center gap-2 py-2 px-2 -mx-2 rounded-lg cursor-pointer active:bg-muted/40 transition-colors"
                >
                  {/* Mini player shield — same OVR-left / POS-right layout
                      as the tactics tile so opponent rosters carry the same
                      visual language. xs (52px) keeps the row compact. */}
                  <div className="shrink-0">
                    <PlayerCard player={p} size="xs" interactive="none" compact />
                  </div>
                  {/* Name + position */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-sm font-medium truncate', isStarter ? 'text-foreground' : 'text-muted-foreground')}>
                        {p.firstName[0]}. {p.lastName}
                      </span>
                      {p.injured && (
                        <span className="flex items-center gap-0.5 shrink-0" title={`Injured — ${p.injuryWeeks || '?'} wk(s)`}>
                          <HeartPulse className="w-3 h-3 text-destructive" />
                          {p.injuryWeeks ? (
                            <span className="text-[8px] font-bold text-destructive tabular-nums">{p.injuryWeeks}w</span>
                          ) : null}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className={cn('px-1 py-0.5 rounded text-[9px] font-bold', posBadgeColor(p.position))}>
                        {p.position}
                      </span>
                      <span>Age {p.age}</span>
                    </div>
                  </div>
                  {/* Flag */}
                  <FlagIcon nationality={p.nationality} size={18} />
                  {/* Contract */}
                  <span className={cn(
                    'text-[10px] font-medium w-8 text-right shrink-0',
                    contractYears <= 1 ? 'text-amber-400' : 'text-muted-foreground'
                  )}>
                    {contractYears > 0 ? `${contractYears}y` : 'Exp'}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      ))}
    </div>
  );
};

export default TeamDetailPage;
