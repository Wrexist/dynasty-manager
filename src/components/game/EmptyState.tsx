import { cn } from '@/lib/utils';
import { GlassPanel } from '@/components/game/GlassPanel';
import { AssetImage } from '@/components/game/AssetImage';
import type { ElementType } from 'react';
import type { AssetEntry } from '@/assets/manifest';
import { motion } from 'framer-motion';

interface Action {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

interface EmptyStateProps {
  icon: ElementType;
  /** Optional illustration asset. When present, replaces the Lucide icon. */
  illustration?: AssetEntry;
  title: string;
  body: string;
  actions?: Action[];
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, illustration, title, body, actions, className, compact }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <GlassPanel className={cn(compact ? 'p-5' : 'p-8', 'text-center space-y-3', className)}>
        {illustration ? (
          <AssetImage
            entry={illustration}
            className={cn('mx-auto opacity-80', compact ? 'w-20 h-14' : 'w-32 h-24')}
            fallbackClassName={cn('mx-auto text-muted-foreground/40', compact ? 'w-8 h-8' : 'w-10 h-10')}
          />
        ) : (
          <Icon className={cn('mx-auto text-muted-foreground/40', compact ? 'w-8 h-8' : 'w-10 h-10')} />
        )}
        <div className="space-y-1">
          <p className={cn('font-semibold text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>{title}</p>
          <p className={cn('text-muted-foreground/60', compact ? 'text-[10px]' : 'text-xs')}>{body}</p>
        </div>
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center pt-1">
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={a.onClick}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  a.primary
                    ? 'bg-primary/20 text-primary hover:bg-primary/30'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </GlassPanel>
    </motion.div>
  );
}
