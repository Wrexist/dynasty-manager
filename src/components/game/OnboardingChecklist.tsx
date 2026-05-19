/**
 * Week-1 onboarding checklist surfaced on the Dashboard.
 *
 * The first session of a new career is the highest-impact moment for
 * teaching players the systems — once they've advanced to week 2 they're
 * already inside the weekly loop. This card sits above the fold on
 * Dashboard for `week === 1 && season === 1`, lists 3 concrete tasks,
 * and auto-disappears once the user advances week.
 *
 * Each row opens an over-explicit step-by-step walkthrough modal that
 * spells out exactly where to tap (e.g. "Tap More in the bottom nav,
 * then tap Finance, scroll down, tap Review"). Tapping "Take me there"
 * at the end of the walkthrough navigates to the actual screen, where
 * the user can complete the action and have the checklist row auto-
 * tick on return.
 *
 * Detection of completion is derived from observable state — no save
 * migration:
 *   - Sponsor reviewed → sponsorOffers.length === 0
 *   - Scout sent       → scouting.assignments.length > 0
 *   - Week advanced    → not tracked here; advancing hides the entire
 *                        card via the week !== 1 guard.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { Banknote, Search, Calendar, Check, X, ChevronRight, ArrowRight } from 'lucide-react';
import type { GameScreen } from '@/types/game';
import { hapticLight } from '@/utils/haptics';
import { readSessionJson, writeSessionJson, STORAGE_KEYS } from '@/store/helpers/persistence';

const DISMISS_KEY = STORAGE_KEYS.ONBOARDING_CHECKLIST_DISMISSED;

interface WalkthroughStep {
  text: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  done: boolean;
  screen: GameScreen;
  /**
   * What the user will see / why this matters. Shown at the top of the
   * walkthrough modal as a "you are about to..." preamble.
   */
  whyItMatters: string;
  /**
   * Step-by-step instructions. Each step is one tap or one thing to look
   * for. Be explicit — assume the user has never seen this screen before
   * and is on a 375px phone with the bottom nav visible.
   */
  steps: WalkthroughStep[];
  /** What to expect when they're done. Sets the success criteria. */
  successCue: string;
}

export function OnboardingChecklist() {
  const { week, season, sponsorOffers, scouting } = useGameStore(
    useShallow(s => ({
      week: s.week,
      season: s.season,
      sponsorOffers: s.sponsorOffers,
      scouting: s.scouting,
    })),
  );
  const setScreen = useGameStore(s => s.setScreen);

  const [dismissed, setDismissed] = useState(() => readSessionJson<boolean>(DISMISS_KEY) === true);
  const [activeWalkthrough, setActiveWalkthrough] = useState<ChecklistItem | null>(null);

  if (week !== 1 || season !== 1) return null;
  if (dismissed) return null;

  const items: ChecklistItem[] = [
    {
      id: 'sponsor',
      label: 'Sign your first sponsor',
      description: 'A local brand has put a kit-sleeve offer on the table.',
      icon: Banknote,
      done: sponsorOffers.length === 0,
      screen: 'finance',
      whyItMatters: 'Sponsorships are weekly income on top of matchday revenue. The offer on your desk pays for the rest of the season. Ignore it and it expires in six weeks — you\'ll have left free money on the table.',
      steps: [
        { text: 'Tap the "More" button in the bottom navigation bar (it has three dots — bottom-right of the screen).' },
        { text: 'In the menu that slides up, tap "Finance".' },
        { text: 'Scroll down until you see a section titled "Pending Offers".' },
        { text: 'You should see one offer — "Kit Sleeve Sponsor" with a weekly amount. Tap the row.' },
        { text: 'A details sheet opens with the sponsor name, weekly payment, bonus condition, and duration. Read it, then tap "Accept" (or "Decline" if you don\'t like the terms — both count as reviewing the offer).' },
      ],
      successCue: 'Once accepted, the offer disappears from Pending Offers and shows up under Sponsor Slots with a green payment bar. This checklist row will tick.',
    },
    {
      id: 'scout',
      label: 'Send your first scout',
      description: 'Scouts find players you would otherwise never see on the market.',
      icon: Search,
      done: scouting.assignments.length > 0,
      screen: 'scouting',
      whyItMatters: 'The transfer market only shows players whose clubs have listed them. Scouts find the rest — including hidden gems and high-potential teenagers. You start with idle scouts costing you nothing; put them to work.',
      steps: [
        { text: 'Tap the "More" button in the bottom navigation bar.' },
        { text: 'In the menu, tap "Scouting".' },
        { text: 'Below the empty reports area you\'ll see "Send Scout" with a list of regions: Domestic, Europe, South America, Africa, Asia.' },
        { text: 'Tap any region — Domestic returns the fastest (2 weeks). Asia and Africa take longer but tend to surface higher-potential youngsters.' },
        { text: 'A confirmation toast pops up. You\'re done. Reports arrive in your inbox automatically when the scout completes the assignment.' },
      ],
      successCue: 'A blue progress bar appears under "Active Assignments" showing weeks remaining. This checklist row will tick.',
    },
    {
      id: 'advance',
      label: 'Advance to your first match week',
      description: 'When you\'ve set things up, advance the week to start the season.',
      icon: Calendar,
      done: false,
      screen: 'dashboard',
      whyItMatters: 'Time only moves when you advance it. The game pauses indefinitely between weeks so you can set tactics, manage transfers, and review scout reports. Once you advance, week 2 begins and friendlies + training fire.',
      steps: [
        { text: 'Make sure you\'ve looked at Squad (bottom nav) — your starting XI is already set, but glance at it to confirm.' },
        { text: 'Optionally peek at Tactics (bottom nav) — your default formation is 4-4-2.' },
        { text: 'Come back to the Dashboard (Home button in the bottom nav).' },
        { text: 'Scroll to the bottom — you\'ll see a big "Advance Week" button.' },
        { text: 'Tap it. The week ticks over and your first pre-season friendly fires.' },
      ],
      successCue: 'Once advanced, this whole checklist disappears — you\'re in the weekly loop now.',
    },
  ];

  const doneCount = items.filter(i => i.done).length;

  const dismiss = () => {
    writeSessionJson(DISMISS_KEY, true);
    setDismissed(true);
  };

  const goThere = (screen: GameScreen) => {
    hapticLight();
    setActiveWalkthrough(null);
    setScreen(screen);
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-xl p-3.5 mb-3 relative"
          role="region"
          aria-label="Getting started checklist"
        >
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-2 right-2 p-2 -m-1 text-primary/40 hover:text-primary/80 transition-colors"
            aria-label="Dismiss checklist"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center justify-between mb-2.5 pr-6">
            <h3 className="text-sm font-bold text-primary font-display">Getting Started</h3>
            <span className="text-[10px] text-primary/60 tabular-nums">{doneCount}/{items.length - 1} done</span>
          </div>

          <p className="text-[10px] text-primary/70 mb-2.5 leading-snug">
            New manager? Tap a step below for an exact walkthrough — we’ll tell you which buttons to press.
          </p>

          <ul className="space-y-1.5">
            {items.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { hapticLight(); setActiveWalkthrough(item); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-primary/10 active:bg-primary/15"
                >
                  <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    item.done
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-primary/20 text-primary'
                  }`}>
                    {item.done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${item.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {item.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground/80 leading-snug">{item.description}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-primary/50 shrink-0" aria-hidden />
                </button>
              );
            })}
          </ul>
        </motion.div>
      </AnimatePresence>

      {/* Walkthrough modal */}
      <AnimatePresence>
        {activeWalkthrough && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 px-4 pb-6 safe-area-bottom"
            onClick={() => setActiveWalkthrough(null)}
            role="dialog"
            aria-modal="true"
            aria-label={`Walkthrough: ${activeWalkthrough.label}`}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-w-sm bg-card border border-primary/30 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(234,179,8,0.15)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-bold text-primary font-display">{activeWalkthrough.label}</h2>
                  <button
                    type="button"
                    onClick={() => setActiveWalkthrough(null)}
                    className="p-2 -m-2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Close walkthrough"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-primary/8 border border-primary/15 rounded-lg p-3 mb-3">
                  <p className="text-[10px] uppercase tracking-wider text-primary/70 font-semibold mb-1">Why bother</p>
                  <p className="text-xs text-foreground/90 leading-relaxed">{activeWalkthrough.whyItMatters}</p>
                </div>

                <p className="text-[10px] uppercase tracking-wider text-primary/70 font-semibold mb-2">Step by step</p>
                <ol className="space-y-2.5 mb-3">
                  {activeWalkthrough.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center tabular-nums">
                        {i + 1}
                      </span>
                      <p className="text-xs text-foreground/90 leading-relaxed">{step.text}</p>
                    </li>
                  ))}
                </ol>

                <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg p-3 mb-4">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-1">What success looks like</p>
                  <p className="text-xs text-foreground/85 leading-relaxed">{activeWalkthrough.successCue}</p>
                </div>

                {activeWalkthrough.screen !== 'dashboard' && (
                  <button
                    type="button"
                    onClick={() => goThere(activeWalkthrough.screen)}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] transition-transform"
                  >
                    Take me there
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {activeWalkthrough.screen === 'dashboard' && (
                  <button
                    type="button"
                    onClick={() => setActiveWalkthrough(null)}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-primary/20 text-primary font-bold text-sm active:scale-[0.98] transition-transform"
                  >
                    Got it
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
