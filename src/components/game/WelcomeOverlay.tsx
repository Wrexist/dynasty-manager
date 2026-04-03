import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, ChevronRight, Trophy, LayoutDashboard, Users, Swords, ShoppingBag } from 'lucide-react';

const STEPS = [
  {
    icon: Trophy,
    title: 'Welcome, Manager!',
    description: 'Build your squad, set tactics, and lead your club to glory. Each week brings training, transfers, and matches — your decisions shape everything.',
    hint: 'Use the bottom tabs to navigate between Squad, Tactics, Market, and more.',
  },
  {
    icon: Target,
    title: 'The Weekly Rhythm',
    description: 'Check your squad, adjust tactics, then hit "Advance Week" to progress. Matches happen when scheduled — make substitutions and tactical changes live.',
    hint: 'The board sets objectives each season. Meet them to keep your job — below 25% confidence, you risk the sack!',
  },
  {
    icon: Users,
    title: 'Your Squad',
    description: 'Pick your best XI and set your bench. Young players (<24) grow toward their potential through training and match time. Veterans (31+) gradually decline.',
    hint: 'Injured or suspended players can\'t play. Keep morale high — unhappy players perform worse and may request a transfer.',
  },
  {
    icon: Swords,
    title: 'Tactics & Training',
    description: 'Choose a formation and playing style. Stick with the same setup to build tactical familiarity — this directly boosts your match performance.',
    hint: 'Set daily training modules to develop your squad. Heavy training is faster but risks injuries. Chemistry builds when players train and play together.',
  },
  {
    icon: ShoppingBag,
    title: 'Transfers & Finances',
    description: 'Buy, sell, and loan players during transfer windows (Weeks 1-8 and 20-24). Watch your wage bill — if wages exceed revenue, you\'ll go into debt.',
    hint: 'Scout players before signing them. Free agents can be signed anytime. The Market tab shows all available transfers.',
  },
  {
    icon: LayoutDashboard,
    title: 'Start From Your Dashboard',
    description: 'Your dashboard is your weekly hub. Some weeks have matches, and others are focused on planning, scouting, and development.',
    hint: 'Use "Advance Week" to move forward. A match will appear automatically when one is scheduled.',
  },
];

interface WelcomeOverlayProps {
  onComplete: () => void;
}

export function WelcomeOverlay({ onComplete }: WelcomeOverlayProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 px-4 pb-8 safe-area-bottom">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-sm bg-card border border-border/50 rounded-2xl overflow-hidden"
        >
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-base font-bold text-foreground font-display">{current.title}</h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>

            <div className="bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
              <p className="text-xs text-primary/80">{current.hint}</p>
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-t border-border/30">
            {/* Progress indicator */}
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === step ? 'bg-primary' : i < step ? 'bg-primary/40' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">{step + 1} of {STEPS.length}</span>
            </div>

            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={() => isLast ? onComplete() : setStep(s => s + 1)}
                className="flex items-center gap-1 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold active:scale-[0.97] transition-transform"
              >
                {isLast ? 'Dashboard' : 'Next'}
                {!isLast && <ChevronRight className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
