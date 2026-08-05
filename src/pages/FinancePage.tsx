import { useState, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { DollarSign, TrendingUp, TrendingDown, Users, ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHint } from '@/components/game/PageHint';
import { PAGE_HINTS } from '@/config/ui';
import { formatMoney } from '@/utils/helpers';
import { useFinanceBreakdown } from '@/hooks/useFinanceBreakdown';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { FinanceBreakdownSheet, FinanceSheetMode } from '@/components/game/FinanceBreakdownSheet';
import { assessFfp } from '@/utils/financeHelpers';
import { FFP_WAGE_RATIO_WARNING, FFP_WAGE_RATIO_CRITICAL } from '@/config/gameBalance';
import { SponsorshipPanel } from '@/components/game/SponsorshipPanel';
import { AnimatedNumber } from '@/components/game/AnimatedNumber';
import { useFlash } from '@/hooks/useFlash';
import { SectionHeader } from '@/components/game/SectionHeader';

const FinancePage = () => {
  const { t } = useTranslation();
  const { clubs, playerClubId, players, financeHistory, careerManager } = useGameStore(useShallow(s => ({
    clubs: s.clubs,
    playerClubId: s.playerClubId,
    players: s.players,
    financeHistory: s.financeHistory,
    careerManager: s.careerManager,
  })));
  const club = clubs[playerClubId];
  const [financeSheetOpen, setFinanceSheetOpen] = useState(false);
  const [financeSheetMode, setFinanceSheetMode] = useState<FinanceSheetMode>('all');
  const budgetFlash = useFlash(club?.budget || 0);
  const { breakdown } = useFinanceBreakdown();

  // Top wage earners (must be before early return to satisfy hook rules)
  const { squadPlayers, topEarners, maxWage, squadValue } = useMemo(() => {
    const ids = club?.playerIds || [];
    const sq = ids
      .map(id => players[id])
      .filter(Boolean)
      .sort((a, b) => b.wage - a.wage);
    const top = sq.slice(0, 5);
    return {
      squadPlayers: sq,
      topEarners: top,
      maxWage: top[0]?.wage || 1,
      squadValue: sq.reduce((sum, p) => sum + p.value, 0),
    };
  }, [club?.playerIds, players]);

  // Chart data — last 20 weeks
  const chartData = useMemo(() => financeHistory.slice(-20).map(f => ({
    week: `W${f.week}`,
    balance: Math.round(f.balance / 1e6 * 10) / 10,
    income: Math.round(f.income / 1000),
    expenses: Math.round(f.expenses / 1000),
  })), [financeHistory]);

  if (!club) return null;

  // Use the full finance breakdown (same source as the breakdown sheet) so the headline
  // figures match what the sheet shows — was a simplified matchday+commercial estimate.
  const weeklyIncome = breakdown?.totalIncome ?? 0;
  const netPerWeek = breakdown?.net ?? 0;
  const isPositive = netPerWeek >= 0;

  // Squad cost breakdown
  const totalWages = club.wageBill;
  const managerSalary = careerManager?.contract?.salary ?? 0;
  const displayExpenses = breakdown?.totalExpenses ?? (totalWages + managerSalary);

  return (
    <>
    <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
      <SectionHeader title={t('financePage.finance')} />
      <PageHint screen="finance" title={PAGE_HINTS.finance.title} body={PAGE_HINTS.finance.body} />

      {/* Negative Budget Warning */}
      {club.budget < 0 && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          {/* Was "The board may intervene if finances don't improve" — nothing in
              the game reacted to a negative balance, so the warning promised a
              consequence that never arrived. State what is actually true: a
              negative budget blocks every fee signing (executeTransfer requires
              fee ≤ budget), and the cost-to-revenue ratio below is what the
              board actually penalises. */}
          <p className="text-xs text-destructive font-medium">Your club is in debt. You cannot make signings until the balance is positive — sell players or cut wages.</p>
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
          formatFn={formatMoney}
          className={cn('text-3xl font-black text-foreground font-display tabular-nums', budgetFlash)}
        />
        <div className="flex items-center gap-1 mt-1">
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-destructive" />
          )}
          <span className={cn('text-xs font-semibold', isPositive ? 'text-emerald-400' : 'text-destructive')}>
            {isPositive ? '+' : ''}{formatMoney(netPerWeek)}/week
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
              <Line type="monotone" dataKey="balance" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </GlassPanel>
      ) : (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Budget History</h3>
          <p className="text-sm text-muted-foreground text-center py-6">Chart will appear after a few weeks of play.</p>
        </GlassPanel>
      )}

      {/* Budget Forecast */}
      {netPerWeek !== 0 && (
        <GlassPanel className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Budget Forecast (10 weeks)</span>
            <span className={cn('text-xs font-bold tabular-nums', (club.budget + netPerWeek * 10) < 0 ? 'text-destructive' : 'text-foreground')}>
              {formatMoney(club.budget + netPerWeek * 10)}
            </span>
          </div>
          {netPerWeek < 0 && club.budget > 0 && (
            <p className="text-micro text-amber-400 mt-1">
              At current spending, budget runs out in ~{Math.ceil(club.budget / Math.abs(netPerWeek))} weeks
            </p>
          )}
        </GlassPanel>
      )}

      {/* Income vs Expenses */}
      <div className="grid grid-cols-2 gap-3">
        <GlassPanel className="p-3 cursor-pointer" onClick={() => { setFinanceSheetMode('income'); setFinanceSheetOpen(true); }}>
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-muted-foreground">Weekly Income</span>
          </div>
          <p className="text-lg font-bold text-emerald-400 tabular-nums">{formatMoney(weeklyIncome)}</p>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-micro">
              <span className="text-muted-foreground">Matchday</span>
              <span className="text-foreground">{formatMoney(breakdown?.income.find(i => i.label === 'Matchday')?.amount ?? 0)}</span>
            </div>
            <div className="flex justify-between text-micro">
              <span className="text-muted-foreground">Commercial</span>
              <span className="text-foreground">{formatMoney(breakdown?.income.find(i => i.label === 'Commercial')?.amount ?? 0)}</span>
            </div>
          </div>
        </GlassPanel>
        <GlassPanel className="p-3 cursor-pointer" onClick={() => { setFinanceSheetMode('expenses'); setFinanceSheetOpen(true); }}>
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />
            <span className="text-xs text-muted-foreground">Weekly Expenses</span>
          </div>
          <p className="text-lg font-bold text-destructive tabular-nums">{formatMoney(displayExpenses)}</p>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-micro">
              <span className="text-muted-foreground">Player Wages</span>
              <span className="text-foreground">{formatMoney(totalWages)}</span>
            </div>
            {managerSalary > 0 && (
              <div className="flex justify-between text-micro">
                <span className="text-muted-foreground">Manager Salary</span>
                <span className="text-foreground">{formatMoney(managerSalary)}</span>
              </div>
            )}
          </div>
        </GlassPanel>
      </div>

      {/* Sponsorship Deals */}
      <SponsorshipPanel />

      {/* Financial Fair Play */}
      {(() => {
        // ONE FFP measurement, shared with the board's weekly penalty via
        // assessFfp(). This block used to compute `club.wageBill / weeklyIncome`
        // — player wages only, against a hardcoded 70/90 — while weekAdvance
        // charged confidence on TOTAL expenses (staff, scouting, manager salary
        // included) against the config thresholds. Players read
        // "62% — Healthy" while the board applied −6 confidence a week.
        const ffp = assessFfp(displayExpenses, weeklyIncome);
        const { noIncome, status: ffpStatus } = ffp;
        const ratioPct = Math.round(ffp.ratio * 100);
        const warningPct = Math.round(FFP_WAGE_RATIO_WARNING * 100);
        const criticalPct = Math.round(FFP_WAGE_RATIO_CRITICAL * 100);
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
              <span className="text-xs text-muted-foreground">Cost-to-Revenue Ratio</span>
              <span className={cn('text-sm font-bold tabular-nums', statusColor)}>{ratioPct}%</span>
            </div>
            <div className="relative w-full h-3 rounded-full bg-muted/40 overflow-hidden mb-2">
              <div
                className={cn('h-full rounded-full transition-all', ffpStatus === 'critical' ? 'bg-destructive' : ffpStatus === 'warning' ? 'bg-amber-500' : 'bg-emerald-500')}
                style={{ width: `${Math.min(100, ratioPct)}%` }}
              />
              <div className="absolute top-0 bottom-0 w-px bg-amber-400/60" style={{ left: `${warningPct}%` }} />
              <div className="absolute top-0 bottom-0 w-px bg-destructive/60" style={{ left: `${criticalPct}%` }} />
            </div>
            <div className="flex justify-between text-micro text-muted-foreground mb-2">
              <span>0%</span>
              <span className="text-amber-400">{warningPct}%</span>
              <span className="text-destructive">{criticalPct}%</span>
              <span>100%</span>
            </div>
            <div className={cn('text-micro font-semibold px-2 py-1 rounded-md text-center', statusColor, statusBg)}>
              {statusText}
            </div>
            <p className="text-micro text-muted-foreground/60 mt-2 leading-relaxed">
              {ffpStatus === 'critical'
                ? `Your total weekly costs are above ${criticalPct}% of revenue. Board confidence drops sharply every week. Cut wages by selling players or renegotiating contracts.`
                : ffpStatus === 'warning'
                ? `Total weekly costs are above ${warningPct}% of revenue. Board confidence declines every week. Consider offloading high earners.`
                : `Finances are sustainable. Keep total weekly costs — player wages, staff, scouting and your own salary — below ${warningPct}% of revenue to stay in good standing with the board.`}
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
          <span className="text-lg font-bold text-primary tabular-nums">{formatMoney(squadValue)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{squadPlayers.length} players · Avg {squadPlayers.length > 0 ? formatMoney(squadValue / squadPlayers.length) : '£0'}</p>
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
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">{formatMoney(player.wage)}/w</span>
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
