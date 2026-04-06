import { cn } from '@/lib/utils';

interface FormGuideProps {
  form: ('W' | 'D' | 'L')[];
  className?: string;
}

const FORM_COLORS = {
  W: 'bg-emerald-500',
  D: 'bg-amber-500',
  L: 'bg-destructive',
} as const;

export function FormGuide({ form, className }: FormGuideProps) {
  if (form.length === 0) return null;
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {form.map((r, i) => (
        <span
          key={i}
          className={cn(
            'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white',
            FORM_COLORS[r]
          )}
        >
          {r}
        </span>
      ))}
    </div>
  );
}
