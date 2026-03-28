import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { NATIONS } from '@/data/nations';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check, Loader2, Search, User, Globe, Sparkles, Briefcase, Star, TrendingUp, Building2, Trophy, Users, MapPin, HandCoins, Palette, Dices, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFlag } from '@/utils/nationality';
import type { ManagerTraitId, ManagerAppearance, JobOffer } from '@/types/game';
import { ManagerTraitPicker } from '@/components/game/ManagerTraitPicker';
import { ManagerStatBar } from '@/components/game/ManagerStatBar';
import { ManagerAvatar } from '@/components/game/ManagerAvatar';
import {
  SKIN_TONES,
  HAIR_COLORS,
  HAIR_COLOR_LABELS,
  MALE_HAIR_STYLES,
  MALE_HAIR_LABELS,
  FEMALE_HAIR_STYLES,
  FEMALE_HAIR_LABELS,
  FACE_SHAPES,
  FACE_SHAPE_LABELS,
  EYE_STYLES,
  EYE_STYLE_LABELS,
  FACIAL_HAIR_STYLES,
  FACIAL_HAIR_LABELS,
  GLASSES_STYLES,
  GLASSES_LABELS,
  OUTFIT_TYPES,
  OUTFIT_LABELS,
  OUTFIT_COLORS,
  TIE_COLORS,
  ACCESSORIES,
  ACCESSORY_LABELS,
  DEFAULT_MALE_APPEARANCE,
  DEFAULT_FEMALE_APPEARANCE,
  DEFAULT_APPEARANCE,
} from '@/config/managerAppearance';
import { createDefaultManager, generateStartingOffers, negotiateSalary } from '@/utils/managerCareer';
import { STARTING_AGE_MIN, STARTING_AGE_MAX, TRAITS_TO_PICK, MAX_NEGOTIATION_ROUNDS, SALARY_COUNTER_MAX_INCREASE } from '@/config/managerCareer';
import { CLUBS_DATA } from '@/data/league';
import { toast } from 'sonner';

type Step = 'name' | 'appearance' | 'nationality' | 'age' | 'traits' | 'offers';

const STEPS: Step[] = ['name', 'appearance', 'nationality', 'age', 'traits', 'offers'];

const STEP_LABELS: Record<Step, string> = {
  name: 'Name',
  appearance: 'Appearance',
  nationality: 'Nationality',
  age: 'Age',
  traits: 'Traits',
  offers: 'Starting Job',
};

// Appearance section IDs for collapsible panels
type AppearanceSection = 'face' | 'hair' | 'facialHair' | 'eyewear' | 'outfit' | 'accessories';

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
  const [appearance, setAppearance] = useState<ManagerAppearance>({ ...DEFAULT_APPEARANCE });
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
  const [openSections, setOpenSections] = useState<Set<AppearanceSection>>(new Set(['face', 'hair']));

  const toggleSection = (section: AppearanceSection) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const handleGenderToggle = (gender: 'male' | 'female') => {
    setAppearance(prev => ({
      ...(gender === 'male' ? DEFAULT_MALE_APPEARANCE : DEFAULT_FEMALE_APPEARANCE),
      skinTone: prev.skinTone,
      faceShape: prev.faceShape,
      eyeStyle: prev.eyeStyle,
      hairColor: prev.hairColor,
      glasses: prev.glasses,
      outfitColor: prev.outfitColor,
      tieColor: prev.tieColor,
      accessory: prev.accessory,
    }));
  };

  const randomizeAppearance = () => {
    const gender = appearance.gender;
    const hairStyles = gender === 'female' ? FEMALE_HAIR_STYLES : MALE_HAIR_STYLES;
    setAppearance({
      gender,
      skinTone: Math.floor(Math.random() * SKIN_TONES.length),
      faceShape: Math.floor(Math.random() * FACE_SHAPES.length),
      eyeStyle: Math.floor(Math.random() * EYE_STYLES.length),
      hairStyle: Math.floor(Math.random() * hairStyles.length),
      hairColor: Math.floor(Math.random() * HAIR_COLORS.length),
      facialHair: gender === 'male' ? Math.floor(Math.random() * FACIAL_HAIR_STYLES.length) : 0,
      glasses: Math.floor(Math.random() * GLASSES_STYLES.length),
      outfit: Math.floor(Math.random() * OUTFIT_TYPES.length),
      outfitColor: OUTFIT_COLORS[Math.floor(Math.random() * OUTFIT_COLORS.length)].color,
      tieColor: TIE_COLORS[Math.floor(Math.random() * TIE_COLORS.length)].color,
      accessory: Math.floor(Math.random() * ACCESSORIES.length),
    });
  };

  const stepIdx = STEPS.indexOf(step);
  const canProceed = (() => {
    switch (step) {
      case 'name': return managerName.trim().length >= 2;
      case 'appearance': return true;
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
        const manager = createDefaultManager(managerName.trim(), nationality, age, selectedTraits, appearance);

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
    return createDefaultManager(managerName || 'Preview', nationality || '', age, selectedTraits, appearance);
  }, [selectedTraits, managerName, nationality, age, appearance]);

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
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Create Manager</h1>
          <p className="text-xs text-muted-foreground">Step {stepIdx + 1} of {STEPS.length} — {STEP_LABELS[step]}</p>
        </div>
        {stepIdx > 1 && (
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            <ManagerAvatar appearance={appearance} size={36} />
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
                {actionButton}
              </div>
            )}

            {/* Step: Appearance */}
            {step === 'appearance' && (
              <div>
                <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <Palette className="w-5 h-5 text-primary" />
                    <h2 className="text-base font-bold text-foreground flex-1">Your Look</h2>
                    <button
                      onClick={randomizeAppearance}
                      className="flex items-center gap-1.5 text-[10px] text-primary font-semibold hover:text-primary/80 transition-colors"
                      aria-label="Randomize appearance"
                    >
                      <Dices className="w-4 h-4" /> Randomize
                    </button>
                  </div>

                  {/* Gender Toggle */}
                  <div className="flex justify-center mb-4">
                    <div className="flex bg-muted/30 rounded-lg p-0.5 border border-border/30">
                      {(['male', 'female'] as const).map(g => (
                        <button
                          key={g}
                          onClick={() => handleGenderToggle(g)}
                          className={cn(
                            'px-5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 capitalize',
                            appearance.gender === g
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live preview */}
                  <div className="flex justify-center mb-5">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl" />
                      <ManagerAvatar appearance={appearance} size={160} className="relative" />
                    </div>
                  </div>

                  {/* ─── Collapsible Sections ─── */}

                  {/* Face */}
                  <SectionHeader title="Face" section="face" open={openSections.has('face')} onToggle={toggleSection} />
                  <div className={cn('overflow-hidden transition-all duration-300', openSections.has('face') ? 'max-h-[500px] opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0')}>
                    {/* Skin Tone */}
                    <div className="mb-4 mt-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Skin Tone</p>
                      <div className="flex gap-2 justify-center flex-wrap">
                        {SKIN_TONES.map((tone, i) => (
                          <button
                            key={tone}
                            onClick={() => setAppearance(prev => ({ ...prev, skinTone: i }))}
                            aria-label={`Skin tone ${i + 1}`}
                            className={cn(
                              'w-9 h-9 rounded-full transition-all duration-200',
                              appearance.skinTone === i
                                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                                : 'hover:scale-105',
                            )}
                            style={{ backgroundColor: tone }}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Face Shape */}
                    <div className="mb-4">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Face Shape</p>
                      <div className="flex gap-2 justify-center">
                        {FACE_SHAPES.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setAppearance(prev => ({ ...prev, faceShape: i }))}
                            aria-label={FACE_SHAPE_LABELS[i]}
                            className={cn(
                              'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-200',
                              appearance.faceShape === i
                                ? 'bg-primary/20 border border-primary/40'
                                : 'bg-muted/20 border border-transparent hover:bg-muted/40',
                            )}
                          >
                            <ManagerAvatar appearance={{ ...appearance, faceShape: i }} size={32} />
                            <span className="text-[8px] text-muted-foreground">{FACE_SHAPE_LABELS[i]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Eye Style */}
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Eye Style</p>
                      <div className="flex gap-2 justify-center">
                        {EYE_STYLES.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setAppearance(prev => ({ ...prev, eyeStyle: i }))}
                            aria-label={EYE_STYLE_LABELS[i]}
                            className={cn(
                              'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-200',
                              appearance.eyeStyle === i
                                ? 'bg-primary/20 border border-primary/40'
                                : 'bg-muted/20 border border-transparent hover:bg-muted/40',
                            )}
                          >
                            <ManagerAvatar appearance={{ ...appearance, eyeStyle: i }} size={32} />
                            <span className="text-[8px] text-muted-foreground">{EYE_STYLE_LABELS[i]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Hair */}
                  <SectionHeader title="Hair" section="hair" open={openSections.has('hair')} onToggle={toggleSection} />
                  <div className={cn('overflow-hidden transition-all duration-300', openSections.has('hair') ? 'max-h-[500px] opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0')}>
                    <div className="mb-4 mt-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Hair Style</p>
                      <div className="grid grid-cols-4 gap-2">
                        {(appearance.gender === 'female' ? FEMALE_HAIR_STYLES : MALE_HAIR_STYLES).map((_, i) => {
                          const labels = appearance.gender === 'female' ? FEMALE_HAIR_LABELS : MALE_HAIR_LABELS;
                          return (
                            <button
                              key={i}
                              onClick={() => setAppearance(prev => ({ ...prev, hairStyle: i }))}
                              aria-label={labels[i]}
                              className={cn(
                                'flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all duration-200',
                                appearance.hairStyle === i
                                  ? 'bg-primary/20 border border-primary/40'
                                  : 'bg-muted/20 border border-transparent hover:bg-muted/40',
                              )}
                            >
                              <ManagerAvatar appearance={{ ...appearance, hairStyle: i }} size={36} />
                              <span className="text-[8px] text-muted-foreground">{labels[i]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Hair Color */}
                    <div className={cn('overflow-hidden transition-all duration-300', appearance.hairStyle !== 0 ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0')}>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Hair Color</p>
                      <div className="flex gap-2 justify-center flex-wrap">
                        {HAIR_COLORS.map((color, i) => (
                          <button
                            key={color}
                            onClick={() => setAppearance(prev => ({ ...prev, hairColor: i }))}
                            aria-label={HAIR_COLOR_LABELS[i]}
                            title={HAIR_COLOR_LABELS[i]}
                            className={cn(
                              'w-8 h-8 rounded-full transition-all duration-200',
                              appearance.hairColor === i
                                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                                : 'hover:scale-105',
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Facial Hair (male only) */}
                  {appearance.gender === 'male' && (
                    <>
                      <SectionHeader title="Facial Hair" section="facialHair" open={openSections.has('facialHair')} onToggle={toggleSection} />
                      <div className={cn('overflow-hidden transition-all duration-300', openSections.has('facialHair') ? 'max-h-[300px] opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0')}>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {FACIAL_HAIR_STYLES.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setAppearance(prev => ({ ...prev, facialHair: i }))}
                              aria-label={FACIAL_HAIR_LABELS[i]}
                              className={cn(
                                'flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all duration-200',
                                appearance.facialHair === i
                                  ? 'bg-primary/20 border border-primary/40'
                                  : 'bg-muted/20 border border-transparent hover:bg-muted/40',
                              )}
                            >
                              <ManagerAvatar appearance={{ ...appearance, facialHair: i }} size={36} />
                              <span className="text-[8px] text-muted-foreground">{FACIAL_HAIR_LABELS[i]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Eyewear */}
                  <SectionHeader title="Eyewear" section="eyewear" open={openSections.has('eyewear')} onToggle={toggleSection} />
                  <div className={cn('overflow-hidden transition-all duration-300', openSections.has('eyewear') ? 'max-h-[200px] opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0')}>
                    <div className="flex gap-2 justify-center mt-2">
                      {GLASSES_STYLES.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setAppearance(prev => ({ ...prev, glasses: i }))}
                          aria-label={GLASSES_LABELS[i]}
                          className={cn(
                            'flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all duration-200',
                            appearance.glasses === i
                              ? 'bg-primary/20 border border-primary/40'
                              : 'bg-muted/20 border border-transparent hover:bg-muted/40',
                          )}
                        >
                          <ManagerAvatar appearance={{ ...appearance, glasses: i }} size={36} />
                          <span className="text-[8px] text-muted-foreground">{GLASSES_LABELS[i]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Outfit */}
                  <SectionHeader title="Outfit" section="outfit" open={openSections.has('outfit')} onToggle={toggleSection} />
                  <div className={cn('overflow-hidden transition-all duration-300', openSections.has('outfit') ? 'max-h-[400px] opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0')}>
                    {/* Outfit Type */}
                    <div className="mb-4 mt-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Style</p>
                      <div className="flex gap-2 justify-center">
                        {OUTFIT_TYPES.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setAppearance(prev => ({ ...prev, outfit: i }))}
                            aria-label={OUTFIT_LABELS[i]}
                            className={cn(
                              'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-200',
                              appearance.outfit === i
                                ? 'bg-primary/20 border border-primary/40'
                                : 'bg-muted/20 border border-transparent hover:bg-muted/40',
                            )}
                          >
                            <ManagerAvatar appearance={{ ...appearance, outfit: i }} size={42} />
                            <span className="text-[8px] text-muted-foreground">{OUTFIT_LABELS[i]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Outfit Color */}
                    <div className="mb-4">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Color</p>
                      <div className="flex gap-2 justify-center flex-wrap">
                        {OUTFIT_COLORS.map(({ color, label }) => (
                          <button
                            key={color}
                            onClick={() => setAppearance(prev => ({ ...prev, outfitColor: color }))}
                            aria-label={label}
                            title={label}
                            className={cn(
                              'w-8 h-8 rounded-full transition-all duration-200 border',
                              appearance.outfitColor === color
                                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 border-primary/40'
                                : 'border-border/30 hover:scale-105',
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Tie Color (suit only) */}
                    <div className={cn('overflow-hidden transition-all duration-300', appearance.outfit === 0 ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0')}>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Tie Color</p>
                      <div className="flex gap-2 justify-center">
                        {TIE_COLORS.map(({ color, label }) => (
                          <button
                            key={color}
                            onClick={() => setAppearance(prev => ({ ...prev, tieColor: color }))}
                            aria-label={label}
                            title={label}
                            className={cn(
                              'w-8 h-8 rounded-full transition-all duration-200 border',
                              appearance.tieColor === color
                                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 border-primary/40'
                                : 'border-border/30 hover:scale-105',
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Accessories */}
                  <SectionHeader title="Accessories" section="accessories" open={openSections.has('accessories')} onToggle={toggleSection} />
                  <div className={cn('overflow-hidden transition-all duration-300', openSections.has('accessories') ? 'max-h-[200px] opacity-100 mb-2' : 'max-h-0 opacity-0 mb-0')}>
                    <div className="flex gap-2 justify-center mt-2">
                      {ACCESSORIES.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setAppearance(prev => ({ ...prev, accessory: i }))}
                          aria-label={ACCESSORY_LABELS[i]}
                          className={cn(
                            'flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all duration-200',
                            appearance.accessory === i
                              ? 'bg-primary/20 border border-primary/40'
                              : 'bg-muted/20 border border-transparent hover:bg-muted/40',
                          )}
                        >
                          <ManagerAvatar appearance={{ ...appearance, accessory: i }} size={36} />
                          <span className="text-[8px] text-muted-foreground">{ACCESSORY_LABELS[i]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {actionButton}
              </div>
            )}

            {/* Step: Nationality */}
            {step === 'nationality' && (
              <div className="space-y-3 pb-20">
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
              <div>
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
                {actionButton}
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
                {actionButton}
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
                          'w-full text-left rounded-xl border transition-all duration-200 overflow-hidden',
                          'bg-card/60 backdrop-blur-xl',
                          isSelected
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border/50 hover:border-border active:scale-[0.98]',
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
                                    {b.condition.replace(/_/g, ' ')}: {formatMoney(b.amount)}
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
                                    const managerSkill = previewManager?.attributes.negotiation || 5;
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
                {actionButton}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating continue button for nationality step */}
      {step === 'nationality' && nationality && (
        <div className="sticky bottom-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-6">
          <Button
            className="w-full h-12 text-base font-bold gap-2"
            onClick={handleNext}
          >
            Continue <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

// Collapsible section header for appearance customization
function SectionHeader({ title, section, open, onToggle }: { title: string; section: AppearanceSection; open: boolean; onToggle: (s: AppearanceSection) => void }) {
  return (
    <button
      onClick={() => onToggle(section)}
      className="w-full flex items-center justify-between py-2 border-t border-border/20"
    >
      <span className="text-xs font-semibold text-foreground">{title}</span>
      <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
    </button>
  );
}

export default ManagerCreation;
