import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { PackTierKey, Player } from '@/types/game';
import { MAX_WALKOUTS_PER_PACK, PACK_ANIM, PACK_TIER_MAP, WALKOUT_OVR_THRESHOLD } from '@/config/packs';
import { useScrollLock } from '@/hooks/useScrollLock';
import { hapticHeavy, hapticLight, hapticMedium } from '@/utils/haptics';
import { PackArt } from './PackArt';
import { PackCard } from './PackCard';
import { PackConfetti } from './PackConfetti';
import { WalkoutReveal } from './WalkoutReveal';
import { tierForOvr } from './packHelpers';

interface PackOpeningOverlayProps {
  tier: PackTierKey;
  players: Player[];
  pityTriggered?: boolean;
  onClose: () => void;
  /** When provided, summary cards render a × quick-release action. */
  onDismiss?: (playerId: string) => void;
}

type Phase = 'portal' | 'arrival' | 'charge' | 'explode' | 'reveal' | 'walkout' | 'summary';

/**
 * Full-screen pack-opening sequence. Orchestrates six beats:
 *   1. Portal open (backdrop + vignette)
 *   2. Pack arrival (fly-in)
 *   3. Charge (shake + glow leaks, tier-hinted color)
 *   4. Explosion (burst + shockwave + confetti)
 *   5. Reveal queue (cards flip; walkout for 84+)
 *   6. Summary grid
 *
 * Mounts a portal so the overlay sits above bottom nav and other UI.
 */
export function PackOpeningOverlay({ tier, players, pityTriggered, onClose, onDismiss }: PackOpeningOverlayProps) {
  const tierDef = PACK_TIER_MAP[tier];
  const [phase, setPhase] = useState<Phase>('portal');
  const [revealedSet, setRevealedSet] = useState<Set<string>>(new Set());
  const [walkoutQueue, setWalkoutQueue] = useState<Player[]>([]);
  const [currentWalkout, setCurrentWalkout] = useState<Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Linger timer between walkouts. Held in a ref so rapid double-complete
  // (child finish + Escape) can't slice the queue twice, and so it gets
  // cleared on unmount.
  const walkoutLingerTimerRef = useRef<number | null>(null);
  const walkoutAdvancingRef = useRef(false);

  useScrollLock(true);

  // Unmount cleanup for the linger timer.
  useEffect(() => () => {
    if (walkoutLingerTimerRef.current !== null) {
      window.clearTimeout(walkoutLingerTimerRef.current);
      walkoutLingerTimerRef.current = null;
    }
  }, []);

  // Auto-close once the user has dismissed every card from the summary.
  // Without this they're left staring at "Added to Squad" with no cards.
  useEffect(() => {
    if (phase === 'summary' && players.length === 0) {
      onClose();
    }
  }, [phase, players.length, onClose]);

  // Focus trap. Modal overlays must contain Tab so keyboard users don't
  // wander back into the locked-out main UI. Focuses the container on
  // mount and wraps Tab/Shift+Tab around interactive descendants.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const prevActive = document.activeElement as HTMLElement | null;
    root.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusables.length === 0) { e.preventDefault(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Restore focus to whatever was active before the overlay opened.
      if (prevActive && typeof prevActive.focus === 'function') {
        prevActive.focus();
      }
    };
  }, []);

  const topOvr = useMemo(() => players.reduce((m, p) => Math.max(m, p.overall), 0), [players]);
  const topTier = useMemo(() => tierForOvr(topOvr), [topOvr]);
  const confettiCount = topOvr >= 90
    ? PACK_ANIM.confetti.icon
    : topOvr >= 84 ? PACK_ANIM.confetti.legendary
    : topOvr >= 75 ? PACK_ANIM.confetti.gold
    : PACK_ANIM.confetti.silver;

  const chargeLength = PACK_ANIM.chargeBaseMs + (
    topOvr >= 90 ? 900
    : topOvr >= 84 ? 600
    : topOvr >= 75 ? 300 : 0
  );

  // Beat orchestration
  useEffect(() => {
    if (phase !== 'portal') return;
    hapticLight();
    const t1 = window.setTimeout(() => { setPhase('arrival'); hapticLight(); }, PACK_ANIM.portalOpenMs);
    return () => window.clearTimeout(t1);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'arrival') return;
    // Auto-advance to charge after a brief float pause
    const t = window.setTimeout(() => setPhase('charge'), PACK_ANIM.arrivalMs + 300);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'charge') return;
    // Charging rumble pulse
    const rumbleInterval = window.setInterval(() => hapticMedium(), 180);
    const t = window.setTimeout(() => {
      window.clearInterval(rumbleInterval);
      setPhase('explode');
      hapticHeavy();
    }, chargeLength);
    return () => { window.clearInterval(rumbleInterval); window.clearTimeout(t); };
  }, [phase, chargeLength]);

  useEffect(() => {
    if (phase !== 'explode') return;
    const t = window.setTimeout(() => setPhase('reveal'), PACK_ANIM.explodeMs + 200);
    return () => window.clearTimeout(t);
  }, [phase]);

  // When all cards are revealed, drain walkout queue then advance to summary
  useEffect(() => {
    if (phase !== 'reveal') return;
    const allRevealed = players.every(p => revealedSet.has(p.id));
    if (!allRevealed) return;
    // Cap the walkout queue to the most-impactful pull(s). Rare Gold packs
    // can yield 3+ cards above the walkout threshold; playing all of them
    // back-to-back becomes ~25s of cinematic the user can't really skip.
    // Sort by OVR desc, take the top N (default 1) — every other 84+ pull
    // still gets a "Rare" badge on its standard flip.
    const pendingWalkouts = players
      .filter(p => p.overall >= WALKOUT_OVR_THRESHOLD)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, MAX_WALKOUTS_PER_PACK);
    if (pendingWalkouts.length > 0) {
      setWalkoutQueue(pendingWalkouts);
      setCurrentWalkout(pendingWalkouts[0]);
      setPhase('walkout');
    } else {
      setPhase('summary');
    }
  }, [phase, revealedSet, players]);

  // Drain walkouts one at a time
  useEffect(() => {
    if (phase !== 'walkout') return;
    if (!currentWalkout && walkoutQueue.length === 0) {
      setPhase('summary');
    }
  }, [phase, currentWalkout, walkoutQueue.length]);

  const onWalkoutComplete = useCallback(() => {
    // Guard: both the child walkout AND the Escape handler can call this.
    // Without this flag, two rapid calls would slice the queue twice and
    // skip a walkout entirely.
    if (walkoutAdvancingRef.current) return;
    walkoutAdvancingRef.current = true;

    setCurrentWalkout(null);
    setWalkoutQueue(prev => {
      const next = prev.slice(1);
      // Clear any stale scheduled advance before booking the new one.
      if (walkoutLingerTimerRef.current !== null) {
        window.clearTimeout(walkoutLingerTimerRef.current);
      }
      walkoutLingerTimerRef.current = window.setTimeout(() => {
        walkoutLingerTimerRef.current = null;
        walkoutAdvancingRef.current = false;
        if (next.length > 0) setCurrentWalkout(next[0]);
        else setPhase('summary');
      }, PACK_ANIM.walkout.lingerMs);
      return next;
    });
  }, []);

  const revealOne = useCallback((id: string) => {
    setRevealedSet(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Allow tap-to-reveal-all during reveal phase
  const revealAll = useCallback(() => {
    setRevealedSet(new Set(players.map(p => p.id)));
  }, [players]);

  // Keyboard: Escape does phase-appropriate things so users never get stuck.
  //   reveal  → fast-reveal every card (same as "Tap all to reveal")
  //   walkout → skip the current walkout and move to the next / summary
  //   summary → close the overlay
  // Portal/arrival/charge/explode are short animations — we let them finish.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (phase === 'reveal') { revealAll(); return; }
      if (phase === 'walkout') { onWalkoutComplete(); return; }
      if (phase === 'summary') { onClose(); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose, revealAll, onWalkoutComplete]);

  const overlay = (
    <motion.div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Opening ${tierDef.label}`}
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden focus:outline-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(16px)' }}
    >
      {/* Vignette pulse on portal open */}
      <AnimatePresence>
        {phase === 'portal' && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 50%, transparent 30%, color-mix(in srgb, ${tierDef.accent} 20%, transparent) 100%)` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.4] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
          />
        )}
      </AnimatePresence>

      {/* Vertical light slit on portal open */}
      <AnimatePresence>
        {phase === 'portal' && (
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[3px] rounded-full pointer-events-none"
            style={{ height: '70vh', background: `linear-gradient(180deg, transparent, ${tierDef.accent}, transparent)` }}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: PACK_ANIM.portalOpenMs / 1000, type: 'spring', stiffness: 260, damping: 22 }}
          />
        )}
      </AnimatePresence>

      {/* The pack itself — visible during arrival + charge + fade on explode */}
      <AnimatePresence>
        {(phase === 'arrival' || phase === 'charge') && (
          <motion.div
            key="pack"
            className="relative flex flex-col items-center justify-center pointer-events-none"
            style={{ width: 220, height: 300 }}
            initial={{ opacity: 0, scale: 0.2, rotateY: 40, y: 120 }}
            animate={phase === 'charge' ? {
              opacity: 1, scale: 1, rotateY: 0, y: 0,
              x: [0, -4, 4, -6, 6, -8, 8, -10, 10, -8, 8, -6, 6, -4, 4, 0],
            } : {
              opacity: 1, scale: 1, rotateY: 0, y: 0,
            }}
            exit={{ opacity: 0, scale: 1.3 }}
            transition={phase === 'charge'
              ? { x: { duration: 0.35, repeat: Infinity, ease: 'linear' } }
              : { type: 'spring', stiffness: 240, damping: 18 }
            }
          >
            {/* Floor shadow */}
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 -bottom-4 w-40 h-4 rounded-full bg-black/70"
              style={{ filter: 'blur(12px)' }}
              initial={{ opacity: 0, scaleX: 0.4 }}
              animate={{ opacity: 0.8, scaleX: 1 }}
              transition={{ duration: 0.5 }}
            />

            {/* Pack body */}
            <div
              className="relative w-full h-full rounded-2xl overflow-hidden border border-white/15 shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
              style={{ background: `linear-gradient(160deg, ${tierDef.gradientFrom}, ${tierDef.gradientTo})` }}
            >
              {/* AI cover art (when present) — sits beneath the gloss/border
                  overlays so the gradient frame still reads as the "pack". */}
              {tierDef.artSrc && (
                <PackArt
                  src={tierDef.artSrc}
                  loading="eager"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                  fallback={null}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40" />
              <div className="absolute inset-3 rounded-xl border border-white/25" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white px-4 text-center">
                <span className="text-[10px] uppercase tracking-[0.35em] font-semibold opacity-80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">Dynasty Pack</span>
                <span className="text-3xl font-display font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">{tierDef.label}</span>
                <span className="text-[11px] opacity-80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">{tierDef.cards} Players</span>
              </div>

              {/* Glow leaks during charge — color tells the rarity story */}
              <AnimatePresence>
                {phase === 'charge' && (
                  <motion.div
                    key="leaks"
                    className="absolute inset-0 mix-blend-screen pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at 30% 40%, ${topTier.gradientVia}cc, transparent 40%),
                                   radial-gradient(circle at 70% 60%, ${topTier.gradientTo}cc, transparent 45%),
                                   radial-gradient(circle at 50% 20%, ${topTier.gradientFrom}aa, transparent 50%)`,
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.9, 0.7, 1] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: chargeLength / 1000, ease: 'easeIn' }}
                  />
                )}
              </AnimatePresence>

              {/* Continuous shimmer sweep on arrival */}
              {phase === 'arrival' && (
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)' }}
                  initial={{ x: '-100%' }}
                  animate={{ x: '120%' }}
                  transition={{ duration: 1.2, ease: 'easeInOut', repeat: Infinity }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ambient floating motes — during arrival/charge */}
      {(phase === 'arrival' || phase === 'charge') && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => {
            const x = 30 + Math.random() * 40;
            const rise = 180 + Math.random() * 260;
            const duration = 2.5 + Math.random() * 2;
            const delay = Math.random() * 1.2;
            const size = 2 + Math.random() * 3;
            return (
              <motion.span
                key={i}
                className="absolute rounded-full"
                style={{
                  width: size, height: size, left: `${x}%`, bottom: '20%',
                  background: tierDef.accent,
                  filter: 'blur(0.5px)',
                  willChange: 'transform, opacity',
                }}
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: [0, 0.9, 0], y: -rise }}
                transition={{ duration, delay, repeat: Infinity, ease: 'easeOut' }}
              />
            );
          })}
        </div>
      )}

      {/* Explosion — shockwave + flash + confetti */}
      <AnimatePresence>
        {phase === 'explode' && (
          <>
            <motion.div
              key="shockwave"
              className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
              style={{
                border: `3px solid ${tierDef.accent}`,
                translateX: '-50%', translateY: '-50%',
                boxShadow: `0 0 80px ${tierDef.accent}`,
              }}
              initial={{ width: 0, height: 0, opacity: 1 }}
              animate={{ width: '160vmax', height: '160vmax', opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.div
              key="flash"
              className="absolute inset-0 bg-white pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.25, 0] }}
              transition={{ duration: 0.18 }}
            />
            <PackConfetti count={confettiCount} hueBase={topOvr >= 90 ? 48 : topOvr >= 84 ? 35 : 43} hueRange={28} />
          </>
        )}
      </AnimatePresence>

      {/* Pity hit banner */}
      <AnimatePresence>
        {pityTriggered && (phase === 'reveal' || phase === 'summary') && (
          <motion.div
            className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/40 backdrop-blur"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            Pity Bonus Applied
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reveal grid */}
      {(phase === 'reveal' || phase === 'walkout' || phase === 'summary') && (
        <div className="relative w-full max-w-[min(92vw,480px)] px-4 flex flex-col items-center gap-4">
          <div className="flex flex-wrap justify-center gap-3">
            {players.map((p, i) => (
              <PackCard
                key={p.id}
                player={p}
                revealed={revealedSet.has(p.id) || phase === 'summary'}
                onReveal={phase === 'reveal' ? () => revealOne(p.id) : undefined}
                onDismiss={phase === 'summary' && onDismiss ? () => onDismiss(p.id) : undefined}
                entranceDelay={i * (PACK_ANIM.revealStaggerMs / 1000)}
              />
            ))}
          </div>

          {phase === 'reveal' && (
            <motion.button
              type="button"
              onClick={revealAll}
              className="text-[11px] uppercase tracking-widest text-white/60 hover:text-white transition-colors"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              Tap all to reveal
            </motion.button>
          )}

          {phase === 'summary' && (
            <motion.div
              className="w-full flex items-center gap-2 pt-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl font-display font-bold text-sm uppercase tracking-widest bg-primary text-primary-foreground shadow-[0_0_24px_hsl(var(--primary)/0.45)] active:scale-[0.98] transition-transform"
              >
                Added to Squad
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* Walkout overlay */}
      <AnimatePresence mode="wait">
        {phase === 'walkout' && currentWalkout && (
          <WalkoutReveal key={currentWalkout.id} player={currentWalkout} onComplete={onWalkoutComplete} />
        )}
      </AnimatePresence>
    </motion.div>
  );

  // Portal into document.body so we sit above everything
  if (typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
}
