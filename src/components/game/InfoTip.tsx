import { createContext, useContext, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

  useEffect(() => {
    if (!activeId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeId, close]);

  useEffect(() => {
    if (!activeId) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-infotip]') && !target.closest('[data-infotip-popover]')) close();
    };
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', onPointer, true);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [activeId, close]);

  useEffect(() => {
    if (!activeId) return;
    const onScrollOrResize = () => close();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
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

const TOOLTIP_WIDTH = 256;
const VIEWPORT_MARGIN = 12;
const TOOLTIP_OFFSET = 8;

export function InfoTip({ text, className }: InfoTipProps) {
  const id = useId();
  const ctx = useContext(InfoTipContext);
  const isOpen = ctx.activeId === id;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    ctx.open(id);
  }, [ctx, id]);

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const maxWidth = Math.min(TOOLTIP_WIDTH, vw - VIEWPORT_MARGIN * 2);
    let left = rect.left + rect.width / 2 - maxWidth / 2;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - maxWidth - VIEWPORT_MARGIN));

    const spaceBelow = vh - rect.bottom;
    const placement: 'top' | 'bottom' = spaceBelow < 120 && rect.top > 120 ? 'top' : 'bottom';
    const top = placement === 'bottom' ? rect.bottom + TOOLTIP_OFFSET : rect.top - TOOLTIP_OFFSET;

    setCoords({ top, left, placement });
  }, [isOpen]);

  return (
    <span className={cn('inline-flex items-center', className)} data-infotip>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        className="inline-flex items-center justify-center w-6 h-6 -m-1 rounded-full bg-primary/10 hover:bg-primary/20 active:bg-primary/30 transition-colors shrink-0"
        aria-label="More info"
        aria-expanded={isOpen}
      >
        <Info className="w-3.5 h-3.5 text-primary/70" />
      </button>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && coords && (
            <motion.div
              data-infotip-popover
              initial={{ opacity: 0, y: coords.placement === 'bottom' ? -4 : 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: coords.placement === 'bottom' ? -4 : 4, scale: 0.98 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                top: coords.placement === 'bottom' ? coords.top : undefined,
                bottom: coords.placement === 'top' ? window.innerHeight - coords.top : undefined,
                left: coords.left,
                width: Math.min(TOOLTIP_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2),
                zIndex: 60,
              }}
              className="pointer-events-auto"
            >
              <div className="bg-popover/95 backdrop-blur-xl border border-border/80 rounded-xl px-3 py-2.5 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)]">
                <p className="text-[11px] text-foreground/90 leading-relaxed">{text}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </span>
  );
}
