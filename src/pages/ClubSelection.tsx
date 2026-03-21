import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { CLUBS_DATA, DIVISIONS } from '@/data/league';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Star, Wallet, Users, Zap, Crown, Shield, TrendingUp, Target, Pickaxe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DivisionId } from '@/types/game';
import { DIFFICULTY_CONFIG, DIFFICULTY_BARS } from '@/config/ui';

const divisionMeta: Record<string, {
  icon: React.ElementType;
  gradient: string;
  glow: string;
  tagline: string;
  emoji: string;
}> = {
  'div-1': {
    icon: Crown,
    gradient: 'from-amber-500/20 via-yellow-600/10 to-transparent',
    glow: 'shadow-[0_0_60px_-15px_rgba(234,179,8,0.3)]',
    tagline: 'Big budgets. World-class squads. Glory awaits.',
    emoji: 'crown',
  },
  'div-2': {
    icon: TrendingUp,
    gradient: 'from-blue-500/20 via-blue-600/10 to-transparent',
    glow: 'shadow-[0_0_60px_-15px_rgba(59,130,246,0.3)]',
    tagline: 'Rising clubs hungry for the top flight.',
    emoji: 'trending-up',
  },
  'div-3': {
    icon: Target,
    gradient: 'from-amber-400/20 via-orange-500/10 to-transparent',
    glow: 'shadow-[0_0_60px_-15px_rgba(245,158,11,0.3)]',
    tagline: 'Smart tactics and shrewd deals win here.',
    emoji: 'target',
  },
  'div-4': {
    icon: Pickaxe,
    gradient: 'from-red-500/20 via-rose-600/10 to-transparent',
    glow: 'shadow-[0_0_60px_-15px_rgba(239,68,68,0.3)]',
    tagline: 'Start from nothing. Build a legacy.',
    emoji: 'pickaxe',
  },
};

const difficultyConfig = DIFFICULTY_CONFIG;
const difficultyBars = DIFFICULTY_BARS;

const ClubSelection = () => {
  const navigate = useNavigate();
  const { initGame } = useGameStore();
  const [step, setStep] = useState<'league' | 'club'>('league');
  const [selectedLeague, setSelectedLeague] = useState<DivisionId | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const handleStart = () => {
    if (!selected) return;
    const pendingSlot = Number(sessionStorage.getItem('dynasty-pending-slot')) || 1;
    sessionStorage.removeItem('dynasty-pending-slot');
    initGame(selected);
    useGameStore.setState({ activeSlot: pendingSlot });
    useGameStore.getState().saveGame(pendingSlot);
    navigate('/game');
  };

  const handleLeagueSelect = (divisionId: DivisionId) => {
    setSelectedLeague(divisionId);
    setSelected(null);
    setStep('club');
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    if (step === 'club') {
      setStep('league');
      setSelected(null);
      setSelectedLeague(null);
    } else {
      navigate('/');
    }
  };

  const divisionData = DIVISIONS.find(d => d.id === selectedLeague);
  const leagueClubs = CLUBS_DATA.filter(c => c.divisionId === selectedLeague);
  const selectedClub = CLUBS_DATA.find(c => c.id === selected);

  return (
    <div className="min-h-screen bg-background safe-area-top">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={handleBack} className="p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              {step === 'league' ? (
                <>
                  <h1 className="text-lg font-bold text-foreground font-display">Choose Your Challenge</h1>
                  <p className="text-xs text-muted-foreground">Where does your story begin?</p>
                </>
              ) : (
                <>
                  <h1 className={cn('text-lg font-bold font-display', divisionData?.colorClass)}>{divisionData?.name}</h1>
                  <p className="text-xs text-muted-foreground">Pick your club</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-5 pb-32">
        <AnimatePresence mode="wait">
          {step === 'league' ? (
            <motion.div
              key="league-step"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {DIVISIONS.map((division, i) => {
                const meta = divisionMeta[division.id];
                const Icon = meta?.icon || Shield;
                const difficulty = difficultyConfig[division.difficulty];
                const bars = difficultyBars[division.difficulty] || 1;
                const clubsInDiv = CLUBS_DATA.filter(c => c.divisionId === division.id);

                return (
                  <motion.div
                    key={division.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, type: 'spring', stiffness: 300, damping: 30 }}
                  >
                    <div
                      onClick={() => handleLeagueSelect(division.id)}
                      className={cn(
                        'relative overflow-hidden rounded-2xl border border-border/40 cursor-pointer',
                        'active:scale-[0.98] transition-all duration-200',
                        'bg-card/40 backdrop-blur-xl',
                        meta?.glow,
                        'hover:border-border/70'
                      )}
                    >
                      {/* Gradient overlay */}
                      <div className={cn('absolute inset-0 bg-gradient-to-br', meta?.gradient)} />

                      <div className="relative p-5">
                        {/* Top row: icon + difficulty */}
                        <div className="flex items-center justify-between mb-4">
                          <div className={cn(
                            'w-14 h-14 rounded-2xl flex items-center justify-center',
                            'bg-white/5 border border-white/10',
                          )}>
                            <Icon className={cn('w-7 h-7', division.colorClass)} />
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Difficulty bars */}
                            <div className="flex gap-1">
                              {[1, 2, 3, 4].map(n => (
                                <div
                                  key={n}
                                  className={cn(
                                    'w-1.5 h-4 rounded-full transition-colors',
                                    n <= bars ? difficulty?.bar || 'bg-muted' : 'bg-white/5'
                                  )}
                                />
                              ))}
                            </div>
                            <span className={cn('text-xs font-semibold', difficulty?.color)}>
                              {difficulty?.label}
                            </span>
                          </div>
                        </div>

                        {/* Name + tagline */}
                        <h2 className={cn('font-display font-bold text-xl text-foreground mb-1')}>
                          {division.name}
                        </h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {meta?.tagline}
                        </p>

                        {/* Stats chips */}
                        <div className="flex items-center gap-3 mt-4">
                          <span className="text-xs text-muted-foreground/70 bg-white/5 rounded-lg px-2.5 py-1 border border-white/5">
                            {clubsInDiv.length} clubs
                          </span>
                          <span className="text-xs text-muted-foreground/70 bg-white/5 rounded-lg px-2.5 py-1 border border-white/5">
                            {division.totalWeeks} weeks
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="club-step"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.25 }}
              className="space-y-2"
            >
              {leagueClubs.map((club, i) => (
                <motion.div
                  key={club.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div
                    onClick={() => setSelected(club.id)}
                    className={cn(
                      'relative overflow-hidden rounded-xl border cursor-pointer',
                      'active:scale-[0.98] transition-all duration-200 p-4',
                      'bg-card/40 backdrop-blur-xl',
                      selected === club.id
                        ? 'ring-2 ring-primary border-primary/30 bg-primary/5'
                        : 'border-border/30 hover:border-border/60'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs shadow-lg"
                        style={{ backgroundColor: club.color, color: club.secondaryColor }}
                      >
                        {club.shortName}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm">{club.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {Array.from({ length: 5 }, (_, si) => (
                            <Star
                              key={si}
                              className={cn(
                                'w-3 h-3',
                                si < club.reputation ? 'fill-primary text-primary' : 'text-border/50'
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-foreground">{'\u00A3'}{(club.budget / 1_000_000).toFixed(0)}M</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">budget</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
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
            className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-xl border-t border-border/50 safe-area-bottom"
          >
            <div className="max-w-lg mx-auto p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xs font-bold shadow-lg"
                  style={{ backgroundColor: selectedClub.color, color: selectedClub.secondaryColor }}
                >
                  {selectedClub.shortName}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground text-base">{selectedClub.name}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> {'\u00A3'}{(selectedClub.budget / 1e6).toFixed(0)}M</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Fans {selectedClub.fanBase}</span>
                    <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Fac. {selectedClub.facilities}</span>
                  </div>
                </div>
              </div>
              <Button className="w-full h-12 text-base font-bold rounded-xl" onClick={handleStart}>
                Begin Career
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClubSelection;
