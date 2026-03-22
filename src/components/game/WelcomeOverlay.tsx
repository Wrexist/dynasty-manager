import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, ArrowLeftRight, ChevronRight, Trophy, Swords, Heart, Users, Zap, PlayCircle } from 'lucide-react';

const STEPS = [
  {
    icon: Trophy,
    title: 'Welcome, Manager!',
    description: 'Build your squad, set tactics, and lead your club to glory. Meet the board\'s objectives to keep your job.',
    hint: 'Swipe between tabs to navigate. Tap any player to see full details.',
  },
  {
    icon: Target,
    title: 'Weekly Rhythm',
    description: 'Each week: check your squad, adjust tactics, then advance. Matches happen automatically when scheduled.',
    hint: 'Training develops players over time. Heavy training is faster but risks injuries.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Transfer Market',
    description: 'Buy and sell players during transfer windows (Weeks 1-8 and 20-24). Scout to find hidden gems.',
    hint: 'Add players to your shortlist to track them between sessions.',
  },
  {
    icon: Swords,
    title: 'Match Day',
    description: 'Watch matches unfold live. Make substitutions, give team talks at half-time, and react to key moments.',
    hint: 'Check player fitness before matches. Tired players perform worse and risk injuries.',
  },
  {
    icon: Heart,
    title: 'Keep the Board Happy',
    description: 'The board sets objectives each season. Meet them to keep your job. Winning boosts confidence, losing drops it.',
    hint: 'Check the Board page for your objectives. Below 25% confidence, you risk being sacked!',
  },
  {
    icon: Users,
    title: 'Building Your Lineup',
    description: 'Go to Squad or Tactics to set your starting 11. Use "Auto Fill" for a quick optimized lineup, or drag players manually.',
    hint: 'Keep an eye on fitness, injuries, and suspensions. Rotate players to avoid burnout.',
  },
  {
    icon: Zap,
    title: 'Chemistry & Tactics',
    description: 'Players with shared nationality or long club tenure form chemistry links that boost performance. Pick a formation that fits your squad.',
    hint: 'Tactical familiarity builds over weeks — avoid changing formation too often.',
  },
  {
    icon: PlayCircle,
    title: 'Your First Match',
    description: 'Before a match, visit Match Prep to scout your opponent. During the match, you can make up to 5 substitutions and adjust mentality.',
    hint: 'After the match, review stats in Match Review to learn what worked and what didn\'t. Good luck!',
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
