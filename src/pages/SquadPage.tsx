import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { SubNav } from '@/components/game/SubNav';
import { ConfirmDialog } from '@/components/game/ConfirmDialog';
import { cn } from '@/lib/utils';
import { Position } from '@/types/game';
import { Tag, TrendingUp, TrendingDown, HeartPulse, Dumbbell, ShoppingCart, UserSearch, AlertTriangle, FileText, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { getRatingColor, getFitnessColor, getMoraleBgColor } from '@/utils/uiHelpers';
import { successToast } from '@/utils/gameToast';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { POSITION_FILTERS, PAGE_HINTS } from '@/config/ui';
import { PageHint } from '@/components/game/PageHint';
import { getFlag } from '@/utils/nationality';

const SUBNAV_ITEMS = [
  { screen: 'squad' as const, label: 'Squad' },
  { screen: 'training' as const, label: 'Training' },
  { screen: 'staff' as const, label: 'Staff' },
  { screen: 'youth-academy' as const, label: 'Youth' },
];

type SortKey = 'overall' | 'potential' | 'age' | 'value' | 'fitness' | 'morale' | 'wage' | 'form';
type StatusFilter = 'injured' | 'listed' | 'expiring' | 'onLoan' | 'youth' | 'starters' | 'bench' | 'unhappy';

const SORT_OPTIONS: SortKey[] = ['overall', 'potential', 'age', 'value', 'fitness', 'morale', 'wage', 'form'];

const SquadPage = () => {
  const { playerClubId, clubs, players, selectPlayer, listPlayerForSale, setScreen, season, training } = useGameStore();
  const [posFilter, setPosFilter] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>('overall');
  const [sortAsc, setSortAsc] = useState(false);
  const [statusFilters, setStatusFilters] = useState<Set<StatusFilter>>(new Set());
  const [confirmListId, setConfirmListId] = useState<string | null>(null);

  const club = clubs[playerClubId];

  const fullSquad = useMemo(() => (club?.playerIds || []).map(id => players[id]).filter(Boolean), [club?.playerIds, players]);

  const lineupSet = useMemo(() => new Set(club?.lineup || []), [club?.lineup]);
  const subsSet = useMemo(() => new Set(club?.subs || []), [club?.subs]);

  // Position group counts for depth summary
  const depthCounts = useMemo(() => ({
    GK: fullSquad.filter(p => p.position === 'GK').length,
    DEF: fullSquad.filter(p => ['CB', 'LB', 'RB'].includes(p.position)).length,
    MID: fullSquad.filter(p => ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.position)).length,
    ATT: fullSquad.filter(p => ['LW', 'RW', 'ST'].includes(p.position)).length,
  }), [fullSquad]);
  const maxDepth = Math.max(...Object.values(depthCounts), 1);

  const depthColors: Record<string, string> = {
    GK: 'bg-amber-500',
    DEF: 'bg-blue-500',
    MID: 'bg-emerald-500',
    ATT: 'bg-red-500',
  };

  // Apply filters and sort
  const squad = useMemo(() => {
    let filtered = [...fullSquad];

    if (POSITION_FILTERS[posFilter].positions.length > 0) {
      filtered = filtered.filter(p => POSITION_FILTERS[posFilter].positions.includes(p.position));
    }

    if (statusFilters.has('injured')) {
      filtered = filtered.filter(p => p.injured);
    }
    if (statusFilters.has('listed')) {
      filtered = filtered.filter(p => p.listedForSale);
    }
    if (statusFilters.has('expiring')) {
      filtered = filtered.filter(p => p.contractEnd <= season);
    }
    if (statusFilters.has('onLoan')) {
      filtered = filtered.filter(p => p.onLoan);
    }
    if (statusFilters.has('youth')) {
      filtered = filtered.filter(p => p.isFromYouthAcademy);
    }
    if (statusFilters.has('starters')) {
      filtered = filtered.filter(p => lineupSet.has(p.id));
    }
    if (statusFilters.has('bench')) {
      filtered = filtered.filter(p => subsSet.has(p.id));
    }
    if (statusFilters.has('unhappy')) {
      filtered = filtered.filter(p => p.wantsToLeave);
    }

    filtered.sort((a, b) => {
      let cmp: number;
      switch (sortBy) {
        case 'overall': cmp = b.overall - a.overall; break;
        case 'potential': cmp = b.potential - a.potential; break;
        case 'age': cmp = a.age - b.age; break;
        case 'value': cmp = b.value - a.value; break;
        case 'fitness': cmp = b.fitness - a.fitness; break;
        case 'morale': cmp = b.morale - a.morale; break;
        case 'wage': cmp = b.wage - a.wage; break;
        case 'form': cmp = b.form - a.form; break;
        default: cmp = 0;
      }
      return sortAsc ? -cmp : cmp;
    });

    return filtered;
  }, [fullSquad, posFilter, statusFilters, sortBy, sortAsc, season, lineupSet, subsSet]);

  const avgOverall = useMemo(() => fullSquad.length > 0
    ? Math.round(fullSquad.reduce((s, p) => s + p.overall, 0) / fullSquad.length)
    : 0, [fullSquad]);

  if (!club) return null;

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
    setConfirmListId(playerId);
  };

  const confirmList = () => {
    if (!confirmListId) return;
    const player = players[confirmListId];
    if (!player) return;
    const result = listPlayerForSale(confirmListId);
    hapticMedium();
    if (result.appeased) {
      successToast(`${player.lastName} appreciates your honesty!`, 'Transfer request withdrawn — morale improved.');
    } else {
      successToast(`${player.lastName} listed for sale!`, `Asking price: £${(player.value / 1_000_000).toFixed(1)}M. Offers will appear in your Inbox.`);
    }
    setConfirmListId(null);
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

        {/* Contract Expiry Alerts */}
        {(() => {
          const expiring = fullSquad.filter(p => p.contractEnd <= season);
          const nearExpiry = fullSquad.filter(p => p.contractEnd === season + 1);
          if (expiring.length === 0 && nearExpiry.length === 0) return null;
          return (
            <GlassPanel className="p-3 border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Contract Alerts</p>
              </div>
              <div className="space-y-1">
                {expiring.length > 0 && (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                    <p className="text-[10px] text-destructive">
                      <span className="font-bold">{expiring.length} player{expiring.length > 1 ? 's' : ''}</span> contract{expiring.length > 1 ? 's' : ''} expiring this season: {expiring.map(p => p.lastName).join(', ')}
                    </p>
                  </div>
                )}
                {nearExpiry.length > 0 && (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-300">
                      <span className="font-bold">{nearExpiry.length} player{nearExpiry.length > 1 ? 's' : ''}</span> contract{nearExpiry.length > 1 ? 's' : ''} expiring next season: {nearExpiry.map(p => p.lastName).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </GlassPanel>
          );
        })()}

        {/* Positional Depth Chart */}
        {(() => {
          const positions: { pos: string; label: string; players: typeof fullSquad }[] = [
            { pos: 'GK', label: 'GK', players: fullSquad.filter(p => p.position === 'GK') },
            { pos: 'CB', label: 'CB', players: fullSquad.filter(p => p.position === 'CB') },
            { pos: 'LB', label: 'LB', players: fullSquad.filter(p => p.position === 'LB') },
            { pos: 'RB', label: 'RB', players: fullSquad.filter(p => p.position === 'RB') },
            { pos: 'CDM', label: 'CDM', players: fullSquad.filter(p => p.position === 'CDM') },
            { pos: 'CM', label: 'CM', players: fullSquad.filter(p => p.position === 'CM') },
            { pos: 'CAM', label: 'CAM', players: fullSquad.filter(p => p.position === 'CAM') },
            { pos: 'LW', label: 'LW', players: fullSquad.filter(p => ['LW', 'LM'].includes(p.position)) },
            { pos: 'RW', label: 'RW', players: fullSquad.filter(p => ['RW', 'RM'].includes(p.position)) },
            { pos: 'ST', label: 'ST', players: fullSquad.filter(p => p.position === 'ST') },
          ];
          const weakPositions = positions.filter(p => p.players.length < 2 && p.pos !== 'GK')
            .concat(positions.filter(p => p.pos === 'GK' && p.players.length < 1));
          if (weakPositions.length === 0) return null;
          return (
            <GlassPanel className="p-3 border-blue-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">Squad Gaps</p>
              </div>
              <p className="text-[10px] text-muted-foreground">
                You lack depth at: {weakPositions.map(p => <span key={p.pos} className="font-bold text-blue-300">{p.label} ({p.players.length})</span>).reduce<React.ReactNode[]>((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])}
                . Consider signing backup players.
              </p>
            </GlassPanel>
          );
        })()}

        {/* Position Filter */}
        <div className="flex gap-2">
          {POSITION_FILTERS.map((f, i) => (
            <button
              key={f.label}
              onClick={() => { hapticLight(); setPosFilter(i); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors active:scale-[0.95]',
                posFilter === i ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {([
            { key: 'injured' as StatusFilter, label: 'Injured' },
            { key: 'listed' as StatusFilter, label: 'Listed' },
            { key: 'expiring' as StatusFilter, label: 'Expiring' },
            { key: 'starters' as StatusFilter, label: 'Starters' },
            { key: 'bench' as StatusFilter, label: 'Bench' },
            { key: 'onLoan' as StatusFilter, label: 'On Loan' },
            { key: 'youth' as StatusFilter, label: 'Youth' },
            { key: 'unhappy' as StatusFilter, label: 'Unhappy' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleStatus(key)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors border whitespace-nowrap shrink-0',
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
              onClick={() => {
                hapticLight();
                if (sortBy === s) {
                  setSortAsc(prev => !prev);
                } else {
                  setSortBy(s);
                  setSortAsc(s === 'age');
                }
              }}
              className={cn(
                'px-2 py-1 rounded text-[10px] uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 active:scale-[0.95]',
                sortBy === s ? 'text-primary font-bold' : 'text-muted-foreground'
              )}
            >
              {s}{sortBy === s ? (sortAsc ? ' ↑' : ' ↓') : ''}
            </button>
          ))}
        </div>

        {/* Player List */}
        <GlassPanel className="divide-y divide-border/30">
          {squad.length === 0 && (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {statusFilters.size > 0 ? 'No players match your filters' : 'No players in your squad'}
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                {statusFilters.size > 0 ? 'Try clearing your filters above' : 'Sign players from the transfer market or check free agents'}
              </p>
              {statusFilters.size === 0 && (
                <div className="flex gap-2 justify-center pt-1">
                  <button onClick={() => setScreen('transfer')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
                    <ShoppingCart className="w-3 h-3" /> Transfer Market
                  </button>
                  <button onClick={() => setScreen('scouting')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted/50 text-muted-foreground hover:bg-muted transition-colors">
                    <UserSearch className="w-3 h-3" /> Scout Players
                  </button>
                </div>
              )}
            </div>
          )}
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
                role="button"
                tabIndex={0}
                aria-label={`View ${player.firstName} ${player.lastName}`}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPlayer(player.id); } }}
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
                    {player.growthDelta > 0 && (
                      <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                    )}
                    {player.growthDelta < 0 && (
                      <TrendingDown className="w-3 h-3 text-destructive shrink-0" />
                    )}
                  </div>

                  {/* Position badge + Age */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', posBadgeColor(player.position))}>
                      {player.position}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{player.age}y</span>
                    {lineupSet.has(player.id) && (
                      <span className="text-[8px] font-bold text-emerald-400 bg-emerald-400/10 px-1 py-0.5 rounded">XI</span>
                    )}
                    {subsSet.has(player.id) && (
                      <span className="text-[8px] font-bold text-amber-400 bg-amber-400/10 px-1 py-0.5 rounded">SUB</span>
                    )}
                    {(training.individualPlans || []).some(p => p.playerId === player.id) && (
                      <Dumbbell className="w-3 h-3 text-primary/70 shrink-0" title="Individual training plan set" />
                    )}
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

        </GlassPanel>
      </div>

      {/* Confirm List for Sale Dialog */}
      <ConfirmDialog
        open={!!confirmListId}
        onOpenChange={(open) => { if (!open) setConfirmListId(null); }}
        title="List Player for Sale?"
        description={
          confirmListId && players[confirmListId]
            ? `${players[confirmListId].firstName} ${players[confirmListId].lastName} (${players[confirmListId].overall} OVR) will be listed at ~£${(players[confirmListId].value / 1_000_000).toFixed(1)}M. Other clubs may make offers via your Inbox.`
            : ''
        }
        confirmLabel="List for Sale"
        variant="default"
        onConfirm={confirmList}
      />
    </div>
  );
};

export default SquadPage;
