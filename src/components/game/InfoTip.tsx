import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfoTipProps {
  text: string;
  className?: string;
}

export function InfoTip({ text, className }: InfoTipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className={cn('inline-flex flex-col', className)}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="inline-flex items-center justify-center w-6 h-6 -m-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
        aria-label="More info"
        aria-expanded={open}
      >
        <Info className="w-2.5 h-2.5 text-primary/70" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="bg-primary/5 border border-primary/10 rounded-lg px-3 py-2 mt-1.5">
              <p className="text-[11px] text-primary/80 leading-relaxed">{text}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
