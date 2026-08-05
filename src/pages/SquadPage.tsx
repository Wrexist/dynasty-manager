import { useState, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { GlassPanel } from '@/components/game/GlassPanel';
import { PlayerCard } from '@/components/game/PlayerCard';
import { cn } from '@/lib/utils';
import { Player } from '@/types/game';
import type { SquadSortKey, SquadStatusFilter } from '@/types/game';
import { ShoppingCart, UserSearch, AlertTriangle, FileText, Users, ChevronDown, ArrowUp, ArrowDown, PenLine, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { getRatingColor, posBadgeColor } from '@/utils/uiHelpers';
import { hapticLight } from '@/utils/haptics';
import { POSITION_FILTERS, PAGE_HINTS } from '@/config/ui';
import { PageHint } from '@/components/game/PageHint';
import { FlagIcon } from '@/components/game/FlagIcon';
import { getContractUrgency } from '@/utils/contracts';
import { StatusPill } from '@/components/game/StatusPill';
import { PlayerStatusBadges } from '@/components/game/PlayerStatusBadges';
import { compareSquadToLeague } from '@/utils/squadStrength';

const SORT_OPTIONS: SquadSortKey[] = ['overall', 'potential', 'age', 'value', 'fitness', 'morale', 'wage', 'form'];
// World Cup mode has no club economy — drop the value/wage sorts (national
// players carry no transfer value or wage in this context).
const WC_SORT_OPTIONS: SquadSortKey[] = ['overall', 'potential', 'age', 'fitness', 'morale', 'form'];

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
      <span className={cn('text-micro font-bold px-1 py-0.5 rounded leading-none', posBadgeColor(p.position))}>
        {p.position}
      </span>
      <button
        onClick={() => onSelect(p.id)}
        className={cn('text-micro font-medium hover:underline truncate max-w-[80px]', nameColor)}
        title={`${p.firstName} ${p.lastName}`}
      >
        {p.lastName}
      </button>
      <span className="text-micro text-muted-foreground tabular-nums">{p.age}y</span>
      {p.injured ? (
        <span className="text-micro font-bold text-muted-foreground/50 px-1" title="Cannot renew while injured">INJ</span>
      ) : p.onLoan ? (
        <span className="text-micro font-bold text-muted-foreground/50 px-1" title="Cannot renew while on loan">LOAN</span>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); hapticLight(); onRenew(p.id); }}
          // Keep the chip visually tiny but give the touch target real size —
          // the visible pill was ~16px tall, easy to mis-tap next to the name.
          className={cn('relative text-micro font-bold px-1.5 py-0.5 rounded transition-colors after:absolute after:-inset-2 after:content-[""]', btnText, btnBg)}
        >
          Renew
        </button>
      )}
    </div>
  );
}

const SquadPage = () => {
  const { t } = useTranslation();
  const { playerClubId, clubs, players, season, week, leagueTable, gameMode } = useGameStore(useShallow(s => ({
    playerClubId: s.playerClubId, clubs: s.clubs, players: s.players,
    season: s.season, week: s.week, leagueTable: s.leagueTable, gameMode: s.gameMode,
  })));
  const isWorldCup = gameMode === 'world-cup';
  const selectPlayer = useGameStore(s => s.selectPlayer);
  const setScreen = useGameStore(s => s.setScreen);
  const startNegotiation = useGameStore(s => s.startNegotiation);
  const [posFilter, setPosFilter] = useState(0);
  const [sortBy, setSortBy] = useState<SquadSortKey>('overall');
  const [sortAsc, setSortAsc] = useState(false);
  const [statusFilters, setStatusFilters] = useState<Set<SquadStatusFilter>>(new Set());
  const [contractAlertsOpen, setContractAlertsOpen] = useState(false);

  const club = clubs[playerClubId];

  const fullSquad = useMemo(() => (club?.playerIds || []).map(id => players[id]).filter(Boolean), [club?.playerIds, players]);

  const lineupSet = useMemo(() => new Set(club?.lineup || []), [club?.lineup]);
  const subsSet = useMemo(() => new Set(club?.subs || []), [club?.subs]);

  // Position group counts for depth summary. Single-pass tally so we walk
  // the squad once instead of four times per memo, and we fold `maxDepth`
  // into the same memo so it doesn't recompute on unrelated re-renders.
  const { depthCounts, maxDepth } = useMemo(() => {
    const counts = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
    for (const p of fullSquad) {
      const pos = p.position;
      if (pos === 'GK') counts.GK++;
      else if (pos === 'CB' || pos === 'LB' || pos === 'RB') counts.DEF++;
      else if (pos === 'CDM' || pos === 'CM' || pos === 'CAM' || pos === 'LM' || pos === 'RM') counts.MID++;
      else counts.ATT++;
    }
    return {
      depthCounts: counts,
      maxDepth: Math.max(counts.GK, counts.DEF, counts.MID, counts.ATT, 1),
    };
  }, [fullSquad]);

  const contractAlerts = useMemo(() => {
    const byRating = (a: Player, b: Player) => b.overall - a.overall;
    const expiring = fullSquad.filter(p => getContractUrgency(p.contractEnd, season) === 'expired').sort(byRating);
    const nearExpiry = fullSquad.filter(p => getContractUrgency(p.contractEnd, season) === 'near').sort(byRating);
    return { expiring, nearExpiry, total: expiring.length + nearExpiry.length };
  }, [fullSquad, season]);

  // "Squad vs League" — your per-group average overall against the rest of the
  // clubs in your division. Drives transfer focus (a red ATT row = go buy a
  // striker). Compares against the league *excluding your own club* so the
  // benchmark isn't diluted by your own squad. Only meaningful once there are
  // other clubs in the table.
  const squadVsLeague = useMemo(() => {
    const otherClubIds = leagueTable.map(e => e.clubId).filter(id => id !== playerClubId);
    if (otherClubIds.length === 0) return null;
    return compareSquadToLeague(fullSquad, otherClubIds, clubs, players);
  }, [fullSquad, leagueTable, clubs, players, playerClubId]);

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

  const toggleStatus = (key: SquadStatusFilter) => {
    setStatusFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleRenew = (playerId: string) => {
    const result = startNegotiation(playerId, true);
    if (result && !result.success) {
      toast.error(result.lockedWeeks
        ? `Negotiations locked for ${result.lockedWeeks} more week${result.lockedWeeks !== 1 ? 's' : ''}`
        : 'Unable to start negotiations');
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-4 space-y-4">
      <div className="px-4 space-y-4">
        <PageHint screen="squad" title={PAGE_HINTS.squad.title} body={PAGE_HINTS.squad.body} />

        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground font-display">Squad</h2>
            <p className="text-xs text-muted-foreground tabular-nums">
              {fullSquad.length} players · Avg {avgOverall} OVR
            </p>
          </div>
          {/* This page is read-only — the LineupEditor lives on Tactics. Without
              this the tab named "Squad" couldn't set the XI and didn't say
              where to. */}
          <button
            type="button"
            onClick={() => { hapticLight(); setScreen('tactics'); }}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 active:scale-[0.97] transition-all"
          >
            <PenLine className="w-3.5 h-3.5" /> Edit Lineup
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Squad Depth Summary */}
        <GlassPanel className="p-3">
          <p className="text-micro text-muted-foreground uppercase tracking-wider mb-2">Squad Depth</p>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(depthCounts).map(([group, count]) => (
              <div key={group} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-micro font-semibold text-muted-foreground">{group}</span>
                  <span className="text-micro font-bold text-foreground tabular-nums">{count}</span>
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

        {/* Squad vs League — per-position-group strength benchmark to guide transfers */}
        {squadVsLeague && (
          <GlassPanel className="p-3">
            <p className="text-micro text-muted-foreground uppercase tracking-wider mb-2">Squad vs League</p>
            <div className="space-y-1.5">
              {squadVsLeague.map(row => {
                const hasPlayers = row.count > 0;
                const deltaTone = !hasPlayers
                  ? 'text-destructive'
                  : row.delta > 1 ? 'text-emerald-400'
                    : row.delta < -1 ? 'text-red-400'
                      : 'text-muted-foreground';
                return (
                  <div key={row.group} className="flex items-center gap-3">
                    <span className="text-micro font-semibold text-muted-foreground w-8 shrink-0">{row.group}</span>
                    <span className={cn('text-sm font-bold tabular-nums w-7 text-right', hasPlayers ? getRatingColor(row.mine) : 'text-muted-foreground/40')}>
                      {hasPlayers ? row.mine : '—'}
                    </span>
                    <span className="text-micro text-muted-foreground tabular-nums shrink-0">vs lg {row.league}</span>
                    <span className={cn('ml-auto text-[11px] font-bold tabular-nums', deltaTone)}>
                      {!hasPlayers ? 'No players' : row.delta > 0 ? `+${row.delta}` : row.delta}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-micro text-muted-foreground/60 mt-2">Average overall by position vs the rest of your league.</p>
          </GlassPanel>
        )}

        {/* Contract Expiry Alerts */}
        {!isWorldCup && contractAlerts.total > 0 && (
          <GlassPanel className="p-3 border-amber-500/20">
            <button
              onClick={() => { hapticLight(); setContractAlertsOpen(prev => !prev); }}
              className="flex items-center gap-2 w-full"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <p className="text-micro text-amber-400 font-semibold uppercase tracking-wider">Contract Alerts</p>
              <span className="text-micro font-bold text-amber-400 bg-amber-400/15 px-1.5 py-0.5 rounded-full tabular-nums">
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
                      <p className="text-micro text-destructive font-semibold">
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
                      <p className="text-micro text-amber-400 font-semibold">
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
                <p className="text-micro text-blue-400 font-semibold uppercase tracking-wider">Squad Gaps</p>
              </div>
              <p className="text-micro text-muted-foreground">
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
            { key: 'injured' as SquadStatusFilter, label: 'Injured' },
            // Club-economy filters (transfer list / contract / loans) are
            // meaningless for a national team — hidden in World Cup mode.
            ...(isWorldCup ? [] : [
              { key: 'listed' as SquadStatusFilter, label: 'Listed' },
              { key: 'expiring' as SquadStatusFilter, label: 'Expiring' },
            ]),
            { key: 'starters' as SquadStatusFilter, label: 'Starters' },
            { key: 'bench' as SquadStatusFilter, label: 'Bench' },
            ...(isWorldCup ? [] : [{ key: 'onLoan' as SquadStatusFilter, label: 'On Loan' }]),
            { key: 'youth' as SquadStatusFilter, label: 'Youth' },
            { key: 'unhappy' as SquadStatusFilter, label: 'Unhappy' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleStatus(key)}
              className={cn(
                'relative px-2.5 py-1 rounded-lg text-micro font-medium transition-colors border whitespace-nowrap shrink-0',
                // Hit area only — visual chip stays compact.
                'after:absolute after:-inset-2 after:content-[""]',
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
          {(isWorldCup ? WC_SORT_OPTIONS : SORT_OPTIONS).map(s => (
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
                'relative px-2 py-1 rounded text-micro uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 active:scale-[0.95] inline-flex items-center gap-0.5',
                'after:absolute after:-inset-2 after:content-[""]',
                sortBy === s ? 'text-primary font-bold' : 'text-muted-foreground'
              )}
            >
              <span>{s}</span>
              {sortBy === s && (
                sortAsc
                  ? <ArrowUp className="w-2.5 h-2.5" aria-label="ascending" />
                  : <ArrowDown className="w-2.5 h-2.5" aria-label="descending" />
              )}
            </button>
          ))}
        </div>

        {/* Player Grid — cards only, tap to open detail for full info */}
        {squad.length === 0 ? (
          <GlassPanel className="p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {statusFilters.size > 0 ? 'No players match your filters' : 'No players in your squad'}
            </p>
            <p className="text-micro text-muted-foreground/60">
              {statusFilters.size > 0 ? 'Try clearing your filters above' : 'Sign players from the transfer market or check free agents'}
            </p>
            {statusFilters.size === 0 && (
              <div className="flex gap-2 justify-center pt-1">
                <button type="button" onClick={() => setScreen('transfers')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
                  <ShoppingCart className="w-3 h-3" /> Transfer Market
                </button>
                <button type="button" onClick={() => setScreen('scouting')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted/50 text-muted-foreground hover:bg-muted transition-colors">
                  <UserSearch className="w-3 h-3" /> Scout Players
                </button>
              </div>
            )}
          </GlassPanel>
        ) : (
          <div className="grid grid-cols-2 gap-3 justify-items-center pt-1">
            {squad.map((player, i) => {
              const isStarter = lineupSet.has(player.id);
              const isSub = subsSet.has(player.id);

              return (
                <motion.div
                  key={player.id}
                  initial={i < 15 ? { opacity: 0, y: 6 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.15 }}
                  className={cn('relative', player.injured && 'opacity-70')}
                >
                  <PlayerCard
                    player={player}
                    size="lg"
                    interactive="detail"
                    showConditionView={false}
                    onDetailClick={(p) => selectPlayer(p.id)}
                  />

                  {/* Top-right overlay — at-a-glance pills. Detail screen (tap) shows the rest. */}
                  <div className="absolute top-1.5 right-1.5 z-10 pointer-events-none">
                    <PlayerStatusBadges
                      player={player}
                      season={season}
                      week={week}
                      contextBadge={
                        isStarter || isSub ? (
                          // The pill was a dead label. It's the most obvious
                          // place a player taps expecting to change the XI, so
                          // route it to the editor. `pointer-events-auto`
                          // re-enables it inside the pass-through overlay.
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); hapticLight(); setScreen('tactics'); }}
                            aria-label={isStarter ? 'In starting XI — edit lineup' : 'On the bench — edit lineup'}
                            className="pointer-events-auto relative after:absolute after:-inset-2 after:content-['']"
                          >
                            {isStarter
                              ? <StatusPill tone="emerald" label="XI" title={t('nationalTeamPage.inStartingXi')} />
                              : <StatusPill tone="amber" label="SUB" title={t('nationalTeamPage.onTheBench')} />}
                          </button>
                        ) : null
                      }
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SquadPage;
