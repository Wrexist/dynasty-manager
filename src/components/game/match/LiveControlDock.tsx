import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, FastForward, Flame, Hand, Megaphone, Pause, RefreshCw, Shield, SkipForward, Swords, Scale, type LucideIcon } from 'lucide-react';
import type { Mentality, ShoutType } from '@/types/game';
import { useTranslation } from '@/hooks/useTranslation';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { cn } from '@/lib/utils';
import { SHOUT_DURATION } from '@/config/matchEngine';

// The live match's touchline: everything a manager does while the clock runs,
// in two rows. One team instruction with three plain choices (the five-step
// mentality stays in the Paused panel's advanced tactics), and one bar of four
// actions — Pause, Subs, Shout, Speed. Shouts live in a small menu that says
// what each one does, instead of three bare buttons and an unexplained count.
// Presentational only: every action is a callback into MatchDay's store calls.

export interface LiveShoutState {
  remaining: number;
  /** Minutes until the next shout is allowed (0 = ready). */
  cooldownLeft: number;
  /** The shout in effect right now, if any. */
  active?: { type: ShoutType; minutesLeft: number };
  /** Time-wasting is only offered late in the match. */
  canTimeWaste: boolean;
}

interface LiveControlDockProps {
  mentality: Mentality;
  onMentality: (m: Mentality) => void;
  onPause: () => void;
  subsLeft: number;
  onSubs: () => void;
  shouts: LiveShoutState;
  onShout: (type: ShoutType) => void;
  speedLabel: string;
  speedShortLabel: string;
  /** A faster-than-default speed is on (the button reads as active). */
  speedBoosted: boolean;
  onSpeed: () => void;
  /** Skip to full time, when this match allows it (free from half-time, Pro
   *  from kickoff): a quiet link under the bar, absent otherwise. */
  onSkip?: () => void;
  reducedMotion?: boolean;
}

type Choice = 'defend' | 'balanced' | 'attack';

/** The three live choices. Cautious and All-Out are the advanced steps either
 *  side of Defend/Attack: shown as such, they light the nearer choice. */
function choiceForMentality(m: Mentality): Choice {
  if (m === 'defensive' || m === 'cautious') return 'defend';
  if (m === 'attacking' || m === 'all-out-attack') return 'attack';
  return 'balanced';
}

const CHOICES: { key: Choice; mentality: Mentality; labelKey: 'liveDock.defend' | 'liveDock.balanced' | 'liveDock.attack'; Icon: LucideIcon }[] = [
  { key: 'defend', mentality: 'defensive', labelKey: 'liveDock.defend', Icon: Shield },
  { key: 'balanced', mentality: 'balanced', labelKey: 'liveDock.balanced', Icon: Scale },
  { key: 'attack', mentality: 'attacking', labelKey: 'liveDock.attack', Icon: Swords },
];

const SHOUTS: { type: ShoutType; labelKey: 'liveDock.push' | 'liveDock.hold' | 'liveDock.calm' | 'liveDock.waste'; hintKey: 'liveDock.pushHint' | 'liveDock.holdHint' | 'liveDock.calmHint' | 'liveDock.wasteHint'; Icon: LucideIcon }[] = [
  { type: 'push_forward', labelKey: 'liveDock.push', hintKey: 'liveDock.pushHint', Icon: Flame },
  { type: 'hold_the_line', labelKey: 'liveDock.hold', hintKey: 'liveDock.holdHint', Icon: Shield },
  { type: 'calm_down', labelKey: 'liveDock.calm', hintKey: 'liveDock.calmHint', Icon: Hand },
  { type: 'time_waste', labelKey: 'liveDock.waste', hintKey: 'liveDock.wasteHint', Icon: Clock },
];

const SPRING = { type: 'spring', stiffness: 420, damping: 32 } as const;

export function LiveControlDock({
  mentality, onMentality, onPause, subsLeft, onSubs, shouts, onShout,
  speedLabel, speedShortLabel, speedBoosted, onSpeed, onSkip, reducedMotion,
}: LiveControlDockProps) {
  const { t } = useTranslation();
  const [shoutOpen, setShoutOpen] = useState(false);
  const shoutReady = shouts.remaining > 0 && shouts.cooldownLeft <= 0;
  const activeShout = shouts.active ? SHOUTS.find(s => s.type === shouts.active!.type) : undefined;
  const ringFrac = shouts.active ? Math.max(0, Math.min(1, shouts.active.minutesLeft / SHOUT_DURATION)) : 0;

  return (
    <div className="space-y-2" data-testid="live-control-dock">
      <TeamInstructionPicker mentality={mentality} onMentality={onMentality} reducedMotion={reducedMotion} layoutId="live-team-choice" />

      {/* Actions — Pause · Subs · Shout · Speed. */}
      <div className="relative grid grid-cols-4 gap-2">
        <DockButton onClick={onPause} Icon={Pause} label={t('liveDock.pause')} ariaLabel={t('matchDay.pauseMatch')} />
        <DockButton
          onClick={() => { hapticLight(); onSubs(); }}
          Icon={RefreshCw}
          label={t('liveDock.subs')}
          badge={subsLeft}
          disabled={subsLeft <= 0}
          ariaLabel={t('liveDock.subsLeft', { n: subsLeft })}
          tone="primary"
        />
        <DockButton
          onClick={() => { hapticLight(); setShoutOpen(o => !o); }}
          Icon={activeShout?.Icon ?? Megaphone}
          label={activeShout ? t(activeShout.labelKey) : t('liveDock.shout')}
          badge={shouts.remaining}
          ariaLabel={activeShout ? t('liveDock.shoutActive', { label: t(activeShout.labelKey), n: shouts.active!.minutesLeft }) : t('liveDock.shout')}
          expanded={shoutOpen}
          tone="amber"
          ring={shouts.active ? ringFrac : undefined}
          reducedMotion={reducedMotion}
        />
        <DockButton
          onClick={onSpeed}
          Icon={FastForward}
          label={speedShortLabel}
          ariaLabel={t('liveDock.speed', { label: speedLabel })}
          tone={speedBoosted ? 'primary' : 'neutral'}
        />

        <AnimatePresence>
          {shoutOpen && (
            <>
              {/* Tap anywhere else to close. */}
              <motion.button
                key="scrim"
                aria-label="Close"
                className="fixed inset-0 z-[45] cursor-default"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShoutOpen(false)}
              />
              <motion.div
                key="menu"
                role="menu"
                className="absolute bottom-full right-0 z-[46] mb-2 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-amber-500/25 bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl"
                style={{ transformOrigin: '75% 100%' }}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 6 }}
                transition={reducedMotion ? { duration: 0.15 } : SPRING}
              >
                <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1">
                  <span className="text-micro font-semibold uppercase tracking-wider text-amber-400/90">{t('liveDock.shout')}</span>
                  <span className="text-micro tabular-nums text-muted-foreground">
                    {shouts.remaining <= 0 ? t('liveDock.noShouts')
                      : shouts.cooldownLeft > 0 ? t('liveDock.cooldown', { n: shouts.cooldownLeft })
                      : `${t('liveDock.shoutsLeft', { n: shouts.remaining })} · ${t('liveDock.shoutFor', { n: SHOUT_DURATION })}`}
                  </span>
                </div>
                {SHOUTS.filter(s => s.type !== 'time_waste' || shouts.canTimeWaste).map((s, i) => (
                  <motion.button
                    key={s.type}
                    role="menuitem"
                    disabled={!shoutReady}
                    onClick={() => { hapticMedium(); onShout(s.type); setShoutOpen(false); }}
                    initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reducedMotion ? 0 : 0.03 * i, duration: 0.18 }}
                    className={cn(
                      'flex min-h-[48px] w-full items-center gap-3 rounded-xl px-2.5 text-left transition-colors',
                      shoutReady ? 'hover:bg-amber-500/10 active:bg-amber-500/15' : 'opacity-40',
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                      <s.Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">{t(s.labelKey)}</span>
                      <span className="block text-xs text-muted-foreground">{t(s.hintKey)}</span>
                    </span>
                  </motion.button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {onSkip && (
          <motion.button
            key="skip"
            onClick={onSkip}
            aria-label={t('matchDay.skipToFullTime')}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, height: 44 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            className="mx-auto flex min-h-[44px] items-center gap-1.5 overflow-hidden px-3 text-xs font-semibold text-primary/90 hover:text-primary"
          >
            <SkipForward className="h-3.5 w-3.5" aria-hidden /> {t('matchDay.skipToFullTime')}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Team instruction — three plain choices with one sliding highlight. Shared by
 *  the live dock and the Paused panel (pass distinct `layoutId`s). */
export function TeamInstructionPicker({ mentality, onMentality, reducedMotion, layoutId }: {
  mentality: Mentality; onMentality: (m: Mentality) => void; reducedMotion?: boolean; layoutId: string;
}) {
  const { t } = useTranslation();
  const chosen = choiceForMentality(mentality);
  // The advanced step's own name, when one is set from Advanced tactics.
  const advancedLabel = mentality === 'cautious' ? 'Cautious' : mentality === 'all-out-attack' ? 'All-Out' : null;
  return (
    <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-micro font-semibold uppercase tracking-wider text-muted-foreground">{t('liveDock.team')}</span>
        <div className="relative flex flex-1 rounded-xl border border-border/40 bg-muted/20 p-1" role="radiogroup" aria-label={t('liveDock.team')}>
          {CHOICES.map(c => {
            const on = chosen === c.key;
            return (
              <button
                key={c.key}
                role="radio"
                aria-checked={on}
                onClick={() => { if (on && mentality === c.mentality) return; hapticLight(); onMentality(c.mentality); }}
                className={cn(
                  'relative flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors',
                  on ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {on && (
                  <motion.span
                    layoutId={reducedMotion ? undefined : layoutId}
                    className="absolute inset-0 rounded-lg border border-primary/35 bg-primary/15"
                    transition={SPRING}
                  />
                )}
                <c.Icon className="relative h-3.5 w-3.5" aria-hidden />
                <span className="relative">{on && advancedLabel ? advancedLabel : t(c.labelKey)}</span>
              </button>
            );
          })}
        </div>
    </div>
  );
}

interface DockButtonProps {
  onClick: () => void;
  Icon: LucideIcon;
  label: string;
  ariaLabel?: string;
  badge?: number;
  disabled?: boolean;
  expanded?: boolean;
  tone?: 'neutral' | 'primary' | 'amber';
  /** Share of an active effect left (0-1): drawn as a draining ring. */
  ring?: number;
  reducedMotion?: boolean;
}

function DockButton({ onClick, Icon, label, ariaLabel, badge, disabled, expanded, tone = 'neutral', ring, reducedMotion }: DockButtonProps) {
  const C = 2 * Math.PI * 9;
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      aria-expanded={expanded}
      whileTap={reducedMotion || disabled ? undefined : { scale: 0.94 }}
      transition={SPRING}
      className={cn(
        'relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border text-micro font-semibold transition-colors disabled:opacity-40',
        tone === 'primary' && 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15',
        tone === 'amber' && 'border-amber-500/25 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15',
        tone === 'neutral' && 'border-border/40 bg-muted/25 text-foreground hover:bg-muted/40',
        expanded && 'ring-1 ring-amber-400/50',
      )}
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        {ring !== undefined && (
          <svg className="absolute -inset-1 h-7 w-7 -rotate-90" viewBox="0 0 22 22" aria-hidden>
            <circle cx="11" cy="11" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
            <circle
              cx="11" cy="11" r="9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - ring)}
              style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
            />
          </svg>
        )}
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="leading-none">{label}</span>
      {badge !== undefined && badge > 0 && (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={badge}
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-current px-1"
            initial={reducedMotion ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
            transition={SPRING}
          >
            <span className="text-micro font-bold tabular-nums leading-none text-background">{badge}</span>
          </motion.span>
        </AnimatePresence>
      )}
    </motion.button>
  );
}
