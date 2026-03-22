import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useGameStore } from '@/store/gameStore';
import { getFinanceBreakdown } from '@/utils/financeHelpers';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

export type FinanceSheetMode = 'income' | 'expenses' | 'budget' | 'all';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: FinanceSheetMode;
}

export function FinanceBreakdownSheet({ open, onOpenChange, mode }: Props) {
  const { clubs, playerClubId, facilities, staff, scouting, fanMood, leagueTable, managerProgression, sponsorDeals, merchandise, players, playerDivision } = useGameStore();
  const club = clubs[playerClubId];
  if (!club) return null;

  const breakdown = getFinanceBreakdown({
    club,
    facilities,
    staffMembers: staff.members,
    scoutingAssignmentCount: scouting.assignments.length,
    fanMood,
    leagueTable,
    managerProgression,
    sponsorDeals: sponsorDeals || [],
    merchandise,
    players,
    division: playerDivision,
  });

  const maxIncome = Math.max(...breakdown.income.map(i => i.amount), 1);
  const maxExpense = Math.max(...breakdown.expenses.map(e => e.amount), 1);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-background/95 backdrop-blur-xl border-t border-border/50 rounded-t-2xl max-h-[85vh] overflow-y-auto pb-8">
        <SheetTitle className="sr-only">Finance Breakdown</SheetTitle>

        {/* Budget header when in budget mode */}
        {mode === 'budget' && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-foreground">Transfer Budget</span>
            </div>
            <p className="text-3xl font-black text-foreground font-display tabular-nums">
              £{(club.budget / 1e6).toFixed(1)}M
            </p>
            <div className="flex items-center gap-1 mt-1">
              {breakdown.net >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-destructive" />
              )}
              <span className={cn('text-xs font-semibold', breakdown.net >= 0 ? 'text-emerald-400' : 'text-destructive')}>
                {breakdown.net >= 0 ? '+' : ''}£{(breakdown.net / 1000).toFixed(0)}K/week net
              </span>
            </div>
          </div>
        )}

        {/* Income Section */}
        {(mode === 'all' || mode === 'income' || mode === 'budget') && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Weekly Income</span>
              <span className="ml-auto text-sm font-bold text-emerald-400 tabular-nums">
                £{(breakdown.totalIncome / 1000).toFixed(0)}K
              </span>
            </div>
            <div className="space-y-2">
              {breakdown.income.map(item => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="text-xs font-semibold text-foreground tabular-nums">
                      £{(item.amount / 1000).toFixed(0)}K
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500/60 rounded-full transition-all"
                      style={{ width: `${(item.amount / maxIncome) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expenses Section */}
        {(mode === 'all' || mode === 'expenses' || mode === 'budget') && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowDownRight className="w-4 h-4 text-destructive" />
              <span className="text-xs font-semibold text-destructive uppercase tracking-wider">Weekly Expenses</span>
              <span className="ml-auto text-sm font-bold text-destructive tabular-nums">
                £{(breakdown.totalExpenses / 1000).toFixed(0)}K
              </span>
            </div>
            <div className="space-y-2">
              {breakdown.expenses.map(item => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="text-xs font-semibold text-foreground tabular-nums">
                      £{(item.amount / 1000).toFixed(0)}K
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-destructive/60 rounded-full transition-all"
                      style={{ width: `${(item.amount / maxExpense) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Net Summary */}
        <div className="border-t border-border/50 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Weekly</span>
            <span className={cn(
              'text-lg font-black tabular-nums',
              breakdown.net >= 0 ? 'text-emerald-400' : 'text-destructive'
            )}>
              {breakdown.net >= 0 ? '+' : ''}£{(breakdown.net / 1000).toFixed(0)}K
            </span>
          </div>
          {mode === 'budget' && (
            <p className="text-[10px] text-muted-foreground mt-1">
              At this rate, budget changes by £{(Math.abs(breakdown.net) * 46 / 1e6).toFixed(1)}M over a full season
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
