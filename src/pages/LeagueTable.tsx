import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DIVISIONS } from '@/data/league';
import type { DivisionId } from '@/types/game';

const LeagueTable = () => {
  const { divisionTables, divisionFixtures, divisionClubs, clubs, players, playerClubId, playerDivision, week, totalWeeks, setScreen } = useGameStore();
  const [tab, setTab] = useState<'table' | 'fixtures' | 'stats'>('table');
  const [selectedDiv, setSelectedDiv] = useState<DivisionId>(playerDivision || 'div-1');
  const [browseWeek, setBrowseWeek] = useState(week);

  const playerRowRef = useRef<HTMLTableRowElement>(null);
  const scrolledRef = useRef(false);
  const scrollToPlayer = useCallback(() => {
    if (playerRowRef.current && !scrolledRef.current) {
      playerRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      scrolledRef.current = true;
    }
  }, []);
  useEffect(() => { scrolledRef.current = false; }, [selectedDiv]);
  useEffect(() => { if (tab === 'table' && selectedDiv === playerDivision) scrollToPlayer(); }, [tab, selectedDiv, playerDivision, scrollToPlayer]);

  const currentTable = divisionTables[selectedDiv] || [];
  const currentDivision = DIVISIONS.find(d => d.id === selectedDiv);

  // Fixtures for the browsed week
  const weekFixtures = useMemo(() => {
    const currentFixtures = divisionFixtures[selectedDiv] || [];
    return currentFixtures.filter(m => m.week === browseWeek);
  }, [divisionFixtures, selectedDiv, browseWeek]);

  // Stats leaders for selected division
  const { topScorers, topAssisters } = useMemo(() => {
    const divClubIds = new Set(divisionClubs[selectedDiv] || []);
    const allPlayers = Object.values(players).filter(p => divClubIds.has(p.clubId));

    const scorers = allPlayers
      .filter(p => p.goals > 0)
      .sort((a, b) => b.goals - a.goals || a.lastName.localeCompare(b.lastName))
      .slice(0, 5);

    const assisters = allPlayers
      .filter(p => p.assists > 0)
      .sort((a, b) => b.assists - a.assists || a.lastName.localeCompare(b.lastName))
      .slice(0, 5);

    return { topScorers: scorers, topAssisters: assisters };
  }, [players, divisionClubs, selectedDiv]);

  // Zone boundaries for current division
  const getZone = (pos: number, tableLen: number): 'champion' | 'promotion' | 'playoff' | 'relegation' | 'replaced' | null => {
    if (!currentDivision) return null;
    if (pos === 1) return 'champion';
    if (currentDivision.autoPromoteSlots > 0 && pos <= currentDivision.autoPromoteSlots) return 'promotion';
    if (currentDivision.playoffSlots > 0) {
      const playoffEnd = currentDivision.autoPromoteSlots + currentDivision.playoffSlots;
      if (pos > currentDivision.autoPromoteSlots && pos <= playoffEnd) return 'playoff';
    }
    if (currentDivision.replacedSlots > 0 && pos > tableLen - currentDivision.replacedSlots) return 'replaced';
    if (currentDivision.autoRelegateSlots > 0 && pos > tableLen - currentDivision.autoRelegateSlots - currentDivision.replacedSlots) return 'relegation';
    return null;
  };

  const zoneBgClass = (zone: ReturnType<typeof getZone>) => {
    switch (zone) {
      case 'champion': return 'bg-primary/10 border-l-2 border-l-primary';
      case 'promotion': return 'bg-emerald-500/5 border-l-2 border-l-emerald-500/40';
      case 'playoff': return 'bg-blue-500/5 border-l-2 border-l-blue-500/40';
      case 'relegation': return 'bg-destructive/5 border-l-2 border-l-destructive/40';
      case 'replaced': return 'bg-destructive/10 border-l-2 border-l-destructive/60';
      default: return '';
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <button onClick={() => setScreen('dashboard')} className="flex items-center gap-1 text-muted-foreground text-sm">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h2 className="text-lg font-bold text-foreground font-display">League</h2>

      {/* Division Selector */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        {DIVISIONS.map(div => (
          <button
            key={div.id}
            onClick={() => { setSelectedDiv(div.id); setBrowseWeek(week); }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0',
              selectedDiv === div.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted',
              div.id === playerDivision && selectedDiv !== div.id && 'ring-1 ring-primary/30'
            )}
          >
            {div.shortName}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['table', 'fixtures', 'stats'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            {t === 'table' ? 'Table' : t === 'fixtures' ? 'Fixtures' : 'Stats Leaders'}
          </button>
        ))}
      </div>

      {/* Table Tab */}
      {tab === 'table' && (
        <GlassPanel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left p-2 text-[10px] text-muted-foreground uppercase w-7">#</th>
                  <th className="text-left p-2 text-[10px] text-muted-foreground uppercase">Club</th>
                  <th className="text-center p-2 text-[10px] text-muted-foreground uppercase w-7">P</th>
                  <th className="text-center p-2 text-[10px] text-muted-foreground uppercase w-10">W-D-L</th>
                  <th className="text-center p-2 text-[10px] text-muted-foreground uppercase w-8">GD</th>
                  <th className="text-center p-2 text-[10px] text-muted-foreground uppercase w-8">Pts</th>
                  <th className="text-center p-2 text-[10px] text-muted-foreground uppercase w-[4.5rem]">Form</th>
                </tr>
              </thead>
              <tbody>
                {currentTable.map((entry, i) => {
                  const club = clubs[entry.clubId];
                  const isPlayer = entry.clubId === playerClubId;
                  const pos = i + 1;
                  const zone = getZone(pos, currentTable.length);

                  return (
                    <motion.tr
                      key={entry.clubId}
                      ref={isPlayer ? playerRowRef : undefined}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.2 }}
                      className={cn(
                        'border-b border-border/10',
                        zoneBgClass(zone),
                        isPlayer && 'bg-primary/5 shadow-[inset_0_0_12px_hsl(43_96%_46%/0.05)] border-l-2 border-l-primary'
                      )}
                    >
                      <td className={cn('p-2 text-xs', pos === 1 ? 'text-primary font-bold' : 'text-muted-foreground')}>
                        <div className="flex items-center gap-0.5">
                          <span>{pos}</span>
                          {entry.form.length > 0 && entry.form[entry.form.length - 1] === 'W' && (
                            <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
                          )}
                          {entry.form.length > 0 && entry.form[entry.form.length - 1] === 'L' && (
                            <TrendingDown className="w-2.5 h-2.5 text-destructive" />
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: club?.color }} />
                          <span className={cn('text-xs font-medium truncate', isPlayer ? 'text-primary font-bold' : 'text-foreground')}>
                            {club?.shortName || '?'}
                          </span>
                        </div>
                      </td>
                      <td className="text-center p-2 text-xs text-muted-foreground tabular-nums">{entry.played}</td>
                      <td className="text-center p-2 text-[10px] text-muted-foreground tabular-nums">{entry.won}-{entry.drawn}-{entry.lost}</td>
                      <td className="text-center p-2 text-xs text-muted-foreground tabular-nums">{entry.goalDifference > 0 ? '+' : ''}{entry.goalDifference}</td>
                      <td className="text-center p-2 text-xs font-bold text-foreground tabular-nums">{entry.points}</td>
                      <td className="p-2">
                        <div className="flex gap-0.5 justify-center">
                          {entry.form.map((r, j) => (
                            <span key={j} className={cn(
                              'w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[7px] font-bold',
                              r === 'W' ? 'bg-emerald-500/20 text-emerald-400' : r === 'L' ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
                            )}>{r}</span>
                          ))}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Zone Legend */}
          <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-t border-border/20">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-primary/40" />
              <span className="text-[10px] text-muted-foreground">Champion</span>
            </div>
            {currentDivision && currentDivision.autoPromoteSlots > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30" />
                <span className="text-[10px] text-muted-foreground">Promotion</span>
              </div>
            )}
            {currentDivision && currentDivision.playoffSlots > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-blue-500/30" />
                <span className="text-[10px] text-muted-foreground">Playoffs</span>
              </div>
            )}
            {currentDivision && currentDivision.autoRelegateSlots > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-destructive/30" />
                <span className="text-[10px] text-muted-foreground">Relegation</span>
              </div>
            )}
            {currentDivision && currentDivision.replacedSlots > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-destructive/50" />
                <span className="text-[10px] text-muted-foreground">Replaced</span>
              </div>
            )}
          </div>
        </GlassPanel>
      )}

      {/* Fixtures Tab */}
      {tab === 'fixtures' && (
        <>
          <GlassPanel className="p-3 flex items-center justify-between">
            <button
              onClick={() => setBrowseWeek(w => Math.max(1, w - 1))}
              disabled={browseWeek <= 1}
              className={cn(
                'p-1.5 rounded-lg transition-all',
                browseWeek <= 1 ? 'text-muted-foreground/30' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-foreground">Week {browseWeek}</p>
              {browseWeek === week && <p className="text-[10px] text-primary">Current Week</p>}
            </div>
            <button
              onClick={() => setBrowseWeek(w => Math.min(totalWeeks, w + 1))}
              disabled={browseWeek >= totalWeeks}
              className={cn(
                'p-1.5 rounded-lg transition-all',
                browseWeek >= totalWeeks ? 'text-muted-foreground/30' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </GlassPanel>

          <div className="space-y-2">
            {weekFixtures.length > 0 ? (
              weekFixtures.map(match => {
                const homeClub = clubs[match.homeClubId];
                const awayClub = clubs[match.awayClubId];
                const isPlayerMatch = match.homeClubId === playerClubId || match.awayClubId === playerClubId;

                return (
                  <GlassPanel key={match.id} className={cn('p-3', isPlayerMatch && 'border-primary/30')}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-2 justify-end">
                        <span className={cn(
                          'text-xs font-medium truncate text-right',
                          match.homeClubId === playerClubId ? 'text-primary font-bold' : 'text-foreground'
                        )}>
                          {homeClub?.shortName || '?'}
                        </span>
                        <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: homeClub?.color }} />
                      </div>
                      <div className="w-16 text-center shrink-0">
                        {match.played ? (
                          <span className="text-sm font-mono font-bold text-foreground">
                            {match.homeGoals} - {match.awayGoals}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium">vs</span>
                        )}
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: awayClub?.color }} />
                        <span className={cn(
                          'text-xs font-medium truncate',
                          match.awayClubId === playerClubId ? 'text-primary font-bold' : 'text-foreground'
                        )}>
                          {awayClub?.shortName || '?'}
                        </span>
                      </div>
                    </div>
                  </GlassPanel>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No fixtures for Week {browseWeek}</p>
            )}
          </div>
        </>
      )}

      {/* Stats Leaders Tab */}
      {tab === 'stats' && (
        <div className="space-y-4">
          <GlassPanel className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Top Scorers</p>
            {topScorers.length > 0 ? (
              <div className="space-y-2">
                {topScorers.map((p, i) => {
                  const pClub = clubs[p.clubId];
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className={cn('w-5 text-xs font-bold text-center', i === 0 ? 'text-primary' : 'text-muted-foreground')}>{i + 1}</span>
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: pClub?.color }} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium truncate', p.clubId === playerClubId ? 'text-primary' : 'text-foreground')}>
                          {p.firstName[0]}. {p.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{p.position} {'\u2022'} {pClub?.shortName || '?'}</p>
                      </div>
                      <span className={cn('text-sm font-mono font-bold', i === 0 ? 'text-primary' : 'text-foreground')}>{p.goals}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No goals scored yet</p>
            )}
          </GlassPanel>

          <GlassPanel className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Top Assists</p>
            {topAssisters.length > 0 ? (
              <div className="space-y-2">
                {topAssisters.map((p, i) => {
                  const pClub = clubs[p.clubId];
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className={cn('w-5 text-xs font-bold text-center', i === 0 ? 'text-primary' : 'text-muted-foreground')}>{i + 1}</span>
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: pClub?.color }} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium truncate', p.clubId === playerClubId ? 'text-primary' : 'text-foreground')}>
                          {p.firstName[0]}. {p.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{p.position} {'\u2022'} {pClub?.shortName || '?'}</p>
                      </div>
                      <span className={cn('text-sm font-mono font-bold', i === 0 ? 'text-primary' : 'text-foreground')}>{p.assists}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No assists recorded yet</p>
            )}
          </GlassPanel>
        </div>
      )}
    </div>
  );
};

export default LeagueTable;
