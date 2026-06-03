import { motion, useReducedMotion } from 'framer-motion';
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
  const reduce = useReducedMotion();
  const body = (
    <div className={cn('text-center', variant === 'panel' ? 'p-6' : 'py-6', className)}>
      {Icon && (
        <motion.div
          className="relative w-12 h-12 mx-auto mb-3 flex items-center justify-center"
          initial={reduce ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20 }}
        >
          {/* Soft glow behind the icon so the empty state reads as an
              intentional, designed moment rather than a bare dead-end. */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, hsl(var(--primary) / 0.12) 0%, transparent 68%)',
              filter: 'blur(6px)',
            }}
          />
          <Icon className="relative w-10 h-10 text-muted-foreground/40" aria-hidden="true" />
        </motion.div>
      )}
      <motion.p
        className="text-sm text-muted-foreground"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.3, delay: 0.08 }}
      >
        {title}
      </motion.p>
      {description && (
        <motion.p
          className="text-xs text-muted-foreground/60 mt-1 max-w-xs mx-auto"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.3, delay: 0.14 }}
        >
          {description}
        </motion.p>
      )}
      {action && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.3, delay: 0.2 }}
        >
          <Button
            type="button"
            variant={action.variant ?? 'secondary'}
            size="sm"
            className="mt-4 h-11"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        </motion.div>
      )}
    </div>
  );

  if (variant === 'plain') return body;
  return <GlassPanel className="overflow-hidden">{body}</GlassPanel>;
}
