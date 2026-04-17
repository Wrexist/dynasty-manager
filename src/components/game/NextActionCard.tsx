import { motion } from 'framer-motion';
import { ChevronRight, AlertTriangle, Users, Calendar, Trophy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ElementType } from 'react';

interface NextActionProps {
  icon: ElementType;
  label: string;
  title: string;
  description: string;
  onClick: () => void;
  urgent?: boolean;
  className?: string;
}

export function NextActionCard({ icon: Icon, label, title, description, onClick, urgent, className }: NextActionProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'w-full text-left rounded-xl px-3 py-3 border flex items-center gap-3 transition-all active:scale-[0.98]',
        urgent
          ? 'bg-destructive/10 border-destructive/40 hover:bg-destructive/15'
          : 'bg-primary/10 border-primary/40 hover:bg-primary/15',
        className
      )}
    >
      <div className={cn(
        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
        urgent ? 'bg-destructive/20' : 'bg-primary/20'
      )}>
        <Icon className={cn('w-4 h-4', urgent ? 'text-destructive' : 'text-primary')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-[10px] uppercase tracking-wider font-bold mb-0.5', urgent ? 'text-destructive/80' : 'text-primary/80')}>
          {label}
        </p>
        <p className="text-sm font-bold text-foreground leading-tight">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
      <ChevronRight className={cn('w-4 h-4 shrink-0', urgent ? 'text-destructive/60' : 'text-primary/60')} />
    </motion.button>
  );
}

export { AlertTriangle, Users, Calendar, Trophy, RefreshCw };
