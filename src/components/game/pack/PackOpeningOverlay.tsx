import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { PackPlayerPlacement, PackTierKey, Player } from '@/types/game';
import { MAX_WALKOUTS_PER_PACK, PACK_ANIM, PACK_TIER_MAP, WALKOUT_OVR_THRESHOLD } from '@/config/packs';
import { useScrollLock } from '@/hooks/useScrollLock';
import { hapticHeavy, hapticLight, hapticMedium } from '@/utils/haptics';
import { formatMoney } from '@/utils/helpers';
import { PLAYER_CARD_SIZE_PX } from '@/components/game/PlayerCard';
import { PackArt } from './PackArt';
import { PackCard } from './PackCard';
import { PackConfetti } from './PackConfetti';
import { PackStadium } from './PackStadium';
import { WalkoutReveal } from './WalkoutReveal';
import { tierForOvr } from './packHelpers';
import { cn } from '@/lib/utils';

/** Quick-sell refund rate — matches packsSlice.quickSellPackedPlayer. */
const QUICK_SELL_RATE = 0.65;

interface PackOpeningOverlayProps {
  tier: PackTierKey;
  players: Player[];
  pityTriggered?: boolean;
  onClose: () => void;
  /** Keep the pulled player — just removes them from the summary view. */
  onKeep?: (playerId: string) => void;
  /** Quick-sell the pulled player at {@link QUICK_SELL_RATE} of market value. */
  onQuickSell?: (playerId: string) => void;
  /** Bulk-keep every remaining player in the summary. */
  onKeepAll?: () => void;
  /** Bulk quick-sell every remaining player in the summary. */
  onSellAll?: () => void;
  /** Per-player placement map from openPack so the reveal modal can badge pulls. */
  placement?: Record<string, PackPlayerPlacement>;
}

type Phase = 'loading' | 'portal' | 'arrival' | 'charge' | 'explode' | 'reveal' | 'walkout' | 'summary';

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
export function PackOpeningOverlay({ tier, players, pityTriggered, onClose, onKeep, onQuickSell, onKeepAll, onSellAll }: PackOpeningOverlayProps) {
  const tierDef = PACK_TIER_MAP[tier];
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('loading');
  const [revealedSet, setRevealedSet] = useState<Set<string>>(new Set());
  const [walkoutQueue, setWalkoutQueue] = useState<Player[]>([]);
  const [currentWalkout, setCurrentWalkout] = useState<Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Charge-phase scheduling lives in refs so a user tap-to-rip can cancel
  // the auto-advance timer/interval without depending on stale state.
  const chargeTimerRef = useRef<number | null>(null);
  const chargeRumbleRef = useRef<number | null>(null);
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

  // Foil-shred params — generated once per explode entry. Inlining the
  // randoms in the .map() would re-roll them on any re-render during the
  // ~0.7s burst, retargeting in-flight Framer Motion animations mid-flight.
  const foilShreds = useMemo(() => {
    if (phase !== 'explode' || prefersReducedMotion) return [];
    return Array.from({ length: 18 }).map((_, i) => {
      const angle = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const distance = 220 + Math.random() * 200;
      return {
        i,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        w: 6 + Math.random() * 8,
        h: 2 + Math.random() * 3,
        rot: (Math.random() - 0.5) * 720,
        duration: 0.7 + Math.random() * 0.4,
      };
    });
  }, [phase, prefersReducedMotion]);

  // Beat orchestration
  // Cinematic "opening…" beat — the dimmed stadium + a luxury loading ring
  // play for ~1s before the pack scene, building anticipation.
  useEffect(() => {
    if (phase !== 'loading') return;
    hapticLight();
    const t = window.setTimeout(() => setPhase('portal'), PACK_ANIM.loadingMs);
    return () => window.clearTimeout(t);
  }, [phase]);

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
    // Charging rumble pulse — held in refs so a tap-to-rip can cancel
    // the same scheduling without resetting effect state.
    chargeRumbleRef.current = window.setInterval(() => hapticMedium(), 180);
    chargeTimerRef.current = window.setTimeout(() => {
      if (chargeRumbleRef.current !== null) window.clearInterval(chargeRumbleRef.current);
      chargeRumbleRef.current = null;
      chargeTimerRef.current = null;
      setPhase('explode');
      hapticHeavy();
    }, chargeLength);
    return () => {
      if (chargeRumbleRef.current !== null) window.clearInterval(chargeRumbleRef.current);
      if (chargeTimerRef.current !== null) window.clearTimeout(chargeTimerRef.current);
      chargeRumbleRef.current = null;
      chargeTimerRef.current = null;
    };
  }, [phase, chargeLength]);

  // Tap-to-rip: short-circuits the charge timer so users can drive the
  // payoff themselves instead of watching the pack auto-shake. Only valid
  // during arrival/charge; ignored at every other beat.
  const tapToRip = useCallback(() => {
    if (phase !== 'arrival' && phase !== 'charge') return;
    if (chargeRumbleRef.current !== null) {
      window.clearInterval(chargeRumbleRef.current);
      chargeRumbleRef.current = null;
    }
    if (chargeTimerRef.current !== null) {
      window.clearTimeout(chargeTimerRef.current);
      chargeTimerRef.current = null;
    }
    hapticHeavy();
    setPhase('explode');
  }, [phase]);

  useEffect(() => {
    if (phase !== 'explode') return;
    const t = window.setTimeout(() => setPhase('reveal'), PACK_ANIM.explodeMs + 200);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Players destined for a walkout cinematic stay face-down through the
  // reveal phase — tapping them in the grid would spoil the cinematic. We
  // compute the walkout set once per render based on the same priority
  // rule used when queueing (top-N by OVR above threshold).
  const walkoutPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    players
      .filter(p => p.overall >= WALKOUT_OVR_THRESHOLD)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, MAX_WALKOUTS_PER_PACK)
      .forEach(p => ids.add(p.id));
    return ids;
  }, [players]);

  // When all non-walkout cards are revealed, drain walkout queue then
  // advance to summary. The walkout-tier cards stay face-down here and
  // are revealed exclusively via the cinematic, then displayed face-up
  // in summary via the `phase === 'summary'` fallback on PackCard.
  useEffect(() => {
    if (phase !== 'reveal') return;
    const tappableRevealed = players
      .filter(p => !walkoutPlayerIds.has(p.id))
      .every(p => revealedSet.has(p.id));
    if (!tappableRevealed) return;
    const pendingWalkouts = players
      .filter(p => walkoutPlayerIds.has(p.id))
      .sort((a, b) => b.overall - a.overall);
    if (pendingWalkouts.length > 0) {
      setWalkoutQueue(pendingWalkouts);
      setCurrentWalkout(pendingWalkouts[0]);
      setPhase('walkout');
    } else {
      setPhase('summary');
    }
  }, [phase, revealedSet, players, walkoutPlayerIds]);

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

  // Allow tap-to-reveal-all during reveal phase. Walkout-tier cards are
  // excluded so the cinematic still plays for them — the parent effect
  // detects "all tappable revealed" and transitions to walkout.
  const revealAll = useCallback(() => {
    setRevealedSet(new Set(players.filter(p => !walkoutPlayerIds.has(p.id)).map(p => p.id)));
  }, [players, walkoutPlayerIds]);

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

  // Visually-hidden live announcer — reads out the most recent pull as
  // each card flips so screen-reader users hear the same reveal sighted
  // users see. Without this, the dramatic flip animation was a silent
  // event and the user had to navigate the card grid manually to learn
  // what they pulled.
  const lastRevealedPlayer = useMemo(() => {
    if (revealedSet.size === 0) return null;
    // Find the most recently revealed player by iterating the original
    // order and picking the highest-index one that's in revealedSet.
    for (let i = players.length - 1; i >= 0; i--) {
      if (revealedSet.has(players[i].id)) return players[i];
    }
    return null;
  }, [revealedSet, players]);

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
      style={{
        background:
          'radial-gradient(ellipse 70% 50% at 50% 42%, rgba(18,22,34,0.98), rgba(2,3,6,0.99) 70%, #000 100%)',
        willChange: 'opacity',
      }}
    >
      {/* Cinematic stadium environment — floodlight banks, a breathing
          central spotlight, drifting fog and floodlit motes. Sits behind
          every other layer (first DOM child) and self-disables motion
          under the OS reduced-motion setting. */}
      <PackStadium />

      {/* Screen-reader announcer — visually hidden but updates as each
          pack card flips. Uses `aria-live="polite"` so announcements
          queue without interrupting in-progress narration of the
          previous reveal. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {lastRevealedPlayer && phase === 'reveal' && (
          <p>
            Revealed {lastRevealedPlayer.position} {lastRevealedPlayer.firstName} {lastRevealedPlayer.lastName}, {lastRevealedPlayer.overall} overall.
          </p>
        )}
      </div>

      {/* Loading beat — a thin luxury ring spins over the dimmed stadium
          before the pack flies in, so the open reads as a deliberate
          cinematic moment rather than an instant cut. */}
      <AnimatePresence>
        {phase === 'loading' && (
          <motion.div
            key="loading"
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              className="w-14 h-14 rounded-full"
              style={{
                border: '2px solid rgba(255,255,255,0.08)',
                borderTopColor: tierDef.accent,
                boxShadow: `0 0 18px color-mix(in srgb, ${tierDef.accent} 45%, transparent)`,
              }}
              animate={prefersReducedMotion ? undefined : { rotate: 360 }}
              transition={prefersReducedMotion ? undefined : { duration: 0.9, repeat: Infinity, ease: 'linear' }}
            />
            <span
              className="mt-4 text-[10px] uppercase tracking-[0.4em] text-white/55"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
            >
              Opening
            </span>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Tier caption — small, tier-tinted, sits above the pack. Replaces
          the old in-pack frosted label that hard-coded gold gradient text
          on every tier (silver pack reading as gold-on-silver). Fades out
          before the pack tears so the explosion frame stays uncluttered. */}
      <AnimatePresence>
        {(phase === 'arrival' || phase === 'charge') && (
          <motion.div
            key="tier-caption"
            className="absolute left-1/2 -translate-x-1/2 top-[calc(50%-260px)] flex flex-col items-center pointer-events-none text-center px-6"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <span
              className="text-[9px] uppercase font-semibold tracking-[0.42em] text-white/60"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}
            >
              Dynasty Pack
            </span>
            <span
              className="mt-1 text-[22px] font-display font-black tracking-[0.04em] uppercase leading-none"
              style={{
                color: tierDef.accent,
                textShadow: `0 0 18px color-mix(in srgb, ${tierDef.accent} 55%, transparent), 0 2px 8px rgba(0,0,0,0.85)`,
              }}
            >
              {tierDef.label}
            </span>
            <span
              className="mt-1.5 text-[9px] uppercase font-medium tracking-[0.3em] text-white/55"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
            >
              {tierDef.cards} {tierDef.cards === 1 ? 'Player' : 'Players'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The pack itself — visible during arrival + charge + tears open on explode.
          The pack art asset already carries its own marble/foil styling, so we
          skip the gradient frame / inset borders that were fighting the artwork.
          Layout: two halves of the same image stacked via clip-path so we can
          rip the pack in two on the explode beat. */}
      <AnimatePresence>
        {(phase === 'arrival' || phase === 'charge' || phase === 'explode') && (
          <motion.div
            key="pack"
            role={phase === 'arrival' || phase === 'charge' ? 'button' : undefined}
            aria-label={phase === 'arrival' || phase === 'charge' ? 'Tap to rip open the pack' : undefined}
            tabIndex={phase === 'arrival' || phase === 'charge' ? 0 : -1}
            onClick={phase === 'arrival' || phase === 'charge' ? tapToRip : undefined}
            onKeyDown={(e) => {
              if (phase !== 'arrival' && phase !== 'charge') return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                tapToRip();
              }
            }}
            className={cn(
              'relative flex flex-col items-center justify-center',
              phase === 'arrival' || phase === 'charge'
                ? 'cursor-pointer pointer-events-auto'
                : 'pointer-events-none',
            )}
            style={{
              width: 260,
              height: 360,
              perspective: 1200,
              ...(phase === 'charge' || phase === 'explode' ? { willChange: 'transform' } : null),
            }}
            initial={{ opacity: 0, scale: 0.25, rotateY: 50, rotateX: -20, y: 140 }}
            animate={(() => {
              if (phase === 'explode') {
                return { opacity: 1, scale: 1.16, rotateY: 0, rotateX: 0, y: 0 };
              }
              if (phase === 'charge') {
                return {
                  opacity: 1,
                  scale: prefersReducedMotion ? 1 : [1, 1.02, 1, 1.04, 1, 1.05],
                  rotateY: 0,
                  rotateX: prefersReducedMotion ? 0 : [0, -2, 2, -3, 3, 0],
                  y: 0,
                  x: prefersReducedMotion ? 0 : [0, -4, 4, -6, 6, -8, 8, -10, 10, -8, 8, -6, 6, -4, 4, 0],
                };
              }
              return { opacity: 1, scale: 1, rotateY: 0, rotateX: 0, y: 0 };
            })()}
            exit={{ opacity: 0, scale: 1.25 }}
            transition={phase === 'charge' && !prefersReducedMotion
              ? {
                  x: { duration: 0.35, repeat: Infinity, ease: 'linear' },
                  scale: { duration: chargeLength / 1000, ease: 'easeIn' },
                  rotateX: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' },
                }
              : phase === 'explode'
                ? { duration: 0.25, ease: [0.22, 1, 0.36, 1] }
                : { type: 'spring', stiffness: 220, damping: 16 }
            }
          >
            {/* Floor shadow */}
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-48 h-5 rounded-full bg-black/75"
              style={{ filter: 'blur(14px)' }}
              initial={{ opacity: 0, scaleX: 0.4 }}
              animate={phase === 'explode'
                ? { opacity: 0, scaleX: 1.4 }
                : { opacity: 0.85, scaleX: 1 }}
              transition={{ duration: 0.5 }}
            />

            {/* Radiating light rays behind the pack during charge. Motion
                handles opacity fade; inner CSS class handles the steady
                rotation so Framer Motion's transform doesn't clobber it. */}
            <AnimatePresence>
              {phase === 'charge' && !prefersReducedMotion && (
                <motion.div
                  key="rays"
                  className="absolute inset-0 pointer-events-none overflow-visible"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.5, 0.9] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: chargeLength / 1000, ease: 'easeIn' }}
                >
                  <div className="pack-rays" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Ambient halo — tier-tinted radial glow behind the pack. Grows
                with the charge so it reads like the pack is about to burst. */}
            <motion.div
              className="absolute inset-[-30%] rounded-full pointer-events-none"
              style={{
                background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${tierDef.accent} 45%, transparent) 0%, transparent 60%)`,
                mixBlendMode: 'screen',
                filter: 'blur(20px)',
              }}
              initial={{ opacity: 0.25, scale: 0.85 }}
              animate={phase === 'charge'
                ? { opacity: [0.35, 0.75, 0.95], scale: [0.85, 1.05, 1.25] }
                : phase === 'explode'
                  ? { opacity: 1, scale: 1.4 }
                  : { opacity: 0.45, scale: 1 }}
              transition={{
                duration: phase === 'charge' ? chargeLength / 1000 : 0.3,
                ease: 'easeOut',
              }}
            />

            {/* The pack art itself — split into two halves so explode can tear
                it apart along a jagged horizontal seam. Each half shows the
                same asset but clipped to its slice. When not exploding the
                seam is invisible since the halves align pixel-perfect.

                During `arrival` this container also carries a gentle infinite
                idle float (slow bob + micro-tilt) so the pack feels alive
                while it waits for the tap. The float is decoupled from the
                pack's entrance spring (which lives on the parent) and is
                pinned back to neutral the instant `charge` begins so it can't
                fight the charge shake or the explode tear. */}
            <motion.div
              className="relative w-full h-full"
              style={{ transformStyle: 'preserve-3d' }}
              animate={phase === 'arrival' && !prefersReducedMotion
                ? { y: [0, -9, 0], rotateZ: [0, 1.1, 0, -1.1, 0] }
                : { y: 0, rotateZ: 0 }}
              transition={phase === 'arrival' && !prefersReducedMotion
                ? {
                    y: { duration: 3.8, repeat: Infinity, ease: 'easeInOut' },
                    rotateZ: { duration: 5.4, repeat: Infinity, ease: 'easeInOut' },
                  }
                : { duration: 0.3, ease: 'easeOut' }}
            >
              {/* Top flap — the smaller top third. On explode it peels up
                  and rotates back so the pack reads as opening from the
                  top seam, not splitting in half. */}
              <motion.div
                className="absolute inset-0"
                style={{
                  clipPath:
                    'polygon(0 0, 100% 0, 100% 33%, 90% 35%, 80% 32%, 70% 35%, 60% 32%, 50% 35%, 40% 32%, 30% 35%, 20% 32%, 10% 35%, 0 33%)',
                  willChange: phase === 'explode' ? 'transform, opacity' : 'auto',
                  filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))',
                }}
                initial={{ y: 0, rotate: 0, opacity: 1 }}
                animate={phase === 'explode'
                  ? { y: -320, rotate: -20, opacity: 0 }
                  : { y: 0, rotate: 0, opacity: 1 }}
                transition={phase === 'explode'
                  ? { duration: 0.62, ease: [0.22, 1, 0.36, 1] }
                  : { duration: 0 }}
              >
                <PackArt
                  src={tierDef.artSrc}
                  loading="eager"
                  className="absolute inset-0 w-full h-full object-contain object-center"
                  fallback={
                    <div
                      className="absolute inset-0 rounded-2xl border border-white/15"
                      style={{ background: `linear-gradient(160deg, ${tierDef.gradientFrom}, ${tierDef.gradientTo})` }}
                    />
                  }
                />
              </motion.div>

              {/* Pack body — the larger lower portion. Sinks slightly and
                  dissolves as the flap opens and the card rises through. */}
              <motion.div
                className="absolute inset-0"
                style={{
                  clipPath:
                    'polygon(0 33%, 10% 35%, 20% 32%, 30% 35%, 40% 32%, 50% 35%, 60% 32%, 70% 35%, 80% 32%, 90% 35%, 100% 33%, 100% 100%, 0 100%)',
                  willChange: phase === 'explode' ? 'transform, opacity' : 'auto',
                  filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))',
                }}
                initial={{ y: 0, rotate: 0, opacity: 1 }}
                animate={phase === 'explode'
                  ? { y: 70, rotate: 3, opacity: 0 }
                  : { y: 0, rotate: 0, opacity: 1 }}
                transition={phase === 'explode'
                  ? { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
                  : { duration: 0 }}
              >
                <PackArt
                  src={tierDef.artSrc}
                  loading="eager"
                  className="absolute inset-0 w-full h-full object-contain object-center"
                  fallback={
                    <div
                      className="absolute inset-0 rounded-2xl border border-white/15"
                      style={{ background: `linear-gradient(160deg, ${tierDef.gradientFrom}, ${tierDef.gradientTo})` }}
                    />
                  }
                />
              </motion.div>

              {/* Seam flash — bright line along the tear as it opens */}
              <AnimatePresence>
                {phase === 'explode' && (
                  <motion.div
                    key="seam-flash"
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{
                      top: '33%',
                      height: 6,
                      background: `linear-gradient(90deg, transparent, ${tierDef.accent}, white, ${tierDef.accent}, transparent)`,
                      boxShadow: `0 0 24px ${tierDef.accent}, 0 0 48px white`,
                      transform: 'translateY(-50%)',
                      filter: 'blur(1px)',
                    }}
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: [0, 1, 1, 0], scaleX: [0, 1, 1.1, 1.2] }}
                    transition={{ duration: 0.55, ease: 'easeOut' }}
                  />
                )}
              </AnimatePresence>

              {/* Tier-coloured glow leaks during charge — escaping through
                  the tear seam and around the pack body. Tinted by the top
                  pull's tier so the rarity is subtly telegraphed. */}
              <AnimatePresence>
                {phase === 'charge' && (
                  <motion.div
                    key="leaks"
                    className="absolute inset-0 mix-blend-screen pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, ${topTier.gradientVia}dd, transparent 45%),
                                   radial-gradient(circle at 30% 40%, ${topTier.gradientTo}aa, transparent 35%),
                                   radial-gradient(circle at 70% 60%, ${topTier.gradientFrom}aa, transparent 35%)`,
                      filter: 'blur(2px)',
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.7, 0.85, 1] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: chargeLength / 1000, ease: 'easeIn' }}
                  />
                )}
              </AnimatePresence>

              {/* Top-seam energy — gold/tier energy gathers along the tear
                  seam during charge, with a metallic shimmer and spark
                  particles, telegraphing exactly where the pack opens. */}
              <AnimatePresence>
                {phase === 'charge' && (
                  <motion.div
                    key="seam-energy"
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{ top: '33%', height: 44, transform: 'translateY(-50%)' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: chargeLength / 1000, ease: 'easeIn' }}
                  >
                    {/* Soft bloom hugging the seam */}
                    <div
                      className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-11"
                      style={{
                        background: `radial-gradient(70% 100% at 50% 50%, color-mix(in srgb, ${tierDef.accent} 50%, transparent), transparent 72%)`,
                        mixBlendMode: 'screen',
                        filter: 'blur(7px)',
                      }}
                    />
                    {/* Energy glow line */}
                    <motion.div
                      className="absolute left-3 right-3 top-1/2 -translate-y-1/2"
                      style={{
                        height: 3,
                        borderRadius: 99,
                        background: `linear-gradient(90deg, transparent, ${tierDef.accent}, #fff, ${tierDef.accent}, transparent)`,
                        boxShadow: `0 0 14px ${tierDef.accent}, 0 0 30px color-mix(in srgb, ${tierDef.accent} 55%, transparent)`,
                      }}
                      animate={prefersReducedMotion
                        ? { opacity: 0.95 }
                        : { opacity: [0.45, 1, 0.6, 1], scaleX: [0.8, 1, 0.88, 1] }}
                      transition={prefersReducedMotion ? undefined : { duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    {/* Spark particles flicking off the seam */}
                    {!prefersReducedMotion && Array.from({ length: 8 }).map((_, i) => {
                      const left = 10 + Math.random() * 80;
                      const up = Math.random() > 0.5;
                      const dist = 16 + Math.random() * 24;
                      const dur = 0.5 + Math.random() * 0.45;
                      const delay = Math.random() * 0.8;
                      return (
                        <motion.span
                          key={`spark-${i}`}
                          className="absolute rounded-full"
                          style={{
                            left: `${left}%`,
                            top: '50%',
                            width: 3,
                            height: 3,
                            background: '#fff',
                            boxShadow: `0 0 6px ${tierDef.accent}`,
                          }}
                          initial={{ opacity: 0, y: 0 }}
                          animate={{ opacity: [0, 1, 0], y: up ? -dist : dist }}
                          transition={{ duration: dur, delay, repeat: Infinity, repeatDelay: 0.5, ease: 'easeOut' }}
                        />
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Continuous shimmer sweep on arrival */}
              {phase === 'arrival' && !prefersReducedMotion && (
                <motion.div
                  className="absolute inset-0 pointer-events-none overflow-hidden"
                  style={{
                    background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)',
                    mixBlendMode: 'overlay',
                  }}
                  initial={{ x: '-100%' }}
                  animate={{ x: '120%' }}
                  transition={{ duration: 1.2, ease: 'easeInOut', repeat: Infinity }}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap-to-open hint — pulses during the charge beat to telegraph
          that the user can drive the payoff themselves rather than just
          watching. Hidden under reduced-motion (no pulse) but the pack
          itself is still tappable for keyboard/click users. */}
      <AnimatePresence>
        {phase === 'charge' && (
          <motion.div
            key="rip-hint"
            className="absolute left-1/2 -translate-x-1/2 top-[calc(50%+200px)] text-center pointer-events-none"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <motion.span
              className="text-[10px] uppercase tracking-[0.4em] font-semibold text-white/75"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
              animate={prefersReducedMotion ? undefined : { opacity: [0.55, 1, 0.55] }}
              transition={prefersReducedMotion ? undefined : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              Tap to open
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ambient floating motes — during arrival/charge. Skipped under
          reduced-motion; count trimmed from 20 → 8 and blur filter dropped
          so each particle stays on the compositor fast path. */}
      {(phase === 'arrival' || phase === 'charge') && !prefersReducedMotion && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => {
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
                  transform: 'translateZ(0)',
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

      {/* Explosion — shockwave + flash + foil shreds + confetti. The
          shred layer is deterministic per-render but visually random:
          18 small foil rectangles fly out from the seam in a 360° spread
          to sell the "ripped wrapper" feel a Pokémon-pack opening lives on. */}
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
              animate={{ width: '120vmax', height: '120vmax', opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            />
            {/* Cinematic white bloom — a radial core that blooms outward
                rather than a flat full-screen fill, so the reveal lands like
                a burst of light from the torn pack instead of a hard cut. */}
            <motion.div
              key="flash"
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 50% 46%, #fff 0%, rgba(255,255,255,0.88) 24%, rgba(255,255,255,0) 68%)',
                willChange: 'transform, opacity',
              }}
              initial={{ opacity: 0, scale: 0.35 }}
              animate={{ opacity: [0, 0.95, 0], scale: [0.35, 1.5, 2.4] }}
              transition={{ duration: 0.36, times: [0, 0.3, 1], ease: [0.22, 1, 0.36, 1] }}
            />
            {/* Anamorphic lens flare — a fast bright streak raking across
                the burst, the cinematic "energy" beat of the reveal. */}
            <motion.div
              key="lens-flare"
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                top: '46%',
                height: 4,
                transform: 'translateY(-50%)',
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.85) 34%, #fff 50%, rgba(255,255,255,0.85) 66%, transparent)',
                boxShadow: `0 0 28px 5px color-mix(in srgb, ${tierDef.accent} 65%, white)`,
                filter: 'blur(1px)',
                willChange: 'transform, opacity',
              }}
              initial={{ opacity: 0, scaleX: 0.15 }}
              animate={{ opacity: [0, 1, 0], scaleX: [0.15, 1, 1.2] }}
              transition={{ duration: 0.42, times: [0, 0.34, 1], ease: [0.22, 1, 0.36, 1] }}
            />
            {!prefersReducedMotion && (
              <div className="absolute left-1/2 top-1/2 pointer-events-none" aria-hidden>
                {foilShreds.map((s) => (
                  <motion.span
                    key={`shred-${s.i}`}
                    className="absolute rounded-[1px]"
                    style={{
                      width: s.w,
                      height: s.h,
                      top: 0,
                      left: 0,
                      background: `linear-gradient(90deg, ${tierDef.gradientFrom}, ${tierDef.gradientTo})`,
                      boxShadow: `0 0 6px ${tierDef.accent}`,
                      willChange: 'transform, opacity',
                    }}
                    initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                    animate={{ x: s.dx, y: s.dy, opacity: 0, rotate: s.rot }}
                    transition={{ duration: s.duration, ease: [0.22, 1, 0.36, 1] }}
                  />
                ))}
              </div>
            )}
            <PackConfetti count={prefersReducedMotion ? 0 : confettiCount} hueBase={topOvr >= 90 ? 48 : topOvr >= 84 ? 35 : 43} hueRange={28} />
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

      {/* Reveal grid. Heavily dimmed + blurred during the walkout so the
          hero card carries the frame unopposed; snaps back in full for
          summary so the player can inspect every pull.
          In summary phase the container takes the full viewport so the
          card grid scrolls between a pinned header and pinned action bar
          — guarantees Keep All / Sell All stay reachable regardless of
          how many cards the pack pulled. */}
      {(phase === 'reveal' || phase === 'walkout' || phase === 'summary') && (
        <motion.div
          className={cn(
            'relative w-full px-4 flex flex-col items-center',
            phase === 'summary'
              ? 'absolute inset-0 max-w-none gap-0'
              : 'max-w-[min(92vw,480px)] gap-4',
          )}
          animate={{
            opacity: phase === 'walkout' ? 0.12 : 1,
            filter: phase === 'walkout' ? 'blur(8px) saturate(0.6)' : 'blur(0px) saturate(1)',
            scale: phase === 'walkout' ? 0.92 : 1,
          }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ willChange: phase === 'walkout' ? 'filter, opacity, transform' : 'auto' }}
        >
          {/* Results header — springs in once the pack settles, giving the
              summary a clear "results screen" identity. */}
          {phase === 'summary' && (
            <motion.div
              className="shrink-0 text-center w-full pt-[max(env(safe-area-inset-top),14px)] pb-3 relative"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            >
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/55">Pack Opened</p>
              <p className="mt-1 text-lg font-display font-black text-white leading-none">
                {players.length} {players.length === 1 ? 'Player' : 'Players'}
              </p>
              <p className="mt-1.5 text-[12px] tabular-nums">
                <span className="text-white/45">Combined value </span>
                <span className="font-display font-bold text-amber-200/95">
                  {formatMoney(players.reduce((s, p) => s + (p.value || 0), 0))}
                </span>
              </p>
              {/* Soft gradient rule — visually separates the header from the
                  scrolling grid below. Fades to transparent at the edges so
                  it doesn't feel like a hard divider on the dark backdrop. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-6 bottom-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
                }}
              />
            </motion.div>
          )}
          <div
            className={cn(
              'flex flex-wrap justify-center gap-x-3 gap-y-4',
              // In summary, the cards grid scrolls within the viewport so
              // every card (and its Keep/Sell row) stays reachable no matter
              // how many the pack pulled. `min-h-0` is required for the flex
              // child to actually shrink — without it `overflow-y-auto` is a
              // no-op inside a flex column.
              phase === 'summary'
                ? 'flex-1 min-h-0 overflow-y-auto w-full max-w-[480px] px-1 py-3 content-start [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
                : '',
            )}
          >
            {players.map((p, i) => {
              const quickSellAmount = Math.max(0, Math.round((p.value || 0) * QUICK_SELL_RATE));
              return (
                <div key={p.id} className="flex flex-col items-center gap-2">
                  <PackCard
                    player={p}
                    revealed={revealedSet.has(p.id) || phase === 'summary'}
                    onReveal={
                      phase === 'reveal' && !walkoutPlayerIds.has(p.id)
                        ? () => revealOne(p.id)
                        : undefined
                    }
                    entranceDelay={prefersReducedMotion ? 0 : i * (PACK_ANIM.revealStaggerMs / 1000)}
                  />
                  {phase === 'summary' && (onKeep || onQuickSell) && (
                    <motion.div
                      className="flex gap-1.5"
                      style={{ width: PLAYER_CARD_SIZE_PX.lg }}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 + i * 0.04 }}
                    >
                      <button
                        type="button"
                        onClick={() => onKeep?.(p.id)}
                        disabled={!onKeep}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-[10px] font-display font-bold uppercase tracking-[0.18em]',
                          'text-white bg-white/10 border border-white/25 backdrop-blur-xl backdrop-saturate-150',
                          'shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.3),0_6px_16px_-8px_rgba(0,0,0,0.55)]',
                          'active:scale-[0.97] active:bg-white/15 transition-[transform,background-color] duration-150',
                          'disabled:opacity-40 disabled:cursor-not-allowed',
                        )}
                      >
                        Keep
                      </button>
                      <button
                        type="button"
                        onClick={() => onQuickSell?.(p.id)}
                        disabled={!onQuickSell || quickSellAmount <= 0}
                        aria-label={`Quick sell for ${formatMoney(quickSellAmount)}`}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-[10px] font-display font-bold uppercase tracking-[0.08em] leading-tight',
                          'text-amber-950 bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-200/70',
                          'shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(120,60,0,0.35),0_6px_16px_-8px_rgba(251,191,36,0.55)]',
                          'active:scale-[0.97] transition-[transform] duration-150',
                          'disabled:opacity-40 disabled:cursor-not-allowed',
                          'flex flex-col items-center justify-center',
                        )}
                      >
                        <span>Sell</span>
                        <span className="tabular-nums tracking-tight text-[9px] font-black">
                          {formatMoney(quickSellAmount)}
                        </span>
                      </button>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>

          {phase === 'summary' && players.length >= 2 && (onKeepAll || onSellAll) && (() => {
            const sellAllTotal = players.reduce(
              (sum, p) => sum + Math.max(0, Math.round((p.value || 0) * QUICK_SELL_RATE)),
              0,
            );
            return (
              <motion.div
                className="shrink-0 flex items-center gap-2.5 pt-2 pb-[max(env(safe-area-inset-bottom),16px)]"
                initial={{ opacity: 0, y: 90 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.1 + players.length * 0.04 }}
              >
                <button
                  type="button"
                  onClick={() => { hapticLight(); onKeepAll?.(); }}
                  disabled={!onKeepAll}
                  className={cn(
                    'relative overflow-hidden flex items-center justify-center',
                    'min-w-[120px] h-11 px-5 rounded-full',
                    'text-[11px] font-display font-bold uppercase tracking-[0.22em] text-white',
                    'bg-gradient-to-b from-white/[0.14] to-white/[0.06]',
                    'border border-white/25 backdrop-blur-2xl backdrop-saturate-150',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.32),0_10px_24px_-12px_rgba(0,0,0,0.55)]',
                    'active:scale-[0.97] active:bg-white/[0.18] transition-[transform,background-color] duration-150',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
                    style={{
                      background:
                        'radial-gradient(120% 90% at 50% -30%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 38%, rgba(255,255,255,0) 70%)',
                      mixBlendMode: 'screen',
                    }}
                  />
                  <span className="relative">Keep All</span>
                </button>
                <button
                  type="button"
                  onClick={() => { hapticMedium(); onSellAll?.(); }}
                  disabled={!onSellAll || sellAllTotal <= 0}
                  aria-label={`Sell all for ${formatMoney(sellAllTotal)}`}
                  className={cn(
                    'relative overflow-hidden flex flex-col items-center justify-center leading-tight',
                    'min-w-[140px] h-11 px-5 rounded-full',
                    'text-amber-950',
                    'bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500',
                    'border border-amber-100/80',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.65),inset_0_-1px_0_rgba(120,60,0,0.4),0_10px_28px_-10px_rgba(251,191,36,0.6)]',
                    'active:scale-[0.97] transition-[transform] duration-150',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
                    style={{
                      background:
                        'radial-gradient(120% 90% at 50% -30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.1) 40%, rgba(255,255,255,0) 72%)',
                      mixBlendMode: 'screen',
                    }}
                  />
                  <span className="relative text-[11px] font-display font-bold uppercase tracking-[0.18em]">Sell All</span>
                  <span className="relative tabular-nums tracking-tight text-[10px] font-black">
                    {formatMoney(sellAllTotal)}
                  </span>
                </button>
              </motion.div>
            );
          })()}

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

          {/* Close fallback — when the summary has no per-card actions
              (replay mode opens the overlay with only `onClose`), the grid
              otherwise offers no clickable way out and touch users are
              stuck. Keyboard users still have Escape. */}
          {phase === 'summary' && !onKeep && !onQuickSell && (
            <motion.button
              type="button"
              onClick={onClose}
              className={cn(
                'shrink-0 py-2.5 px-8 rounded-2xl font-display font-bold text-xs uppercase tracking-[0.2em]',
                'text-white bg-white/10 border border-white/25',
                'backdrop-blur-2xl backdrop-saturate-150',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(0,0,0,0.30),0_10px_30px_-10px_rgba(0,0,0,0.55)]',
                'active:scale-[0.98] active:bg-white/15 transition-[transform,background-color] duration-150',
                'mb-[max(env(safe-area-inset-bottom),16px)]',
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              Close
            </motion.button>
          )}
        </motion.div>
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
