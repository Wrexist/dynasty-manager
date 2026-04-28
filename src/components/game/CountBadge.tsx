import { cn } from '@/lib/utils';

type Tone = 'red' | 'emerald' | 'primary' | 'sky';

interface CountBadgeProps {
  count: number;
  /** Cap value to show "9+", "99+", etc. */
  cap?: number;
  tone?: Tone;
  /** Pulse the badge — useful for "new" / "unread" attention pulls. */
  pulse?: boolean;
  /** Outer ring color — should match the surface the badge sits on. */
  ringColor?: string;
  className?: string;
}

const FILL: Record<Tone, string> = {
  red: 'linear-gradient(180deg, #FB7185 0%, #E11D48 60%, #9F1239 100%)',
  emerald: 'linear-gradient(180deg, #34D399 0%, #059669 60%, #065F46 100%)',
  primary: 'linear-gradient(180deg, hsl(43 96% 70%) 0%, hsl(43 96% 46%) 60%, hsl(35 80% 38%) 100%)',
  sky: 'linear-gradient(180deg, #7DD3FC 0%, #0284C7 60%, #075985 100%)',
};

const GLOW: Record<Tone, string> = {
  red: '0 0 8px rgba(239,68,68,0.7)',
  emerald: '0 0 8px rgba(16,185,129,0.65)',
  primary: '0 0 8px hsl(var(--primary)/0.6)',
  sky: '0 0 8px rgba(56,189,248,0.65)',
};

export function CountBadge({
  count,
  cap = 9,
  tone = 'red',
  pulse = false,
  ringColor = 'hsl(222 30% 7%)',
  className,
}: CountBadgeProps) {
  if (count <= 0) return null;
  const display = count > cap ? `${cap}+` : String(count);

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-bold tabular-nums leading-none text-white',
        'min-w-[16px] h-4 px-1 rounded-full',
        'text-[10px]',
        pulse && 'animate-pulse',
        className,
      )}
      style={{
        background: FILL[tone],
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.25), 0 0 0 1.5px ${ringColor}, ${GLOW[tone]}`,
        textShadow: '0 1px 1px rgba(0,0,0,0.4)',
      }}
    >
      {display}
    </span>
  );
}
