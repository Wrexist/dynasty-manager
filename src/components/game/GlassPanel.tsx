import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function GlassPanel({ children, className, onClick }: GlassPanelProps) {
  const handleClick = onClick ? () => { hapticLight(); onClick(); } : undefined;

  return (
    <div
      onClick={handleClick}
      className={cn(
        'bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl',
        onClick && 'cursor-pointer active:scale-[0.98] transition-transform',
        className
      )}
    >
      {children}
    </div>
  );
}
