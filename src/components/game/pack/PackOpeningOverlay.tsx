import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, animate, useAnimationFrame, useMotionValue, useTransform } from 'framer-motion';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import type { PackPlayerPlacement, PackTierKey, Player } from '@/types/game';
import { MAX_WALKOUTS_PER_PACK, PACK_ANIM, PACK_QUICK_SELL_CAP, PACK_QUICK_SELL_RATE, PACK_TIER_MAP, WALKOUT_OVR_THRESHOLD } from '@/config/packs';
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

// Quick-sell pricing comes from config so the button can never promise a
// different number than the slice pays out — the cap especially: an uncapped
// preview over a capped refund would read as the game shorting the player.

/**
 * Counts a money value up from 0 over ~900ms for the summary header. A small
 * premium reward beat so the combined value reads as "tallied" rather than
 * just printed. Honours reduced-motion by jumping straight to the final value.
 */
function CountUpMoney({ value, durationMs = 900 }: { value: number; durationMs?: number }) {
  const prefersReducedMotion = useReducedMotionPref();
  const [display, setDisplay] = useState(prefersReducedMotion ? value : 0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — fast tally that settles gently on the final figure.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs, prefersReducedMotion]);

  return <>{formatMoney(display)}</>;
}

interface PackOpeningOverlayProps {
  tier: PackTierKey;
  players: Player[];
  pityTriggered?: boolean;
  onClose: () => void;
  /** Keep the pulled player — just removes them from the summary view. */
  onKeep?: (playerId: string) => void;
  /** Quick-sell the pulled player at the config rate, capped — see PACK_QUICK_SELL_CAP. */
  onQuickSell?: (playerId: string) => void;
  /** Bulk-keep every remaining player in the summary. */
  onKeepAll?: () => void;
  /** Bulk quick-sell every remaining player in the summary. */
  onSellAll?: () => void;
  /** Per-player placement map from openPack so the reveal modal can badge pulls. */
  placement?: Record<string, PackPlayerPlacement>;
  /** Optional "+X OVR vs current best at this position" map. Only entries
   *  with a positive delta are present; consumers render an upgrade badge
   *  on key presence alone. Computed by the parent (which has the squad in
   *  state) and passed in. */
  improvement?: Record<string, { delta: number; currentBestOvr: number }>;
  /** What is left of this open's quick-sell cap (PACK_QUICK_SELL_CAP minus
   *  refunds already taken). The cap is per OPEN, so every SELL label must be
   *  priced against the live remainder — a per-card min(cap, value×rate) would
   *  promise money the slice will not pay. Defaults to the full cap for
   *  replays, where selling is disabled anyway. */
  quickSellRemaining?: number;
}

type Phase = 'loading' | 'portal' | 'arrival' | 'charge' | 'explode' | 'reveal' | 'walkout' | 'summary';

/** Player-facing copy for the auto-placement chip on summary cards. */
const PLACEMENT_LABEL: Record<PackPlayerPlacement, string> = {
  starter: 'Straight into your XI',
  bench: 'Bench',
  squad: 'Squad',
};

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
export function PackOpeningOverlay({ tier, players, pityTriggered, onClose, onKeep, onQuickSell, onKeepAll, onSellAll, placement, improvement, quickSellRemaining = PACK_QUICK_SELL_CAP }: PackOpeningOverlayProps) {
  const { t } = useTranslation();
  const tierDef = PACK_TIER_MAP[tier];
  const prefersReducedMotion = useReducedMotionPref();
  const [phase, setPhase] = useState<Phase>('loading');
  const [revealedSet, setRevealedSet] = useState<Set<string>>(new Set());
  // Most recently flipped card for the screen-reader announcer. Tracked
  // explicitly — deriving it from revealedSet picked the highest-index
  // revealed card, so out-of-order reveals were never announced.
  const [lastRevealedId, setLastRevealedId] = useState<string | null>(null);
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

  // Unmount cleanup for every pending timer/interval, so a phase jump
  // (e.g. an immediate walkout skip) can never leave a timer firing
  // setState after the overlay has gone.
  useEffect(() => () => {
    if (walkoutLingerTimerRef.current !== null) {
      window.clearTimeout(walkoutLingerTimerRef.current);
      walkoutLingerTimerRef.current = null;
    }
    if (chargeTimerRef.current !== null) {
      window.clearTimeout(chargeTimerRef.current);
      chargeTimerRef.current = null;
    }
    if (chargeRumbleRef.current !== null) {
      window.clearInterval(chargeRumbleRef.current);
      chargeRumbleRef.current = null;
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

  // ── One driver for the whole charge ──
  //
  // `chargeProgress` runs 0 → 1 across the charge beat and everything that
  // escalates reads from it: shake amplitude, tilt, scale, halo, rumble.
  //
  // It is a MOTION VALUE, not React state, for two reasons. It updates every
  // frame and this component is ~1500 lines, so setState would re-render the
  // entire overlay 60 times a second. And a motion value keeps every derived
  // property on the same clock — the old charge ran the shake on a 0.35s
  // linear loop, the tilt on a 0.6s loop and the scale on the charge's full
  // duration, three independent timers whose beat frequencies drifted apart.
  // That is why it read as a rattle rather than a build: nothing was rising
  // together, and a constant-amplitude shake carries no information about how
  // close the pack is to bursting.
  const chargeProgress = useMotionValue(0);
  /** Live shake offset, written by the frame loop below. */
  const shakeX = useMotionValue(0);
  const shakeRotate = useMotionValue(0);
  // Scale and halo ride the same curve, but as PLAIN motion values written by
  // the frame loop rather than `useTransform` outputs. A transform output is
  // derived and read-only in practice: the tear needs to animate these away
  // from the charge curve, and any `animate()` on a transform is overwritten by
  // its source on the next frame. One writer at a time instead — the frame loop
  // owns them during `charge`, the tear's `animate` owns them during `explode`.
  const packScale = useMotionValue(1);
  const haloOpacity = useMotionValue(0.45);
  const haloScale = useMotionValue(1);
  // These two only exist during the charge and unmount with it, so nothing
  // else ever writes them and a derived value is exactly right.
  const leakOpacity = useTransform(chargeProgress, [0, 0.35, 1], [0, 0.55, 1]);
  const rayOpacity = useTransform(chargeProgress, [0, 0.5, 1], [0, 0.45, 0.95]);

  /** True once the charge has entered its held-breath tail: the shake stops
   *  dead and the glow spikes. Kept as a ref so the frame loop can read it
   *  without a re-render. */
  const breathingRef = useRef(false);

  // The shake itself. A sine oscillator whose AMPLITUDE is a function of
  // progress, so the pack barely stirs at the start and is hammering by the
  // end — and then, during the breath, stops completely.
  useAnimationFrame((t) => {
    if (phase !== 'charge' || prefersReducedMotion) {
      // Don't zero the shake here during the tear — `explode` runs its own
      // short settle on these values, and writing 0 every frame would cancel it.
      if (phase !== 'explode' && shakeX.get() !== 0) { shakeX.set(0); shakeRotate.set(0); }
      return;
    }
    const p = chargeProgress.get();
    // Everything that escalates, on one curve and one frame.
    packScale.set(1 + 0.07 * p);
    haloScale.set(0.85 + 0.45 * p);
    // 0.35 → 0.80 over the first 60%, then 0.80 → 1.0 over the last 40%, so
    // the glow is already bright well before the burst and the final stretch
    // reads as saturation rather than as the light only just arriving.
    haloOpacity.set(p < 0.6 ? 0.35 + 0.45 * (p / 0.6) : 0.8 + 0.2 * ((p - 0.6) / 0.4));

    if (breathingRef.current) {
      // The held breath: movement eases out rather than cutting, so the
      // stillness arrives as a settle and not a dropped frame. The glow is
      // left at full — bright and completely motionless is the whole effect.
      shakeX.set(shakeX.get() * 0.8);
      shakeRotate.set(shakeRotate.get() * 0.8);
      return;
    }
    // Amplitude and frequency both climb with p. Cubed amplitude keeps the
    // first half of the charge calm so the second half has somewhere to go.
    const amp = 11 * p * p * p;
    const freq = 0.011 + 0.019 * p;
    shakeX.set(Math.sin(t * freq) * amp);
    shakeRotate.set(Math.sin(t * freq * 0.6 + 1) * amp * 0.28);
  });

  /**
   * Side-tear geometry, generated once per open.
   *
   * A jagged vertical seam near the left edge, sampled at `segments + 1` y
   * boundaries. Adjacent slices reuse the SAME boundary x, so the strip tiles
   * against itself with no hairline gap and the body's edge is the exact
   * negative of the strip's.
   */
  const tearGeometry = useMemo(() => {
    const { seamXPct, segments, jagPct } = PACK_ANIM.tear;
    // Seam x at each y boundary. Deterministic wobble rather than Math.random
    // so a replayed open tears along the same line it did the first time.
    const seamAt = (i: number) =>
      seamXPct + Math.sin(i * 2.399) * jagPct + Math.sin(i * 5.117) * (jagPct * 0.45);
    const bounds = Array.from({ length: segments + 1 }, (_, i) => ({
      y: (i / segments) * 100,
      x: seamAt(i),
    }));

    // One slice of the strip: left edge to the seam, between two boundaries.
    const strip = Array.from({ length: segments }, (_, i) => {
      const a = bounds[i];
      const b = bounds[i + 1];
      return {
        i,
        clipPath: `polygon(0 ${a.y}%, ${a.x}% ${a.y}%, ${b.x}% ${b.y}%, 0 ${b.y}%)`,
      };
    });

    // The body: everything right of the seam. Top edge, down the right side,
    // along the bottom, then back UP through the boundaries in reverse so the
    // torn edge matches the strip exactly.
    const bodyPoints = [
      `${bounds[0].x}% 0%`,
      '100% 0%',
      '100% 100%',
      `${bounds[segments].x}% 100%`,
      ...bounds.slice(0, segments).reverse().map(pt => `${pt.x}% ${pt.y}%`),
    ];
    return { strip, bodyClip: `polygon(${bodyPoints.join(', ')})`, seamXPct };
  }, []);

  // The burst layers (shockwave, bloom, flare, shreds, confetti) outlive the
  // explode PHASE on purpose: the phase hands off to the reveal at
  // `explodeMs` so the cards land fast, but the shockwave (220ms delay +
  // 550ms), bloom and shreds are still mid-flight — unmounting them with the
  // phase cut every one of them off at ~120ms, a hard cut where the design
  // wants a bloom. They run to completion on their own clock behind the
  // reveal grid (all pointer-events-none), then unmount at their finished,
  // invisible state. The effects driving this live beside the
  // explode→reveal timer below.
  const [burstAlive, setBurstAlive] = useState(false);
  const burstMounted = phase === 'explode' || burstAlive;

  // Foil-shred params — generated once per explode entry. Inlining the
  // randoms in the .map() would re-roll them on any re-render during the
  // ~0.7s burst, retargeting in-flight Framer Motion animations mid-flight.
  // Keyed on `burstMounted`, which stays true across the explode→reveal
  // handoff — keying on the phase re-rolled every spec at the handoff and
  // teleported the in-flight shreds.
  const foilShreds = useMemo(() => {
    if (!burstMounted || prefersReducedMotion) return [];
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
  }, [burstMounted, prefersReducedMotion]);

  // Charge-seam sparks + arrival/charge ambient motes — same rule as
  // foilShreds: roll the random specs once. Inlined randoms re-rolled on
  // every re-render (typewriter ticks, card-reveal taps), teleporting
  // in-flight infinite Framer animations.
  // Sparks flicking off the tear seam. `along` is a percentage DOWN the seam
  // (it was across a horizontal one before the pack started opening from the
  // side) and `dist` is how far sideways each one flies.
  const seamSparks = useMemo(() =>
    Array.from({ length: 8 }).map((_, i) => ({
      i,
      along: 10 + Math.random() * 80,
      up: Math.random() > 0.5,
      dist: 16 + Math.random() * 24,
      dur: 0.5 + Math.random() * 0.45,
      delay: Math.random() * 0.8,
    })),
  []);
  const ambientMotes = useMemo(() =>
    Array.from({ length: 8 }).map((_, i) => ({
      i,
      x: 30 + Math.random() * 40,
      rise: 180 + Math.random() * 260,
      duration: 2.5 + Math.random() * 2,
      delay: Math.random() * 1.2,
      size: 2 + Math.random() * 3,
    })),
  []);

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
    // A rip that was requested before the pack existed: let it land, then tear
    // it. Long enough that the entrance spring reads as a landing, short enough
    // that it still answers the tap.
    if (pendingRipRef.current) {
      pendingRipRef.current = false;
      const t = window.setTimeout(() => { hapticHeavy(); setPhase('explode'); }, PACK_ANIM.earlyRipMs);
      return () => window.clearTimeout(t);
    }
    // Auto-advance to charge after a brief float pause
    const t = window.setTimeout(() => setPhase('charge'), PACK_ANIM.arrivalMs + 300);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'charge') return;
    breathingRef.current = false;
    chargeProgress.set(0);
    packScale.set(1);
    haloScale.set(0.85);
    haloOpacity.set(0.35);

    // The single curve everything else reads from. `easeIn` so the build
    // accelerates — a linear ramp reads as a machine idling, not as pressure.
    const rampMs = Math.max(1, chargeLength - PACK_ANIM.chargeBreathMs);
    const ramp = animate(chargeProgress, 1, {
      duration: rampMs / 1000,
      ease: 'easeIn',
    });

    // Rumble that accelerates with the build. A recursive timeout rather than
    // an interval, because the whole point is that the GAP shrinks: the old
    // flat 180ms tick carried no information about how far along the charge
    // was, so the haptics said "something is happening" for the entire beat
    // and never "it is about to go".
    const pulse = () => {
      hapticMedium();
      const p = chargeProgress.get();
      const gap = PACK_ANIM.chargeHapticStartMs
        + (PACK_ANIM.chargeHapticEndMs - PACK_ANIM.chargeHapticStartMs) * p;
      chargeRumbleRef.current = window.setTimeout(pulse, Math.max(40, gap));
    };
    chargeRumbleRef.current = window.setTimeout(pulse, PACK_ANIM.chargeHapticStartMs);

    // Held breath, then burst. The shake settles to nothing and the glow is at
    // full while absolutely nothing moves; the tear lands into that silence.
    const breathTimer = window.setTimeout(() => {
      breathingRef.current = true;
      if (chargeRumbleRef.current !== null) {
        window.clearTimeout(chargeRumbleRef.current);
        chargeRumbleRef.current = null;
      }
    }, rampMs);

    chargeTimerRef.current = window.setTimeout(() => {
      chargeTimerRef.current = null;
      setPhase('explode');
      hapticHeavy();
    }, chargeLength);

    return () => {
      ramp.stop();
      window.clearTimeout(breathTimer);
      if (chargeRumbleRef.current !== null) window.clearTimeout(chargeRumbleRef.current);
      if (chargeTimerRef.current !== null) window.clearTimeout(chargeTimerRef.current);
      chargeRumbleRef.current = null;
      chargeTimerRef.current = null;
      breathingRef.current = false;
    };
  }, [phase, chargeLength, chargeProgress, packScale, haloScale, haloOpacity]);

  /** True while a tap should rip the pack — i.e. every beat before it tears.
   *  Deliberately includes `loading` and `portal`: those two beats are under
   *  half a second combined, but they used to swallow taps, and a store that
   *  ignores the first tap teaches the player the pack is not tappable. */
  const canRip = phase === 'loading' || phase === 'portal' || phase === 'arrival' || phase === 'charge';

  /** Set when the player tapped before the pack had flown in, so the arrival
   *  beat knows to tear immediately instead of starting a charge. */
  const pendingRipRef = useRef(false);

  // Tap-to-rip: short-circuits the build so the player drives the payoff
  // themselves instead of watching the pack shake. Valid from the first frame
  // to the tear; ignored afterwards.
  const tapToRip = useCallback(() => {
    if (!canRip) return;
    // Tapped before the pack has even flown in. Going straight to `explode`
    // would mount the pack mid-tear, so instead snap the entrance forward and
    // let the arrival beat fire the tear a moment later — the pack still lands
    // and still rips, just immediately.
    if (phase === 'loading' || phase === 'portal') {
      pendingRipRef.current = true;
      hapticMedium();
      setPhase('arrival');
      return;
    }
    if (chargeRumbleRef.current !== null) {
      window.clearTimeout(chargeRumbleRef.current);
      chargeRumbleRef.current = null;
    }
    if (chargeTimerRef.current !== null) {
      window.clearTimeout(chargeTimerRef.current);
      chargeTimerRef.current = null;
    }
    hapticHeavy();
    setPhase('explode');
  }, [canRip, phase]);

  // The tear takes over the charge's motion values rather than handing control
  // back to the `animate` prop, so the pack continues from exactly where the
  // build left it — from a half-charged 1.02 on an early tap as readily as from
  // a fully-charged 1.07.
  useEffect(() => {
    if (phase !== 'explode') return;
    const burst = [
      animate(packScale, 1.16, { duration: 0.25, ease: [0.22, 1, 0.36, 1] }),
      animate(haloOpacity, 1, { duration: 0.25, ease: 'easeOut' }),
      animate(haloScale, 1.4, { duration: 0.3, ease: 'easeOut' }),
      animate(shakeX, 0, { duration: 0.12 }),
      animate(shakeRotate, 0, { duration: 0.12 }),
    ];
    return () => burst.forEach(a => a.stop());
  }, [phase, packScale, haloOpacity, haloScale, shakeX, shakeRotate]);

  useEffect(() => {
    if (phase !== 'explode') return;
    setBurstAlive(true);
    const t = window.setTimeout(() => setPhase('reveal'), PACK_ANIM.explodeMs);
    return () => window.clearTimeout(t);
  }, [phase]);
  useEffect(() => {
    if (!burstAlive) return;
    const t = window.setTimeout(() => setBurstAlive(false), PACK_ANIM.tear.burstDelayMs + 1150);
    return () => window.clearTimeout(t);
  }, [burstAlive]);

  // Players destined for a walkout cinematic stay face-down through the
  // reveal phase — a quiet flip would waste their payoff. Tapping one instead
  // launches its walkout immediately (see `triggerWalkout`); otherwise the
  // walkout auto-fires once every other card is revealed. We compute the
  // walkout set once per render based on the same priority rule used when
  // queueing (top-N by OVR above threshold).
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

  // Advance to the next walkout (or summary) IMMEDIATELY, cancelling any
  // pending linger. Used for explicit skips so a tap/Escape is never eaten
  // by the inter-hero hold. Guarded by `walkoutAdvancingRef` so two rapid
  // triggers can't slice the queue twice; the guard is released by the
  // render effect below once the next hero/summary commits — never by a
  // timer, which was the old deadlock.
  const advanceWalkout = useCallback(() => {
    if (walkoutAdvancingRef.current) return;
    walkoutAdvancingRef.current = true;
    if (walkoutLingerTimerRef.current !== null) {
      window.clearTimeout(walkoutLingerTimerRef.current);
      walkoutLingerTimerRef.current = null;
    }
    setWalkoutQueue(prev => {
      const next = prev.slice(1);
      if (next.length > 0) setCurrentWalkout(next[0]);
      else { setCurrentWalkout(null); setPhase('summary'); }
      return next;
    });
  }, []);

  // Release the advance lock once the next hero (or summary) has committed.
  // Tying release to render — not to a timer — means a skip during the hold
  // can always go through, so the reveal can never dead-lock.
  useEffect(() => { walkoutAdvancingRef.current = false; }, [currentWalkout, phase]);

  // A hero finished its cinematic: hold its final frame for a short linger,
  // then advance. The child stays mounted during the linger, so a tap on it
  // routes through `onAdvance` (→ advanceWalkout) and skips the rest of the
  // hold instead of being swallowed.
  const onWalkoutComplete = useCallback(() => {
    if (walkoutLingerTimerRef.current !== null) return; // already lingering
    walkoutLingerTimerRef.current = window.setTimeout(() => {
      walkoutLingerTimerRef.current = null;
      advanceWalkout();
    }, PACK_ANIM.walkout.lingerMs);
  }, [advanceWalkout]);

  // Resilience: if the hero currently on screen was removed from the pack
  // mid-reveal (a quick-sell race), advance past it so the cinematic never
  // strands on a player that no longer exists.
  useEffect(() => {
    if (phase !== 'walkout' || !currentWalkout) return;
    if (!players.some(p => p.id === currentWalkout.id)) advanceWalkout();
  }, [phase, currentWalkout, players, advanceWalkout]);

  // Keep the walkout queue pruned to players still in the pack.
  useEffect(() => {
    setWalkoutQueue(q => {
      const pruned = q.filter(p => players.some(cur => cur.id === p.id));
      return pruned.length === q.length ? q : pruned;
    });
  }, [players]);

  const revealOne = useCallback((id: string) => {
    setRevealedSet(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setLastRevealedId(id);
  }, []);

  // Tap-to-walkout: a walkout-tier card stays face-down in the reveal grid
  // because its payoff is the cinematic, not a quiet flip. Previously that
  // made the card a dead tap — it read "Tap to reveal" but tapping did
  // nothing until every other card was flipped and the walkout auto-fired.
  // Now tapping the card starts the walkout immediately: seed the queue with
  // the tapped player first, then any other pending walkouts (top-OVR first),
  // and jump straight to the walkout phase. Remaining face-down cards are
  // surfaced face-up in the summary that follows.
  const triggerWalkout = useCallback((id: string) => {
    if (phase !== 'reveal') return;
    if (!walkoutPlayerIds.has(id)) return;
    const tapped = players.find(p => p.id === id);
    if (!tapped) return;
    const rest = players
      .filter(p => walkoutPlayerIds.has(p.id) && p.id !== id)
      .sort((a, b) => b.overall - a.overall);
    hapticHeavy();
    setWalkoutQueue([tapped, ...rest]);
    setCurrentWalkout(tapped);
    setPhase('walkout');
  }, [phase, players, walkoutPlayerIds]);

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
      if (phase === 'walkout') { advanceWalkout(); return; }
      if (phase === 'summary') { onClose(); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose, revealAll, advanceWalkout]);

  // Visually-hidden live announcer — reads out the most recent pull as
  // each card flips so screen-reader users hear the same reveal sighted
  // users see. Without this, the dramatic flip animation was a silent
  // event and the user had to navigate the card grid manually to learn
  // what they pulled. Keyed on the explicitly-tracked last flip, not the
  // highest revealed index.
  const lastRevealedPlayer = useMemo(
    () => (lastRevealedId ? players.find(p => p.id === lastRevealedId) ?? null : null),
    [lastRevealedId, players],
  );

  // Render order for the card grid. During reveal the cards keep their
  // original (shuffled) order so the user can't tell which face-down card is
  // the walkout — preserving the surprise. Once we leave reveal we rank them
  // best-first so the summary reads like a results podium (top pull top-left).
  // The reorder happens at the reveal→walkout boundary, where the grid is
  // blurred to 12% behind the cinematic, so the shuffle is invisible; for
  // walkout-less packs the `layout` prop on each card animates the reflow.
  const displayPlayers = useMemo(() => {
    if (phase === 'walkout' || phase === 'summary') {
      return [...players].sort((a, b) => b.overall - a.overall);
    }
    return players;
  }, [players, phase]);

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
            {/* Soft tier-coloured ambient glow that gently pulses while we
                load. Sets the tier identity before the pack art appears so
                the user sees "this is going to be a Rare Gold opening" the
                moment the overlay mounts, not 1s later. */}
            {!prefersReducedMotion && (
              <motion.div
                aria-hidden
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                style={{
                  width: 320,
                  height: 320,
                  background: `radial-gradient(circle, color-mix(in srgb, ${tierDef.accent} 35%, transparent) 0%, transparent 65%)`,
                  filter: 'blur(40px)',
                  willChange: 'transform, opacity',
                }}
                animate={{ opacity: [0.45, 0.85, 0.45], scale: [0.95, 1.08, 0.95] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {/* Concentric ring stack — a slow outer ring + the existing fast
                inner spinner. Two speeds give the loading state a bit of
                cinematic depth instead of one flat rotation. */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              {!prefersReducedMotion && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: `1px solid color-mix(in srgb, ${tierDef.accent} 30%, transparent)`,
                    boxShadow: `0 0 24px color-mix(in srgb, ${tierDef.accent} 25%, transparent)`,
                    willChange: 'transform',
                  }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
                >
                  {/* Single bright dot on the outer ring — gives the slow
                      rotation an anchor the eye can track. */}
                  <span
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2 -top-[3px] w-1.5 h-1.5 rounded-full"
                    style={{
                      background: tierDef.accent,
                      boxShadow: `0 0 8px ${tierDef.accent}`,
                    }}
                  />
                </motion.div>
              )}
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
            </div>
            <span
              className="relative mt-5 text-[10px] uppercase tracking-[0.4em] text-white/55"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
            >
              Opening
            </span>
            {/* Pack tier name — sets identity immediately and primes the
                reveal. Gradient-clipped from the tier's own colour pair so
                the type carries its tier signature without competing with
                the spinning ring's accent. */}
            <span
              className="relative mt-1 text-base font-display font-black uppercase tracking-[0.16em] leading-none"
              style={{
                backgroundImage: `linear-gradient(90deg, ${tierDef.gradientFrom}, ${tierDef.gradientTo})`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))',
              }}
            >
              {tierDef.label}
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
            {/* Eyebrow above the pack's own name. It read "Dynasty Pack",
                which was fine when no pack was called that and is not now: the
                weekly promo is "The Dynasty Pack", so the reveal announced
                "DYNASTY PACK / THE DYNASTY PACK" and implied every other pack
                was a Dynasty Pack too. */}
            <span
              className="text-[9px] uppercase font-semibold tracking-[0.42em] text-white/60"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}
            >
              Opening
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
            className="relative flex flex-col items-center justify-center pointer-events-none"
            style={{
              width: 260,
              height: 360,
              perspective: 1200,
              // The charge's live offsets. Applied as style rather than as
              // `animate` keyframes so they update per frame without React
              // re-rendering, and so shake, tilt and scale stay on one clock.
              // Bound for the tear as well as the charge. Handing `scale` back
              // to the `animate` prop at the phase flip made the pack pop from
              // its charged 1.07 to 1 for one frame, because the animate track
              // had not been driving scale during the charge and still held its
              // arrival value. The tear animates the motion value instead.
              ...(phase === 'charge' || phase === 'explode'
                ? { x: shakeX, rotateZ: shakeRotate, scale: packScale }
                : null),
              ...(phase === 'charge' || phase === 'explode' ? { willChange: 'transform' } : null),
            }}
            initial={{ opacity: 0, scale: 0.25, rotateY: 50, rotateX: -20, y: 140 }}
            animate={phase === 'explode' || phase === 'charge'
              ? { opacity: 1, rotateY: 0, rotateX: 0, y: 0 }
              : { opacity: 1, scale: 1, rotateY: 0, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, scale: 1.25 }}
            transition={phase === 'explode'
              ? { duration: 0.25, ease: [0.22, 1, 0.36, 1] }
              : { type: 'spring', stiffness: 220, damping: 16 }}
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
                  style={{ opacity: rayOpacity }}
                  exit={{ opacity: 0 }}
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
                ...(phase === 'charge' || phase === 'explode'
                  ? { opacity: haloOpacity, scale: haloScale }
                  : null),
              }}
              initial={{ opacity: 0.25, scale: 0.85 }}
              animate={phase === 'charge' || phase === 'explode'
                ? {}
                : { opacity: 0.45, scale: 1 }}
              transition={{
                duration: 0.3,
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
              {/* ── The torn strip ──
                  The pack's left edge, cut into slices that peel away one
                  after another from the top down. Each slice carries its own
                  copy of the art under its own STATIC clip-path and animates
                  only transform and opacity, so the travelling tear costs no
                  repaints — see the note in `PACK_ANIM.tear`.

                  Slices further down peel harder and rotate further: the strip
                  is still attached at the bottom while the top is already
                  away, which is what makes it read as tearing rather than as
                  a piece sliding off. */}
              {tearGeometry.strip.map(({ i, clipPath }) => {
                const t = i / Math.max(1, PACK_ANIM.tear.segments - 1);
                return (
                  <motion.div
                    key={`tear-${i}`}
                    className="absolute inset-0"
                    style={{
                      clipPath,
                      willChange: phase === 'explode' ? 'transform, opacity' : 'auto',
                      transformOrigin: '0% 50%',
                      filter: 'drop-shadow(-6px 8px 18px rgba(0,0,0,0.55))',
                    }}
                    initial={{ x: 0, rotate: 0, opacity: 1 }}
                    animate={phase === 'explode'
                      // Travel is deliberately short. A 17%-wide strip on a
                      // 260px pack is ~44px, so it is clear of the pack after
                      // 44px and everything beyond that happens off-screen: at
                      // -150 the strip was gone within 60ms and the peel was
                      // never visible. It comes away, curls, and fades in view.
                      ? { x: -66 - 58 * t, rotate: -17 - 21 * t, opacity: [1, 1, 0] }
                      : { x: 0, rotate: 0, opacity: 1 }}
                    transition={phase === 'explode'
                      ? {
                          // Transform gets the snappy near-exponential ease —
                          // that is what makes it read as a rip rather than a
                          // slide. Opacity must NOT share it: on that curve the
                          // slice is 80% faded within ~100ms, which is why the
                          // pack appeared to vanish instead of tear.
                          default: {
                            duration: PACK_ANIM.tear.segmentMs / 1000,
                            delay: (i * PACK_ANIM.tear.staggerMs) / 1000,
                            ease: [0.22, 1, 0.36, 1],
                          },
                          opacity: {
                            duration: PACK_ANIM.tear.segmentMs / 1000,
                            delay: (i * PACK_ANIM.tear.staggerMs) / 1000,
                            times: [0, 0.72, 1],
                            ease: 'linear',
                          },
                        }
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
                );
              })}

              {/* ── The pack body ──
                  Everything right of the seam. It leans away from the tear and
                  settles rather than dropping: the strip is what moves, the
                  body is what is being opened. */}
              <motion.div
                className="absolute inset-0"
                style={{
                  clipPath: tearGeometry.bodyClip,
                  willChange: phase === 'explode' ? 'transform, opacity' : 'auto',
                  transformOrigin: '100% 50%',
                  filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))',
                }}
                initial={{ x: 0, rotate: 0, opacity: 1 }}
                animate={phase === 'explode'
                  ? { x: 26, rotate: 2.5, opacity: [1, 1, 0] }
                  : { x: 0, rotate: 0, opacity: 1 }}
                transition={phase === 'explode'
                  ? {
                      default: { duration: 0.62, ease: [0.22, 1, 0.36, 1] },
                      opacity: { duration: 0.62, times: [0, 0.5, 1], ease: 'linear' },
                    }
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

              {/* ── The tear head ──
                  A hot point of light that runs DOWN the seam, arriving at
                  each slice just as that slice starts to peel. This is what
                  actually sells the direction of the tear: the slices alone
                  read as "the edge came off", the travelling head reads as
                  "something is tearing it, and it is here now". Timed off the
                  same stagger, so the two can never disagree. */}
              <AnimatePresence>
                {phase === 'explode' && (
                  <motion.div
                    key="tear-head"
                    className="absolute pointer-events-none"
                    style={{
                      left: `${tearGeometry.seamXPct}%`,
                      top: 0,
                      width: 10,
                      height: 40,
                      marginLeft: -5,
                      borderRadius: 99,
                      background: `radial-gradient(circle, #fff 0%, ${tierDef.accent} 45%, transparent 72%)`,
                      boxShadow: `0 0 26px ${tierDef.accent}, 0 0 54px white`,
                      filter: 'blur(1px)',
                    }}
                    initial={{ y: '-10%', opacity: 0, scaleY: 0.6 }}
                    animate={{ y: '105%', opacity: [0, 1, 1, 0], scaleY: [0.6, 1, 1, 0.7] }}
                    transition={{
                      duration: (PACK_ANIM.tear.staggerMs * PACK_ANIM.tear.segments + 160) / 1000,
                      ease: 'easeIn',
                    }}
                  />
                )}
              </AnimatePresence>

              {/* The open seam behind the departing strip — a bright edge left
                  where the foil was, fading as the whole pack goes. */}
              <AnimatePresence>
                {phase === 'explode' && (
                  <motion.div
                    key="seam-flash"
                    className="absolute pointer-events-none"
                    style={{
                      left: `${tearGeometry.seamXPct}%`,
                      top: 0,
                      bottom: 0,
                      width: 5,
                      marginLeft: -2,
                      background: `linear-gradient(180deg, transparent, ${tierDef.accent}, white, ${tierDef.accent}, transparent)`,
                      boxShadow: `0 0 24px ${tierDef.accent}, 0 0 48px white`,
                      filter: 'blur(1px)',
                    }}
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={{ opacity: [0, 1, 1, 0], scaleY: [0, 1, 1, 1] }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
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
                      opacity: leakOpacity,
                    }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>

              {/* ── Where it is about to tear ──
                  Energy gathers along the vertical seam during the charge, so
                  by the time the pack rips the player has been staring at the
                  line it rips along for a second and a half. It used to gather
                  on a horizontal line across the top third, which is where the
                  pack used to open. */}
              <AnimatePresence>
                {phase === 'charge' && (
                  <motion.div
                    key="seam-energy"
                    className="absolute pointer-events-none"
                    style={{
                      left: `${tearGeometry.seamXPct}%`,
                      top: 0,
                      bottom: 0,
                      width: 44,
                      marginLeft: -22,
                      opacity: leakOpacity,
                    }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Soft bloom hugging the seam */}
                    <div
                      className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-11"
                      style={{
                        background: `radial-gradient(100% 70% at 50% 50%, color-mix(in srgb, ${tierDef.accent} 50%, transparent), transparent 72%)`,
                        mixBlendMode: 'screen',
                        filter: 'blur(7px)',
                      }}
                    />
                    {/* Energy glow line */}
                    <motion.div
                      className="absolute top-3 bottom-3 left-1/2 -translate-x-1/2"
                      style={{
                        width: 3,
                        borderRadius: 99,
                        background: `linear-gradient(180deg, transparent, ${tierDef.accent}, #fff, ${tierDef.accent}, transparent)`,
                        boxShadow: `0 0 14px ${tierDef.accent}, 0 0 30px color-mix(in srgb, ${tierDef.accent} 55%, transparent)`,
                      }}
                      animate={prefersReducedMotion
                        ? { opacity: 0.95 }
                        : { opacity: [0.45, 1, 0.6, 1], scaleY: [0.8, 1, 0.88, 1] }}
                      transition={prefersReducedMotion ? undefined : { duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    {/* Sparks flicking sideways off the seam */}
                    {!prefersReducedMotion && seamSparks.map(s => (
                      <motion.span
                        key={`spark-${s.i}`}
                        className="absolute rounded-full"
                        style={{
                          top: `${s.along}%`,
                          left: '50%',
                          width: 3,
                          height: 3,
                          background: '#fff',
                          boxShadow: `0 0 6px ${tierDef.accent}`,
                        }}
                        initial={{ opacity: 0, x: 0 }}
                        animate={{ opacity: [0, 1, 0], x: s.up ? -s.dist : s.dist }}
                        transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, repeatDelay: 0.5, ease: 'easeOut' }}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Continuous shimmer sweep on arrival */}
              {phase === 'arrival' && !prefersReducedMotion && (
                <motion.div
                  className="absolute inset-0 pointer-events-none overflow-hidden"
                  style={{
                    background: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.18) 50%, transparent 62%)',
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

      {/* ── Tap anywhere to rip ──
          A full-bleed target rather than a hit box on the pack art. Two
          reasons. The pack is a 260x360 shape in the middle of a phone screen,
          so aiming at it is a small-target task at the exact moment the player
          is excited and jabbing; and it covers `loading` and `portal`, the two
          beats that used to swallow the first tap entirely. Sits under the
          pack in z-order so nothing here intercepts a card reveal later. */}
      {canRip && (
        <button
          type="button"
          onClick={tapToRip}
          className="absolute inset-0 z-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40"
          aria-label="Tap to rip open the pack"
        />
      )}

      {/* Tap-to-open hint. Shown from the moment the pack lands, not from the
          charge beat — the pack accepts a tap well before then and a hint that
          arrives after the affordance does is a hint that arrives too late. */}
      <AnimatePresence>
        {(phase === 'arrival' || phase === 'charge') && (
          <motion.div
            key="rip-hint"
            className="absolute left-1/2 -translate-x-1/2 top-[calc(50%+200px)] text-center pointer-events-none"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
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
          {ambientMotes.map(m => (
            <motion.span
              key={m.i}
              className="absolute rounded-full"
              style={{
                width: m.size, height: m.size, left: `${m.x}%`, bottom: '20%',
                background: tierDef.accent,
                transform: 'translateZ(0)',
                willChange: 'transform, opacity',
              }}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 0.9, 0], y: -m.rise }}
              transition={{ duration: m.duration, delay: m.delay, repeat: Infinity, ease: 'easeOut' }}
            />
          ))}
        </div>
      )}

      {/* Explosion — shockwave + flash + foil shreds + confetti. The
          shred layer is deterministic per-render but visually random:
          18 small foil rectangles fly out from the seam in a 360° spread
          to sell the "ripped wrapper" feel a Pokémon-pack opening lives on. */}
      <AnimatePresence>
        {burstMounted && (
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
              transition={{
                duration: 0.55,
                delay: PACK_ANIM.tear.burstDelayMs / 1000,
                ease: [0.22, 1, 0.36, 1],
              }}
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
              transition={{
                duration: 0.36,
                delay: PACK_ANIM.tear.burstDelayMs / 1000,
                times: [0, 0.3, 1],
                ease: [0.22, 1, 0.36, 1],
              }}
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

      {/* Pity hit banner — a small premium glass chip that announces the
          guarantee paid off. Uses gold rather than the generic primary
          accent so it visually echoes the PacksPage Guarantee Tracker
          and feels like the same "reward unlocked" moment landing. */}
      <AnimatePresence>
        {pityTriggered && (phase === 'reveal' || phase === 'summary') && (
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 top-[max(env(safe-area-inset-top),16px)] flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.22em] font-display font-bold text-amber-100 backdrop-blur-md"
            style={{
              background: 'linear-gradient(180deg, rgba(251,191,36,0.22), rgba(251,191,36,0.10))',
              border: '1px solid rgba(251,191,36,0.45)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 22px -10px rgba(251,191,36,0.55)',
            }}
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <motion.span
              aria-hidden
              className="text-amber-200"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              ✦
            </motion.span>
            <span>{t('packOpeningOverlay.guaranteeUnlocked')}</span>
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
            // Dim + push the grid back during a walkout with opacity + scale
            // only. The old animated `filter: blur()+saturate()` re-rastered the
            // whole card subtree every frame; at 0.12 opacity it's barely
            // visible anyway, so the cheap transform/opacity dim reads the same.
            opacity: phase === 'walkout' ? 0.12 : 1,
            scale: phase === 'walkout' ? 0.92 : 1,
          }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ willChange: phase === 'walkout' ? 'opacity, transform' : 'auto' }}
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
                  <CountUpMoney value={players.reduce((s, p) => s + (p.value || 0), 0)} />
                </span>
              </p>
              {/* Best-pull rarity chip — tints the results header with the
                  top card's tier so the headline rarity of the pack reads at
                  a glance, echoing the same tier palette the cards' auras use. */}
              {topOvr > 0 && (
                <motion.div
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-display font-bold uppercase tracking-[0.22em] text-white"
                  style={{
                    background: `linear-gradient(135deg, ${topTier.gradientFrom}33, ${topTier.gradientTo}1f)`,
                    border: `1px solid ${topTier.gradientVia}66`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 6px 18px -10px ${topTier.gradientVia}99`,
                  }}
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.14 }}
                >
                  <span aria-hidden style={{ color: topTier.gradientVia, textShadow: `0 0 8px ${topTier.gradientVia}` }}>★</span>
                  <span>Best pull · {topTier.label}</span>
                </motion.div>
              )}
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
            {displayPlayers.map((p, i) => {
              const quickSellAmount = Math.min(quickSellRemaining, Math.max(0, Math.round((p.value || 0) * PACK_QUICK_SELL_RATE)));
              const upgrade = improvement?.[p.id];
              const placementLabel = placement?.[p.id] ? PLACEMENT_LABEL[placement[p.id]] : null;
              return (
                <motion.div key={p.id} layout="position" className="flex flex-col items-center gap-2">
                  <div className="relative" style={{ width: PLAYER_CARD_SIZE_PX.lg }}>
                    <PackCard
                      player={p}
                      revealed={revealedSet.has(p.id) || phase === 'summary'}
                      onReveal={
                        phase === 'reveal'
                          ? walkoutPlayerIds.has(p.id)
                            ? () => triggerWalkout(p.id)
                            : () => revealOne(p.id)
                          : undefined
                      }
                      entranceDelay={prefersReducedMotion ? 0 : i * (PACK_ANIM.revealStaggerMs / 1000)}
                    />
                    {/* Upgrade badge — gold pill that springs in slightly
                        after the card when the pulled player out-rates the
                        user's current best at the same position. */}
                    {phase === 'summary' && upgrade && (
                      <motion.div
                        className="absolute -top-1 -right-1 z-10 flex items-center gap-0.5 px-1.5 py-[3px] rounded-md text-[9px] font-display font-black uppercase tracking-[0.06em] tabular-nums leading-none"
                        style={{
                          color: '#3a2400',
                          background: 'linear-gradient(180deg, #fde68a, #f59e0b)',
                          border: '1px solid rgba(255,255,255,0.55)',
                          boxShadow:
                            'inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(120,60,0,0.4), 0 4px 14px -4px rgba(251,191,36,0.55)',
                        }}
                        initial={{ opacity: 0, y: -6, scale: 0.7 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.35 + i * 0.06 }}
                        aria-label={`Upgrade — ${upgrade.delta} OVR better than your current ${p.position}`}
                      >
                        <span aria-hidden>↑</span>
                        <span>+{upgrade.delta}</span>
                      </motion.div>
                    )}
                    {/* Placement chip — where openPack auto-slotted the pull
                        (straight into the XI / bench / squad depth). Subtle
                        glass pill, mirrors the upgrade badge's entrance. */}
                    {phase === 'summary' && placementLabel && (
                      <motion.div
                        className="absolute -bottom-1.5 left-1/2 z-10 max-w-full whitespace-nowrap px-1.5 py-[3px] rounded-md text-[8px] font-display font-bold uppercase tracking-[0.06em] leading-none text-white/90 bg-white/10 border border-white/25 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_-6px_rgba(0,0,0,0.6)]"
                        initial={{ opacity: 0, y: 6, x: '-50%', scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 20, delay: 0.45 + i * 0.06 }}
                      >
                        {placementLabel}
                      </motion.div>
                    )}
                  </div>
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
                        <span>{t('packOpeningOverlay.sell')}</span>
                        <span className="tabular-nums tracking-tight text-[9px] font-black">
                          {formatMoney(quickSellAmount)}
                        </span>
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {phase === 'summary' && players.length >= 2 && (onKeepAll || onSellAll) && (() => {
            // Sell All pays out of the same per-open cap the singles do, so
            // its total is the SUM clamped to what is left of the cap.
            const sellAllTotal = Math.min(
              quickSellRemaining,
              players.reduce(
                (sum, p) => sum + Math.max(0, Math.round((p.value || 0) * PACK_QUICK_SELL_RATE)),
                0,
              ),
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
              className={cn(
                'mt-1 px-6 py-2.5 rounded-full',
                'text-[11px] font-display font-bold uppercase tracking-[0.22em] text-white',
                'bg-white/[0.08] border border-white/20 backdrop-blur-xl backdrop-saturate-150',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_22px_-12px_rgba(0,0,0,0.6)]',
                'active:scale-[0.97] active:bg-white/[0.14] transition-[transform,background-color] duration-150',
              )}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
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
          <WalkoutReveal key={currentWalkout.id} player={currentWalkout} onComplete={onWalkoutComplete} onAdvance={advanceWalkout} />
        )}
      </AnimatePresence>
    </motion.div>
  );

  // Portal into document.body so we sit above everything
  if (typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
}
