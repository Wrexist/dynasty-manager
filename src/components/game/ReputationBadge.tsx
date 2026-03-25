import { cn } from '@/lib/utils';
import type { ReputationTier } from '@/types/game';
import { getReputationTierLabel, getReputationColor } from '@/utils/managerCareer';

interface ReputationBadgeProps {
  tier: ReputationTier;
  score?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function ReputationBadge({ tier, score, size = 'sm', className }: ReputationBadgeProps) {
  const label = getReputationTierLabel(tier);
  const colorClass = getReputationColor(tier);

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-semibold border',
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
      colorClass,
      'border-current/20 bg-current/10',
      className,
    )}>
      {label}
      {score !== undefined && (
        <span className="opacity-60">({score})</span>
      )}
    </span>
  );
}
