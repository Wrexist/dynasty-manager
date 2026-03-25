import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { NATIONS } from '@/data/nations';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check, Loader2, Search, User, Globe, Sparkles, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFlag } from '@/utils/nationality';
import type { ManagerTraitId, JobOffer } from '@/types/game';
import { ManagerTraitPicker } from '@/components/game/ManagerTraitPicker';
import { ManagerStatBar } from '@/components/game/ManagerStatBar';
import { createDefaultManager, generateStartingOffers } from '@/utils/managerCareer';
import { STARTING_AGE_MIN, STARTING_AGE_MAX, TRAITS_TO_PICK } from '@/config/managerCareer';
import { CLUBS_DATA } from '@/data/league';
import { toast } from 'sonner';

type Step = 'name' | 'nationality' | 'age' | 'traits' | 'offers';

const STEPS: Step[] = ['name', 'nationality', 'age', 'traits', 'offers'];

const STEP_LABELS: Record<Step, string> = {
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
  const { initCareerGame, initNationalTeam, saveGame } = useGameStore();
  const slot = (location.state as { slot?: number })?.slot || 1;

  const [step, setStep] = useState<Step>('name');
  const [managerName, setManagerName] = useState('');
  const [nationality, setNationality] = useState<string | null>(null);
  const [age, setAge] = useState(38);
  const [selectedTraits, setSelectedTraits] = useState<ManagerTraitId[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<JobOffer | null>(null);
  const [startingOffers, setStartingOffers] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [nationSearch, setNationSearch] = useState('');

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
        // Build a clubs record from CLUBS_DATA for generating offers
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
      navigate('/mode-select', { state: { slot } });
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
    requestAnimationFrame(() => {
      try {
        const manager = createDefaultManager(managerName.trim(), nationality, age, selectedTraits);

        // Set contract from selected offer
        manager.contract = {
          clubId: selectedOffer.clubId,
          salary: selectedOffer.salary,
          startSeason: 1,
          endSeason: selectedOffer.contractLength,
          bonuses: selectedOffer.bonuses,
        };

        initCareerGame(manager, selectedOffer.clubId);
        initNationalTeam(nationality);
        useGameStore.setState({ activeSlot: slot });
        try { saveGame(slot); } catch { /* save failure shouldn't block */ }
        navigate('/game');
      } catch (err) {
        console.error('Failed to start career:', err);
        toast.error('Something went wrong. Please try again.');
        setLoading(false);
      }
    });
  };

  // Preview the manager attributes based on current trait selection
  const previewManager = useMemo(() => {
    if (selectedTraits.length === 0) return null;
    return createDefaultManager(managerName || 'Preview', nationality || '', age, selectedTraits);
  }, [selectedTraits, managerName, nationality, age]);

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
    return groups;
  }, [filteredNations]);

  return (
    <div className="min-h-screen bg-background flex flex-col safe-area-top safe-area-bottom">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Create Manager</h1>
          <p className="text-xs text-muted-foreground">Step {stepIdx + 1} of {STEPS.length} — {STEP_LABELS[step]}</p>
        </div>
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
      <div className="flex-1 px-4 pb-24 overflow-y-auto">
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
              <div className="space-y-4">
                <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-5">
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
                    className="w-full bg-muted/30 border border-border/50 rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground mt-2">This is how you'll be known throughout your career.</p>
                </div>
              </div>
            )}

            {/* Step: Nationality */}
            {step === 'nationality' && (
              <div className="space-y-3">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={nationSearch}
                    onChange={e => setNationSearch(e.target.value)}
                    placeholder="Search nations..."
                    className="w-full bg-muted/30 border border-border/50 rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                </div>
                {Object.entries(nationsByConfederation).map(([conf, nations]) => (
                  <div key={conf}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 px-1">
                      {CONFEDERATION_LABELS[conf] || conf}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {nations.map(nation => (
                        <button
                          key={nation.name}
                          onClick={() => setNationality(nation.name)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-xs',
                            nationality === nation.name
                              ? 'bg-primary/20 border border-primary/30 text-foreground'
                              : 'bg-card/40 border border-border/30 text-muted-foreground hover:border-border/50',
                          )}
                        >
                          <span className="text-base">{getFlag(nation.name)}</span>
                          <span className="truncate">{nation.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step: Age */}
            {step === 'age' && (
              <div className="space-y-4">
                <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <Globe className="w-5 h-5 text-primary" />
                    <h2 className="text-base font-bold text-foreground">Starting Age</h2>
                  </div>
                  <div className="text-center mb-4">
                    <span className="text-5xl font-black text-primary font-display">{age}</span>
                    <p className="text-xs text-muted-foreground mt-1">years old</p>
                  </div>
                  <input
                    type="range"
                    min={STARTING_AGE_MIN}
                    max={STARTING_AGE_MAX}
                    value={age}
                    onChange={e => setAge(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{STARTING_AGE_MIN}</span>
                    <span>{STARTING_AGE_MAX}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-3">
                    Younger managers have longer careers but less starting experience.
                    Retirement age is 65 (75 if you reach Legendary reputation).
                  </p>
                </div>
              </div>
            )}

            {/* Step: Traits */}
            {step === 'traits' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles className="w-5 h-5 text-primary" />
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
                {previewManager && (
                  <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-4 mt-4">
                    <p className="text-xs font-semibold text-foreground mb-3">Attribute Preview</p>
                    <div className="space-y-2">
                      <ManagerStatBar label="Tactical Knowledge" value={previewManager.attributes.tacticalKnowledge} />
                      <ManagerStatBar label="Motivation" value={previewManager.attributes.motivation} />
                      <ManagerStatBar label="Negotiation" value={previewManager.attributes.negotiation} />
                      <ManagerStatBar label="Scouting Eye" value={previewManager.attributes.scoutingEye} />
                      <ManagerStatBar label="Youth Development" value={previewManager.attributes.youthDevelopment} />
                      <ManagerStatBar label="Discipline" value={previewManager.attributes.discipline} />
                      <ManagerStatBar label="Media Handling" value={previewManager.attributes.mediaHandling} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step: Starting Offers */}
            {step === 'offers' && (
              <div className="space-y-4">
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
                    return (
                      <button
                        key={offer.id}
                        onClick={() => setSelectedOffer(offer)}
                        className={cn(
                          'w-full text-left rounded-xl p-4 border transition-all duration-200',
                          'bg-card/60 backdrop-blur-xl',
                          isSelected
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-border/50 hover:border-border active:scale-[0.98]',
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className={cn('text-sm font-bold', isSelected ? 'text-primary' : 'text-foreground')}>
                            {offer.clubName}
                          </h3>
                          {isSelected && <Check className="w-4 h-4 text-primary" />}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-muted-foreground">Salary: </span>
                            <span className="text-foreground font-semibold">
                              £{(offer.salary / 1000).toFixed(1)}k/wk
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Contract: </span>
                            <span className="text-foreground font-semibold">{offer.contractLength} year{offer.contractLength > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-primary/70 mt-2 italic">"{offer.boardExpectations}"</p>
                        {offer.bonuses.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {offer.bonuses.map((b, i) => (
                              <span key={i} className="text-[9px] bg-muted/30 text-muted-foreground px-1.5 py-0.5 rounded">
                                {b.condition.replace('_', ' ')}: £{(b.amount / 1000).toFixed(0)}k
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border/30 safe-area-bottom">
        <div className="max-w-lg mx-auto">
          {step === 'offers' ? (
            <Button
              className="w-full h-12 text-base font-bold gap-2"
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
              className="w-full h-12 text-base font-bold gap-2"
              disabled={!canProceed}
              onClick={handleNext}
            >
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerCreation;
