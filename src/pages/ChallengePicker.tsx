import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CHALLENGES, getDifficultyColor } from '@/data/challenges';
import { CLUBS_DATA, LEAGUES } from '@/data/league';
import { CLUBS_BY_LEAGUE } from '@/data/leagues';
import { COUNTRY_FLAGS, LEAGUE_REGIONS } from '@/data/leagueConstants';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronRight, ChevronDown, Trophy, Star, Globe } from 'lucide-react';
import { DynamicIcon } from '@/components/game/DynamicIcon';
import type { ChallengeScenario } from '@/types/game';

const ChallengePicker = () => {
  const navigate = useNavigate();
  const startChallenge = useGameStore(s => s.startChallenge);
  const [selected, setSelected] = useState<ChallengeScenario | null>(null);
  const [pickingClub, setPickingClub] = useState(false);
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null);

  const handleSelectChallenge = (scenario: ChallengeScenario) => {
    setSelected(scenario);
    if (scenario.startingClubId) {
      startChallenge(scenario.id, scenario.startingClubId);
      navigate('/game');
    } else if (scenario.id === 'giant-killer') {
      const lowestRep = [...CLUBS_DATA].sort((a, b) => a.reputation - b.reputation)[0];
      startChallenge(scenario.id, lowestRep.id);
      navigate('/game');
    } else {
      setPickingClub(true);
      setExpandedLeague(null);
    }
  };

  const handleSelectClub = (clubId: string) => {
    if (!selected) return;
    startChallenge(selected.id, clubId);
    navigate('/game');
  };

  // Build league-grouped club data based on the selected challenge's filter
  const leagueClubMap = useMemo(() => {
    if (!selected) return new Map<string, typeof CLUBS_DATA>();
    const isBottom = selected.clubFilter === 'bottom';
    const map = new Map<string, typeof CLUBS_DATA>();

    for (const league of LEAGUES) {
      const clubs = CLUBS_BY_LEAGUE[league.id];
      if (!clubs || clubs.length === 0) continue;

      if (isBottom) {
        const sorted = [...clubs].sort((a, b) => a.squadQuality - b.squadQuality);
        const count = Math.max(league.replacedSlots, 3);
        map.set(league.id, sorted.slice(0, count));
      } else {
        map.set(league.id, [...clubs].sort((a, b) => b.squadQuality - a.squadQuality));
      }
    }
    return map;
  }, [selected]);

  // Auto-expand first league that has clubs on initial open
  const handleToggleLeague = (leagueId: string) => {
    setExpandedLeague(prev => prev === leagueId ? null : leagueId);
  };

  if (pickingClub && selected) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-border/30 safe-area-top">
          <button onClick={() => { setPickingClub(false); setExpandedLeague(null); }} className="p-2 rounded-lg hover:bg-muted/50">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-display font-bold text-foreground">Choose Your Club</h1>
            <p className="text-xs text-muted-foreground truncate">{selected.name}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
          <div className="space-y-5">
            {LEAGUE_REGIONS.map(region => {
              const regionLeagues = region.ids
                .map(id => LEAGUES.find(l => l.id === id))
                .filter(Boolean)
                .filter(l => (leagueClubMap.get(l!.id)?.length ?? 0) > 0);

              if (regionLeagues.length === 0) return null;

              return (
                <div key={region.label}>
                  {/* Region header */}
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                    <Globe className="w-3 h-3" />
                    {region.label}
                  </h3>

                  <div className="space-y-1.5">
                    {regionLeagues.map(league => {
                      if (!league) return null;
                      const clubs = leagueClubMap.get(league.id) || [];
                      const isExpanded = expandedLeague === league.id;
                      const flag = COUNTRY_FLAGS[league.countryCode] || '';

                      return (
                        <div key={league.id}>
                          {/* League accordion header */}
                          <button
                            onClick={() => handleToggleLeague(league.id)}
                            className={cn(
                              'w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200',
                              'bg-card/60 backdrop-blur-xl active:scale-[0.98]',
                              isExpanded
                                ? 'border-primary/30 bg-primary/5'
                                : 'border-border/50 hover:border-border/80'
                            )}
                          >
                            <span className="text-lg leading-none">{flag}</span>
                            <div className="flex-1 text-left min-w-0">
                              <p className={cn('text-sm font-semibold', league.colorClass || 'text-foreground')}>{league.name}</p>
                              <p className="text-[10px] text-muted-foreground">{league.country}</p>
                            </div>
                            <span className="text-[10px] font-medium text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                              {clubs.length} club{clubs.length !== 1 ? 's' : ''}
                            </span>
                            <ChevronDown className={cn(
                              'w-4 h-4 text-muted-foreground transition-transform duration-200',
                              isExpanded && 'rotate-180'
                            )} />
                          </button>

                          {/* Expanded club list */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="pt-1.5 pl-3 space-y-1">
                                  {clubs.map((club, ci) => (
                                    <motion.button
                                      key={club.id}
                                      initial={{ opacity: 0, x: -8 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: ci * 0.03 }}
                                      onClick={() => handleSelectClub(club.id)}
                                      className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-card/40 border border-border/30 hover:border-primary/40 active:scale-[0.98] transition-all"
                                    >
                                      <div
                                        className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center font-bold text-[9px] shadow-md"
                                        style={{ backgroundColor: club.color, color: club.secondaryColor }}
                                      >
                                        {club.shortName}
                                      </div>
                                      <div className="flex-1 text-left min-w-0">
                                        <p className="text-sm font-semibold text-foreground truncate">{club.name}</p>
                                        <div className="flex items-center gap-1">
                                          {Array.from({ length: 5 }).map((_, si) => (
                                            <Star key={si} className={cn('w-2.5 h-2.5', si < club.reputation ? 'fill-primary text-primary' : 'text-muted-foreground/20')} />
                                          ))}
                                          <span className="text-[10px] text-muted-foreground ml-1">{club.stadiumName}</span>
                                        </div>
                                      </div>
                                      <div className="shrink-0 text-right">
                                        <span className={cn(
                                          'text-xs font-bold tabular-nums',
                                          club.budget >= 150_000_000 ? 'text-emerald-400' :
                                          club.budget >= 80_000_000 ? 'text-foreground' :
                                          club.budget >= 30_000_000 ? 'text-amber-400' : 'text-muted-foreground'
                                        )}>
                                          {'\u00A3'}{(club.budget / 1_000_000).toFixed(0)}M
                                        </span>
                                      </div>
                                    </motion.button>
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
          </div>
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
