import { useRef, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

export interface LiquidGlassSliderOption<T> {
  value: T;
  label: string;
}

interface LiquidGlassSliderProps<T> {
  options: readonly LiquidGlassSliderOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Discrete liquid-glass slider used for tactical instructions.
 *
 * Snaps to the nearest option while dragging, supports click-to-jump on
 * labels, and keyboard arrows. Haptic pulse on every value change.
 */
export function LiquidGlassSlider<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: LiquidGlassSliderProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const n = options.length;
  const activeIndex = useMemo(() => {
    const idx = options.findIndex(o => o.value === value);
    return idx === -1 ? 0 : idx;
  }, [options, value]);

  const percent = n > 1 ? (activeIndex / (n - 1)) * 100 : 50;

  const indexFromClientX = useCallback((clientX: number): number => {
    const el = trackRef.current;
    if (!el || n <= 1) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, ratio));
    return Math.round(clamped * (n - 1));
  }, [n]);

  const commitIndex = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(n - 1, idx));
    const next = options[clamped].value;
    if (next !== value) {
      hapticLight();
      onChange(next);
    }
  }, [n, options, value, onChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    commitIndex(indexFromClientX(e.clientX));
  }, [commitIndex, indexFromClientX]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    commitIndex(indexFromClientX(e.clientX));
  }, [dragging, commitIndex, indexFromClientX]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      commitIndex(activeIndex - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      commitIndex(activeIndex + 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      commitIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      commitIndex(n - 1);
    }
  }, [activeIndex, commitIndex, n]);

  const springTransition = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.7 };

  return (
    <div className={cn('select-none', className)}>
      <div className="px-3">
        <div
          ref={trackRef}
          role="slider"
          aria-label={ariaLabel}
          aria-valuemin={0}
          aria-valuemax={n - 1}
          aria-valuenow={activeIndex}
          aria-valuetext={options[activeIndex]?.label}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
          className={cn(
            'relative h-9 touch-none cursor-pointer',
            'focus-visible:outline-none',
          )}
        >
          {/* Track groove — recessed glass */}
          <div
            aria-hidden
            className={cn(
              'absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full',
              'bg-[hsl(222_35%_6%/0.7)] border border-white/[0.04]',
              'shadow-[inset_0_1px_2px_rgba(0,0,0,0.55),inset_0_-1px_0_rgba(255,255,255,0.04)]',
            )}
          />

          {/* Filled portion — up to thumb center */}
          <motion.div
            aria-hidden
            className={cn(
              'absolute left-0 top-1/2 -translate-y-1/2 h-2 rounded-full',
              'bg-gradient-to-r from-primary/60 via-primary/90 to-primary',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_10px_hsl(var(--primary)/0.35)]',
            )}
            animate={{ width: `${percent}%` }}
            transition={dragging ? { duration: 0 } : springTransition}
          />

          {/* Tick marks */}
          {options.map((_, i) => {
            const p = n > 1 ? (i / (n - 1)) * 100 : 50;
            const filled = i <= activeIndex;
            return (
              <div
                key={i}
                aria-hidden
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[3px] h-[3px] rounded-full pointer-events-none transition-colors',
                  filled ? 'bg-white/70' : 'bg-white/15',
                )}
                style={{ left: `${p}%` }}
              />
            );
          })}

          {/* Thumb — liquid glass bead */}
          <motion.div
            aria-hidden
            className={cn(
              'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full',
              'bg-gradient-to-br from-white/95 via-white/85 to-white/65',
              'border border-white/70',
              'shadow-[0_2px_6px_rgba(0,0,0,0.55),0_0_16px_hsl(var(--primary)/0.55),inset_0_1px_1px_rgba(255,255,255,0.95),inset_0_-2px_2px_rgba(0,0,0,0.18)]',
            )}
            animate={{
              left: `${percent}%`,
              width: dragging ? 26 : 22,
              height: dragging ? 26 : 22,
            }}
            transition={dragging ? { left: { duration: 0 }, width: springTransition, height: springTransition } : springTransition}
          />
        </div>
      </div>

      {/* Labels row */}
      <div className="relative mt-2 h-4 text-[10px]">
        {options.map((o, i) => {
          const p = n > 1 ? (i / (n - 1)) * 100 : 50;
          const isActive = i === activeIndex;
          // Anchor edges: first label left-aligned, last right-aligned, middle centered.
          const alignClass =
            i === 0 ? 'translate-x-0' :
            i === n - 1 ? '-translate-x-full' :
            '-translate-x-1/2';
          return (
            <button
              type="button"
              key={String(o.value)}
              onClick={() => commitIndex(i)}
              className={cn(
                'absolute top-0 whitespace-nowrap font-medium transition-colors',
                'focus-visible:outline-none focus-visible:text-primary',
                alignClass,
                isActive ? 'text-primary' : 'text-muted-foreground/70 hover:text-foreground',
              )}
              style={{ left: `${p}%` }}
              tabIndex={-1}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
