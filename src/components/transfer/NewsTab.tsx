/**
 * NewsTab — extracted from `pages/TransferPage.tsx`.
 *
 * Presentational. Receives pre-computed summary + grouped news plus the
 * single setter for the type filter; owns no other state.
 */
import { motion } from 'framer-motion';
import { Calendar, Newspaper, ArrowUpRight, Repeat2, Users, TrendingUp, ArrowRight } from 'lucide-react';
import { GlassPanel } from '@/components/game/GlassPanel';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';
import { formatMoney } from '@/utils/helpers';
import type { Club, TransferNewsEntry } from '@/types/game';

type NewsTypeFilter = 'all' | 'transfer' | 'loan' | 'free_agent';

interface NewsSummary {
  allNews: TransferNewsEntry[];
  totalTransfers: number;
  totalLoans: number;
  totalFreeAgents: number;
  totalSpend: number;
  biggestDeal: TransferNewsEntry | undefined;
  myClubDeals: TransferNewsEntry[];
}

interface FilteredGroupedNews {
  filteredNews: TransferNewsEntry[];
  grouped: Record<string, TransferNewsEntry[]>;
}

interface NewsTabProps {
  newsSummary: NewsSummary;
  filteredGroupedNews: FilteredGroupedNews;
  clubs: Record<string, Club>;
  playerClubId: string;
  newsTypeFilter: NewsTypeFilter;
  onSetNewsTypeFilter: (v: NewsTypeFilter) => void;
}

export function NewsTab({
  newsSummary,
  filteredGroupedNews,
  clubs,
  playerClubId,
  newsTypeFilter,
  onSetNewsTypeFilter,
}: NewsTabProps) {
  const { allNews, totalTransfers, totalLoans, totalFreeAgents, totalSpend, biggestDeal, myClubDeals } = newsSummary;
  const { filteredNews, grouped } = filteredGroupedNews;

  return (
    <div className="space-y-3">
      {/* News Summary Stats */}
      {allNews.length > 0 && (
        <GlassPanel className="p-3 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Window Summary</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/30 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground">Total Spend</p>
              <p className="text-sm font-bold text-primary">{formatMoney(totalSpend)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground">Deals</p>
              <p className="text-sm font-bold text-foreground">{allNews.length}</p>
            </div>
            {biggestDeal?.fee ? (
              <div className="bg-muted/30 rounded-lg p-2 col-span-2">
                <p className="text-[10px] text-muted-foreground">Biggest Deal</p>
                <p className="text-sm font-bold text-foreground">
                  {biggestDeal.playerName} <span className="text-primary">{formatMoney(biggestDeal.fee)}</span>
                </p>
              </div>
            ) : null}
          </div>
          {myClubDeals.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[10px] text-muted-foreground">
                Your club: <span className="text-foreground font-medium">{myClubDeals.length} deal{myClubDeals.length !== 1 ? 's' : ''}</span>
              </span>
            </div>
          )}
        </GlassPanel>
      )}

      {/* Type Filter */}
      {allNews.length > 0 && (
        <div className="flex gap-1.5">
          {([
            { id: 'all' as const, label: 'All', count: allNews.length },
            { id: 'transfer' as const, label: 'Transfers', count: totalTransfers },
            { id: 'loan' as const, label: 'Loans', count: totalLoans },
            { id: 'free_agent' as const, label: 'Free Agents', count: totalFreeAgents },
          ]).map(f => (
            <button
              key={f.id}
              onClick={() => { hapticLight(); onSetNewsTypeFilter(f.id); }}
              className={cn(
                'px-2 py-1 rounded text-[10px] font-medium shrink-0 transition-all',
                newsTypeFilter === f.id
                  ? f.id === 'transfer' ? 'bg-primary/20 text-primary'
                  : f.id === 'loan' ? 'bg-amber-500/20 text-amber-400'
                  : f.id === 'free_agent' ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      )}

      {/* Grouped News Feed */}
      {filteredNews.length > 0 ? (
        Object.entries(grouped).map(([weekLabel, entries]) => (
          <div key={weekLabel} className="space-y-1.5">
            <div className="flex items-center gap-2 pt-1">
              <Calendar className="w-3 h-3 text-muted-foreground/50" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{weekLabel}</span>
              <div className="flex-1 h-px bg-border/30" />
            </div>
            {entries.map((entry, i) => {
              const fromClub = clubs[entry.fromClubId];
              const toClub = clubs[entry.toClubId];
              const involvesMyClub = entry.fromClubId === playerClubId || entry.toClubId === playerClubId;
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                >
                  <GlassPanel className={cn('p-3', involvesMyClub && 'ring-1 ring-primary/30')}>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                        entry.type === 'transfer' ? 'bg-primary/15 text-primary' :
                        entry.type === 'loan' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-emerald-500/15 text-emerald-400'
                      )}>
                        {entry.type === 'transfer' ? <ArrowUpRight className="w-4 h-4" /> :
                         entry.type === 'loan' ? <Repeat2 className="w-4 h-4" /> :
                         <Users className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-foreground">{entry.playerName}</p>
                          {involvesMyClub && (
                            <span className="text-[8px] font-bold bg-primary/20 text-primary px-1 py-0.5 rounded">YOU</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {entry.playerPosition} {'•'} {entry.playerAge}y {'•'} {entry.playerOverall} OVR
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.type === 'free_agent' ? (
                            <>Signed by <span className="text-foreground font-medium">{toClub?.shortName || '?'}</span></>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-foreground">{fromClub?.shortName || '?'}</span>
                              <ArrowRight className="w-3 h-3 text-primary/70 shrink-0" aria-hidden />
                              <span className="text-foreground">{toClub?.shortName || '?'}</span>
                              {entry.type === 'loan' && entry.loanDuration && (
                                <span className="text-amber-400 ml-1">({entry.loanDuration}wk loan)</span>
                              )}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {entry.fee ? (
                          <span className="text-sm font-bold text-primary">{formatMoney(entry.fee)}</span>
                        ) : entry.type === 'loan' ? (
                          <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">LOAN</span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded">FREE</span>
                        )}
                      </div>
                    </div>
                  </GlassPanel>
                </motion.div>
              );
            })}
          </div>
        ))
      ) : allNews.length > 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
          <Newspaper className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No {newsTypeFilter === 'transfer' ? 'transfers' : newsTypeFilter === 'loan' ? 'loans' : 'free agent signings'} this season</p>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
          <Newspaper className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No transfer activity yet this season</p>
          <p className="text-xs text-muted-foreground/60 mt-1">AI club transfers and loans will appear here</p>
        </motion.div>
      )}
    </div>
  );
}
