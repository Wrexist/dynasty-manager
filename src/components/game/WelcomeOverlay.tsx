import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Target, ArrowLeftRight, Play, ChevronRight, Trophy } from 'lucide-react';

const STEPS = [
  {
    icon: Trophy,
    title: 'Welcome, Manager!',
    description: 'You\'re in charge now. Build your squad, set tactics, and lead your club to glory across multiple seasons.',
    hint: 'Swipe left and right between tabs to navigate quickly.',
  },
  {
    icon: Users,
    title: 'Manage Your Squad',
    description: 'Check your players\' fitness, morale, and form. Tap any player to see full details. Keep your squad depth balanced across all positions.',
    hint: 'Tip: Players with low fitness perform worse in matches.',
  },
  {
    icon: Target,
    title: 'Set Your Tactics',
    description: 'Pick a formation and mentality that suits your squad. Your tactical choices directly affect match results.',
    hint: 'Tip: Balanced mentality is safe. Go attacking when chasing a win.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Transfer Market',
    description: 'Buy and sell players during transfer windows. Scout new talent and manage your wage budget wisely.',
    hint: 'Tip: Check the scouting page to discover hidden gems.',
  },
  {
    icon: Play,
    title: 'Play Matches & Advance',
    description: 'When a match is scheduled, tap "Kick Off" to play. Between matches, press "Advance Week" to progress through the season.',
    hint: 'Tip: Check your board objectives — they\'re your key targets.',
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
            {/* Progress dots */}
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
                {isLast ? 'Get Started' : 'Next'}
                {!isLast && <ChevronRight className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
