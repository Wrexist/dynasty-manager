import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CHALLENGES, getDifficultyColor } from '@/data/challenges';
import { CLUBS_DATA, LEAGUES } from '@/data/league';
import { CLUBS_BY_LEAGUE } from '@/data/leagues';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronRight, ChevronDown, Trophy, Search, X } from 'lucide-react';
import { FlagIcon } from '@/components/game/FlagIcon';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import type { ChallengeScenario, ClubData } from '@/types/game';

const LEAGUE_REGIONS = [
  { label: 'Top 5 Leagues', ids: ['eng', 'esp', 'ita', 'ger', 'fra'] },
  { label: 'Strong Leagues', ids: ['ned', 'por', 'bel', 'tur', 'sco'] },
  { label: 'Central & Eastern Europe', ids: ['cze', 'pol', 'hun', 'rou', 'ukr', 'srb', 'bgr', 'svk', 'cro'] },
  { label: 'Nordic Leagues', ids: ['den', 'nor', 'swe', 'fin', 'isl'] },
  { label: 'Other Leagues', ids: ['gre', 'che', 'aut', 'irl', 'isr', 'cyp'] },
];

const ChallengePicker = () => {
  const navigate = useNavigate();
  const startChallenge = useGameStore(s => s.startChallenge);
  const [selected, setSelected] = useState<ChallengeScenario | null>(null);
  const [pickingClub, setPickingClub] = useState(false);

  const handleSelectChallenge = (scenario: ChallengeScenario) => {
    setSelected(scenario);
    if (scenario.startingClubId) {
      // Fixed club — start directly
      startChallenge(scenario.id, scenario.startingClubId);
      navigate('/game');
    } else if (scenario.id === 'giant-killer') {
      // Must pick lowest rep club
      const lowestRep = [...CLUBS_DATA].sort((a, b) => a.reputation - b.reputation)[0];
      startChallenge(scenario.id, lowestRep.id);
      navigate('/game');
    } else {
      setPickingClub(true);
    }
  };

  const handleSelectClub = (clubId: string) => {
    if (!selected) return;
    startChallenge(selected.id, clubId);
    navigate('/game');
  };

  const [expandedLeagues, setExpandedLeagues] = useState<Set<string>>(new Set());
  const [clubSearch, setClubSearch] = useState('');

  const toggleLeague = useCallback((leagueId: string) => {
    setExpandedLeagues(prev => {
      const next = new Set(prev);
      if (next.has(leagueId)) next.delete(leagueId);
      else next.add(leagueId);
      return next;
    });
  }, []);

  // Filter clubs by search query and determine which leagues have matches
  const searchResults = useMemo(() => {
    if (!clubSearch.trim()) return null;
    const q = clubSearch.toLowerCase();
    const matched: Record<string, ClubData[]> = {};
    for (const club of CLUBS_DATA) {
      if (club.name.toLowerCase().includes(q) || club.shortName.toLowerCase().includes(q)) {
        if (!matched[club.divisionId]) matched[club.divisionId] = [];
        matched[club.divisionId].push(club);
      }
    }
    // Sort clubs within each league
    for (const key of Object.keys(matched)) {
      matched[key].sort((a, b) => b.squadQuality - a.squadQuality);
    }
    return matched;
  }, [clubSearch]);

  if (pickingClub && selected) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/30 safe-area-top">
          <div className="flex items-center gap-3 p-4 max-w-lg mx-auto">
            <button onClick={() => { setPickingClub(false); setClubSearch(''); setExpandedLeagues(new Set()); }} className="p-2 -ml-2 rounded-lg hover:bg-muted/50">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-display font-bold text-foreground">Choose Your Club</h1>
              <p className="text-xs text-muted-foreground">{selected.name}</p>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 pb-3 max-w-lg mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <input
                type="text"
                value={clubSearch}
                onChange={e => setClubSearch(e.target.value)}
                placeholder="Search clubs..."
                className="w-full bg-muted/30 border border-border/30 rounded-lg pl-9 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 transition-colors"
              />
              {clubSearch && (
                <button
                  onClick={() => setClubSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* League-grouped clubs */}
        <div className="flex-1 overflow-y-auto px-4 pb-8 max-w-lg mx-auto w-full">
          {LEAGUE_REGIONS.map(region => {
            // Get leagues in this region that have clubs (and match search if active)
            const regionLeagues = region.ids
              .map(id => LEAGUES.find(l => l.id === id))
              .filter(Boolean)
              .filter(league => {
                if (!searchResults) return true;
                return searchResults[league!.id]?.length > 0;
              });

            if (regionLeagues.length === 0) return null;

            return (
              <div key={region.label} className="mt-4 first:mt-2">
                {/* Region label */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="h-px flex-1 bg-border/30" />
                  <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{region.label}</span>
                  <div className="h-px flex-1 bg-border/30" />
                </div>

                <div className="space-y-1.5">
                  {regionLeagues.map(league => {
                    if (!league) return null;
                    const leagueClubs = searchResults
                      ? (searchResults[league.id] || [])
                      : (CLUBS_BY_LEAGUE[league.id] || []).slice().sort((a, b) => b.squadQuality - a.squadQuality);
                    const isExpanded = expandedLeagues.has(league.id) || !!searchResults;

                    return (
                      <div key={league.id}>
                        {/* League header */}
                        <button
                          onClick={() => toggleLeague(league.id)}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-xl transition-all',
                            'bg-card/60 backdrop-blur-xl border',
                            isExpanded ? 'border-primary/30 bg-card/80' : 'border-border/30 hover:border-border/60',
                          )}
                        >
                          <FlagIcon nationality={league.country} size={24} className="rounded-sm shrink-0" />
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-semibold text-foreground">{league.name}</p>
                            <p className="text-[10px] text-muted-foreground">{league.country}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground/60 bg-white/5 rounded px-1.5 py-0.5 shrink-0">
                            {leagueClubs.length} clubs
                          </span>
                          <ChevronDown className={cn(
                            'w-4 h-4 text-muted-foreground transition-transform duration-200',
                            isExpanded && 'rotate-180'
                          )} />
                        </button>

                        {/* Clubs list (collapsible) */}
                        <AnimatePresence initial={false}>
                          {isExpanded && leagueClubs.length > 0 && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: 'easeInOut' }}
                              className="overflow-hidden"
                            >
                              <div className="pt-1 pl-3 space-y-1">
                                {leagueClubs.map(club => (
                                  <button
                                    key={club.id}
                                    onClick={() => handleSelectClub(club.id)}
                                    className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-card/30 border border-border/20 hover:border-primary/40 active:scale-[0.98] transition-all"
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
                                        <div className="flex gap-0.5">
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

          {/* No results message */}
          {searchResults && Object.keys(searchResults).length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-12">No clubs match &ldquo;{clubSearch}&rdquo;</p>
          )}
        </div>
      </div>
    );
  }

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
