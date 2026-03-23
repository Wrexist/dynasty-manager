import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { CHART_COLORS, PAGE_HINTS } from '@/config/ui';
import { PageHint } from '@/components/game/PageHint';
import { ArrowLeft } from 'lucide-react';

const ComparisonPage = () => {
  const { clubs, players, playerClubId, setScreen } = useGameStore();
  const club = clubs[playerClubId];
  const squadPlayers = club?.playerIds.map(id => players[id]).filter(Boolean).sort((a, b) => b.overall - a.overall) || [];

  const [playerAId, setPlayerAId] = useState<string>(squadPlayers[0]?.id || '');
  const [playerBId, setPlayerBId] = useState<string>(squadPlayers[1]?.id || '');

  if (squadPlayers.length < 2) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        <button onClick={() => setScreen('squad')} className="flex items-center gap-1 text-muted-foreground text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <GlassPanel className="p-6 text-center">
          <p className="text-muted-foreground">Need at least 2 players to compare.</p>
        </GlassPanel>
      </div>
    );
  }

  const playerA = players[playerAId];
  const playerB = players[playerBId];

  const radarData = playerA && playerB ? [
    { attr: 'PAC', a: playerA.attributes.pace, b: playerB.attributes.pace },
    { attr: 'SHO', a: playerA.attributes.shooting, b: playerB.attributes.shooting },
    { attr: 'PAS', a: playerA.attributes.passing, b: playerB.attributes.passing },
    { attr: 'DEF', a: playerA.attributes.defending, b: playerB.attributes.defending },
    { attr: 'PHY', a: playerA.attributes.physical, b: playerB.attributes.physical },
    { attr: 'MEN', a: playerA.attributes.mental, b: playerB.attributes.mental },
  ] : [];

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      <PageHint screen="comparison" title={PAGE_HINTS.comparison.title} body={PAGE_HINTS.comparison.body} />
      <h2 className="text-lg font-display font-bold text-foreground">Player Comparison</h2>

      {/* Player Selectors */}
      <div className="grid grid-cols-2 gap-3">
        <GlassPanel className="p-3">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Player A</label>
          <select
            value={playerAId}
            onChange={e => setPlayerAId(e.target.value)}
            className="w-full bg-muted/30 text-foreground text-xs rounded-lg p-2 border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {squadPlayers.map(p => (
              <option key={p.id} value={p.id}>{p.lastName} ({p.position} · {p.overall})</option>
            ))}
          </select>
        </GlassPanel>
        <GlassPanel className="p-3">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Player B</label>
          <select
            value={playerBId}
            onChange={e => setPlayerBId(e.target.value)}
            className="w-full bg-muted/30 text-foreground text-xs rounded-lg p-2 border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {squadPlayers.map(p => (
              <option key={p.id} value={p.id}>{p.lastName} ({p.position} · {p.overall})</option>
            ))}
          </select>
        </GlassPanel>
      </div>

      {/* Radar Chart */}
      {playerA && playerB && (
        <>
          <GlassPanel className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-xs font-semibold text-foreground">{playerA.lastName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{playerB.lastName}</span>
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
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
