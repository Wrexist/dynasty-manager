import * as Sentry from '@sentry/react';
import { useState, useMemo, memo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { CLUBS_DATA, LEAGUES, getLeaguesByCountry } from '@/data/league';
import { CLUBS_BY_LEAGUE, LEAGUE_REGIONS } from '@/data/leagues';
import { NATIONS, NATION_STARS } from '@/data/nations';
import { FlagIcon } from '@/components/game/FlagIcon';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/game/GlassPanel';
import { ArrowLeft, Wallet, Users, Loader2, Search, Globe, X, Building2, Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LeagueId, OnboardingStep, OnboardingDraft } from '@/types/game';
import { DIFFICULTY_CONFIG, DIFFICULTY_BARS } from '@/config/ui';
import { readSessionJson, writeSessionJson, removeSessionKey, STORAGE_KEYS } from '@/store/helpers/persistence';
import { hapticLight } from '@/utils/haptics';
import { toast } from 'sonner';



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

// Apple Liquid-Glass surface — hairline white rim + top inset highlight +
// bottom inset shadow + soft drop. Shared by nation/league/club rows and
// the bottom-sheet stat tiles. NOTE: no backdrop-filter here — rows render
// on a solid dark background (4% tint is imperceptibly blurred) and mobile
// paints 20-40 of these at once, so we keep blur on hero surfaces only
// (header, bottom sheet, summary panel, search pill).
const LIQUID_ROW_CLASS =
  'relative overflow-hidden rounded-2xl bg-white/[0.04] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-1px_0_rgba(0,0,0,0.35),0_6px_20px_-8px_rgba(0,0,0,0.5)] transition-[box-shadow,background-color,border-color,transform] duration-200';

// Small glass-capsule badge (prize chip, difficulty pill, etc.). No
// backdrop-filter — badges nest inside row cards, and we avoid the
// per-element compositor cost that stacks up 100+ badges on mobile.
const LIQUID_BADGE_CLASS =
  'inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_10px_-2px_rgba(0,0,0,0.4)]';

// Radial specular crescent that sits across the top half of each row. Pure
// CSS, mix-blend screen so it catches light without fighting tier colors.
const LIQUID_SPECULAR_STYLE: React.CSSProperties = {
  background:
    'radial-gradient(120% 90% at 50% -20%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 32%, rgba(255,255,255,0) 62%)',
  mixBlendMode: 'screen',
};

// Pre-compute club counts per league at module level (runs once)
const LEAGUE_CLUB_COUNTS: Record<string, number> = {};
for (const league of LEAGUES) {
  LEAGUE_CLUB_COUNTS[league.id] = CLUBS_BY_LEAGUE[league.id]?.length || league.teamCount;
}

// Leagues sourced from the FC26 community pack. Hidden from the league list
// during new-game onboarding unless the user opts in to the community pack
// (see COMMUNITY_PACK_DRAFT_KEY below). Existing 37 baseline leagues are
// always visible. 'chn' is included for forward-compat — it will be a no-op
// until that league file lands.
const COMMUNITY_PACK_LEAGUE_IDS: ReadonlySet<string> = new Set([
  'arg', 'mls', 'sau', 'kor', 'bra', 'aus', 'ind', 'chn',
]);

// Session-scoped draft so a refresh during onboarding doesn't wipe progress.
// Cleared once the career is successfully started (see handleStart).
const ONBOARDING_DRAFT_KEY = STORAGE_KEYS.ONBOARDING_DRAFT;
const COMMUNITY_PACK_DRAFT_KEY = STORAGE_KEYS.COMMUNITY_PACK_DRAFT;

// Reads the in-flight community pack opt-in for new-game onboarding. The
// flag is null until the user answers the popup; we treat null as "off" so
// community pack leagues stay hidden until explicitly enabled.
function readCommunityPackOptIn(): boolean {
  return readSessionJson<boolean>(COMMUNITY_PACK_DRAFT_KEY) === true;
}

function readOnboardingDraft(): OnboardingDraft {
  const empty: OnboardingDraft = { step: 'nationality', nation: null, league: null };
  const parsed = readSessionJson<Partial<OnboardingDraft>>(ONBOARDING_DRAFT_KEY);
  if (!parsed) return empty;
  // Validate against current data — stale league/nation refs fall back to step 1
  const validNation = parsed.nation && NATIONS.some(n => n.name === parsed.nation) ? parsed.nation : null;
  const validLeague = parsed.league && LEAGUES.some(l => l.id === parsed.league) ? (parsed.league as LeagueId) : null;
  let step: OnboardingStep = 'nationality';
  if (parsed.step === 'club' && validNation && validLeague) step = 'club';
  else if (parsed.step === 'league' && validNation) step = 'league';
  return { step, nation: validNation, league: validLeague };
}

const ClubSelection = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initGame = useGameStore(s => s.initGame);
  const initNationalTeam = useGameStore(s => s.initNationalTeam);
  const reduceMotion = useReducedMotion();

  // Hydrate once from sessionStorage draft (if user refreshed mid-onboarding)
  const initialDraft = useMemo(readOnboardingDraft, []);
  const [step, setStep] = useState<OnboardingStep>(initialDraft.step);
  const [selectedNationality, setSelectedNationality] = useState<string | null>(initialDraft.nation);
  const [selectedLeague, setSelectedLeague] = useState<LeagueId | null>(initialDraft.league);
  // Snapshot the community-pack opt-in once at mount. The popup writes to the
  // session key before navigating here; on a fresh new-game flow with no popup
  // answer yet this resolves to false and the new-pack leagues stay hidden.
  const [communityPackEnabled] = useState<boolean>(readCommunityPackOptIn);
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

  // Persist the in-flight draft so refresh/tab-switch doesn't lose progress
  useEffect(() => {
    const draft: OnboardingDraft = { step, nation: selectedNationality, league: selectedLeague };
    writeSessionJson(ONBOARDING_DRAFT_KEY, draft);
  }, [step, selectedNationality, selectedLeague]);

  const handleStart = () => {
    if (!selected || !selectedNationality || !selectedLeague || loading) return;
    hapticLight();
    setLoading(true);
    requestAnimationFrame(() => {
      try {
        const pendingSlot = (location.state as { slot?: number })?.slot || 1;
        initGame(selected, { communityPackEnabled });
        initNationalTeam(selectedNationality);
        useGameStore.setState({ activeSlot: pendingSlot });
        try {
          useGameStore.getState().saveGame(pendingSlot);
        } catch (saveErr) {
          Sentry.captureException(saveErr, { tags: { context: 'careerStartSave' } });
        }
        removeSessionKey(ONBOARDING_DRAFT_KEY);
        removeSessionKey(COMMUNITY_PACK_DRAFT_KEY);
        queueMicrotask(() => navigate('/game'));
      } catch (err) {
        Sentry.captureException(err, { tags: { context: 'startGame' } });
        toast.error('Something went wrong starting your career. Please try again.');
        setLoading(false);
      }
    });
  };

  const handleNationalitySelect = (name: string) => {
    hapticLight();
    setSelectedNationality(name);
    setStep('league');
    window.scrollTo(0, 0);
  };

  const handleLeagueSelect = (leagueId: LeagueId) => {
    hapticLight();
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
      // Exiting onboarding — discard the draft so the next visit starts fresh
      removeSessionKey(ONBOARDING_DRAFT_KEY);
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

  // Visible league pool — drops community-pack leagues unless the user has
  // opted in. Used by both search and the regions render path so the gate
  // can never leak through one but not the other.
  const visibleLeagues = useMemo(
    () => communityPackEnabled
      ? LEAGUES
      : LEAGUES.filter(l => !COMMUNITY_PACK_LEAGUE_IDS.has(l.id)),
    [communityPackEnabled],
  );

  const filteredLeagues = useMemo(() => {
    if (!leagueSearch) return null;
    const q = leagueSearch.toLowerCase();
    return visibleLeagues.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.country.toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q)
    );
  }, [leagueSearch, visibleLeagues]);

  // When the community pack is enabled, surface the new leagues as their own
  // region so users can find them without searching. Each entry mirrors the
  // shape of LEAGUE_REGIONS but is computed live since the visibility
  // depends on the opt-in flag.
  const regionsToRender = useMemo(() => {
    if (!communityPackEnabled) return LEAGUE_REGIONS;
    const cpIds = LEAGUES
      .filter(l => COMMUNITY_PACK_LEAGUE_IDS.has(l.id))
      .map(l => l.id);
    if (cpIds.length === 0) return LEAGUE_REGIONS;
    return [
      ...LEAGUE_REGIONS,
      { label: 'Community Pack Leagues', ids: cpIds },
    ];
  }, [communityPackEnabled]);

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
      {/* Header — frosted liquid-glass rim with specular top crescent */}
      <div className="sticky top-0 z-20 bg-card/50 backdrop-blur-2xl backdrop-saturate-150 border-b border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_0_rgba(0,0,0,0.4)] px-4 pt-3 pb-2">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-2/3"
          style={LIQUID_SPECULAR_STYLE}
        />
        <div className="relative max-w-lg mx-auto">
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
                      {selectedNationality && <><span className="text-foreground/70"><FlagIcon nationality={selectedNationality} size={16} /> {selectedNationality}</span> · </>}
                      {new Set(visibleLeagues.map(l => l.countryId)).size} countries · {visibleLeagues.length} divisions
                    </p>
                  </>
                ) : (
                  <>
                    <h1 ref={headingRef} tabIndex={-1} className={cn('text-lg font-bold font-display outline-none', leagueInfo?.colorClass)}>
                      {leagueInfo?.name}
                    </h1>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {selectedNationality && <><span className="text-foreground/70"><FlagIcon nationality={selectedNationality} size={16} /> {selectedNationality}</span> · </>}
                      {leagueClubs.length} clubs
                    </p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Step progress — Sonora-style capsule with sliding active pill */}
          <div
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuetext={`Step ${stepIndex + 1} of ${STEPS.length}: ${STEPS[stepIndex].label}`}
            className="flex gap-1 mt-2.5 bg-card/40 backdrop-blur-xl border border-border/50 rounded-full p-1 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]"
          >
            {STEPS.map((s, i) => {
              const isActive = i === stepIndex;
              const isComplete = i < stepIndex;
              return (
                <div
                  key={s.key}
                  aria-hidden="true"
                  className={cn(
                    'relative flex-1 px-3 py-1.5 rounded-full text-[10px] font-semibold text-center transition-colors',
                    isActive ? 'text-primary-foreground' : isComplete ? 'text-primary' : 'text-muted-foreground/60',
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="onboarding-step-pill"
                      initial={false}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }
                      }
                      className="absolute inset-0 rounded-full bg-primary/90 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.2),0_4px_16px_hsl(var(--primary)/0.35)]"
                    />
                  )}
                  <span className="relative">{s.label}</span>
                </div>
              );
            })}
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
                              LIQUID_ROW_CLASS,
                              'cursor-pointer w-full text-left active:scale-[0.97] p-3',
                              isSelected
                                ? 'ring-2 ring-primary bg-primary/10 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.45)]'
                                : 'hover:border-white/20',
                            )}
                          >
                            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={LIQUID_SPECULAR_STYLE} />
                            <div className="relative flex items-center gap-3">
                              <FlagIcon nationality={nation.name} size={16} />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-foreground text-sm truncate">{nation.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={cn(LIQUID_BADGE_CLASS, 'text-[10px] font-medium text-muted-foreground px-2 py-0.5')}>
                                    #{nation.baseRanking} FIFA
                                  </span>
                                  {nation.baseRanking <= 10 && (
                                    <span className={cn(LIQUID_BADGE_CLASS, 'text-[10px] font-medium text-primary px-2 py-0.5 bg-primary/15 border-primary/30')}>
                                      Top 10
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {stars.length > 0 && (
                              <div className="relative flex items-center gap-3 mt-2.5 pt-2 border-t border-white/10">
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
                regionsToRender.map(region => {
                  const regionLeagues = region.ids.map(id => LEAGUES.find(l => l.id === id)).filter(Boolean);
                  return (
                    <div key={region.label}>
                      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                        <Globe className="w-3 h-3" />
                        {region.label}
                      </h3>
                      <div className="space-y-2">
                        {regionLeagues.flatMap((league, i) => {
                          if (!league) return [];
                          const countryTiers = getLeaguesByCountry(league.countryId);
                          return countryTiers.map((tier) => (
                            <LeagueCard key={tier.id} league={tier} index={i} onSelect={handleLeagueSelect} isLowerTier={tier.tier > 1} />
                          ));
                        })}
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
              {/* League info summary — liquid-glass surface with floating badges */}
              {leagueInfo && (
                <GlassPanel className="relative overflow-hidden p-4 rounded-2xl border-white/15 bg-white/[0.06] backdrop-saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.25),0_8px_28px_-12px_rgba(0,0,0,0.55)]">
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-2/3" style={LIQUID_SPECULAR_STYLE} />
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FlagIcon nationality={leagueInfo.country} size={24} className="rounded-sm" />
                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold text-foreground truncate">{leagueInfo.country}</h3>
                        <p className="text-[10px] text-muted-foreground">{leagueInfo.totalWeeks} week season</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={cn(LIQUID_BADGE_CLASS, 'px-2.5 py-1 flex-col items-center gap-0')}>
                        <span className="text-xs font-bold text-primary tabular-nums leading-none">{'\u00A3'}{(leagueInfo.prizeMoney / 1_000_000).toFixed(0)}M</span>
                        <span className="text-[8px] text-muted-foreground/80 leading-tight mt-0.5">Prize</span>
                      </div>
                      <div className={cn(LIQUID_BADGE_CLASS, 'px-2 py-1')}>
                        <DifficultyPips difficulty={leagueInfo.difficulty} />
                      </div>
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
                        onClick={() => { if (!isSelected) hapticLight(); setSelected(club.id); }}
                        aria-pressed={isSelected}
                        className={cn(
                          LIQUID_ROW_CLASS,
                          'w-full text-left active:scale-[0.98] p-3',
                          isSelected
                            ? 'ring-2 ring-primary bg-primary/10 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.45)]'
                            : 'hover:border-white/20',
                        )}
                      >
                        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={LIQUID_SPECULAR_STYLE} />
                        <div className="relative flex items-center gap-3">
                          {/* Club badge */}
                          <div
                            className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center font-bold text-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_10px_-2px_rgba(0,0,0,0.5)]"
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
            className="fixed bottom-0 left-0 right-0 z-30 bg-card/70 backdrop-blur-2xl backdrop-saturate-150 border-t border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_-12px_40px_-8px_rgba(0,0,0,0.6)] safe-area-bottom"
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={LIQUID_SPECULAR_STYLE} />
            <div className="relative max-w-lg mx-auto p-4 space-y-3">
              {/* Club header */}
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center text-[10px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_12px_-2px_rgba(0,0,0,0.55)]"
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

              {/* Stats grid — glass capsules */}
              <div className="grid grid-cols-4 gap-1.5">
                <div className={cn(LIQUID_ROW_CLASS, 'px-2 py-2 text-center')}>
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={LIQUID_SPECULAR_STYLE} />
                  <div className="relative">
                    <Wallet className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-0.5" />
                    <div className="text-[11px] font-bold text-foreground tabular-nums">{'\u00A3'}{(selectedClub.budget / 1e6).toFixed(0)}M</div>
                    <div className="text-[8px] text-muted-foreground">Budget</div>
                  </div>
                </div>
                <div className={cn(LIQUID_ROW_CLASS, 'px-2 py-2 text-center')}>
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={LIQUID_SPECULAR_STYLE} />
                  <div className="relative">
                    <Users className="w-3.5 h-3.5 text-blue-400 mx-auto mb-0.5" />
                    <div className="text-[11px] font-bold text-foreground tabular-nums">{selectedClub.fanBase}</div>
                    <div className="text-[8px] text-muted-foreground">Fans</div>
                  </div>
                </div>
                <div className={cn(LIQUID_ROW_CLASS, 'px-2 py-2 text-center')}>
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={LIQUID_SPECULAR_STYLE} />
                  <div className="relative">
                    <Building2 className="w-3.5 h-3.5 text-amber-400 mx-auto mb-0.5" />
                    <div className="text-[11px] font-bold text-foreground tabular-nums">{selectedClub.facilities}</div>
                    <div className="text-[8px] text-muted-foreground">Facilities</div>
                  </div>
                </div>
                <div className={cn(LIQUID_ROW_CLASS, 'px-2 py-2 text-center')}>
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={LIQUID_SPECULAR_STYLE} />
                  <div className="relative">
                    <Sprout className="w-3.5 h-3.5 text-purple-400 mx-auto mb-0.5" />
                    <div className="text-[11px] font-bold text-foreground tabular-nums">{selectedClub.youthRating}</div>
                    <div className="text-[8px] text-muted-foreground">Youth</div>
                  </div>
                </div>
              </div>

              <Button
                className="w-full h-12 text-sm font-bold rounded-full bg-primary/90 text-primary-foreground border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_28px_-8px_hsl(var(--primary)/0.55)] hover:bg-primary"
                onClick={handleStart}
                disabled={loading}
              >
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
        className="w-full pl-10 pr-10 py-2.5 rounded-full bg-white/[0.04] backdrop-blur-xl backdrop-saturate-150 border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.35)] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
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
const LeagueCard = memo(function LeagueCard({ league, index, onSelect, isLowerTier }: { league: typeof LEAGUES[number]; index: number; onSelect: (id: LeagueId) => void; isLowerTier?: boolean }) {
  const difficulty = DIFFICULTY_CONFIG[league.difficulty];
  const bars = DIFFICULTY_BARS[league.difficulty] || 1;
  const clubCount = LEAGUE_CLUB_COUNTS[league.id] || league.teamCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 30 }}
      className={cn('relative', isLowerTier && 'pl-5')}
    >
      {/* Tier connector line (visual hierarchy for sub-leagues) */}
      {isLowerTier && (
        <span
          aria-hidden="true"
          className="absolute left-2 top-0 bottom-0 w-px bg-border/40"
        />
      )}
      <button
        type="button"
        onClick={() => onSelect(league.id)}
        className={cn(
          LIQUID_ROW_CLASS,
          'cursor-pointer w-full text-left active:scale-[0.98] hover:border-white/20 p-3',
          isLowerTier && 'bg-white/[0.025] opacity-90',
        )}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={LIQUID_SPECULAR_STYLE} />
        <div className="relative flex items-center gap-3">
          {isLowerTier ? (
            <span className={cn(LIQUID_BADGE_CLASS, 'text-[10px] font-semibold text-muted-foreground px-2 py-0.5 min-w-[32px] justify-center shrink-0 tabular-nums')}>T{league.tier}</span>
          ) : (
            <FlagIcon nationality={league.country} size={28} className="rounded-sm" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-sm text-foreground truncate">
              {league.name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn(LIQUID_BADGE_CLASS, 'text-[10px] text-muted-foreground/70 px-2 py-0.5')}>
                {clubCount} clubs
              </span>
              <span className={cn(LIQUID_BADGE_CLASS, 'text-[10px] text-muted-foreground/70 px-2 py-0.5 tabular-nums')}>
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
