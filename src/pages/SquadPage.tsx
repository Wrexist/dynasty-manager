import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubNav } from '@/components/game/SubNav';
import { cn } from '@/lib/utils';
import { Position } from '@/types/game';
import { Tag, TrendingUp, TrendingDown, HeartPulse } from 'lucide-react';
import { motion } from 'framer-motion';
import { getRatingColor, getFitnessColor, getMoraleBgColor } from '@/utils/uiHelpers';
import { successToast } from '@/utils/gameToast';
import { hapticMedium } from '@/utils/haptics';
import { POSITION_FILTERS, PAGE_HINTS } from '@/config/ui';
import { PageHint } from '@/components/game/PageHint';
import { getFlag } from '@/utils/nationality';

const SUBNAV_ITEMS = [
  { screen: 'squad' as const, label: 'Squad' },
  { screen: 'training' as const, label: 'Training' },
  { screen: 'staff' as const, label: 'Staff' },
  { screen: 'youth-academy' as const, label: 'Youth' },
];

type SortKey = 'overall' | 'age' | 'value' | 'fitness' | 'morale' | 'wage' | 'form';
type StatusFilter = 'injured' | 'listed' | 'expiring';

const SORT_OPTIONS: SortKey[] = ['overall', 'age', 'value', 'fitness', 'morale', 'wage', 'form'];

const SquadPage = () => {
  const { playerClubId, clubs, players, selectPlayer, listPlayerForSale, season } = useGameStore();
  const [posFilter, setPosFilter] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>('overall');
  const [statusFilters, setStatusFilters] = useState<Set<StatusFilter>>(new Set());

  const club = clubs[playerClubId];
  if (!club) return null;

  const fullSquad = club.playerIds.map(id => players[id]).filter(Boolean);

  // Position group counts for depth summary
  const depthCounts = {
    GK: fullSquad.filter(p => p.position === 'GK').length,
    DEF: fullSquad.filter(p => ['CB', 'LB', 'RB'].includes(p.position)).length,
    MID: fullSquad.filter(p => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.position)).length,
    ATT: fullSquad.filter(p => ['LW', 'RW', 'ST'].includes(p.position)).length,
  };
  const maxDepth = Math.max(...Object.values(depthCounts), 1);

  const depthColors: Record<string, string> = {
    GK: 'bg-amber-500',
    DEF: 'bg-blue-500',
    MID: 'bg-emerald-500',
    ATT: 'bg-red-500',
  };

  // Apply filters
  let squad = [...fullSquad];

  if (POSITION_FILTERS[posFilter].positions.length > 0) {
    squad = squad.filter(p => POSITION_FILTERS[posFilter].positions.includes(p.position));
  }

  if (statusFilters.has('injured')) {
    squad = squad.filter(p => p.injured);
  }
  if (statusFilters.has('listed')) {
    squad = squad.filter(p => p.listedForSale);
  }
  if (statusFilters.has('expiring')) {
    squad = squad.filter(p => p.contractEnd <= season);
  }

  // Sort
  squad.sort((a, b) => {
    switch (sortBy) {
      case 'overall': return b.overall - a.overall;
      case 'age': return a.age - b.age;
      case 'value': return b.value - a.value;
      case 'fitness': return b.fitness - a.fitness;
      case 'morale': return b.morale - a.morale;
      case 'wage': return b.wage - a.wage;
      case 'form': return b.form - a.form;
      default: return 0;
    }
  });

  const avgOverall = fullSquad.length > 0
    ? Math.round(fullSquad.reduce((s, p) => s + p.overall, 0) / fullSquad.length)
    : 0;

  const toggleStatus = (key: StatusFilter) => {
    setStatusFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleListForSale = (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    const player = players[playerId];
    if (!player) return;
    listPlayerForSale(playerId);
    hapticMedium();
    successToast(`${player.lastName} listed for sale!`, `Asking price: £${(player.value / 1_000_000).toFixed(1)}M`);
  };

  const posGroupLabel = (pos: Position): string => {
    if (pos === 'GK') return 'GK';
    if (['CB', 'LB', 'RB'].includes(pos)) return 'DEF';
    if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'MID';
    return 'ATT';
  };

  const posBadgeColor = (pos: Position): string => {
    const group = posGroupLabel(pos);
    if (group === 'GK') return 'bg-amber-500/20 text-amber-400';
    if (group === 'DEF') return 'bg-blue-500/20 text-blue-400';
    if (group === 'MID') return 'bg-emerald-500/20 text-emerald-400';
    return 'bg-red-500/20 text-red-400';
  };

  return (
    <div className="max-w-lg mx-auto pb-4 space-y-4">
      {/* SubNav */}
      <SubNav items={SUBNAV_ITEMS} />

      <div className="px-4 space-y-4">
        <PageHint screen="squad" title={PAGE_HINTS.squad.title} body={PAGE_HINTS.squad.body} />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground font-display">Squad</h2>
            <p className="text-xs text-muted-foreground tabular-nums">
              {fullSquad.length} players · Avg {avgOverall} OVR
            </p>
          </div>
        </div>

        {/* Squad Depth Summary */}
        <GlassPanel className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Squad Depth</p>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(depthCounts).map(([group, count]) => (
              <div key={group} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground">{group}</span>
                  <span className="text-[10px] font-bold text-foreground tabular-nums">{count}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', depthColors[group])}
                    style={{ width: `${(count / maxDepth) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* Position Filter */}
        <div className="flex gap-2">
          {POSITION_FILTERS.map((f, i) => (
            <button
              key={f.label}
              onClick={() => setPosFilter(i)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                posFilter === i ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex gap-2">
          {([
            { key: 'injured' as StatusFilter, label: 'Injured' },
            { key: 'listed' as StatusFilter, label: 'Listed' },
            { key: 'expiring' as StatusFilter, label: 'Expiring' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleStatus(key)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors border',
                statusFilters.has(key)
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border/30 bg-muted/30 text-muted-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {SORT_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn(
                'px-2 py-1 rounded text-[10px] uppercase tracking-wider transition-colors whitespace-nowrap shrink-0',
                sortBy === s ? 'text-primary font-bold' : 'text-muted-foreground'
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Player List */}
        <GlassPanel className="divide-y divide-border/30">
          {squad.map((player, i) => {
            const fitnessColor = getFitnessColor(player.fitness);
            const moraleColor = getMoraleBgColor(player.morale);

            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.45), duration: 0.2 }}
                onClick={() => selectPlayer(player.id)}
                className="flex items-center gap-2 py-2.5 px-3 hover:bg-muted/30 cursor-pointer transition-colors"
              >
                {/* Overall */}
                <span className={cn('font-mono font-black text-lg w-8 shrink-0 tabular-nums', getRatingColor(player.overall))}>
                  {player.overall}
                </span>

                {/* Name + growth indicator */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-semibold text-foreground text-sm truncate">
                      {getFlag(player.nationality)} {player.firstName[0]}. {player.lastName}
                    </p>
                    {player.growthDelta && player.growthDelta > 0 && (
                      <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                    )}
                    {player.growthDelta && player.growthDelta < 0 && (
                      <TrendingDown className="w-3 h-3 text-destructive shrink-0" />
                    )}
                  </div>

                  {/* Position badge + Age */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', posBadgeColor(player.position))}>
                      {player.position}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{player.age}y</span>
                  </div>
                </div>

                {/* Fitness bar */}
                <div className="w-10 shrink-0 space-y-0.5" title={`Fitness ${player.fitness}%`}>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', fitnessColor)}
                      style={{ width: `${player.fitness}%` }}
                    />
                  </div>
                  <p className="text-[8px] text-muted-foreground text-center tabular-nums">{player.fitness}%</p>
                </div>

                {/* Morale dot */}
                <div className={cn('w-2 h-2 rounded-full shrink-0', moraleColor)} title={`Morale ${player.morale}%`} />

                {/* Status icons */}
                <div className="flex items-center gap-1 w-10 justify-end shrink-0">
                  {player.injured && (
                    <span className="flex items-center gap-0.5" title={`Injured — ${player.injuryWeeks || '?'} wk(s)`}>
                      <HeartPulse className="w-3.5 h-3.5 text-destructive" />
                      <span className="text-[8px] font-bold text-destructive">{player.injuryWeeks}w</span>
                    </span>
                  )}
                  {player.wantsToLeave && !player.injured && (
                    <span className="text-[8px] font-bold text-destructive bg-destructive/10 px-1 py-0.5 rounded" title="Wants to leave">
                      UNHAPPY
                    </span>
                  )}
                  {player.contractEnd <= season && !player.injured && (
                    <span className="text-[8px] font-bold text-amber-400 bg-amber-400/10 px-1 py-0.5 rounded" title="Contract expiring">
                      EXP
                    </span>
                  )}
                  {player.listedForSale && (
                    <span className="text-[8px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded">
                      LISTED
                    </span>
                  )}
                  {!player.listedForSale && !player.injured && (
                    <button
                      onClick={(e) => handleListForSale(e, player.id)}
                      className="text-muted-foreground hover:text-primary transition-colors p-2"
                      title="List for sale"
                    >
                      <Tag className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}

          {squad.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No players found</p>
          )}
        </GlassPanel>
      </div>
    </div>
  );
};

export default SquadPage;
