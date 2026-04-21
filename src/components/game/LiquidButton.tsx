import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

export type LiquidButtonTone = 'default' | 'primary' | 'amber' | 'destructive';

interface LiquidButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  /** Visual treatment. `primary` is the gold CTA; `amber`/`destructive` are
   *  warning / danger variants; `default` is a neutral glass capsule. */
  tone?: LiquidButtonTone;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  type?: 'button' | 'submit';
  /** Fire hapticLight() on press (mobile). Default true. */
  haptic?: boolean;
}

/**
 * Apple-style liquid-glass capsule button — the project-wide button primitive
 * for anywhere we want the unified glass look. Use this in place of the bare
 * shadcn `<Button>` for buttons inside glass surfaces.
 *
 * Why not a Button variant? Modifying `src/components/ui/button.tsx` is
 * explicitly out of scope per CLAUDE.md. This component composes the glass
 * treatment at the game-layer instead, so the shadcn primitive stays clean
 * for contexts that want the plain shadcn look.
 */
export function LiquidButton({
  children,
  onClick,
  tone = 'default',
  disabled,
  className,
  'aria-label': ariaLabel,
  type = 'button',
  haptic = true,
}: LiquidButtonProps) {
  const toneClasses: Record<LiquidButtonTone, string> = {
    default:
      'bg-white/[0.06] text-foreground/90 border-white/15 hover:bg-white/10 ' +
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.32),inset_0_-1px_0_rgba(0,0,0,0.3),0_6px_16px_-8px_rgba(0,0,0,0.5)]',
    primary:
      'bg-gradient-to-b from-primary/95 to-primary/75 text-primary-foreground border-primary/40 hover:from-primary hover:to-primary/80 ' +
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(0,0,0,0.35),0_10px_22px_-8px_hsl(43_96%_46%/0.55)]',
    amber:
      'bg-amber-400/10 text-amber-200 border-amber-400/35 hover:bg-amber-400/15 ' +
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.3),0_6px_16px_-8px_rgba(0,0,0,0.45)]',
    destructive:
      'bg-destructive/15 text-red-300 border-destructive/35 hover:bg-destructive/20 ' +
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.35),0_6px_16px_-8px_rgba(0,0,0,0.45)]',
  };

  const handleClick = () => {
    if (disabled) return;
    if (haptic) hapticLight();
    onClick?.();
  };

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'relative w-full h-11 rounded-2xl font-semibold text-sm border backdrop-blur-xl backdrop-saturate-150',
        'active:scale-[0.98] transition-transform',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        disabled && 'opacity-50 cursor-not-allowed',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}
