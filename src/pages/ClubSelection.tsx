import { useState, useMemo, memo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { CLUBS_DATA, LEAGUES } from '@/data/league';
import { CLUBS_BY_LEAGUE } from '@/data/leagues';
import { NATIONS, NATION_STARS } from '@/data/nations';
import { getFlag } from '@/utils/nationality';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ArrowLeft, Wallet, Users, Loader2, Search, Globe, X, Building2, Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LeagueId } from '@/types/game';
import { DIFFICULTY_CONFIG, DIFFICULTY_BARS } from '@/config/ui';
import { toast } from 'sonner';

const COUNTRY_FLAGS: Record<string, string> = {
  GB: '🇬🇧', ES: '🇪🇸', IT: '🇮🇹', DE: '🇩🇪', FR: '🇫🇷',
  NL: '🇳🇱', PT: '🇵🇹', BE: '🇧🇪', TR: '🇹🇷', CZ: '🇨🇿',
  GR: '🇬🇷', PL: '🇵🇱', DK: '🇩🇰', NO: '🇳🇴', CH: '🇨🇭',
  AT: '🇦🇹', SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', SE: '🇸🇪', HR: '🇭🇷', HU: '🇭🇺',
  RS: '🇷🇸', RO: '🇷🇴', UA: '🇺🇦', BG: '🇧🇬', SK: '🇸🇰',
  FI: '🇫🇮', IS: '🇮🇸', IE: '🇮🇪', IL: '🇮🇱', CY: '🇨🇾',
};

const LEAGUE_REGIONS = [
  { label: 'Top 5 Leagues', ids: ['eng', 'esp', 'ita', 'ger', 'fra'] },
  { label: 'Strong Leagues', ids: ['ned', 'por', 'bel', 'tur', 'sco'] },
  { label: 'Central & Eastern Europe', ids: ['cze', 'pol', 'hun', 'rou', 'ukr', 'srb', 'bgr', 'svk', 'cro'] },
  { label: 'Nordic Leagues', ids: ['den', 'nor', 'swe', 'fin', 'isl'] },
  { label: 'Other Leagues', ids: ['gre', 'che', 'aut', 'irl', 'isr', 'cyp'] },
];

const CONFEDERATION_LABELS: Record<string, string> = {
  UEFA: 'Europe',
  CONMEBOL: 'South America',
  CAF: 'Africa',
  AFC: 'Asia',
  CONCACAF: 'North & Central America',
};

const STEPS = [
  { key: 'nationality', label: 'Nation' },
  { key: 'league', label: 'League' },
  { key: 'club', label: 'Club' },
] as const;

// Pre-compute club counts per league at module level (runs once)
const LEAGUE_CLUB_COUNTS: Record<string, number> = {};
for (const league of LEAGUES) {
  LEAGUE_CLUB_COUNTS[league.id] = CLUBS_BY_LEAGUE[league.id]?.length || league.teamCount;
}

const ClubSelection = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initGame = useGameStore(s => s.initGame);
  const initNationalTeam = useGameStore(s => s.initNationalTeam);
  const [step, setStep] = useState<'nationality' | 'league' | 'club'>('nationality');
  const [selectedNationality, setSelectedNationality] = useState<string | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<LeagueId | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nationSearch, setNationSearch] = useState('');
  const [leagueSearch, setLeagueSearch] = useState('');
  const [clubSearch, setClubSearch] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus heading when step changes for accessibility
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const handleStart = () => {
    if (!selected || !selectedNationality || !selectedLeague || loading) return;
    setLoading(true);
    requestAnimationFrame(() => {
      try {
        const pendingSlot = (location.state as { slot?: number })?.slot || 1;
        initGame(selected);
        initNationalTeam(selectedNationality);
        useGameStore.setState({ activeSlot: pendingSlot });
        try {
          useGameStore.getState().saveGame(pendingSlot);
        } catch (saveErr) {
          console.warn('Save failed during career start:', saveErr);
        }
        queueMicrotask(() => navigate('/game'));
      } catch (err) {
        console.error('Failed to start game:', err);
        toast.error('Something went wrong starting your career. Please try again.');
        setLoading(false);
      }
    });
  };

  const handleNationalitySelect = (name: string) => {
    setSelectedNationality(name);
    setStep('league');
    window.scrollTo(0, 0);
  };

  const handleLeagueSelect = (leagueId: LeagueId) => {
    setSelectedLeague(leagueId);
    setSelected(null);
    setClubSearch('');
    setStep('club');
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    if (step === 'club') {
      setStep('league');
      setSelected(null);
      setSelectedLeague(null);
      setClubSearch('');
    } else if (step === 'league') {
      setStep('nationality');
      setSelectedLeague(null);
    } else {
      navigate('/');
    }
  };

  const leagueInfo = LEAGUES.find(l => l.id === selectedLeague);
  const leagueClubs = useMemo(() =>
    CLUBS_DATA.filter(c => c.divisionId === selectedLeague).sort((a, b) => b.squadQuality - a.squadQuality),
    [selectedLeague]
  );

  // Filter clubs by search
  const filteredClubs = useMemo(() => {
    if (!clubSearch) return leagueClubs;
    const q = clubSearch.toLowerCase();
    return leagueClubs.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.shortName.toLowerCase().includes(q) ||
      c.stadiumName?.toLowerCase().includes(q)
    );
  }, [clubSearch, leagueClubs]);

  const selectedClub = CLUBS_DATA.find(c => c.id === selected);

  const filteredLeagues = useMemo(() => {
    if (!leagueSearch) return null;
    const q = leagueSearch.toLowerCase();
    return LEAGUES.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.country.toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q)
    );
  }, [leagueSearch]);

  // Memoize nation filtering to avoid inline recomputation
  const nationsByConfederation = useMemo(() => {
    const q = nationSearch.toLowerCase();
    return Object.entries(CONFEDERATION_LABELS).map(([conf, label]) => {
      const nations = NATIONS
        .filter(n => n.confederation === conf)
        .filter(n => !nationSearch || n.name.toLowerCase().includes(q))
        .sort((a, b) => a.baseRanking - b.baseRanking);
      return { conf, label, nations };
    }).filter(g => g.nations.length > 0);
  }, [nationSearch]);

  const stepIndex = step === 'nationality' ? 0 : step === 'league' ? 1 : 2;

  const backLabel = step === 'club' ? 'Back to leagues' : step === 'league' ? 'Back to nations' : 'Back to menu';

  return (
    <div className="min-h-screen bg-background safe-area-top">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 pt-3 pb-2">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              aria-label={backLabel}
              className="p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-w-0"
              >
                {step === 'nationality' ? (
                  <>
                    <h1 ref={headingRef} tabIndex={-1} className="text-lg font-bold text-foreground font-display outline-none">Your Nationality</h1>
                    <p className="text-[10px] text-muted-foreground">You'll manage this national team too</p>
                  </>
                ) : step === 'league' ? (
                  <>
                    <h1 ref={headingRef} tabIndex={-1} className="text-lg font-bold text-foreground font-display outline-none">Choose League</h1>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {selectedNationality && <><span className="text-foreground/70">{getFlag(selectedNationality)} {selectedNationality}</span> · </>}
                      30 leagues across Europe
                    </p>
                  </>
                ) : (
                  <>
                    <h1 ref={headingRef} tabIndex={-1} className={cn('text-lg font-bold font-display outline-none', leagueInfo?.colorClass)}>
                      {leagueInfo?.name}
                    </h1>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {selectedNationality && <><span className="text-foreground/70">{getFlag(selectedNationality)} {selectedNationality}</span> · </>}
                      {leagueClubs.length} clubs
                    </p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Step progress indicator */}
          <div className="flex items-center gap-2 mt-2.5">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1.5 flex-1">
                <div
                  className={cn(
                    'h-1 rounded-full flex-1 transition-all duration-300',
                    i <= stepIndex ? 'bg-primary' : 'bg-muted/30'
                  )}
                  role="progressbar"
                  aria-valuenow={stepIndex + 1}
                  aria-valuemin={1}
                  aria-valuemax={3}
                />
                <span className={cn(
                  'text-[9px] font-semibold transition-colors',
                  i <= stepIndex ? 'text-primary' : 'text-muted-foreground/50'
                )}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-4 pb-32">
        <AnimatePresence mode="wait">
          {step === 'nationality' ? (
            <motion.div
              key="nationality-step"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <SearchInput
                placeholder="Search nations..."
                value={nationSearch}
                onChange={setNationSearch}
              />

              {nationsByConfederation.map(({ conf, label, nations }) => (
                <div key={conf}>
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                    {label}
                  </h3>
                  <div className="space-y-1.5">
                    {nations.map((nation, i) => {
                      const stars = NATION_STARS[nation.name] || [];
                      const flag = getFlag(nation.name);
                      const isSelected = selectedNationality === nation.name;
                      return (
                        <motion.div
                          key={nation.name}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                        >
                          <button
                            type="button"
                            onClick={() => handleNationalitySelect(nation.name)}
                            className={cn(
                              'relative overflow-hidden rounded-xl border cursor-pointer w-full text-left',
                              'active:scale-[0.97] transition-all duration-200 p-3',
                              'bg-card/40 backdrop-blur-xl',
                              isSelected
                                ? 'ring-2 ring-primary border-primary/30 bg-primary/5'
                                : 'border-border/30 hover:border-border/60'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl leading-none shrink-0" role="img" aria-label={`${nation.name} flag`}>{flag}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-foreground text-sm truncate">{nation.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-medium text-muted-foreground bg-white/5 rounded px-1.5 py-0.5">
                                    #{nation.baseRanking} FIFA
                                  </span>
                                  {nation.baseRanking <= 10 && (
                                    <span className="text-[10px] font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5">
                                      Top 10
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {stars.length > 0 && (
                              <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-border/20">
                                {stars.map((player) => (
                                  <div key={player.name} className="flex-1 min-w-0">
                                    <p className="text-[11px] text-foreground/80 font-medium truncate">{player.name}</p>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] text-muted-foreground/60">{player.position}</span>
                                      <span className={cn(
                                        'text-[10px] font-bold',
                                        player.rating >= 90 ? 'text-emerald-400' :
                                        player.rating >= 85 ? 'text-primary' :
                                        player.rating >= 80 ? 'text-amber-400' : 'text-muted-foreground'
                                      )}>{player.rating}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          ) : step === 'league' ? (
            <motion.div
              key="league-step"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <SearchInput
                placeholder="Search leagues or countries..."
                value={leagueSearch}
                onChange={setLeagueSearch}
              />

              {filteredLeagues ? (
                <div className="space-y-2">
                  {filteredLeagues.map((league, i) => (
                    <LeagueCard key={league.id} league={league} index={i} onSelect={handleLeagueSelect} />
                  ))}
                  {filteredLeagues.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-8">No leagues found</p>
                  )}
                </div>
              ) : (
                LEAGUE_REGIONS.map(region => {
                  const regionLeagues = region.ids.map(id => LEAGUES.find(l => l.id === id)).filter(Boolean);
                  return (
                    <div key={region.label}>
                      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                        <Globe className="w-3 h-3" />
                        {region.label}
                      </h3>
                      <div className="space-y-2">
                        {regionLeagues.map((league, i) => league && (
                          <LeagueCard key={league.id} league={league} index={i} onSelect={handleLeagueSelect} />
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </motion.div>
          ) : (
            <motion.div
              key="club-step"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.25 }}
              className="space-y-3"
            >
              {/* League info summary */}
              {leagueInfo && (
                <GlassPanel className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl leading-none">{COUNTRY_FLAGS[leagueInfo.countryCode] || ''}</span>
                      <div>
                        <h3 className="text-xs font-semibold text-foreground">{leagueInfo.country}</h3>
                        <p className="text-[10px] text-muted-foreground">{leagueInfo.totalWeeks} week season</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-xs font-bold text-primary tabular-nums">{'\u00A3'}{(leagueInfo.prizeMoney / 1_000_000).toFixed(0)}M</div>
                        <div className="text-[8px] text-muted-foreground">Prize</div>
                      </div>
                      <DifficultyPips difficulty={leagueInfo.difficulty} />
                    </div>
                  </div>
                </GlassPanel>
              )}

              {/* Club search */}
              {leagueClubs.length > 8 && (
                <SearchInput
                  placeholder="Search clubs..."
                  value={clubSearch}
                  onChange={setClubSearch}
                />
              )}

              {/* Club list */}
              <div className="space-y-1.5">
                {filteredClubs.length === 0 && clubSearch && (
                  <p className="text-center text-muted-foreground text-sm py-8">No clubs match "{clubSearch}"</p>
                )}
                {filteredClubs.map((club, i) => {
                  const isSelected = selected === club.id;
                  return (
                    <motion.div
                      key={club.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.025 }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelected(club.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          'relative w-full text-left rounded-xl border transition-all duration-200',
                          'active:scale-[0.98] p-3',
                          'bg-card/40 backdrop-blur-xl',
                          isSelected
                            ? 'ring-2 ring-primary border-primary/30 bg-primary/5'
                            : 'border-border/30 hover:border-border/60'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {/* Club badge */}
                          <div
                            className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center font-bold text-[10px] shadow-md"
                            style={{ backgroundColor: club.color, color: club.secondaryColor }}
                          >
                            {club.shortName}
                          </div>

                          {/* Club info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground text-sm leading-tight">{club.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <ReputationDots value={club.reputation} />
                              {club.stadiumName && (
                                <span className="text-[10px] text-muted-foreground/50 truncate">{club.stadiumName}</span>
                              )}
                            </div>
                          </div>

                          {/* Budget */}
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
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom sheet — club selected */}
      <AnimatePresence>
        {selectedClub && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            role="dialog"
            aria-label={`${selectedClub.name} details`}
            className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-xl border-t border-border/40 safe-area-bottom"
          >
            <div className="max-w-lg mx-auto p-4 space-y-3">
              {/* Club header */}
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center text-[10px] font-bold shadow-lg"
                  style={{ backgroundColor: selectedClub.color, color: selectedClub.secondaryColor }}
                >
                  {selectedClub.shortName}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-base leading-tight">{selectedClub.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <ReputationDots value={selectedClub.reputation} />
                    {selectedClub.stadiumName && (
                      <span className="text-[10px] text-muted-foreground/50 truncate">
                        {selectedClub.stadiumName} ({(selectedClub.stadiumCapacity / 1000).toFixed(0)}k)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-1.5">
                <div className="bg-muted/20 rounded-lg px-2 py-2 text-center">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-0.5" />
                  <div className="text-[11px] font-bold text-foreground tabular-nums">{'\u00A3'}{(selectedClub.budget / 1e6).toFixed(0)}M</div>
                  <div className="text-[8px] text-muted-foreground">Budget</div>
                </div>
                <div className="bg-muted/20 rounded-lg px-2 py-2 text-center">
                  <Users className="w-3.5 h-3.5 text-blue-400 mx-auto mb-0.5" />
                  <div className="text-[11px] font-bold text-foreground tabular-nums">{selectedClub.fanBase}</div>
                  <div className="text-[8px] text-muted-foreground">Fans</div>
                </div>
                <div className="bg-muted/20 rounded-lg px-2 py-2 text-center">
                  <Building2 className="w-3.5 h-3.5 text-amber-400 mx-auto mb-0.5" />
                  <div className="text-[11px] font-bold text-foreground tabular-nums">{selectedClub.facilities}</div>
                  <div className="text-[8px] text-muted-foreground">Facilities</div>
                </div>
                <div className="bg-muted/20 rounded-lg px-2 py-2 text-center">
                  <Sprout className="w-3.5 h-3.5 text-purple-400 mx-auto mb-0.5" />
                  <div className="text-[11px] font-bold text-foreground tabular-nums">{selectedClub.youthRating}</div>
                  <div className="text-[8px] text-muted-foreground">Youth</div>
                </div>
              </div>

              <Button className="w-full h-11 text-sm font-bold rounded-xl" onClick={handleStart} disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Setting up...</> : 'Begin Career'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Reusable Search Input with Clear Button ──
function SearchInput({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={placeholder}
        className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-card/60 border border-border/40 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Reputation Dots (accessible) ──
function ReputationDots({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`${value} out of 5 reputation`}>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            i < value ? 'bg-primary' : 'bg-white/10'
          )}
        />
      ))}
    </div>
  );
}

// ── Difficulty Pips ──
function DifficultyPips({ difficulty }: { difficulty: string }) {
  const config = DIFFICULTY_CONFIG[difficulty];
  const bars = DIFFICULTY_BARS[difficulty] || 1;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5" role="img" aria-label={`Difficulty: ${config?.label || difficulty}`}>
        {[1, 2, 3, 4].map(n => (
          <div
            key={n}
            className={cn(
              'w-1.5 h-3 rounded-full transition-colors',
              n <= bars ? config?.bar || 'bg-muted' : 'bg-white/5'
            )}
          />
        ))}
      </div>
      <span className={cn('text-[8px] font-semibold', config?.color)}>{config?.label}</span>
    </div>
  );
}

// ── League Card Component (memoized) ──
const LeagueCard = memo(function LeagueCard({ league, index, onSelect }: { league: typeof LEAGUES[number]; index: number; onSelect: (id: LeagueId) => void }) {
  const difficulty = DIFFICULTY_CONFIG[league.difficulty];
  const bars = DIFFICULTY_BARS[league.difficulty] || 1;
  const flag = COUNTRY_FLAGS[league.countryCode] || '';
  const clubCount = LEAGUE_CLUB_COUNTS[league.id] || league.teamCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 30 }}
    >
      <button
        type="button"
        onClick={() => onSelect(league.id)}
        className={cn(
          'relative overflow-hidden rounded-xl border border-border/30 cursor-pointer w-full text-left',
          'active:scale-[0.98] transition-all duration-200',
          'bg-card/40 backdrop-blur-xl',
          'hover:border-border/60 p-3'
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none shrink-0" role="img" aria-label={`${league.country} flag`}>{flag}</span>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-sm text-foreground truncate">
              {league.name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-muted-foreground/60 bg-white/5 rounded px-1.5 py-0.5">
                {clubCount} clubs
              </span>
              <span className="text-[10px] text-muted-foreground/60 bg-white/5 rounded px-1.5 py-0.5">
                {'\u00A3'}{(league.prizeMoney / 1_000_000).toFixed(league.prizeMoney >= 1_000_000 ? 0 : 1)}M
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex gap-0.5" role="img" aria-label={`Difficulty: ${difficulty?.label || league.difficulty}`}>
              {[1, 2, 3, 4].map(n => (
                <div
                  key={n}
                  className={cn(
                    'w-1.5 h-3.5 rounded-full transition-colors',
                    n <= bars ? difficulty?.bar || 'bg-muted' : 'bg-white/5'
                  )}
                />
              ))}
            </div>
            <span className={cn('text-[10px] font-semibold', difficulty?.color)}>
              {difficulty?.label}
            </span>
          </div>
        </div>
      </button>
    </motion.div>
  );
});

export default ClubSelection;
