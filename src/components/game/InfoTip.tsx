import { createContext, useContext, useCallback, useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Context: ensures only one InfoTip is open at a time ── */
interface InfoTipCtx {
  activeId: string | null;
  open: (id: string) => void;
  close: () => void;
}

const InfoTipContext = createContext<InfoTipCtx>({
  activeId: null,
  open: () => {},
  close: () => {},
});

export function InfoTipProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const open = useCallback((id: string) => setActiveId(prev => (prev === id ? null : id)), []);
  const close = useCallback(() => setActiveId(null), []);

  // Close on Escape key
  useEffect(() => {
    if (!activeId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeId, close]);

  // Close when tapping outside any InfoTip
  useEffect(() => {
    if (!activeId) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-infotip]')) close();
    };
    // Use a timeout so the current click event doesn't immediately close the tooltip
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', onPointer, true);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [activeId, close]);

  return (
    <InfoTipContext.Provider value={{ activeId, open, close }}>
      {children}
    </InfoTipContext.Provider>
  );
}

/* ── InfoTip component ── */
interface InfoTipProps {
  text: string;
  className?: string;
}

export function InfoTip({ text, className }: InfoTipProps) {
  const id = useId();
  const ctx = useContext(InfoTipContext);
  const isOpen = ctx.activeId === id;
  const ref = useRef<HTMLSpanElement>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    ctx.open(id);
  }, [ctx, id]);

  return (
    <span ref={ref} className={cn('inline-flex flex-col', className)} data-infotip>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center justify-center w-6 h-6 -m-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
        aria-label="More info"
        aria-expanded={isOpen}
      >
        <Info className="w-3.5 h-3.5 text-primary/70" />
      </button>
      <AnimatePresence>
        {isOpen && (
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
