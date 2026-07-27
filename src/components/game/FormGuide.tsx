import { cn } from '@/lib/utils';

interface FormGuideProps {
  form: ('W' | 'D' | 'L')[];
  size?: 'sm' | 'default';
  className?: string;
}

// Premium pips: vertical gradient + inner highlight + tinted glow.
const FORM_STYLE: Record<'W' | 'D' | 'L', React.CSSProperties> = {
  W: {
    background: 'linear-gradient(180deg, #6EE7B7 0%, #10B981 55%, #047857 100%)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.25), 0 0 6px rgba(16,185,129,0.55)',
    textShadow: '0 1px 1px rgba(0,0,0,0.45)',
  },
  D: {
    background: 'linear-gradient(180deg, #FDE68A 0%, #F59E0B 55%, #B45309 100%)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.25), 0 0 6px rgba(245,158,11,0.5)',
    textShadow: '0 1px 1px rgba(0,0,0,0.45)',
  },
  L: {
    background: 'linear-gradient(180deg, #FCA5A5 0%, #E11D48 55%, #9F1239 100%)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.25), 0 0 6px rgba(225,29,72,0.55)',
    textShadow: '0 1px 1px rgba(0,0,0,0.45)',
  },
};

const SIZE_CLASSES = {
  sm: 'w-3.5 h-3.5 text-[8px]',
  default: 'w-5 h-5 text-[9px]',
} as const;

const RESULT_WORD: Record<'W' | 'D' | 'L', string> = { W: 'Win', D: 'Draw', L: 'Loss' };

export function FormGuide({ form, size = 'default', className }: FormGuideProps) {
  if (form.length === 0) return null;
  // Without a role + name this read as an unlabelled letter salad ("W D L L W")
  // with no indication of what it was. `role="img"` names the whole strip and
  // suppresses the individual pips.
  return (
    <div
      role="img"
      aria-label={`Recent form: ${form.map(r => RESULT_WORD[r]).join(', ')}`}
      className={cn('flex items-center', size === 'sm' ? 'gap-0.5' : 'gap-1', className)}
    >
      {form.map((r, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            'rounded-full inline-flex items-center justify-center font-bold text-white leading-none',
            SIZE_CLASSES[size],
          )}
          style={FORM_STYLE[r]}
        >
          {r}
        </span>
      ))}
    </div>
  );
}
