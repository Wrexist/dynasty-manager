import { cn } from '@/lib/utils';

interface FormGuideProps {
  form: ('W' | 'D' | 'L')[];
  size?: 'sm' | 'default';
  className?: string;
}

const FORM_COLORS = {
  W: 'bg-emerald-500',
  D: 'bg-amber-500',
  L: 'bg-destructive',
} as const;

const SIZE_CLASSES = {
  sm: 'w-3.5 h-3.5 text-[8px]',
  default: 'w-5 h-5 text-[9px]',
} as const;

export function FormGuide({ form, size = 'default', className }: FormGuideProps) {
  if (form.length === 0) return null;
  return (
    <div className={cn('flex items-center', size === 'sm' ? 'gap-0.5' : 'gap-1', className)}>
      {form.map((r, i) => (
        <span
          key={i}
          className={cn(
            'rounded-full flex items-center justify-center font-bold text-white',
            SIZE_CLASSES[size],
            FORM_COLORS[r]
          )}
        >
          {r}
        </span>
      ))}
    </div>
  );
}
