import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, ChevronDown, Search, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LEAGUES, getLeaguesByCountry } from '@/data/league';
import { FlagIcon } from '@/components/game/FlagIcon';
import { PageHint } from '@/components/game/PageHint';
import { getQualificationZones } from '@/utils/leagueRanking';
import { getClubDisplayName } from '@/utils/uiHelpers';
import { hapticLight } from '@/utils/haptics';

const TIER_LABELS: Record<number, string> = {
  1: 'Top Leagues',
  2: 'Strong Leagues',
  3: 'Mid-Tier Leagues',
  4: 'Developing Leagues',
};

const TIER_ORDER = [1, 2, 3, 4];

// Group leagues by quality tier, but include all divisions (not just tier 1)
const leaguesByTier = TIER_ORDER.map(tier => ({
  tier,
  label: TIER_LABELS[tier],
  leagues: LEAGUES.filter(l => l.qualityTier === tier && l.tier === 1).sort((a, b) => a.name.localeCompare(b.name)),
})).filter(g => g.leagues.length > 0);


const LeagueTable = () => {
  const { divisionTables, divisionFixtures, divisionClubs, clubs, players, playerClubId, playerDivision, week, totalWeeks } = useGameStore(useShallow((s) => ({
    divisionTables: s.divisionTables,
    divisionFixtures: s.divisionFixtures,
    divisionClubs: s.divisionClubs,
    clubs: s.clubs,
    players: s.players,
    playerClubId: s.playerClubId,
    playerDivision: s.playerDivision,
    week: s.week,
    totalWeeks: s.totalWeeks,
  })));
  const selectClub = useGameStore((s) => s.selectClub);
  const handleSelectClub = useCallback((id: string) => { hapticLight(); selectClub(id); }, [selectClub]);
  const selectPlayer = useGameStore((s) => s.selectPlayer);
  const initializeLeague = useGameStore((s) => s.initializeLeague);
  const [tab, setTab] = useState<'table' | 'fixtures' | 'stats'>('table');
  const [browseWeek, setBrowseWeek] = useState(week);
  const [selectedDiv, setSelectedDiv] = useState(playerDivision || 'eng');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const isPlayerLeague = selectedDiv === playerDivision;

  const playerRowRef = useRef<HTMLTableRowElement>(null);
  const scrolledRef = useRef(false);
  const scrollToPlayer = useCallback(() => {
    if (playerRowRef.current && !scrolledRef.current) {
      playerRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      scrolledRef.current = true;
    }
  }, []);
  useEffect(() => { scrolledRef.current = false; }, [selectedDiv]);
  useEffect(() => { if (tab === 'table') scrollToPlayer(); }, [tab, scrollToPlayer]);

  const currentTable = divisionTables[selectedDiv] || [];
  const currentLeague = LEAGUES.find(l => l.id === selectedDiv);

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

  // Qualification zones for current league (Champions Cup, Shield Cup, Conference Cup, Replaced)
  const qualZones = useMemo(() => getQualificationZones(selectedDiv), [selectedDiv]);

  type ZoneType = 'champions_cup' | 'shield_cup' | 'conference_cup' | 'promotion' | 'playoff' | 'replaced' | null;

  const getZone = (pos: number): ZoneType => {
    if (qualZones.promotion?.includes(pos)) return 'promotion';
    if (qualZones.playoff?.includes(pos)) return 'playoff';
    if (qualZones.championsCup.includes(pos)) return 'champions_cup';
    if (qualZones.shieldCup.includes(pos)) return 'shield_cup';
    if (qualZones.conferenceCup.includes(pos)) return 'conference_cup';
    if (qualZones.replaced.includes(pos)) return 'replaced';
    return null;
  };

  const zoneBgClass = (zone: ZoneType) => {
    switch (zone) {
      case 'promotion': return 'bg-emerald-500/10 border-l-2 border-l-emerald-400';
      case 'playoff': return 'bg-amber-500/10 border-l-2 border-l-amber-400';
      case 'champions_cup': return 'bg-blue-500/10 border-l-2 border-l-blue-400';
      case 'shield_cup': return 'bg-orange-500/10 border-l-2 border-l-orange-400';
      case 'conference_cup': return 'bg-emerald-500/10 border-l-2 border-l-emerald-400';
      case 'replaced': return 'bg-destructive/10 border-l-2 border-l-destructive/60';
      default: return '';
    }
  };

  // Filtered leagues for picker search
  const filteredTiers = useMemo(() => {
    if (!searchQuery.trim()) return leaguesByTier;
    const q = searchQuery.toLowerCase();
    return leaguesByTier.map(group => ({
      ...group,
      leagues: group.leagues.filter(l =>
        l.name.toLowerCase().includes(q) || l.country.toLowerCase().includes(q) || l.shortName.toLowerCase().includes(q)
      ),
    })).filter(g => g.leagues.length > 0);
  }, [searchQuery]);

  const handleLeagueSelect = (leagueId: string) => {
    setPickerOpen(false);
    setSearchQuery('');
    scrolledRef.current = false;

    // Lazy-initialize the league if not yet loaded
    if (!divisionClubs[leagueId]?.length && leagueId !== playerDivision) {
      setIsLoading(true);
      // Use setTimeout to let the UI update before the heavy computation
      setTimeout(() => {
        initializeLeague(leagueId);
        setSelectedDiv(leagueId);
        setIsLoading(false);
      }, 50);
    } else {
      setSelectedDiv(leagueId);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
      <PageHint
        screen="league-table"
        title="League Table"
        body="Track standings, browse weekly fixtures, and see top scorers and assist leaders. Green zones mean promotion, red zones mean relegation. Tap any team to view their details."
      />

      {/* League Selector */}
      <button
        onClick={() => setPickerOpen(!pickerOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-card/60 backdrop-blur-xl border border-border/50 active:bg-muted/40 transition-colors"
      >
        <FlagIcon nationality={currentLeague?.country || 'England'} size={24} className="rounded-[2px]" />
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-bold text-foreground font-display truncate">{currentLeague?.name || 'League'}</p>
          <p className="text-[10px] text-muted-foreground">{currentLeague?.country}{isPlayerLeague ? ' \u2022 Your League' : ''}</p>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', pickerOpen && 'rotate-180')} />
      </button>

      {/* League Picker Dropdown */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <GlassPanel className="p-3 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setPickerOpen(false); }}
                  placeholder="Search leagues..."
                  className="w-full pl-8 pr-12 py-2 text-sm bg-muted/50 rounded-lg border border-border/30 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* League List */}
              <div className="max-h-72 overflow-y-auto space-y-3 -mx-1 px-1">
                {filteredTiers.map(group => (
                  <div key={group.tier}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 px-1">{group.label}</p>
                    <div className="space-y-0.5">
                      {group.leagues.map(topLeague => {
                        // Get all tiers for this country
                        const countryTiers = getLeaguesByCountry(topLeague.countryId);
                        const matchesSearch = searchQuery === '' || countryTiers.some(l =>
                          l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          l.country.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                        if (!matchesSearch) return null;
                        return countryTiers.map(league => {
                          const isActive = league.id === selectedDiv;
                          const isPlayerHome = league.id === playerDivision;
                          const isLowerTier = league.tier > 1;
                          return (
                            <button
                              key={league.id}
                              onClick={() => handleLeagueSelect(league.id)}
                              className={cn(
                                'w-full flex items-center gap-2.5 py-2 rounded-lg text-left transition-colors',
                                isLowerTier ? 'pl-8 pr-2.5' : 'px-2.5',
                                isActive ? 'bg-primary/15 border border-primary/30' : 'hover:bg-muted/40 active:bg-muted/60'
                              )}
                            >
                              {!isLowerTier && <FlagIcon nationality={league.country} size={20} className="rounded-[1px]" />}
                              {isLowerTier && <span className="text-[10px] text-muted-foreground w-5 text-center shrink-0">T{league.tier}</span>}
                              <span className={cn(
                                'text-xs font-medium flex-1 truncate',
                                isActive ? 'text-primary' : isLowerTier ? 'text-muted-foreground' : 'text-foreground'
                              )}>
                                {league.name}
                              </span>
                              {isPlayerHome && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold shrink-0">
                                  YOU
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground shrink-0">{league.teamCount}</span>
                            </button>
                          );
                        });
                      })}
                    </div>
                  </div>
                ))}
                {filteredTiers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No leagues found</p>
                )}
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {isLoading && (
        <GlassPanel className="p-8 text-center">
          <div className="animate-pulse space-y-2">
            <p className="text-sm font-medium text-foreground">Loading league data...</p>
            <p className="text-[10px] text-muted-foreground">Generating squads and simulating matches</p>
          </div>
        </GlassPanel>
      )}

      {/* Tabs */}
      {!isLoading && (<><div className="flex gap-2 items-center">
        {(['table', 'fixtures', 'stats'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors relative',
              tab === t ? 'text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            {t === 'table' ? 'Table' : t === 'fixtures' ? 'Fixtures' : 'Stats Leaders'}
            {tab === t && (
              <motion.div
                layoutId="league-tab-indicator"
                className="absolute inset-0 rounded-lg bg-primary -z-10"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
        <button
          onClick={() => setInfoOpen(!infoOpen)}
          className={cn(
            'ml-auto p-1.5 rounded-lg transition-colors shrink-0',
            infoOpen ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
          aria-label="Qualification info"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Qualification Info Panel */}
      <AnimatePresence>
        {infoOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <GlassPanel className="p-4 space-y-3">
              <p className="text-xs font-bold text-foreground font-display">
                {currentLeague?.name || 'League'} — Qualification Spots
              </p>

              {qualZones.championsCup.length > 0 && (
                <div className="flex items-start gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm bg-blue-400/50 mt-1 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-blue-400">Champions Cup</p>
                    <p className="text-[10px] text-muted-foreground">
                      Position{qualZones.championsCup.length > 1 ? 's' : ''} {qualZones.championsCup.join(', ')} qualify for the elite continental tournament.
                      Top 2 in each group advance to knockouts.
                    </p>
                  </div>
                </div>
              )}

              {qualZones.shieldCup.length > 0 && (
                <div className="flex items-start gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm bg-orange-400/50 mt-1 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-orange-400">Shield Cup</p>
                    <p className="text-[10px] text-muted-foreground">
                      Position{qualZones.shieldCup.length > 1 ? 's' : ''} {qualZones.shieldCup.join(', ')} qualify for the secondary continental cup.
                      Shield Cup winners earn a Champions Cup spot next season.
                    </p>
                  </div>
                </div>
              )}

              {qualZones.conferenceCup.length > 0 && (
                <div className="flex items-start gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400/50 mt-1 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-emerald-400">Conference Cup</p>
                    <p className="text-[10px] text-muted-foreground">
                      Position{qualZones.conferenceCup.length > 1 ? 's' : ''} {qualZones.conferenceCup.join(', ')} qualify for the third-tier continental cup.
                      Conference Cup winners earn a Shield Cup spot next season.
                    </p>
                  </div>
                </div>
              )}

              {qualZones.championsCup.length === 0 && qualZones.shieldCup.length === 0 && qualZones.conferenceCup.length === 0 && (
                <p className="text-[10px] text-muted-foreground">This league does not have continental qualification spots.</p>
              )}

              {currentLeague && currentLeague.replacedSlots > 0 && (
                <div className="flex items-start gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm bg-destructive/50 mt-1 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-destructive">Replaced Zone</p>
                    <p className="text-[10px] text-muted-foreground">
                      Bottom {currentLeague.replacedSlots} club{currentLeague.replacedSlots > 1 ? 's' : ''} are replaced at end of season.
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-1 border-t border-border/20">
                <p className="text-[10px] text-muted-foreground italic">
                  Domestic cup winners may also earn continental spots. Spots are based on league ranking which evolves with continental performance over seasons.
                </p>
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table Tab */}
      {tab === 'table' && (
        <GlassPanel className="overflow-hidden">
          <div className="overflow-x-auto">
            {/* table-fixed so the Club column truncates cleanly instead of
                the auto-layout squeezing every column at 375px width. */}
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left px-1 py-2 text-[10px] text-muted-foreground uppercase w-6">#</th>
                  <th className="text-left px-1 py-2 text-[10px] text-muted-foreground uppercase">Club</th>
                  <th className="text-center px-1 py-2 text-[10px] text-muted-foreground uppercase w-6">P</th>
                  <th className="text-center px-1 py-2 text-[10px] text-muted-foreground uppercase w-[2.6rem]">W-D-L</th>
                  <th className="text-center px-1 py-2 text-[10px] text-muted-foreground uppercase w-7">GD</th>
                  <th className="text-center px-1 py-2 text-[10px] text-muted-foreground uppercase w-7">Pts</th>
                  <th className="text-center px-1 py-2 text-[10px] text-muted-foreground uppercase w-[4rem]">Form</th>
                </tr>
              </thead>
              <tbody>
                {currentTable.map((entry, i) => {
                  const club = clubs[entry.clubId];
                  const isPlayer = entry.clubId === playerClubId;
                  const pos = i + 1;
                  const zone = getZone(pos);

                  return (
                    <motion.tr
                      key={entry.clubId}
                      ref={isPlayer ? playerRowRef : undefined}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.2 }}
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${club?.shortName || club?.name || 'club'}`}
                      onClick={() => handleSelectClub(entry.clubId)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectClub(entry.clubId); } }}
                      className={cn(
                        'border-b border-border/10 cursor-pointer active:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:bg-muted/40',
                        zoneBgClass(zone),
                        isPlayer && 'bg-primary/5 shadow-[inset_0_0_12px_hsl(var(--primary)/0.05)] border-l-2 border-l-primary'
                      )}
                    >
                      <td className={cn('px-1 py-2 text-xs', pos === 1 ? 'text-primary font-bold' : 'text-muted-foreground')}>
                        <div className="flex items-center gap-0.5">
                          <span>{pos}</span>
                          {entry.form.length > 0 && entry.form[entry.form.length - 1] === 'W' && (
                            <TrendingUp className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                          )}
                          {entry.form.length > 0 && entry.form[entry.form.length - 1] === 'L' && (
                            <TrendingDown className="w-2.5 h-2.5 text-destructive shrink-0" />
                          )}
                        </div>
                      </td>
                      <td className="px-1 py-2">
                        <div className="flex items-center gap-1 min-w-0">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: club?.color }} />
                          <span className={cn('text-xs font-medium truncate', isPlayer ? 'text-primary font-bold' : 'text-foreground')}>
                            {getClubDisplayName(club?.name || '?')}
                          </span>
                        </div>
                      </td>
                      <td className="text-center px-1 py-2 text-xs text-muted-foreground tabular-nums">{entry.played}</td>
                      <td className="text-center px-1 py-2 text-[10px] text-muted-foreground tabular-nums">{entry.won}-{entry.drawn}-{entry.lost}</td>
                      <td className="text-center px-1 py-2 text-xs text-muted-foreground tabular-nums">{entry.goalDifference > 0 ? '+' : ''}{entry.goalDifference}</td>
                      <td className="text-center px-1 py-2 text-xs font-bold text-foreground tabular-nums">{entry.points}</td>
                      <td className="px-1 py-2">
                        <div className="flex gap-0.5 justify-center">
                          {entry.form.map((r, j) => (
                            <span key={j} className={cn(
                              'w-3 h-3 rounded-sm flex items-center justify-center text-[7px] font-bold shrink-0',
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 border-t border-border/20">
            {qualZones.promotion?.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400/50" />
                <span className="text-[10px] text-muted-foreground">Promotion</span>
              </div>
            )}
            {qualZones.playoff?.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-amber-400/50" />
                <span className="text-[10px] text-muted-foreground">Playoffs</span>
              </div>
            )}
            {qualZones.championsCup.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-blue-400/50" />
                <span className="text-[10px] text-muted-foreground">Champions Cup</span>
              </div>
            )}
            {qualZones.shieldCup.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-orange-400/50" />
                <span className="text-[10px] text-muted-foreground">Shield Cup</span>
              </div>
            )}
            {qualZones.conferenceCup.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400/50" />
                <span className="text-[10px] text-muted-foreground">Conference Cup</span>
              </div>
            )}
            {qualZones.replaced.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-destructive/50" />
                <span className="text-[10px] text-muted-foreground">Relegation</span>
              </div>
            )}
            {isPlayerLeague && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-foreground/30" />
                <span className="text-[10px] text-muted-foreground">Your team</span>
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
              aria-label="Previous week"
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
              aria-label="Next week"
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
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`View ${getClubDisplayName(homeClub?.name || 'club')}`}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectClub(match.homeClubId); } }}
                        className="flex-1 flex items-center gap-2 justify-end cursor-pointer active:opacity-70 focus-visible:outline-none focus-visible:opacity-70"
                        onClick={() => handleSelectClub(match.homeClubId)}
                      >
                        <span className={cn(
                          'text-xs font-medium truncate text-right',
                          match.homeClubId === playerClubId ? 'text-primary font-bold' : 'text-foreground'
                        )}>
                          {getClubDisplayName(homeClub?.name || '?')}
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
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`View ${getClubDisplayName(awayClub?.name || 'club')}`}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectClub(match.awayClubId); } }}
                        className="flex-1 flex items-center gap-2 cursor-pointer active:opacity-70 focus-visible:outline-none focus-visible:opacity-70"
                        onClick={() => handleSelectClub(match.awayClubId)}
                      >
                        <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: awayClub?.color }} />
                        <span className={cn(
                          'text-xs font-medium truncate',
                          match.awayClubId === playerClubId ? 'text-primary font-bold' : 'text-foreground'
                        )}>
                          {getClubDisplayName(awayClub?.name || '?')}
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
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${p.firstName} ${p.lastName}`}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPlayer(p.id); } }}
                      className="flex items-center gap-3 cursor-pointer active:opacity-70 focus-visible:outline-none focus-visible:opacity-70"
                      onClick={() => selectPlayer(p.id)}
                    >
                      <span className={cn('w-5 text-xs font-bold text-center', i === 0 ? 'text-primary' : 'text-muted-foreground')}>{i + 1}</span>
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: pClub?.color }} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium truncate', p.clubId === playerClubId ? 'text-primary' : 'text-foreground')}>
                          {p.firstName[0]}. {p.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{p.position} {'\u2022'} {getClubDisplayName(pClub?.name || '?')}</p>
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
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${p.firstName} ${p.lastName}`}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPlayer(p.id); } }}
                      className="flex items-center gap-3 cursor-pointer active:opacity-70 focus-visible:outline-none focus-visible:opacity-70"
                      onClick={() => selectPlayer(p.id)}
                    >
                      <span className={cn('w-5 text-xs font-bold text-center', i === 0 ? 'text-primary' : 'text-muted-foreground')}>{i + 1}</span>
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: pClub?.color }} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-medium truncate', p.clubId === playerClubId ? 'text-primary' : 'text-foreground')}>
                          {p.firstName[0]}. {p.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{p.position} {'\u2022'} {getClubDisplayName(pClub?.name || '?')}</p>
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
      </>)}
    </div>
  );
};

export default LeagueTable;
