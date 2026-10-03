import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Check, Sparkles } from 'lucide-react';
import type { Player } from '@/types/game';
import { cn } from '@/lib/utils';
import { getRatingBadgeClasses } from '@/utils/uiHelpers';
import { getPlayerPortrait } from '@/utils/playerPortrait';

// The substitution sheet's two clean steps: a bench list that shows only what
// the decision needs (rating, position, energy, how well he fits the slot, and
// which one we'd pick), and a confirm card that plays the swap — the tired man
// walks off, the fresh one runs on — before the sheet closes.

export type SlotFit = 'natural' | 'compatible' | 'wrong';

const FIT_LABEL: Record<SlotFit, { text: string; className: string }> = {
  natural: { text: 'Natural fit', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  compatible: { text: 'Can play there', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  wrong: { text: 'Out of position', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const SPRING = { type: 'spring', stiffness: 380, damping: 30 } as const;

/** Energy bar colour: the same thresholds the squad screens use. */
function energyClass(fit: number): string {
  if (fit >= 75) return 'bg-emerald-400';
  if (fit >= 50) return 'bg-amber-400';
  return 'bg-red-400';
}

/** A face when the catalogue has one, else the rating badge. */
function PlayerFace({ player, size = 40 }: { player: Player; size?: number }) {
  const portrait = getPlayerPortrait(player);
  return (
    <div
      className={cn('relative shrink-0 overflow-hidden rounded-xl', !portrait && getRatingBadgeClasses(player.overall))}
      style={{ width: size, height: size }}
    >
      {portrait ? (
        <>
          <div className={cn('absolute inset-0 opacity-60', getRatingBadgeClasses(player.overall))} />
          <img src={portrait.src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover object-top" />
        </>
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm font-black tabular-nums">{player.overall}</span>
      )}
    </div>
  );
}

export interface BenchOption {
  player: Player;
  fit: SlotFit | null;
  energy: number;
  recommended?: boolean;
  /** A yellow card earlier in the match (rare for a sub, but possible). */
  booked?: boolean;
}

interface SubBenchListProps {
  options: BenchOption[];
  /** No one picked to come off yet: the bench is a preview, not a choice. */
  locked: boolean;
  onPick: (id: string) => void;
  reducedMotion?: boolean;
}

export function SubBenchList({ options, locked, onPick, reducedMotion }: SubBenchListProps) {
  return (
    <motion.ul
      className="space-y-1.5"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: reducedMotion ? 0 : 0.04 } } }}
    >
      {options.map(o => (
        <motion.li
          key={o.player.id}
          layout={!reducedMotion}
          variants={{ hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
          transition={SPRING}
        >
          <button
            type="button"
            disabled={locked}
            onClick={() => onPick(o.player.id)}
            aria-label={`Bring on ${o.player.firstName} ${o.player.lastName}, ${o.player.position}, ${o.player.overall} overall${o.fit ? `, ${FIT_LABEL[o.fit].text}` : ''}${o.recommended ? ', recommended' : ''}`}
            className={cn(
              'flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition-colors',
              locked ? 'border-border/30 bg-card/30 opacity-60'
                : o.recommended ? 'border-primary/40 bg-primary/10 hover:bg-primary/15 active:bg-primary/20'
                : 'border-border/40 bg-card/50 hover:bg-card/80 active:bg-card',
            )}
          >
            <PlayerFace player={o.player} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-foreground">{o.player.lastName}</span>
                {o.booked && <span className="h-3 w-2 shrink-0 rounded-[2px] bg-yellow-400" aria-label="Booked" />}
                {o.recommended && !locked && (
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-micro font-bold text-primary">
                    <Sparkles className="h-3 w-3" aria-hidden /> Recommended
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">{o.player.position} · {o.player.overall}</span>
                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted/40" aria-label={`Energy ${Math.round(o.energy)}%`}>
                  <motion.span
                    className={cn('block h-full rounded-full', energyClass(o.energy))}
                    initial={reducedMotion ? false : { width: 0 }}
                    animate={{ width: `${Math.max(4, Math.min(100, o.energy))}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </span>
                {o.fit && !locked && (
                  <span className={cn('ml-auto shrink-0 rounded-full border px-2 py-0.5 text-micro font-semibold', FIT_LABEL[o.fit].className)}>
                    {FIT_LABEL[o.fit].text}
                  </span>
                )}
              </div>
            </div>
          </button>
        </motion.li>
      ))}
    </motion.ul>
  );
}

interface SwapCardProps {
  out: Player;
  outEnergy: number;
  incoming: Player;
  fit: SlotFit;
  /** The sub has been made: play the swap. */
  done: boolean;
  reducedMotion?: boolean;
}

/** OUT ⇄ IN, with what changes. When `done`, the out-going player drops away
 *  and the new one rises into his place, then a tick lands. */
export function SubSwapCard({ out, outEnergy, incoming, fit, done, reducedMotion }: SwapCardProps) {
  const ovrDiff = incoming.overall - out.overall;
  const energyDiff = Math.round(incoming.fitness - outEnergy);
  const move = !reducedMotion && done;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-3">
      <div className="flex items-center gap-2">
        <motion.div
          className="flex flex-1 flex-col items-center gap-1 text-center"
          animate={move ? { y: 26, opacity: 0, scale: 0.9 } : { y: 0, opacity: done ? 0.4 : 1, scale: 1 }}
          transition={{ ...SPRING, delay: 0.05 }}
        >
          <span className="inline-flex items-center gap-1 text-micro font-bold uppercase tracking-wider text-red-400"><ArrowDown className="h-3 w-3" aria-hidden /> Off</span>
          <PlayerFace player={out} size={52} />
          <span className="max-w-full truncate text-sm font-semibold text-foreground">{out.lastName}</span>
          <span className="text-micro tabular-nums text-muted-foreground">{out.position} · {out.overall} · {Math.round(outEnergy)}%</span>
        </motion.div>

        <motion.div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-primary"
          animate={done ? { rotate: reducedMotion ? 0 : 180, scale: reducedMotion ? 1 : [1, 1.25, 1] } : { rotate: 0 }}
          transition={{ duration: 0.45 }}
        >
          {done ? <Check className="h-4 w-4" aria-hidden /> : <span className="text-sm font-bold">⇄</span>}
        </motion.div>

        <motion.div
          className="flex flex-1 flex-col items-center gap-1 text-center"
          animate={move ? { y: [0, -8, 0], scale: [1, 1.08, 1] } : { y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <span className="inline-flex items-center gap-1 text-micro font-bold uppercase tracking-wider text-emerald-400"><ArrowUp className="h-3 w-3" aria-hidden /> On</span>
          <div className={cn('rounded-xl', done && 'shadow-[0_0_18px_rgba(16,185,129,0.55)]')}>
            <PlayerFace player={incoming} size={52} />
          </div>
          <span className="max-w-full truncate text-sm font-semibold text-foreground">{incoming.lastName}</span>
          <span className="text-micro tabular-nums text-muted-foreground">{incoming.position} · {incoming.overall} · {Math.round(incoming.fitness)}%</span>
        </motion.div>
      </div>

      {/* What changes — two numbers and the fit, nothing else. */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <Delta label="Rating" value={ovrDiff} />
        <Delta label="Energy" value={energyDiff} suffix="%" />
        <span className={cn('rounded-full border px-2 py-0.5 text-micro font-semibold', FIT_LABEL[fit].className)}>{FIT_LABEL[fit].text}</span>
      </div>
    </div>
  );
}

function Delta({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  const tone = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-muted-foreground';
  return (
    <span className="rounded-full border border-border/40 bg-muted/20 px-2 py-0.5 text-micro font-semibold text-muted-foreground">
      {label} <span className={cn('tabular-nums', tone)}>{value > 0 ? `+${value}` : value === 0 ? '±0' : value}{suffix}</span>
    </span>
  );
}
