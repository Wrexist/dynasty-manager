import { useState, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { CHART_COLORS, PAGE_HINTS } from '@/config/ui';
import { PageHint } from '@/components/game/PageHint';
import { ShoppingCart, UserSearch } from 'lucide-react';
import type { Player } from '@/types/game';

const byOverall = (a: Player, b: Player) => b.overall - a.overall;

const ComparisonPage = () => {
  const { t } = useTranslation();
  const { clubs, players, playerClubId, shortlist, transferMarket, scoutWatchList, selectedPlayerId } =
    useGameStore(useShallow(s => ({
      clubs: s.clubs,
      players: s.players,
      playerClubId: s.playerClubId,
      shortlist: s.shortlist,
      transferMarket: s.transferMarket,
      scoutWatchList: s.scoutWatchList,
      selectedPlayerId: s.selectedPlayerId,
    })));
  const setScreen = useGameStore(s => s.setScreen);
  const club = clubs[playerClubId];

  const squadPlayers = useMemo(
    () => (club?.playerIds || []).map(id => players[id]).filter(Boolean).sort(byOverall),
    [club?.playerIds, players],
  );

  // Transfer targets you can compare against your own players — the primary use
  // of this screen. Drawn from the market listings, your shortlist, the scout
  // watch list, and whichever player you arrived here from. Resolved against the
  // full `players` map so any id works, not just your squad.
  const targetPlayers = useMemo(() => {
    const squadIds = new Set(club?.playerIds || []);
    const ids = new Set<string>();
    for (const id of shortlist) ids.add(id);
    for (const id of scoutWatchList) ids.add(id);
    for (const listing of transferMarket) ids.add(listing.playerId);
    if (selectedPlayerId) ids.add(selectedPlayerId);
    return [...ids]
      .filter(id => !squadIds.has(id))
      .map(id => players[id])
      .filter(Boolean)
      .sort(byOverall);
  }, [club?.playerIds, shortlist, scoutWatchList, transferMarket, selectedPlayerId, players]);

  const allOptions = useMemo(() => [...squadPlayers, ...targetPlayers], [squadPlayers, targetPlayers]);

  // Arriving from a player's profile pre-loads him on the right-hand side so the
  // comparison is one tap away.
  const arrivedFrom = selectedPlayerId && players[selectedPlayerId] ? selectedPlayerId : '';
  const [playerAId, setPlayerAId] = useState<string>(() => {
    const first = squadPlayers.find(p => p.id !== arrivedFrom) || squadPlayers[0];
    return first?.id || '';
  });
  const [playerBId, setPlayerBId] = useState<string>(
    () => arrivedFrom || squadPlayers[1]?.id || '',
  );

  if (allOptions.length < 2) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        <PageHint screen="comparison" title={PAGE_HINTS.comparison.title} body={PAGE_HINTS.comparison.body} />
        <h2 className="text-lg font-display font-bold text-foreground">Player Comparison</h2>
        <GlassPanel className="p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Nothing to compare yet</p>
          <p className="text-[10px] text-muted-foreground/60">
            You need at least two players. Shortlist a transfer target or scout a region,
            then come back to weigh him against your current starter.
          </p>
          <div className="flex gap-2 justify-center pt-1">
            <button
              type="button"
              onClick={() => setScreen('transfers')}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
            >
              <ShoppingCart className="w-3 h-3" /> Transfer Market
            </button>
            <button
              type="button"
              onClick={() => setScreen('scouting')}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-xs font-semibold bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
            >
              <UserSearch className="w-3 h-3" /> Scout Players
            </button>
          </div>
        </GlassPanel>
      </div>
    );
  }

  // Resolve selections against the *current* option pool — a selected player who
  // was sold/released since selection must not silently blank the chart.
  const playerA = allOptions.find(p => p.id === playerAId);
  const playerB = allOptions.find(p => p.id === playerBId);
  const staleSelection = (!playerA && !!playerAId) || (!playerB && !!playerBId);

  const radarData = playerA && playerB ? [
    { attr: 'PAC', a: playerA.attributes.pace, b: playerB.attributes.pace },
    { attr: 'SHO', a: playerA.attributes.shooting, b: playerB.attributes.shooting },
    { attr: 'PAS', a: playerA.attributes.passing, b: playerB.attributes.passing },
    { attr: 'DEF', a: playerA.attributes.defending, b: playerB.attributes.defending },
    { attr: 'PHY', a: playerA.attributes.physical, b: playerB.attributes.physical },
    { attr: 'MEN', a: playerA.attributes.mental, b: playerB.attributes.mental },
  ] : [];

  const renderOptions = () => (
    <>
      {squadPlayers.length > 0 && (
        <optgroup label={t('comparisonPage.yourSquad')}>
          {squadPlayers.map(p => (
            <option key={p.id} value={p.id}>{p.lastName} ({p.position} · {p.overall})</option>
          ))}
        </optgroup>
      )}
      {targetPlayers.length > 0 && (
        <optgroup label={t('comparisonPage.transferTargets')}>
          {targetPlayers.map(p => (
            <option key={p.id} value={p.id}>{p.lastName} ({p.position} · {p.overall})</option>
          ))}
        </optgroup>
      )}
    </>
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      <PageHint screen="comparison" title={PAGE_HINTS.comparison.title} body={PAGE_HINTS.comparison.body} />
      <h2 className="text-lg font-display font-bold text-foreground">Player Comparison</h2>

      {/* Player Selectors */}
      <div className="grid grid-cols-2 gap-3">
        <GlassPanel className="p-3">
          <label htmlFor="compare-a" className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Player A</label>
          <select
            id="compare-a"
            value={playerAId}
            onChange={e => setPlayerAId(e.target.value)}
            className="w-full min-h-[44px] bg-muted/30 text-foreground text-xs rounded-lg px-2 border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {renderOptions()}
          </select>
        </GlassPanel>
        <GlassPanel className="p-3">
          <label htmlFor="compare-b" className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Player B</label>
          <select
            id="compare-b"
            value={playerBId}
            onChange={e => setPlayerBId(e.target.value)}
            className="w-full min-h-[44px] bg-muted/30 text-foreground text-xs rounded-lg px-2 border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {renderOptions()}
          </select>
        </GlassPanel>
      </div>

      {/* Stale selection — explain why the chart is gone instead of vanishing silently */}
      {staleSelection && (
        <GlassPanel className="p-6 text-center">
          <p className="text-xs text-muted-foreground">
            A selected player is no longer available. Pick another player to compare.
          </p>
        </GlassPanel>
      )}

      {/* Radar Chart */}
      {playerA && playerB && (
        <>
          <GlassPanel className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-3 h-3 rounded-full bg-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate">{playerA.lastName}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-foreground truncate">{playerB.lastName}</span>
                <div className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="attr" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Radar name={playerA.lastName} dataKey="a" stroke={CHART_COLORS.PRIMARY} fill={CHART_COLORS.PRIMARY} fillOpacity={CHART_COLORS.FILL_OPACITY_PRIMARY} strokeWidth={CHART_COLORS.STROKE_WIDTH} />
                <Radar name={playerB.lastName} dataKey="b" stroke={CHART_COLORS.COMPARISON} fill={CHART_COLORS.COMPARISON} fillOpacity={CHART_COLORS.FILL_OPACITY_SECONDARY} strokeWidth={CHART_COLORS.STROKE_WIDTH} />
              </RadarChart>
            </ResponsiveContainer>
          </GlassPanel>

          {/* Stat Comparison Table */}
          <GlassPanel className="p-4">
            <div className="space-y-2">
              {[
                { label: 'Overall', a: playerA.overall, b: playerB.overall },
                { label: 'Potential', a: playerA.potential, b: playerB.potential },
                { label: 'Age', a: playerA.age, b: playerB.age, lower: true },
                { label: 'Value', a: playerA.value, b: playerB.value, format: 'money' },
                { label: 'Wage', a: playerA.wage, b: playerB.wage, format: 'wage' },
                { label: 'Form', a: playerA.form, b: playerB.form },
                { label: 'Fitness', a: playerA.fitness, b: playerB.fitness },
                { label: 'Goals', a: playerA.goals, b: playerB.goals },
                { label: 'Assists', a: playerA.assists, b: playerB.assists },
              ].map(({ label, a, b, lower, format }) => {
                const aWins = lower ? a < b : a > b;
                const bWins = lower ? b < a : b > a;
                const fmt = (v: number) => format === 'money' ? `£${(v / 1e6).toFixed(1)}M` : format === 'wage' ? `£${(v / 1000).toFixed(0)}K` : String(v);
                return (
                  <div key={label} className="flex items-center text-xs">
                    <span className={cn('w-16 tabular-nums text-right', aWins ? 'text-primary font-bold' : 'text-muted-foreground')}>{fmt(a)}</span>
                    <span className="flex-1 text-center text-muted-foreground text-[10px]">{label}</span>
                    <span className={cn('w-16 tabular-nums', bWins ? 'text-emerald-400 font-bold' : 'text-muted-foreground')}>{fmt(b)}</span>
                  </div>
                );
              })}
            </div>
          </GlassPanel>
        </>
      )}
    </div>
  );
};

export default ComparisonPage;
