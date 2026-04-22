import { GlassPanel } from '@/components/game/GlassPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  /** Optional lucide icon rendered above the title. Muted + small. */
  icon?: LucideIcon;
  /** One-line primary message, e.g. "No players listed". */
  title: string;
  /** Supporting line explaining the next action the user can take. */
  description?: string;
  /**
   * Optional call-to-action. When provided, renders as a secondary button
   * below the description — use for things like "Retry", "Go to Dashboard",
   * "Hire a Scout".
   */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  };
  /**
   * When "plain" the state renders without the GlassPanel wrapper — use when
   * the caller already sits inside a panel (e.g. inside a tabbed card) and
   * you want just the centered text + icon.
   */
  variant?: 'panel' | 'plain';
  className?: string;
}

/**
 * Shared empty-state surface for list views across the app.
 * Matches the dark glass aesthetic: soft card background, muted icon at
 * 30% opacity, two-line copy (what + suggested next action), optional CTA.
 *
 * Use for: no transfer listings, no scouting activity, no match history,
 * empty inbox filter, no trophies yet, etc. Prefer this over ad-hoc
 * GlassPanel + <p> combinations so copy + spacing stays consistent.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'panel',
  className,
}: EmptyStateProps) {
  const body = (
    <div className={cn('text-center', variant === 'panel' ? 'p-6' : 'py-6', className)}>
      {Icon && (
        <Icon
          className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3"
          aria-hidden="true"
        />
      )}
      <p className="text-sm text-muted-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs mx-auto">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant={action.variant ?? 'secondary'}
          size="sm"
          className="mt-4 h-11"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );

  if (variant === 'plain') return body;
  return <GlassPanel className="overflow-hidden">{body}</GlassPanel>;
}
