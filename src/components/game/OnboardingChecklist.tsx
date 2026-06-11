/**
 * Week-1 onboarding checklist surfaced on the Dashboard.
 *
 * The first session of a new career is the highest-impact moment for
 * teaching players the systems — once they've advanced to week 2 they're
 * already inside the weekly loop. This card sits above the fold on
 * Dashboard for `week === 1 && season === 1 && prestigeLevel === 0`,
 * lists concrete tasks, and auto-disappears once the user advances week
 * or toggles `settings.hideOnboarding`.
 *
 * Each row opens an over-explicit step-by-step walkthrough modal that
 * spells out exactly where to tap. Tapping "Take me there" navigates to
 * the actual screen.
 *
 * Visibility / completion rules — all derived from observable state, no
 * save migration:
 *   - Card hidden if: week !== 1, season !== 1, prestigeLevel > 0,
 *     settings.hideOnboarding === true, or session-dismissed.
 *   - Sponsor row done when sponsorOffers.length === 0.
 *   - Scout row done when scouting.assignments.length > 0; hidden entirely
 *     when scouting.maxAssignments === 0 (user has no scout on staff
 *     yet — Staff hire row is added as a replacement so the checklist
 *     can still complete).
 *   - Advance-week row never ticks; advancing hides the entire card via
 *     the week-guard.
 *
 * Visual treatment uses the project's LIQUID_GLASS_SURFACE constant +
 * the GlassPanel decorative specular layer, matching the rest of the
 * dark glass-morphism design language.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { Banknote, Search, Calendar, UserPlus, Check, X, ChevronRight, ArrowRight } from 'lucide-react';
import type { GameScreen } from '@/types/game';
import { hapticLight } from '@/utils/haptics';
import { readSessionJson, writeSessionJson, STORAGE_KEYS } from '@/store/helpers/persistence';
import { LIQUID_GLASS_SURFACE } from '@/components/game/GlassPanel';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { cn } from '@/lib/utils';

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
  whyItMatters: string;
  steps: WalkthroughStep[];
  successCue: string;
}

export function OnboardingChecklist() {
  const { week, season, sponsorOffers, scouting, managerProgression, hideOnboarding } = useGameStore(
    useShallow(s => ({
      week: s.week,
      season: s.season,
      sponsorOffers: s.sponsorOffers,
      scouting: s.scouting,
      managerProgression: s.managerProgression,
      hideOnboarding: s.settings.hideOnboarding,
    })),
  );
  const setScreen = useGameStore(s => s.setScreen);

  const [dismissed, setDismissed] = useState(() => readSessionJson<boolean>(DISMISS_KEY) === true);
  const [activeWalkthrough, setActiveWalkthrough] = useState<ChecklistItem | null>(null);

  // Focus trap + Escape close for the walkthrough modal. Hooks must run
  // unconditionally before the early-return guards below, so they're
  // declared here and keyed off `activeWalkthrough` being non-null.
  const walkthroughRef = useRef<HTMLDivElement | null>(null);
  const closeWalkthrough = () => setActiveWalkthrough(null);
  useFocusTrap(walkthroughRef, activeWalkthrough !== null);
  useEscapeClose(closeWalkthrough, activeWalkthrough !== null);

  // Auto-complete: once both starter tasks are ticked, the checklist has
  // served its purpose. Persist the dismissal immediately (so it never
  // re-opens) and fade the card out after a short beat — long enough for
  // the player to see it reach 2/2.
  const sponsorTaskDone = sponsorOffers.length === 0;
  const scoutTaskDone = scouting.maxAssignments > 0 && scouting.assignments.length > 0;
  const allTasksDone = sponsorTaskDone && scoutTaskDone;
  const eligibleToShow =
    week === 1 && season === 1 &&
    (managerProgression?.prestigeLevel ?? 0) === 0 &&
    !hideOnboarding;

  // Only auto-close after the player has actually seen the card with tasks
  // still pending. A brand-new career that happens to start already at 2/2
  // (no sponsor offer generated + a scout pre-assigned) must NOT flash the
  // card away before it is ever read.
  const sawIncompleteRef = useRef(false);
  useEffect(() => {
    if (!eligibleToShow || dismissed) return;
    if (!allTasksDone) { sawIncompleteRef.current = true; return; }
    if (!sawIncompleteRef.current) return;
    writeSessionJson(DISMISS_KEY, true);
    const t = window.setTimeout(() => setDismissed(true), 1400);
    return () => window.clearTimeout(t);
  }, [eligibleToShow, dismissed, allTasksDone]);

  // Hard gates: hide entirely if not a brand-new career, if the user has
  // dismissed it this session, or if they've globally opted out via Settings.
  if (week !== 1 || season !== 1) return null;
  if ((managerProgression?.prestigeLevel ?? 0) > 0) return null;
  if (hideOnboarding) return null;
  if (dismissed) return null;

  // Build the item list dynamically — the scout row swaps to a "hire a
  // scout from Staff" row when the user has no scout on payroll, so the
  // checklist never has an un-tickable orphan row.
  const items: ChecklistItem[] = [];

  items.push({
    id: 'sponsor',
    label: 'Sign your first sponsor',
    description: 'A local brand has put a kit-sleeve offer on the table.',
    icon: Banknote,
    done: sponsorOffers.length === 0,
    screen: 'finance',
    whyItMatters: 'Sponsorships are weekly income on top of matchday revenue. The offer on your desk pays for the rest of the season. Ignore it and it expires in six weeks — you\'ll have left free money on the table.',
    steps: [
      { text: 'Tap "More" in the bottom navigation bar (three dots, bottom-right).' },
      { text: 'In the menu that slides up, tap "Finance".' },
      { text: 'Scroll down until you see a section titled "Pending Offers".' },
      { text: 'You\'ll see one offer — "Kit Sleeve Sponsor" with a weekly payment. Tap the row.' },
      { text: 'A details sheet opens with the sponsor name, weekly payment, bonus condition, and duration. Read it, then tap "Accept" (or "Decline" — both count as reviewing).' },
    ],
    successCue: 'Once accepted, the offer moves from "Pending Offers" to "Sponsor Slots" with a green payment bar. This checklist row will tick.',
  });

  if (scouting.maxAssignments > 0) {
    items.push({
      id: 'scout',
      label: 'Send your first scout',
      description: 'Scouts find players you would never see on the open market.',
      icon: Search,
      done: scouting.assignments.length > 0,
      screen: 'scouting',
      whyItMatters: 'The transfer market only shows players whose clubs have listed them. Scouts find the rest — hidden gems, high-potential teenagers. You start with idle scouts costing you nothing; put them to work.',
      steps: [
        { text: 'Tap "More" in the bottom navigation bar.' },
        { text: 'In the menu, tap "Scouting".' },
        { text: 'Below the empty reports area you\'ll see "Send Scout" with five regions.' },
        { text: 'Tap any region. Domestic returns reports fastest (2 weeks); Asia and Africa take 4-5 weeks but surface higher-potential youngsters.' },
        { text: 'A confirmation toast appears. Reports arrive in your inbox automatically.' },
      ],
      successCue: 'A blue progress bar appears under "Active Assignments" showing weeks remaining. This checklist row will tick.',
    });
  } else {
    items.push({
      id: 'hire-scout',
      label: 'Hire your first scout',
      description: 'You currently have no scouts. Hire one from Staff to unlock scouting.',
      icon: UserPlus,
      // No way to derive completion without a scout on the books; the row
      // ticks once the user hires (maxAssignments > 0), which flips the
      // ternary above to the regular scout row.
      done: false,
      screen: 'staff',
      whyItMatters: 'Without a scout on your staff you cannot send anyone out on assignment, and the entire Scouting page sits idle. Tier-1 scouts are cheap and find domestic talent reliably.',
      steps: [
        { text: 'Tap "More" in the bottom navigation bar.' },
        { text: 'In the menu, tap "Staff".' },
        { text: 'Switch to the "Hires" tab at the top of the page.' },
        { text: 'Find a candidate with the "Scout" role and tap "Hire" — the cost is shown as a one-off signing fee plus weekly wage.' },
      ],
      successCue: 'Once hired, this row swaps to "Send your first scout" — head to Scouting and send them on assignment.',
    });
  }

  items.push({
    id: 'advance',
    label: 'Then: play your first match',
    description: 'When you\'re set up, play your Week 1 matches to start the season.',
    icon: Calendar,
    done: false,
    screen: 'dashboard',
    whyItMatters: 'Time only moves when you advance it. The game pauses indefinitely between weeks so you can set tactics, manage transfers, and review scout reports. Once you advance, week 2 begins and friendlies + training fire.',
    steps: [
      { text: 'Make sure you\'ve looked at Squad (bottom nav) — your starting XI is already set, but glance at it.' },
      { text: 'Optionally peek at Tactics (bottom nav) — your default formation is 4-3-3.' },
      { text: 'Come back to the Dashboard (Home button in the bottom nav).' },
      { text: 'Your next match card is right at the top — tap "Match Prep".' },
      { text: 'Play your Week 1 matches (a friendly may share the week with a league fixture). Once they\'re done, the week ticks over.' },
    ],
    successCue: 'Once advanced, this whole checklist disappears — you\'re inside the weekly loop now.',
  });

  // "Active" tasks (excludes the always-incomplete advance row from the
  // denominator so progress reads naturally: 1/2, 2/2, hidden).
  const activeItems = items.filter(i => i.id !== 'advance');
  const doneCount = activeItems.filter(i => i.done).length;

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
          className={cn(LIQUID_GLASS_SURFACE, 'p-3.5 mb-3')}
          role="region"
          aria-label="Getting started checklist"
        >
          {/* Specular crescent — same lighting treatment as GlassPanel so the
              card reads as the same material as everything else around it. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
            style={{
              background:
                'radial-gradient(120% 90% at 50% -30%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.025) 32%, rgba(255,255,255,0) 62%)',
              mixBlendMode: 'screen',
            }}
          />

          {/* Gold accent line at the top — Liquid Glass elements often have a
              thin coloured edge to denote their semantic role. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
          />

          <button
            type="button"
            onClick={dismiss}
            className="absolute top-2 right-2 p-2 -m-1 rounded-full text-foreground/40 hover:text-foreground/80 hover:bg-white/5 transition-colors"
            aria-label="Dismiss checklist"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="relative flex items-center justify-between mb-1 pr-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-primary/80 font-semibold">First Session</span>
            </div>
            <span className="text-[10px] text-foreground/60 tabular-nums">{doneCount}/{activeItems.length} done</span>
          </div>

          <h3 className="relative text-base font-bold text-foreground font-display mb-1">Getting Started</h3>
          <p className="relative text-[11px] text-foreground/70 mb-3 leading-snug">
            Tap any step for an exact walkthrough — we'll tell you which buttons to press.
          </p>

          <ul className="relative space-y-1.5">
            {items.map(item => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                <button
                  type="button"
                  onClick={() => { hapticLight(); setActiveWalkthrough(item); }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                    'bg-white/[0.025] hover:bg-white/[0.05] active:bg-white/[0.075]',
                    'border border-white/[0.04] hover:border-white/[0.08]',
                  )}
                >
                  <div className={cn(
                    'shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.25)]',
                    item.done
                      ? 'bg-emerald-500/25 text-emerald-300'
                      // The 'advance' row is the closing step, not a tickable
                      // task (it's excluded from the X/N counter — the card
                      // disappears once the week moves). Mute it so the
                      // counter and the visible checkboxes agree.
                      : item.id === 'advance'
                        ? 'bg-white/10 text-foreground/60'
                        : 'bg-primary/25 text-primary',
                  )}>
                    {item.done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-xs font-semibold',
                      item.done ? 'text-foreground/50 line-through' : 'text-foreground',
                    )}>
                      {item.label}
                    </p>
                    <p className="text-[10px] text-foreground/60 leading-snug">{item.description}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-foreground/40 shrink-0" aria-hidden />
                </button>
                </li>
              );
            })}
          </ul>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {activeWalkthrough && (
          <motion.div
            ref={walkthroughRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm px-4 pb-6 safe-area-bottom"
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
              className={cn(LIQUID_GLASS_SURFACE, 'w-full max-w-sm overflow-visible')}
              onClick={e => e.stopPropagation()}
            >
              {/* Specular highlight matching the card */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-2/3 rounded-2xl overflow-hidden"
                style={{
                  background:
                    'radial-gradient(120% 90% at 50% -20%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 38%, rgba(255,255,255,0) 70%)',
                  mixBlendMode: 'screen',
                }}
              />
              <div className="relative p-5 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-foreground font-display">{activeWalkthrough.label}</h2>
                  <button
                    type="button"
                    onClick={() => setActiveWalkthrough(null)}
                    className="p-2 -m-2 rounded-full text-foreground/50 hover:text-foreground hover:bg-white/5 transition-colors"
                    aria-label="Close walkthrough"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div
                  className={cn(
                    'rounded-xl p-3 mb-3 border border-primary/20',
                    'bg-gradient-to-br from-primary/8 via-primary/5 to-transparent',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
                  )}
                >
                  <p className="text-[10px] uppercase tracking-[0.16em] text-primary font-semibold mb-1">Why bother</p>
                  <p className="text-xs text-foreground/90 leading-relaxed">{activeWalkthrough.whyItMatters}</p>
                </div>

                <p className="text-[10px] uppercase tracking-[0.16em] text-primary/80 font-semibold mb-2">Step by step</p>
                <ol className="space-y-2.5 mb-3">
                  {activeWalkthrough.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className={cn(
                        'shrink-0 w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums',
                        'bg-primary/20 text-primary',
                        'shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.18)]',
                      )}>
                        {i + 1}
                      </span>
                      <p className="text-xs text-foreground/90 leading-relaxed pt-0.5">{step.text}</p>
                    </li>
                  ))}
                </ol>

                <div
                  className={cn(
                    'rounded-xl p-3 mb-4 border border-emerald-500/20',
                    'bg-gradient-to-br from-emerald-500/8 via-emerald-500/5 to-transparent',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
                  )}
                >
                  <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-400 font-semibold mb-1">What success looks like</p>
                  <p className="text-xs text-foreground/85 leading-relaxed">{activeWalkthrough.successCue}</p>
                </div>

                {activeWalkthrough.screen !== 'dashboard' ? (
                  <button
                    type="button"
                    onClick={() => goThere(activeWalkthrough.screen)}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 h-12 rounded-xl',
                      'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground',
                      'font-bold text-sm tracking-wide',
                      'shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.25),0_4px_12px_-4px_hsl(43_96%_46%/0.4)]',
                      'active:scale-[0.98] transition-transform',
                    )}
                  >
                    Take me there
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveWalkthrough(null)}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 h-12 rounded-xl',
                      'bg-white/[0.06] text-foreground font-bold text-sm tracking-wide',
                      'border border-white/[0.08]',
                      'shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
                      'active:scale-[0.98] transition-transform',
                    )}
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
