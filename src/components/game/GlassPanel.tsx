import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  'aria-label'?: string;
}

export function GlassPanel({ children, className, onClick, 'aria-label': ariaLabel }: GlassPanelProps) {
  const handleClick = onClick ? () => { hapticLight(); onClick(); } : undefined;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      hapticLight();
      onClick();
    }
  }, [onClick]);

  return (
    <div
      onClick={handleClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      className={cn(
        'bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl',
        onClick && 'cursor-pointer active:scale-[0.98] transition-transform focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none',
        className
      )}
    >
      {children}
    </div>
  );
}
