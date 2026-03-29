import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { DollarSign, TrendingUp, TrendingDown, Users, ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS } from '@/config/ui';
import { getWeeklyIncome, getNetWeeklyIncome } from '@/utils/financeHelpers';
import { MATCHDAY_INCOME_PER_FAN, COMMERCIAL_INCOME_PER_REP, COMMERCIAL_INCOME_BASE } from '@/config/gameBalance';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { FinanceBreakdownSheet, FinanceSheetMode } from '@/components/game/FinanceBreakdownSheet';
import { SponsorshipPanel } from '@/components/game/SponsorshipPanel';
import { AnimatedNumber } from '@/components/game/AnimatedNumber';
import { useFlash } from '@/hooks/useFlash';

const FinancePage = () => {
  const { clubs, playerClubId, players, financeHistory } = useGameStore();
  const club = clubs[playerClubId];
  const [financeSheetOpen, setFinanceSheetOpen] = useState(false);
  const [financeSheetMode, setFinanceSheetMode] = useState<FinanceSheetMode>('all');
  const budgetFlash = useFlash(club?.budget || 0);
  if (!club) return null;

  const weeklyIncome = getWeeklyIncome(club);
  const netPerWeek = getNetWeeklyIncome(club);
  const isPositive = netPerWeek >= 0;

  // Top wage earners
  const squadPlayers = club.playerIds
    .map(id => players[id])
    .filter(Boolean)
    .sort((a, b) => b.wage - a.wage);
  const topEarners = squadPlayers.slice(0, 5);
  const maxWage = topEarners[0]?.wage || 1;

  // Squad cost breakdown
  const totalWages = club.wageBill;
  const squadValue = squadPlayers.reduce((sum, p) => sum + p.value, 0);

  // Chart data — last 20 weeks
  const chartData = financeHistory.slice(-20).map(f => ({
    week: `W${f.week}`,
    balance: Math.round(f.balance / 1e6 * 10) / 10,
    income: Math.round(f.income / 1000),
    expenses: Math.round(f.expenses / 1000),
  }));

  return (
    <>
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      <h2 className="text-lg font-display font-bold text-foreground">Finance</h2>
      <PageHint screen="finance" title={PAGE_HINTS.finance.title} body={PAGE_HINTS.finance.body} />

      {/* Negative Budget Warning */}
      {club.budget < 0 && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive font-medium">Your club is in debt. The board may intervene if finances don't improve.</p>
        </div>
      )}

      {/* Budget Overview */}
      <GlassPanel className="p-4 cursor-pointer" onClick={() => { setFinanceSheetMode('budget'); setFinanceSheetOpen(true); }}>
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Transfer Budget</h3>
        </div>
        <AnimatedNumber
          value={club.budget}
          formatFn={(n) => '£' + (n / 1e6).toFixed(1) + 'M'}
          className={cn('text-3xl font-black text-foreground font-display tabular-nums', budgetFlash)}
        />
        <div className="flex items-center gap-1 mt-1">
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-destructive" />
          )}
          <span className={cn('text-xs font-semibold', isPositive ? 'text-emerald-400' : 'text-destructive')}>
            {isPositive ? '+' : ''}£{(netPerWeek / 1000).toFixed(0)}K/week
          </span>
        </div>
      </GlassPanel>

      {/* Balance History Chart */}
      {chartData.length > 0 ? (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Budget History</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={35} tickFormatter={(v) => `${v}M`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [`£${value}M`, 'Balance']}
              />
              <Line type="monotone" dataKey="balance" stroke="hsl(43, 96%, 46%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </GlassPanel>
      ) : (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Budget History</h3>
          <p className="text-sm text-muted-foreground text-center py-6">Chart will appear after a few weeks of play.</p>
        </GlassPanel>
      )}

      {/* Income vs Expenses */}
      <div className="grid grid-cols-2 gap-3">
        <GlassPanel className="p-3 cursor-pointer" onClick={() => { setFinanceSheetMode('income'); setFinanceSheetOpen(true); }}>
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-muted-foreground">Weekly Income</span>
          </div>
          <p className="text-lg font-bold text-emerald-400 tabular-nums">£{(weeklyIncome / 1000).toFixed(0)}K</p>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Matchday</span>
              <span className="text-foreground">£{(club.fanBase * MATCHDAY_INCOME_PER_FAN / 1000).toFixed(0)}K</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Commercial</span>
              <span className="text-foreground">£{((COMMERCIAL_INCOME_BASE + club.reputation * COMMERCIAL_INCOME_PER_REP) / 1000).toFixed(0)}K</span>
            </div>
          </div>
        </GlassPanel>
        <GlassPanel className="p-3 cursor-pointer" onClick={() => { setFinanceSheetMode('expenses'); setFinanceSheetOpen(true); }}>
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />
            <span className="text-xs text-muted-foreground">Weekly Expenses</span>
          </div>
          <p className="text-lg font-bold text-destructive tabular-nums">£{(club.wageBill / 1000).toFixed(0)}K</p>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Player Wages</span>
              <span className="text-foreground">£{(totalWages / 1000).toFixed(0)}K</span>
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* Sponsorship Deals */}
      <SponsorshipPanel />

      {/* Financial Fair Play */}
      {(() => {
        const noIncome = weeklyIncome <= 0 && club.wageBill > 0;
        const wageRatio = weeklyIncome > 0 ? club.wageBill / weeklyIncome : (club.wageBill > 0 ? 1 : 0);
        const ratioPct = Math.round(wageRatio * 100);
        const ffpStatus = noIncome ? 'critical' : ratioPct >= 90 ? 'critical' : ratioPct >= 70 ? 'warning' : 'healthy';
        const statusColor = ffpStatus === 'critical' ? 'text-destructive' : ffpStatus === 'warning' ? 'text-amber-400' : 'text-emerald-400';
        const statusBg = ffpStatus === 'critical' ? 'bg-destructive/20' : ffpStatus === 'warning' ? 'bg-amber-400/20' : 'bg-emerald-500/20';
        const statusText = noIncome ? 'Critical — No Revenue' : ffpStatus === 'critical' ? 'Critical — Restrictions Active' : ffpStatus === 'warning' ? 'Warning — Board Concern' : 'Healthy';
        return (
          <GlassPanel className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className={cn('w-4 h-4', statusColor)} />
              <h3 className="text-sm font-semibold text-foreground">Financial Fair Play</h3>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Wage-to-Revenue Ratio</span>
              <span className={cn('text-sm font-bold tabular-nums', statusColor)}>{ratioPct}%</span>
            </div>
            <div className="relative w-full h-3 rounded-full bg-muted/40 overflow-hidden mb-2">
              <div
                className={cn('h-full rounded-full transition-all', ffpStatus === 'critical' ? 'bg-destructive' : ffpStatus === 'warning' ? 'bg-amber-500' : 'bg-emerald-500')}
                style={{ width: `${Math.min(100, ratioPct)}%` }}
              />
              <div className="absolute top-0 bottom-0 w-px bg-amber-400/60" style={{ left: '70%' }} />
              <div className="absolute top-0 bottom-0 w-px bg-destructive/60" style={{ left: '90%' }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground mb-2">
              <span>0%</span>
              <span className="text-amber-400">70%</span>
              <span className="text-destructive">90%</span>
              <span>100%</span>
            </div>
            <div className={cn('text-[10px] font-semibold px-2 py-1 rounded-md text-center', statusColor, statusBg)}>
              {statusText}
            </div>
            <p className="text-[9px] text-muted-foreground/60 mt-2 leading-relaxed">
              {ffpStatus === 'critical'
                ? 'Your wage bill is dangerously high. Board confidence drops sharply each week. Reduce wages by selling players or renegotiating contracts.'
                : ffpStatus === 'warning'
                ? 'Wages are above 70% of revenue. Board confidence will slowly decline. Consider offloading high earners.'
                : 'Finances are sustainable. Keep wage-to-revenue ratio below 70% to stay in good standing with the board.'}
            </p>
          </GlassPanel>
        );
      })()}

      {/* Squad Value */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Squad Value</span>
          </div>
          <span className="text-lg font-bold text-primary tabular-nums">£{(squadValue / 1e6).toFixed(1)}M</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{squadPlayers.length} players · Avg £{squadPlayers.length > 0 ? (squadValue / squadPlayers.length / 1e6).toFixed(1) : '0.0'}M</p>
      </GlassPanel>

      {/* Top Earners */}
      <GlassPanel className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Top Earners</h3>
        <div className="space-y-2.5">
          {topEarners.map((player, i) => (
            <div key={player.id} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-4 shrink-0 tabular-nums">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-foreground truncate">{player.lastName}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">£{(player.wage / 1000).toFixed(0)}K/w</span>
                </div>
                <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full"
                    style={{ width: `${(player.wage / maxWage) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
    <FinanceBreakdownSheet open={financeSheetOpen} onOpenChange={setFinanceSheetOpen} mode={financeSheetMode} />
    </>
  );
};

export default FinancePage;
