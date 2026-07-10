import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Trophy, ChevronRight } from 'lucide-react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useEscapeClose } from '@/hooks/useEscapeClose';

interface WelcomeCardProps {
  /** Dismiss the first-run welcome entirely (sets the device-global flag). */
  onDismiss: () => void;
  /** Open the full 6-panel tour for players who want the deep dive. */
  onTakeTour: () => void;
}

const QUICK_START = [
  'Set your best XI and tactics from the bottom tabs.',
  'Play your scheduled match from the Dashboard, then advance the week.',
  'Meet the board’s objectives to keep your job and climb.',
];

/**
 * First-run welcome, compressed to a single dismissible card. Most players
 * want to start playing — this gives them the three-line quick-start and gets
 * out of the way, while "Take the tour" still opens the full 6-panel
 * `WelcomeOverlay` for anyone who wants it. Shares the device-global
 * `WELCOME_SHOWN` flag: dismissing either surface counts as seen.
 */
export function WelcomeCard({ onDismiss, onTakeTour }: WelcomeCardProps) {
  useScrollLock(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(containerRef, true);
  useEscapeClose(onDismiss);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 px-4 pb-8 safe-area-bottom"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-card-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm bg-card border border-border/50 rounded-2xl overflow-hidden"
      >
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-primary" aria-hidden />
            </div>
            <h2 id="welcome-card-title" className="text-base font-bold text-foreground font-display">
              Welcome, Manager!
            </h2>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Build your squad, set tactics, and lead your club to glory. Here’s the quick version:
          </p>

          <ul className="space-y-2">
            {QUICK_START.map((line, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-[11px] font-bold text-primary">
                  {i + 1}
                </span>
                <span className="text-xs text-foreground/90 leading-snug">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border/30">
          <button
            onClick={onTakeTour}
            className="min-h-11 flex items-center gap-1 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Take the tour
            <ChevronRight className="w-3 h-3" />
          </button>
          <button
            onClick={onDismiss}
            className="min-h-11 px-5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold active:scale-[0.97] transition-transform"
          >
            Start Managing
          </button>
        </div>
      </motion.div>
    </div>
  );
}
