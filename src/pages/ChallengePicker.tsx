import * as Sentry from '@sentry/react';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CHALLENGES, getDifficultyColor } from '@/data/challenges';
import { CLUBS_DATA, LEAGUES } from '@/data/league';
import { CLUBS_BY_LEAGUE, LEAGUE_REGIONS } from '@/data/leagues';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronRight, ChevronDown, Trophy, Search, X, ChevronsUpDown, Loader2 } from 'lucide-react';
import { FlagIcon } from '@/components/game/FlagIcon';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import type { ChallengeScenario, ClubData, LeagueInfo } from '@/types/game';

// Pre-compute sorted clubs per league (runs once at module level)
const SORTED_CLUBS_BY_LEAGUE: Record<string, ClubData[]> = {};
for (const [leagueId, clubs] of Object.entries(CLUBS_BY_LEAGUE)) {
  SORTED_CLUBS_BY_LEAGUE[leagueId] = [...clubs].sort((a, b) => b.squadQuality - a.squadQuality);
}

// Build a league lookup map for O(1) access
const LEAGUE_MAP: Record<string, LeagueInfo> = {};
for (const league of LEAGUES) {
  LEAGUE_MAP[league.id] = league;
}

const ChallengePicker = () => {
  const navigate = useNavigate();
  const startChallenge = useGameStore(s => s.startChallenge);
  const [selected, setSelected] = useState<ChallengeScenario | null>(null);
  const [pickingClub, setPickingClub] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedLeagues, setExpandedLeagues] = useState<Set<string>>(new Set());
  const [clubSearch, setClubSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Scroll to top when entering club picker
  useEffect(() => {
    if (pickingClub) window.scrollTo(0, 0);
  }, [pickingClub]);

  const handleSelectChallenge = (scenario: ChallengeScenario) => {
    setSelected(scenario);
    if (scenario.startingClubId) {
      startChallenge(scenario.id, scenario.startingClubId);
      navigate('/game');
    } else if (scenario.id === 'giant-killer') {
      const lowestRep = [...CLUBS_DATA].sort((a, b) => a.reputation - b.reputation)[0];
      if (!lowestRep) return;
      startChallenge(scenario.id, lowestRep.id);
      navigate('/game');
    } else {
      setPickingClub(true);
    }
  };

  const handleSelectClub = useCallback((clubId: string) => {
    if (!selected || loading) return;
    setLoading(true);
    requestAnimationFrame(() => {
      try {
        startChallenge(selected.id, clubId);
        queueMicrotask(() => navigate('/game'));
      } catch (err) {
        Sentry.captureException(err, { tags: { context: 'startChallenge' } });
        setLoading(false);
      }
    });
  }, [selected, loading, startChallenge, navigate]);

  const handleBack = useCallback(() => {
    setPickingClub(false);
    setClubSearch('');
    setExpandedLeagues(new Set());
  }, []);

  const toggleLeague = useCallback((leagueId: string) => {
    setExpandedLeagues(prev => {
      const next = new Set(prev);
      if (next.has(leagueId)) next.delete(leagueId);
      else next.add(leagueId);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setExpandedLeagues(prev => {
      if (prev.size > 0) return new Set();
      return new Set(LEAGUES.map(l => l.id));
    });
  }, []);

  // Filter clubs by search query
  const searchResults = useMemo(() => {
    const q = clubSearch.trim().toLowerCase();
    if (!q) return null;
    const matched: Record<string, ClubData[]> = {};
    for (const club of CLUBS_DATA) {
      if (club.name.toLowerCase().includes(q) || club.shortName.toLowerCase().includes(q)) {
        if (!matched[club.divisionId]) matched[club.divisionId] = [];
        matched[club.divisionId].push(club);
      }
    }
    for (const key of Object.keys(matched)) {
      matched[key].sort((a, b) => b.squadQuality - a.squadQuality);
    }
    return matched;
  }, [clubSearch]);

  // Count total search results
  const searchCount = useMemo(() => {
    if (!searchResults) return 0;
    return Object.values(searchResults).reduce((sum, arr) => sum + arr.length, 0);
  }, [searchResults]);

  // ── Club Picker View ──
  if (pickingClub && selected) {
    const isSearching = !!searchResults;

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Sticky header */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/30 safe-area-top">
          <div className="flex items-center gap-3 p-4 max-w-lg mx-auto">
            <button
              onClick={handleBack}
              aria-label="Back to challenges"
              className="p-2 -ml-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-display font-bold text-foreground">Choose Your Club</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase', getDifficultyColor(selected.difficulty))}>
                  {selected.difficulty}
                </span>
                <span className="text-xs text-muted-foreground truncate">{selected.name}</span>
              </div>
            </div>
          </div>

          {/* Search + controls */}
          <div className="px-4 pb-3 max-w-lg mx-auto flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <input
                ref={searchRef}
                type="text"
                value={clubSearch}
                onChange={e => setClubSearch(e.target.value)}
                placeholder="Search clubs..."
                aria-label="Search clubs"
                className="w-full bg-muted/30 border border-border/30 rounded-lg pl-9 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 transition-colors"
              />
              {clubSearch && (
                <button
                  onClick={() => { setClubSearch(''); searchRef.current?.focus(); }}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {!isSearching && (
              <button
                onClick={toggleAll}
                aria-label={expandedLeagues.size > 0 ? 'Collapse all leagues' : 'Expand all leagues'}
                className="p-2 rounded-lg bg-muted/30 border border-border/30 hover:border-border/60 text-muted-foreground hover:text-foreground transition-all shrink-0"
              >
                <ChevronsUpDown className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Result count during search */}
          {isSearching && (
            <div className="px-4 pb-2 max-w-lg mx-auto">
              <p className="text-[10px] text-muted-foreground">
                {searchCount} {searchCount === 1 ? 'club' : 'clubs'} found
              </p>
            </div>
          )}
        </div>

        {/* League-grouped clubs */}
        <div className="flex-1 overflow-y-auto px-4 pb-8 max-w-lg mx-auto w-full">
          {LEAGUE_REGIONS.map(region => {
            const regionLeagues = region.ids
              .map(id => LEAGUE_MAP[id])
              .filter(Boolean)
              .filter(league => !isSearching || (searchResults[league.id]?.length > 0));

            if (regionLeagues.length === 0) return null;

            return (
              <div key={region.label} className="mt-4 first:mt-2">
                {/* Region divider */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="h-px flex-1 bg-border/30" />
                  <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{region.label}</span>
                  <div className="h-px flex-1 bg-border/30" />
                </div>

                <div className="space-y-1.5">
                  {regionLeagues.map(league => {
                    const leagueClubs = isSearching
                      ? searchResults[league.id] || []
                      : SORTED_CLUBS_BY_LEAGUE[league.id] || [];
                    const isExpanded = isSearching || expandedLeagues.has(league.id);

                    return (
                      <div key={league.id}>
                        {/* League header */}
                        <button
                          onClick={() => { if (!isSearching) toggleLeague(league.id); }}
                          aria-expanded={isExpanded}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-xl transition-all',
                            'bg-card/60 backdrop-blur-xl border',
                            isExpanded ? 'border-primary/30 bg-card/80' : 'border-border/30 hover:border-border/60',
                            isSearching && 'cursor-default',
                          )}
                        >
                          <FlagIcon nationality={league.country} size={24} className="rounded-sm shrink-0" />
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-semibold text-foreground">{league.name}</p>
                            <p className="text-[10px] text-muted-foreground">{league.country}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground/60 bg-white/5 rounded px-1.5 py-0.5 shrink-0">
                            {leagueClubs.length} {isSearching ? (leagueClubs.length === 1 ? 'match' : 'matches') : 'clubs'}
                          </span>
                          {!isSearching && (
                            <ChevronDown className={cn(
                              'w-4 h-4 text-muted-foreground transition-transform duration-200',
                              isExpanded && 'rotate-180'
                            )} />
                          )}
                        </button>

                        {/* Clubs list */}
                        <AnimatePresence initial={false}>
                          {isExpanded && leagueClubs.length > 0 && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: 'easeInOut' }}
                              className="overflow-hidden"
                            >
                              <div className="pt-1 pl-3 space-y-1">
                                {leagueClubs.map(club => (
                                  <button
                                    key={club.id}
                                    onClick={() => handleSelectClub(club.id)}
                                    disabled={loading}
                                    className={cn(
                                      'w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all',
                                      'bg-card/30 border-border/20 hover:border-primary/40 active:scale-[0.98]',
                                      loading && 'opacity-50 pointer-events-none',
                                    )}
                                  >
                                    <div
                                      className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-[9px] font-bold shadow-sm"
                                      style={{ backgroundColor: club.color, color: club.secondaryColor }}
                                    >
                                      {club.shortName}
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                      <p className="text-sm font-medium text-foreground truncate">{club.name}</p>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="flex gap-0.5" role="img" aria-label={`${club.reputation} out of 5 reputation`}>
                                          {Array.from({ length: 5 }, (_, i) => (
                                            <div
                                              key={i}
                                              className={cn(
                                                'w-1.5 h-1.5 rounded-full',
                                                i < club.reputation ? 'bg-primary' : 'bg-white/10'
                                              )}
                                            />
                                          ))}
                                        </div>
                                        {club.stadiumName && (
                                          <span className="text-[9px] text-muted-foreground/50 truncate">{club.stadiumName}</span>
                                        )}
                                      </div>
                                    </div>
                                    <span className={cn(
                                      'text-xs font-bold tabular-nums shrink-0',
                                      club.budget >= 150_000_000 ? 'text-emerald-400' :
                                      club.budget >= 80_000_000 ? 'text-foreground' :
                                      club.budget >= 30_000_000 ? 'text-amber-400' : 'text-muted-foreground'
                                    )}>
                                      {'\u00A3'}{(club.budget / 1_000_000).toFixed(0)}M
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* No results */}
          {isSearching && searchCount === 0 && (
            <p className="text-center text-muted-foreground text-sm py-12">No clubs match &ldquo;{clubSearch}&rdquo;</p>
          )}
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Starting challenge...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Challenge List View ──
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/30 safe-area-top">
        <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-muted/50">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-display font-bold text-foreground">Challenge Mode</h1>
          <p className="text-xs text-muted-foreground">Test your skills with unique scenarios</p>
        </div>
      </div>

      {/* Challenge List */}
      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
        <div className="space-y-3">
          {CHALLENGES.map((challenge, i) => (
            <motion.button
              key={challenge.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleSelectChallenge(challenge)}
              className="w-full text-left bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-4 hover:border-primary/40 active:scale-[0.98] transition-all"
            >
              <div className="flex items-start gap-3">
                <DynamicIcon name={challenge.icon} className="w-7 h-7 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-foreground">{challenge.name}</h3>
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase', getDifficultyColor(challenge.difficulty))}>
                      {challenge.difficulty}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{challenge.description}</p>

                  {/* Objective */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Trophy className="w-3 h-3 text-primary shrink-0" />
                    <p className="text-[10px] text-primary font-medium">{challenge.winCondition}</p>
                  </div>

                  {/* Constraints */}
                  <div className="flex flex-wrap gap-1">
                    {challenge.constraints.map((c, j) => (
                      <span key={j} className="text-[9px] bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded">
                        {c}
                      </span>
                    ))}
                    <span className="text-[9px] bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded">
                      {challenge.seasonLimit} season{challenge.seasonLimit > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChallengePicker;
