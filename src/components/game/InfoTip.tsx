import { createContext, useContext, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Context: ensures only one InfoTip is open at a time ── */
interface InfoTipCtx {
  activeId: string | null;
  open: (id: string, fromKeyboard: boolean) => void;
  close: () => void;
  openedViaKeyboard: boolean;
}

const InfoTipContext = createContext<InfoTipCtx>({
  activeId: null,
  open: () => {},
  close: () => {},
  openedViaKeyboard: false,
});

export function InfoTipProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openedViaKeyboard, setOpenedViaKeyboard] = useState(false);
  const location = useLocation();

  const open = useCallback((id: string, fromKeyboard: boolean) => {
    setOpenedViaKeyboard(fromKeyboard);
    setActiveId(prev => (prev === id ? null : id));
  }, []);
  const close = useCallback(() => setActiveId(null), []);

  // Close on Escape
  useEffect(() => {
    if (!activeId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeId, close]);

  // Close on outside pointerdown
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

  // Close on route change (prevents orphan tooltips after navigation / swipe)
  const lastPath = useRef(location.pathname);
  useEffect(() => {
    if (lastPath.current !== location.pathname) {
      lastPath.current = location.pathname;
      close();
    }
  }, [location.pathname, close]);

  return (
    <InfoTipContext.Provider value={{ activeId, open, close, openedViaKeyboard }}>
      {children}
    </InfoTipContext.Provider>
  );
}

/* ── InfoTip component ── */
interface InfoTipProps {
  text: string;
  className?: string;
}

// z-stack: toasts (z-[100]) > InfoTip (z-80) > modals (z-50..60)
const TOOLTIP_Z = 80;
const TOOLTIP_WIDTH = 256;
const VIEWPORT_MARGIN = 12;
const TOOLTIP_OFFSET = 8;
const FLIP_THRESHOLD = 120;

interface Coords {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
}

function computeCoords(rect: DOMRect): Coords {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const maxWidth = Math.min(TOOLTIP_WIDTH, vw - VIEWPORT_MARGIN * 2);
  let left = rect.left + rect.width / 2 - maxWidth / 2;
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - maxWidth - VIEWPORT_MARGIN));

  const spaceBelow = vh - rect.bottom;
  const placement: 'top' | 'bottom' = spaceBelow < FLIP_THRESHOLD && rect.top > FLIP_THRESHOLD ? 'top' : 'bottom';
  const top = placement === 'bottom' ? rect.bottom + TOOLTIP_OFFSET : rect.top - TOOLTIP_OFFSET;

  return { top, left, placement };
}

function isRectInViewport(rect: DOMRect): boolean {
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
}

export function InfoTip({ text, className }: InfoTipProps) {
  const id = useId();
  const ctx = useContext(InfoTipContext);
  const isOpen = ctx.activeId === id;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const tooltipContentId = `infotip-${id.replace(/:/g, '-')}`;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // detail === 0 when triggered via keyboard (Enter/Space) rather than mouse/touch
    ctx.open(id, e.detail === 0);
  }, [ctx, id]);

  // Initial positioning + clear on close
  useLayoutEffect(() => {
    if (!isOpen) {
      setCoords(null);
      return;
    }
    if (!buttonRef.current) return;
    setCoords(computeCoords(buttonRef.current.getBoundingClientRect()));
  }, [isOpen]);

  // Reposition on scroll/resize — close only when button leaves the viewport
  useEffect(() => {
    if (!isOpen) return;
    const reposition = () => {
      const el = buttonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!isRectInViewport(rect)) {
        ctx.close();
        return;
      }
      setCoords(computeCoords(rect));
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen, ctx]);

  // Restore focus to trigger after keyboard-opened tip closes
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !isOpen && ctx.openedViaKeyboard) {
      buttonRef.current?.focus();
    }
    wasOpen.current = isOpen;
  }, [isOpen, ctx.openedViaKeyboard]);

  return (
    <span className={cn('inline-flex items-center', className)} data-infotip>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        className="inline-flex items-center justify-center w-6 h-6 -m-1 rounded-full bg-primary/10 hover:bg-primary/20 active:bg-primary/30 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        aria-label="More info"
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipContentId : undefined}
      >
        <Info className="w-3.5 h-3.5 text-primary/70" />
      </button>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && coords && (
            <motion.div
              data-infotip-popover
              id={tooltipContentId}
              role="tooltip"
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
                zIndex: TOOLTIP_Z,
              }}
              className="pointer-events-auto"
            >
              <div className="bg-popover/95 backdrop-blur-xl border border-border/80 rounded-xl px-3 py-2.5 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] max-h-[40vh] overflow-y-auto">
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
