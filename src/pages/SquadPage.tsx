import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ListForSaleModal } from '@/components/game/ListForSaleModal';
import { PlayerRatingBadge } from '@/components/game/PlayerRatingBadge';
import { cn } from '@/lib/utils';
import { Player } from '@/types/game';
import { Tag, TrendingUp, TrendingDown, HeartPulse, Dumbbell, ShoppingCart, UserSearch, AlertTriangle, FileText, Users, LogOut, Smile, Meh, Frown, Repeat2, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { getRatingColor, getFitnessColor, posBadgeColor } from '@/utils/uiHelpers';
import type { ElementType } from 'react';
import { successToast } from '@/utils/gameToast';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { POSITION_FILTERS, PAGE_HINTS } from '@/config/ui';
import { PageHint } from '@/components/game/PageHint';
import { FlagIcon } from '@/components/game/FlagIcon';
import { getContractUrgency } from '@/utils/contracts';

type SortKey = 'overall' | 'potential' | 'age' | 'value' | 'fitness' | 'morale' | 'wage' | 'form';
type StatusFilter = 'injured' | 'listed' | 'expiring' | 'onLoan' | 'youth' | 'starters' | 'bench' | 'unhappy';

const SORT_OPTIONS: SortKey[] = ['overall', 'potential', 'age', 'value', 'fitness', 'morale', 'wage', 'form'];

function getMoraleIcon(morale: number): { Icon: ElementType; color: string; label: string } {
  if (morale >= 60) return { Icon: Smile, color: 'text-emerald-400', label: 'Happy' };
  if (morale >= 35) return { Icon: Meh, color: 'text-amber-400', label: 'Unsettled' };
  return { Icon: Frown, color: 'text-red-400', label: 'Low' };
}


function getFormLabel(form: number): { label: string; color: string } {
  if (form >= 70) return { label: 'Hot', color: 'text-emerald-400' };
  if (form >= 45) return { label: 'OK', color: 'text-muted-foreground' };
  return { label: 'Cold', color: 'text-red-400' };
}

function ContractAlertChip({ p, variant, onSelect, onRenew }: {
  p: Player; variant: 'expired' | 'near';
  onSelect: (id: string) => void; onRenew: (id: string) => void;
}) {
  const isExpired = variant === 'expired';
  const borderColor = isExpired ? 'border-destructive/20' : 'border-amber-400/20';
  const bgColor = isExpired ? 'bg-destructive/10' : 'bg-amber-400/10';
  const nameColor = isExpired ? 'text-destructive' : 'text-amber-300';
  const btnBg = isExpired ? 'bg-destructive/10 hover:bg-destructive/20' : 'bg-amber-400/10 hover:bg-amber-400/20';
  const btnText = isExpired ? 'text-destructive/80 hover:text-destructive' : 'text-amber-400/80 hover:text-amber-400';

  return (
    <div className={cn('flex items-center gap-1.5 border rounded-lg px-2 py-1.5', bgColor, borderColor)}>
      <span className={cn('text-[11px] font-bold tabular-nums leading-none', getRatingColor(p.overall))}>
        {p.overall}
      </span>
      <FlagIcon nationality={p.nationality} size={12} />
      <span className={cn('text-[8px] font-bold px-1 py-0.5 rounded leading-none', posBadgeColor(p.position))}>
        {p.position}
      </span>
      <button
        onClick={() => onSelect(p.id)}
        className={cn('text-[10px] font-medium hover:underline truncate max-w-[80px]', nameColor)}
        title={`${p.firstName} ${p.lastName}`}
      >
        {p.lastName}
      </button>
      <span className="text-[9px] text-muted-foreground tabular-nums">{p.age}y</span>
      {p.injured ? (
        <span className="text-[8px] font-bold text-muted-foreground/50 px-1" title="Cannot renew while injured">INJ</span>
      ) : p.onLoan ? (
        <span className="text-[8px] font-bold text-muted-foreground/50 px-1" title="Cannot renew while on loan">LOAN</span>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); hapticLight(); onRenew(p.id); }}
          className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded transition-colors', btnText, btnBg)}
        >
          Renew
        </button>
      )}
    </div>
  );
}

const SquadPage = () => {
  const { playerClubId, clubs, players, season, training } = useGameStore(useShallow(s => ({
    playerClubId: s.playerClubId, clubs: s.clubs, players: s.players,
    season: s.season, training: s.training,
  })));
  const selectPlayer = useGameStore(s => s.selectPlayer);
  const setScreen = useGameStore(s => s.setScreen);
  const startNegotiation = useGameStore(s => s.startNegotiation);
  const [posFilter, setPosFilter] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>('overall');
  const [sortAsc, setSortAsc] = useState(false);
  const [statusFilters, setStatusFilters] = useState<Set<StatusFilter>>(new Set());
  const [confirmListId, setConfirmListId] = useState<string | null>(null);
  const [contractAlertsOpen, setContractAlertsOpen] = useState(true);

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

  const contractAlerts = useMemo(() => {
    const byRating = (a: Player, b: Player) => b.overall - a.overall;
    const expiring = fullSquad.filter(p => getContractUrgency(p.contractEnd, season) === 'expired').sort(byRating);
    const nearExpiry = fullSquad.filter(p => getContractUrgency(p.contractEnd, season) === 'near').sort(byRating);
    return { expiring, nearExpiry, total: expiring.length + nearExpiry.length };
  }, [fullSquad, season]);

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
      filtered = filtered.filter(p => getContractUrgency(p.contractEnd, season) !== null);
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

  const handleRenew = (playerId: string) => {
    const result = startNegotiation(playerId, true);
    if (result && !result.success) {
      toast.error(result.lockedWeeks
        ? `Negotiations locked for ${result.lockedWeeks} more week${result.lockedWeeks !== 1 ? 's' : ''}`
        : 'Unable to start negotiations');
    }
  };

  const handleListComplete = (appeased: boolean) => {
    if (!confirmListId) return;
    const player = players[confirmListId];
    if (!player) return;
    hapticMedium();
    if (appeased) {
      successToast(`${player.lastName} appreciates your honesty!`, 'Transfer request withdrawn — morale improved.');
    } else {
      successToast(`${player.lastName} listed for sale!`, 'Offers will appear in your Inbox.');
    }
    setConfirmListId(null);
  };

  return (
    <div className="max-w-lg mx-auto pb-4 space-y-4">
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
        {contractAlerts.total > 0 && (
          <GlassPanel className="p-3 border-amber-500/20">
            <button
              onClick={() => { hapticLight(); setContractAlertsOpen(prev => !prev); }}
              className="flex items-center gap-2 w-full"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Contract Alerts</p>
              <span className="text-[9px] font-bold text-amber-400 bg-amber-400/15 px-1.5 py-0.5 rounded-full tabular-nums">
                {contractAlerts.total}
              </span>
              <ChevronDown className={cn(
                'w-3 h-3 text-amber-400/60 ml-auto transition-transform duration-200',
                !contractAlertsOpen && '-rotate-90'
              )} />
            </button>
            {contractAlertsOpen && (
              <div className="space-y-2.5 mt-2.5">
                {contractAlerts.expiring.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-2.5 h-2.5 text-destructive shrink-0" />
                      <p className="text-[9px] text-destructive font-semibold">
                        Expiring this season ({contractAlerts.expiring.length})
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {contractAlerts.expiring.map(p => (
                        <ContractAlertChip key={p.id} p={p} variant="expired" onSelect={selectPlayer} onRenew={handleRenew} />
                      ))}
                    </div>
                  </div>
                )}
                {contractAlerts.nearExpiry.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                      <p className="text-[9px] text-amber-400 font-semibold">
                        Expiring next season ({contractAlerts.nearExpiry.length})
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {contractAlerts.nearExpiry.map(p => (
                        <ContractAlertChip key={p.id} p={p} variant="near" onSelect={selectPlayer} onRenew={handleRenew} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </GlassPanel>
        )}

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
        <div className="space-y-1.5">
          {squad.length === 0 && (
            <GlassPanel className="p-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {statusFilters.size > 0 ? 'No players match your filters' : 'No players in your squad'}
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                {statusFilters.size > 0 ? 'Try clearing your filters above' : 'Sign players from the transfer market or check free agents'}
              </p>
              {statusFilters.size === 0 && (
                <div className="flex gap-2 justify-center pt-1">
                  <button onClick={() => setScreen('transfers')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
                    <ShoppingCart className="w-3 h-3" /> Transfer Market
                  </button>
                  <button onClick={() => setScreen('scouting')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted/50 text-muted-foreground hover:bg-muted transition-colors">
                    <UserSearch className="w-3 h-3" /> Scout Players
                  </button>
                </div>
              )}
            </GlassPanel>
          )}
          {squad.map((player, i) => {
            const fitnessColor = getFitnessColor(player.fitness);
            const morale = getMoraleIcon(player.morale);
            const form = getFormLabel(player.form);
            const contractUrgency = getContractUrgency(player.contractEnd, season);
            // Determine the single most important status to show (priority order)
            const statusBadge = player.injured
              ? 'injured' as const
              : player.wantsToLeave
                ? 'wantsOut' as const
                : player.onLoan
                  ? 'onLoan' as const
                  : player.listedForSale
                    ? 'listed' as const
                    : null;

            return (
              <motion.div
                key={player.id}
                initial={i < 15 ? { opacity: 0, y: 6 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.15 }}
                onClick={() => selectPlayer(player.id)}
                role="button"
                tabIndex={0}
                aria-label={`View ${player.firstName} ${player.lastName}`}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPlayer(player.id); } }}
                className={cn(
                  'flex items-center gap-2.5 py-2.5 px-3 cursor-pointer transition-all rounded-xl',
                  'bg-card/50 backdrop-blur-sm border border-border/30',
                  'hover:bg-card/80 hover:border-border/50 active:scale-[0.99]',
                  player.wantsToLeave && 'border-amber-500/25',
                  player.injured && 'opacity-60',
                )}
              >
                {/* Overall Rating Badge */}
                <PlayerRatingBadge overall={player.overall} size="md" />

                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-foreground text-sm truncate">
                      <FlagIcon nationality={player.nationality} size={16} /> {player.firstName[0]}. {player.lastName}
                    </p>
                    {player.growthDelta > 0 && (
                      <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                    )}
                    {player.growthDelta < 0 && (
                      <TrendingDown className="w-3 h-3 text-destructive shrink-0" />
                    )}
                  </div>

                  {/* Position + Age + Status Row */}
                  <div className="flex items-center gap-1.5 mt-1">
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
                      <span title="Individual training plan set"><Dumbbell className="w-3 h-3 text-primary/70 shrink-0" /></span>
                    )}
                  </div>
                </div>

                {/* Fitness + Morale + Form Column */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Form indicator */}
                  <span className={cn('text-[9px] font-bold tabular-nums w-7 text-center', form.color)} title={`Form: ${player.form}`}>
                    {form.label}
                  </span>

                  {/* Fitness bar */}
                  <div className="w-11 space-y-0.5" title={`Fitness ${player.fitness}%`}>
                    <div className="h-1.5 bg-muted/80 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', fitnessColor)}
                        style={{ width: `${player.fitness}%` }}
                      />
                    </div>
                    <p className="text-[8px] text-muted-foreground text-center tabular-nums">{player.fitness}%</p>
                  </div>

                  {/* Morale icon */}
                  <morale.Icon className={cn('w-3.5 h-3.5 shrink-0', morale.color)} title={`Morale: ${morale.label} (${player.morale}%)`} />
                </div>

                {/* Contract urgency indicator — always allocate space for alignment */}
                <div className="w-6 shrink-0 flex items-center justify-center">
                  {contractUrgency && !player.onLoan && !player.injured && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        hapticLight();
                        startNegotiation(player.id, true);
                      }}
                      className={cn(
                        'p-1 rounded-md transition-colors',
                        contractUrgency === 'expired'
                          ? 'text-destructive hover:bg-destructive/10'
                          : 'text-amber-400 hover:bg-amber-400/10'
                      )}
                      title={contractUrgency === 'expired'
                        ? `Contract expires end of this season (S${player.contractEnd})`
                        : `Contract expires end of next season (S${player.contractEnd})`}
                      aria-label={`Negotiate renewal for ${player.firstName} ${player.lastName}`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Status Column — single priority badge to prevent overflow */}
                <div className="flex items-center justify-end shrink-0 w-11">
                  {statusBadge === 'injured' && (
                    <span className="flex items-center gap-0.5" title={`Injured — ${player.injuryWeeks || '?'} wk(s)`}>
                      <HeartPulse className="w-3.5 h-3.5 text-destructive" />
                      <span className="text-[8px] font-bold text-destructive tabular-nums">{player.injuryWeeks}w</span>
                    </span>
                  )}
                  {statusBadge === 'wantsOut' && (
                    <span
                      className="flex items-center gap-0.5 text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-md"
                      title="Wants to leave the club"
                    >
                      <LogOut className="w-2.5 h-2.5" />
                      <span className="text-[7px] font-bold uppercase tracking-wide">Out</span>
                    </span>
                  )}
                  {statusBadge === 'onLoan' && (
                    <span
                      className="flex items-center gap-0.5 text-sky-400 bg-sky-400/10 border border-sky-400/20 px-1.5 py-0.5 rounded-md"
                      title="On loan"
                    >
                      <Repeat2 className="w-2.5 h-2.5" />
                      <span className="text-[7px] font-bold uppercase tracking-wide">Loan</span>
                    </span>
                  )}
                  {statusBadge === 'listed' && (
                    <span className="text-[8px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                      LISTED
                    </span>
                  )}
                  {!statusBadge && (
                    <button
                      onClick={(e) => handleListForSale(e, player.id)}
                      className="text-muted-foreground/40 hover:text-primary transition-colors p-1.5"
                      title="List for sale"
                    >
                      <Tag className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}

        </div>
      </div>

      {/* List for Sale Modal */}
      {confirmListId && players[confirmListId] && (
        <ListForSaleModal
          player={players[confirmListId]}
          onClose={() => setConfirmListId(null)}
          onListed={handleListComplete}
        />
      )}
    </div>
  );
};

export default SquadPage;
