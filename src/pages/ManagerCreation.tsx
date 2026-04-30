import * as Sentry from '@sentry/react';
import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { NATIONS, getNationStarPlayers } from '@/data/nations';
import { PlayerCard } from '@/components/game/PlayerCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check, Loader2, Search, User, Globe, Briefcase, Star, TrendingUp, Building2, Trophy, Users, MapPin, HandCoins, X } from 'lucide-react';
import { PremiumSparkle } from '@/components/game/icons/PremiumSparkle';
import { cn } from '@/lib/utils';
import { FlagIcon } from '@/components/game/FlagIcon';
import { LIQUID_GLASS_SURFACE } from '@/components/game/GlassPanel';
import type { ManagerTraitId, ManagerAppearance, JobOffer, ManagerCreationStep } from '@/types/game';
import { ManagerTraitPicker } from '@/components/game/ManagerTraitPicker';
import { ManagerStatBar } from '@/components/game/ManagerStatBar';
import { ManagerAvatar } from '@/components/game/ManagerAvatar';
import { DEFAULT_APPEARANCE } from '@/config/managerAppearance';
import { createDefaultManager, generateBaseAttributes, applyTraitBonuses, generateStartingOffers, negotiateSalary, getManagerBonusLabel } from '@/utils/managerCareer';
import { STARTING_AGE_MIN, STARTING_AGE_MAX, TRAITS_TO_PICK, MAX_NEGOTIATION_ROUNDS, SALARY_COUNTER_MAX_INCREASE } from '@/config/managerCareer';
import { CLUBS_DATA } from '@/data/league';
import { toast } from 'sonner';

const STEPS: ManagerCreationStep[] = ['name', 'nationality', 'age', 'traits', 'offers'];

const STEP_LABELS: Record<ManagerCreationStep, string> = {
  name: 'Name',
  nationality: 'Nationality',
  age: 'Age',
  traits: 'Traits',
  offers: 'Starting Job',
};

// Group nations by confederation for display
const CONFEDERATION_LABELS: Record<string, string> = {
  UEFA: 'Europe',
  CONMEBOL: 'South America',
  CAF: 'Africa',
  AFC: 'Asia',
  CONCACAF: 'North & Central America',
};

const ManagerCreation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initCareerGame = useGameStore(s => s.initCareerGame);
  const setManagerNationality = useGameStore(s => s.setManagerNationality);
  const saveGame = useGameStore(s => s.saveGame);
  const navState = (location.state as { slot?: number; communityPackEnabled?: boolean }) || {};
  const slot = navState.slot || 1;
  const communityPackEnabled = navState.communityPackEnabled === true;

  const [step, setStep] = useState<ManagerCreationStep>('name');
  const [managerName, setManagerName] = useState('');
  const [appearance] = useState<ManagerAppearance>({ ...DEFAULT_APPEARANCE });
  const [nationality, setNationality] = useState<string | null>(null);
  const [age, setAge] = useState(38);
  const [selectedTraits, setSelectedTraits] = useState<ManagerTraitId[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<JobOffer | null>(null);
  const [startingOffers, setStartingOffers] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [nationSearch, setNationSearch] = useState('');
  const [negotiatingOfferId, setNegotiatingOfferId] = useState<string | null>(null);
  const [counterSalary, setCounterSalary] = useState<number>(0);
  const [negotiationMessage, setNegotiationMessage] = useState<string | null>(null);

  // Random base attributes generated once — trait bonuses applied deterministically on top
  const baseAttributes = useRef(generateBaseAttributes());

  // Derive initials from manager name for the emblem preview
  const managerInitials = managerName.trim()
    ? managerName.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'M';

  const stepIdx = STEPS.indexOf(step);
  const canProceed = (() => {
    switch (step) {
      case 'name': return managerName.trim().length >= 2;
      case 'nationality': return nationality !== null;
      case 'age': return true;
      case 'traits': return selectedTraits.length === TRAITS_TO_PICK;
      case 'offers': return selectedOffer !== null;
    }
  })();

  const handleNext = () => {
    if (!canProceed) return;
    const nextIdx = stepIdx + 1;
    if (nextIdx < STEPS.length) {
      const nextStep = STEPS[nextIdx];
      // Generate starting offers when reaching the offers step
      if (nextStep === 'offers' && startingOffers.length === 0) {
        const clubsRecord: Record<string, { id: string; name: string; divisionId: string; reputation: number }> = {};
        for (const club of CLUBS_DATA) {
          clubsRecord[club.id] = {
            id: club.id,
            name: club.name,
            divisionId: club.divisionId,
            reputation: club.reputation,
          };
        }
        const offers = generateStartingOffers(clubsRecord);
        setStartingOffers(offers);
      }
      setStep(nextStep);
    }
  };

  const handleBack = () => {
    if (stepIdx > 0) {
      setStep(STEPS[stepIdx - 1]);
    } else {
      navigate('/mode-select', { state: { slot, communityPackEnabled } });
    }
  };

  const handleTraitToggle = (traitId: ManagerTraitId) => {
    setSelectedTraits(prev =>
      prev.includes(traitId)
        ? prev.filter(t => t !== traitId)
        : prev.length < TRAITS_TO_PICK
          ? [...prev, traitId]
          : prev
    );
  };

  const handleStart = () => {
    if (!selectedOffer || !nationality || loading) return;
    setLoading(true);
    requestAnimationFrame(async () => {
      try {
        const finalAttributes = applyTraitBonuses(baseAttributes.current, selectedTraits);
        const manager = createDefaultManager(managerName.trim(), nationality, age, selectedTraits, appearance, finalAttributes);

        // Set contract from selected offer
        manager.contract = {
          clubId: selectedOffer.clubId,
          salary: selectedOffer.salary,
          startSeason: 1,
          endSeason: selectedOffer.contractLength,
          bonuses: selectedOffer.bonuses,
        };

        // Must await — initCareerGame internally awaits initGame, which is
        // async when communityPackEnabled is true. Without awaiting, saveGame
        // below runs before gameStarted is set and the performSave seatbelt
        // silently discards the write, leaving the slot empty on reload.
        await initCareerGame(manager, selectedOffer.clubId, { communityPackEnabled });
        setManagerNationality(nationality);
        useGameStore.setState({ activeSlot: slot });
        try { saveGame(slot); } catch { /* save failure shouldn't block */ }
        // Defer navigation so React flushes all batched store updates
        // before GameShell/Dashboard mount and subscribe (React #185 fix)
        queueMicrotask(() => navigate('/game'));
      } catch (err) {
        Sentry.captureException(err, { tags: { context: 'startCareer' } });
        toast.error('Something went wrong. Please try again.');
        setLoading(false);
      }
    });
  };

  // Preview attributes: stable base + deterministic trait bonuses
  const previewAttributes = useMemo(() => {
    return applyTraitBonuses(baseAttributes.current, selectedTraits);
  }, [selectedTraits]);

  // Filtered nations for search
  const filteredNations = useMemo(() => {
    const search = nationSearch.toLowerCase();
    if (!search) return NATIONS;
    return NATIONS.filter(n => n.name.toLowerCase().includes(search));
  }, [nationSearch]);

  const nationsByConfederation = useMemo(() => {
    const groups: Record<string, typeof NATIONS> = {};
    for (const nation of filteredNations) {
      const conf = nation.confederation || 'Other';
      if (!groups[conf]) groups[conf] = [];
      groups[conf].push(nation);
    }
    for (const conf in groups) {
      groups[conf].sort((a, b) => a.baseRanking - b.baseRanking);
    }
    return groups;
  }, [filteredNations]);

  // Inline continue / begin career button
  const actionButton = step === 'offers' ? (
    <Button
      className="w-full h-12 text-base font-bold gap-2 mt-6"
      disabled={!canProceed || loading}
      onClick={handleStart}
    >
      {loading ? (
        <><Loader2 className="w-4 h-4 animate-spin" /> Starting Career...</>
      ) : (
        <><Briefcase className="w-4 h-4" /> Begin Career</>
      )}
    </Button>
  ) : (
    <Button
      className="w-full h-12 text-base font-bold gap-2 mt-6"
      disabled={!canProceed}
      onClick={handleNext}
    >
      Continue <ArrowRight className="w-4 h-4" />
    </Button>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col safe-area-top safe-area-bottom">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Back"
          className="text-muted-foreground hover:text-foreground -ml-2 h-11 w-11 px-0"
          onClick={handleBack}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Create Manager</h1>
          <p className="text-xs text-muted-foreground">Step {stepIdx + 1} of {STEPS.length} — {STEP_LABELS[step]}</p>
        </div>
        {stepIdx > 0 && (
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            <ManagerAvatar appearance={appearance} size={36} initials={managerInitials} />
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-4 mb-4">
        <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            {/* Step: Name */}
            {step === 'name' && (
              <div>
                <div className={cn(LIQUID_GLASS_SURFACE, 'border border-white/10 p-5')}>
                  <div className="flex items-center gap-3 mb-4">
                    <User className="w-5 h-5 text-primary" />
                    <h2 className="text-base font-bold text-foreground">Manager Name</h2>
                  </div>
                  <input
                    type="text"
                    value={managerName}
                    onChange={e => setManagerName(e.target.value)}
                    placeholder="Enter your name..."
                    maxLength={30}
                    aria-label="Manager name"
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/30 transition-colors backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.25)]"
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground mt-2">This is how you'll be known throughout your career.</p>
                </div>
                {actionButton}
              </div>
            )}

            {/* Step: Nationality */}
            {step === 'nationality' && (
              <div className="space-y-5 pb-20">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={nationSearch}
                    onChange={e => setNationSearch(e.target.value)}
                    placeholder="Search nations..."
                    aria-label="Search nations"
                    className={cn(LIQUID_GLASS_SURFACE, 'w-full pl-9 pr-9 py-2.5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all')}
                  />
                  {nationSearch && (
                    <button
                      type="button"
                      onClick={() => setNationSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Empty state when search finds nothing */}
                {nationSearch && filteredNations.length === 0 && (
                  <div role="status" aria-live="polite" className="flex flex-col items-center justify-center px-4 py-12 gap-3 text-center">
                    <Globe className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground max-w-full break-words">No nations found for "<span className="text-foreground">{nationSearch}</span>"</p>
                    <button
                      type="button"
                      onClick={() => setNationSearch('')}
                      className="text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      Clear search
                    </button>
                  </div>
                )}

                {/* Nation list by confederation */}
                {Object.entries(nationsByConfederation).map(([conf, nations]) => (
                  <div key={conf}>
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                        {CONFEDERATION_LABELS[conf] || conf}
                      </h3>
                      <div className="flex-1 h-px bg-border/30" />
                      <span className="text-[10px] text-muted-foreground/50 font-medium tabular-nums">
                        {nations.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {nations.map((nation, i) => {
                        const starPlayers = getNationStarPlayers(nation.name);
                        const isSelected = nationality === nation.name;
                        return (
                          <motion.div
                            key={nation.name}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02, duration: 0.25 }}
                          >
                            <button
                              type="button"
                              onClick={() => setNationality(nation.name)}
                              className={cn(
                                LIQUID_GLASS_SURFACE,
                                'rounded-xl border cursor-pointer w-full text-left',
                                'active:scale-[0.98] transition-colors duration-200 p-3',
                                isSelected
                                  ? 'ring-2 ring-primary border-primary/30'
                                  : 'border-white/10 hover:border-white/20'
                              )}
                            >
                              {/* Top row: Flag + Name + Badges */}
                              <div className="flex items-center gap-3">
                                <FlagIcon nationality={nation.name} size={32} className="rounded-none shadow-sm" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-foreground text-sm truncate">{nation.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-medium text-muted-foreground bg-white/5 rounded px-1.5 py-0.5">
                                      World #{nation.baseRanking}
                                    </span>
                                    {nation.baseRanking <= 10 && (
                                      <span className="text-[10px] font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5">
                                        Top 10
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                                    <Check className="w-3.5 h-3.5 text-primary-foreground" />
                                  </div>
                                )}
                              </div>

                              {/* Star players */}
                              {starPlayers.length > 0 && (
                                <div className="flex items-center justify-around gap-2 mt-2.5 pt-2 border-t border-border/20">
                                  {starPlayers.map((player) => (
                                    <PlayerCard
                                      key={player.id}
                                      player={player}
                                      size="md"
                                      interactive="none"
                                      showConditionView={false}
                                    />
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
              </div>
            )}

            {/* Step: Age */}
            {step === 'age' && (
              <div>
                <div className={cn(LIQUID_GLASS_SURFACE, 'border border-white/10 p-6')}>
                  <div className="flex items-center gap-3 mb-6">
                    <Globe className="w-5 h-5 text-primary" />
                    <h2 className="text-base font-bold text-foreground">Starting Age</h2>
                  </div>
                  <div className="text-center mb-8">
                    <span className="text-6xl font-black text-primary font-display">{age}</span>
                    <p className="text-sm text-muted-foreground mt-1">years old</p>
                  </div>
                  <div className="px-2">
                    <input
                      type="range"
                      min={STARTING_AGE_MIN}
                      max={STARTING_AGE_MAX}
                      value={age}
                      onChange={e => setAge(Number(e.target.value))}
                      aria-label="Starting age"
                      aria-valuetext={`${age} years old`}
                      className="age-slider"
                      style={{
                        '--slider-progress': `${((age - STARTING_AGE_MIN) / (STARTING_AGE_MAX - STARTING_AGE_MIN)) * 100}%`,
                      } as React.CSSProperties}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>{STARTING_AGE_MIN}</span>
                      <span>{STARTING_AGE_MAX}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-5 leading-relaxed">
                    Younger managers have longer careers but less starting experience.
                    Retirement age is 65 (75 if you reach Legendary reputation).
                  </p>
                </div>
                {actionButton}
              </div>
            )}

            {/* Step: Traits */}
            {step === 'traits' && (
              <div className="space-y-4 pb-20">
                <div className="flex items-center gap-3 mb-2">
                  <PremiumSparkle className="w-5 h-5" />
                  <div>
                    <h2 className="text-base font-bold text-foreground">Choose Your Traits</h2>
                    <p className="text-xs text-muted-foreground">Pick {TRAITS_TO_PICK} traits that define your management style</p>
                  </div>
                </div>
                <ManagerTraitPicker
                  selected={selectedTraits}
                  maxTraits={TRAITS_TO_PICK}
                  onToggle={handleTraitToggle}
                />
                <div className={cn(LIQUID_GLASS_SURFACE, 'border border-white/10 p-4 mt-4')}>
                  <p className="text-xs font-semibold text-foreground mb-3">Attribute Preview</p>
                  <div className="space-y-2">
                    {([
                      ['Tactical Knowledge', 'tacticalKnowledge'],
                      ['Motivation', 'motivation'],
                      ['Negotiation', 'negotiation'],
                      ['Scouting Eye', 'scoutingEye'],
                      ['Youth Development', 'youthDevelopment'],
                      ['Discipline', 'discipline'],
                      ['Media Handling', 'mediaHandling'],
                    ] as [string, keyof typeof previewAttributes][]).map(([label, key]) => (
                      <ManagerStatBar
                        key={key}
                        label={label}
                        value={previewAttributes[key]}
                        bonus={previewAttributes[key] - baseAttributes.current[key]}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step: Starting Offers */}
            {step === 'offers' && (
              <div className="space-y-4 pb-20">
                <div className="flex items-center gap-3 mb-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  <div>
                    <h2 className="text-base font-bold text-foreground">Job Offers</h2>
                    <p className="text-xs text-muted-foreground">Three clubs want you as their new manager</p>
                  </div>
                </div>
                {startingOffers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">No offers available</div>
                ) : (
                  startingOffers.map(offer => {
                    const isSelected = selectedOffer?.id === offer.id;
                    const isNegotiating = negotiatingOfferId === offer.id;
                    const canNegotiate = (offer.negotiationRound || 0) < MAX_NEGOTIATION_ROUNDS
                      && offer.negotiationStatus !== 'final'
                      && offer.negotiationStatus !== 'accepted';
                    const formatMoney = (val: number) => {
                      if (val >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}M`;
                      if (val >= 1_000) return `£${(val / 1_000).toFixed(0)}k`;
                      return `£${val}`;
                    };
                    const renderStars = (value: number, max: number = 10) => {
                      const stars = Math.round(value / (max / 5));
                      return (
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star key={i} className={cn('w-2.5 h-2.5', i < stars ? 'text-primary fill-primary' : 'text-muted-foreground/30')} />
                          ))}
                        </div>
                      );
                    };

                    return (
                      <button
                        key={offer.id}
                        onClick={() => {
                          setSelectedOffer(offer);
                          if (negotiatingOfferId && negotiatingOfferId !== offer.id) {
                            setNegotiatingOfferId(null);
                            setNegotiationMessage(null);
                          }
                        }}
                        className={cn(
                          LIQUID_GLASS_SURFACE,
                          'w-full text-left border transition-colors duration-200',
                          isSelected
                            ? 'border-primary/50'
                            : 'border-white/10 hover:border-white/20 active:scale-[0.98]',
                        )}
                      >
                        {/* Club color accent bar */}
                        <div className="h-1 w-full" style={{ backgroundColor: offer.clubColor || '#888' }} />

                        <div className="p-4 space-y-3">
                          {/* Header: Club name + league */}
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className={cn('text-sm font-bold', isSelected ? 'text-primary' : 'text-foreground')}>
                                {offer.clubName}
                              </h3>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {offer.leagueName}{offer.country ? ` · ${offer.country}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {offer.reputation !== undefined && renderStars(offer.reputation, 5)}
                              {isSelected && <Check className="w-4 h-4 text-primary ml-1" />}
                            </div>
                          </div>

                          {/* Contract section */}
                          <div className="bg-muted/20 rounded-lg p-2.5">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <HandCoins className="w-3 h-3 text-primary/70" />
                              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Your Contract</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div>
                                <span className="text-muted-foreground">Salary: </span>
                                <span className={cn('font-bold', offer.negotiationStatus === 'accepted' ? 'text-emerald-400' : 'text-foreground')}>
                                  £{(offer.salary / 1000).toFixed(1)}k/wk
                                </span>
                                {offer.negotiationStatus === 'accepted' && (
                                  <span className="text-[8px] text-emerald-400/70 ml-1">negotiated</span>
                                )}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Contract: </span>
                                <span className="text-foreground font-bold">{offer.contractLength} year{offer.contractLength > 1 ? 's' : ''}</span>
                              </div>
                            </div>
                            {offer.bonuses.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {offer.bonuses.map((b, i) => (
                                  <span key={i} className="text-[9px] bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded">
                                    {getManagerBonusLabel(b.condition)}: {formatMoney(b.amount)}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Negotiate button */}
                            {isSelected && canNegotiate && !isNegotiating && (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNegotiatingOfferId(offer.id);
                                  setCounterSalary(Math.round(offer.salary * 1.1));
                                  setNegotiationMessage(null);
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setNegotiatingOfferId(offer.id); setCounterSalary(Math.round(offer.salary * 1.1)); setNegotiationMessage(null); } }}
                                className="mt-2 text-[10px] text-primary font-semibold flex items-center gap-1 hover:text-primary/80 cursor-pointer"
                              >
                                <TrendingUp className="w-3 h-3" /> Negotiate Salary ({MAX_NEGOTIATION_ROUNDS - (offer.negotiationRound || 0)} attempt{MAX_NEGOTIATION_ROUNDS - (offer.negotiationRound || 0) !== 1 ? 's' : ''} left)
                              </div>
                            )}
                            {offer.negotiationStatus === 'final' && (
                              <p className="mt-1.5 text-[9px] text-amber-400/80 italic">Board has made their final offer</p>
                            )}
                          </div>

                          {/* Inline negotiation UI */}
                          {isSelected && isNegotiating && (
                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2" onClick={e => e.stopPropagation()}>
                              <p className="text-[10px] font-semibold text-foreground">Counter-offer</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">£{(offer.salary / 1000).toFixed(1)}k</span>
                                <input
                                  type="range"
                                  min={offer.salary}
                                  max={Math.round((offer.initialSalary || offer.salary) * (1 + SALARY_COUNTER_MAX_INCREASE))}
                                  step={100}
                                  value={counterSalary}
                                  onChange={e => setCounterSalary(Number(e.target.value))}
                                  aria-label="Counter-offer salary"
                                  aria-valuetext={`£${Math.round(counterSalary / 1000)} thousand`}
                                  className="flex-1 accent-primary h-1.5"
                                  onClick={e => e.stopPropagation()}
                                />
                                <span className="text-[10px] text-primary font-bold whitespace-nowrap">£{(counterSalary / 1000).toFixed(1)}k</span>
                              </div>
                              <div className="flex gap-2">
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const managerSkill = previewAttributes.negotiation;
                                    const result = negotiateSalary(offer, counterSalary, managerSkill);
                                    setStartingOffers(prev => prev.map(o => o.id === offer.id ? result : o));
                                    setSelectedOffer(result);
                                    setNegotiatingOfferId(null);

                                    if (result.negotiationStatus === 'accepted') {
                                      setNegotiationMessage(`Board accepts £${(result.salary / 1000).toFixed(1)}k/wk!`);
                                    } else if (result.salary > offer.salary) {
                                      setNegotiationMessage(`Board counters with £${(result.salary / 1000).toFixed(1)}k/wk`);
                                    } else {
                                      setNegotiationMessage(`Board insists on £${(result.salary / 1000).toFixed(1)}k/wk`);
                                    }
                                  }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}
                                  className="flex-1 bg-primary text-primary-foreground text-[10px] font-bold py-1.5 rounded text-center cursor-pointer hover:bg-primary/90"
                                >
                                  Submit Counter
                                </div>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => { e.stopPropagation(); setNegotiatingOfferId(null); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setNegotiatingOfferId(null); } }}
                                  className="bg-muted/30 text-muted-foreground text-[10px] font-semibold py-1.5 px-3 rounded cursor-pointer hover:bg-muted/50"
                                >
                                  Cancel
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Negotiation result message */}
                          {isSelected && negotiationMessage && !isNegotiating && (
                            <p className={cn(
                              'text-[10px] font-semibold px-2 py-1 rounded',
                              offer.negotiationStatus === 'accepted'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-amber-500/10 text-amber-400',
                            )}>
                              {negotiationMessage}
                            </p>
                          )}

                          {/* Club Profile grid */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-muted/15 rounded-lg p-2 text-center">
                              <p className="text-[8px] text-muted-foreground uppercase tracking-wider mb-0.5">Budget</p>
                              <p className="text-[11px] font-bold text-foreground">{formatMoney(offer.budget || 0)}</p>
                            </div>
                            <div className="bg-muted/15 rounded-lg p-2 text-center">
                              <p className="text-[8px] text-muted-foreground uppercase tracking-wider mb-0.5">Squad Value</p>
                              <p className="text-[11px] font-bold text-foreground">{formatMoney(offer.estimatedSquadValue || 0)}</p>
                            </div>
                            <div className="bg-muted/15 rounded-lg p-2 text-center">
                              <p className="text-[8px] text-muted-foreground uppercase tracking-wider mb-0.5">Expected</p>
                              <p className="text-[11px] font-bold text-foreground">{offer.expectedPosition || '—'}</p>
                            </div>
                          </div>

                          {/* Club details row */}
                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div>
                              <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                                <Building2 className="w-2.5 h-2.5" />
                                <span className="text-[8px] uppercase tracking-wider">Facilities</span>
                              </div>
                              {renderStars(offer.facilities || 5)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                                <Trophy className="w-2.5 h-2.5" />
                                <span className="text-[8px] uppercase tracking-wider">Youth</span>
                              </div>
                              {renderStars(offer.youthRating || 5)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                                <Users className="w-2.5 h-2.5" />
                                <span className="text-[8px] uppercase tracking-wider">Fans</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                                  <div className="h-full bg-primary/60 rounded-full" style={{ width: `${offer.fanBase || 0}%` }} />
                                </div>
                                <span className="text-[8px] text-muted-foreground">{offer.fanBase || 0}</span>
                              </div>
                            </div>
                          </div>

                          {/* Board expectations + patience */}
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-primary/70 italic flex-1">"{offer.boardExpectations}"</p>
                            <div className="flex items-center gap-1 ml-2">
                              <span className="text-[8px] text-muted-foreground uppercase">Patience</span>
                              <div className="flex gap-px">
                                {Array.from({ length: 10 }, (_, i) => (
                                  <div
                                    key={i}
                                    className={cn(
                                      'w-1.5 h-3 rounded-[1px]',
                                      i < (offer.boardPatience || 5)
                                        ? (offer.boardPatience || 5) >= 7 ? 'bg-emerald-500/70' : (offer.boardPatience || 5) >= 4 ? 'bg-amber-500/70' : 'bg-red-500/70'
                                        : 'bg-muted/20',
                                    )}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Stadium footer */}
                          {offer.stadiumName && (
                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
                              <MapPin className="w-2.5 h-2.5" />
                              {offer.stadiumName}
                              {offer.stadiumCapacity ? ` (${offer.stadiumCapacity.toLocaleString()})` : ''}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating continue button for nationality step */}
      <AnimatePresence>
        {step === 'nationality' && nationality && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="sticky bottom-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-6"
          >
            <Button
              className="w-full h-12 text-base font-bold gap-2"
              onClick={handleNext}
            >
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating continue button for traits step */}
      <AnimatePresence>
        {step === 'traits' && selectedTraits.length === TRAITS_TO_PICK && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="sticky bottom-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-6"
          >
            <Button
              className="w-full h-12 text-base font-bold gap-2"
              onClick={handleNext}
            >
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating begin career button for offers step */}
      <AnimatePresence>
        {step === 'offers' && selectedOffer && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="sticky bottom-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-6"
          >
            <Button
              className="w-full h-12 text-base font-bold gap-2"
              disabled={loading}
              onClick={handleStart}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Starting Career...</>
              ) : (
                <><Briefcase className="w-4 h-4" /> Begin Career</>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


export default ManagerCreation;
