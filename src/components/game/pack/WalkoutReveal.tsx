import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import type { Player } from '@/types/game';
import { CardBack } from '@/components/game/pack/CardBack';
import { getPlayerCardArt } from '@/utils/uiHelpers';
import { PlayerCard } from '@/components/game/PlayerCard';
import { PACK_ANIM, LEGENDARY_OVR_THRESHOLD } from '@/config/packs';
import { tierForOvr } from './packHelpers';
import { PackConfetti } from './PackConfetti';
import { WalkoutStadium } from './WalkoutStadium';
import { useTypewriter } from './useTypewriter';
import { hapticHeavy, hapticLight, hapticMedium } from '@/utils/haptics';
import { resolveLegend } from '@/utils/legends';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';

interface WalkoutRevealProps {
  player: Player;
  /** Called when the walkout finishes and the card should fall back into the grid. */
  onComplete: () => void;
  /** Called when the user taps to hurry an already-finished hero — advance now
   *  instead of waiting out the inter-hero linger. */
  onAdvance?: () => void;
}

// Walkout hero card width. xl PlayerCard is 220px natural — we scale to
// this width so the card reads bigger than any other card in the app
// without leaving the reusable PlayerCard visual behind.
const WALKOUT_CARD_W = 244;
const PLAYER_CARD_XL_W = 220;
const CARD_SCALE = WALKOUT_CARD_W / PLAYER_CARD_XL_W;

/** Soft drift of tier-coloured particles behind the hero card. Slow, blurred,
 *  near-transparent — meant to read as ambient atmosphere, not confetti.
 *  Deterministic per-mount so motion stays consistent between re-renders. */
function ParticleDrift({ accent, count = 14 }: { accent: string; count?: number }) {
  const particles = useMemo(() => {
    const seed = Math.random() * 10_000;
    return Array.from({ length: count }, (_, i) => {
      const r = (seed + i * 31) % 1;
      const r2 = (seed * 1.7 + i * 17) % 1;
      const r3 = (seed * 2.3 + i * 7) % 1;
      const r4 = (seed * 3.1 + i * 5) % 1;
      return {
        i,
        x: 10 + r * 80, // %
        size: 3 + r2 * 5, // px
        duration: 6 + r3 * 6, // s
        delay: r4 * 5, // s
        opacity: 0.15 + r2 * 0.25,
      };
    });
  }, [count]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {particles.map(p => (
        <motion.span
          key={`particle-${p.i}`}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            bottom: -8,
            width: p.size,
            height: p.size,
            background: accent,
            boxShadow: `0 0 ${p.size * 2}px ${accent}`,
            filter: 'blur(0.5px)',
            opacity: p.opacity,
            willChange: 'transform, opacity',
          }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: '-110vh', opacity: [0, p.opacity, p.opacity, 0] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeOut',
            times: [0, 0.12, 0.78, 1],
          }}
        />
      ))}
    </div>
  );
}

/** Big tickered OVR overlay that floods the frame at the flip moment.
 *  This is the single highest-impact number in the cinematic — the
 *  rating dictates everything downstream — so it gets the biggest
 *  visual treatment: scale-in, fast tick from 0, golden glow, then a
 *  graceful fade as the stats start landing. */
function OvrOverlay({ value, accent, durationMs, rollMs }: {
  value: number;
  accent: string;
  durationMs: number;
  rollMs: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = performance.now();
    // The count itself is shorter than the overlay, so the number lands and
    // is then HELD at its final value for the rest of the beat. A roll that
    // runs the full overlay never rests on the answer.
    const dur = Math.max(280, rollMs);
    let raf = 0;
    // Read the clock rather than trusting rAF's argument. They are the same
    // clock in a normal browser, but the marketing capture rig scales
    // `performance.now` to slow the page down and cannot touch the rAF
    // timestamp — mixing the two made the roll finish on its second frame, so
    // every captured walkout landed on the final rating with no count at all.
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / dur);
      // Punchy easeOut quad so the number lands fast and settles slow.
      const eased = 1 - Math.pow(1 - t, 2);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, rollMs]);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      // Two plain tweens, not a keyframe track. The keyframed version
      // (`opacity: [0, 1, 1, 0]` with a `times` array) measured 0.38 opacity a
      // third of the way through the beat — the number was still fading in
      // while it was already counting, and it never reached full before
      // AnimatePresence tore it down. A snap-in tween plus an `exit` fade is
      // both simpler and what the beat actually wants: land hard, hold, go.
      initial={{ opacity: 0, scale: 0.55 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      aria-hidden
    >
      {/* Scrim. The number lands ON the card, and a walkout card is often
          near-white (icon marble, silver, the gold frames' highlights), so
          white type needs its own ground to sit on. */}
      <div
        className="absolute"
        style={{
          width: 'min(86vw, 420px)',
          height: 'min(86vw, 420px)',
          background: 'radial-gradient(circle, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.34) 42%, transparent 68%)',
          filter: 'blur(6px)',
        }}
      />
      <span
        className="relative font-display font-black leading-none tabular-nums select-none"
        style={{
          fontSize: 'clamp(140px, 46vw, 280px)',
          color: '#fff',
          WebkitTextStroke: `3px ${accent}`,
          // No mix-blend-mode. `screen` cannot darken, so over the white
          // marble of an icon card the white number composited to exactly the
          // card beneath it and the biggest beat in the walkout was invisible
          // on every take. Legibility here is carried by the scrim + a hard
          // dark shadow instead, which works on any card in the set.
          textShadow: `0 0 24px rgba(0,0,0,0.92), 0 0 70px ${accent}dd, 0 0 140px ${accent}66, 0 8px 30px rgba(0,0,0,0.8)`,
          letterSpacing: '-0.03em',
        }}
      >
        {display}
      </span>
    </motion.div>
  );
}

// Order + labels match the on-card row in PlayerCard so the stat reveal
// visually echoes the card the user is about to see flip face-up. DRI is
// the canonical FC-style label for the `mental` attribute.
const ATTRIBUTE_ROW: Array<{ key: keyof Player['attributes']; label: string }> = [
  { key: 'pace', label: 'PAC' },
  { key: 'shooting', label: 'SHO' },
  { key: 'passing', label: 'PAS' },
  { key: 'mental', label: 'DRI' },
  { key: 'defending', label: 'DEF' },
  { key: 'physical', label: 'PHY' },
];

/** Single attribute pill that ticks from 0 to its final value over ~360ms,
 *  delayed by its index in the row so the stats reveal in sequence. Each
 *  pill pops in scale (1 → 1.18 → 1) when its number lands — every stat
 *  is its own little hit. The final pill in the row also fires the
 *  crescendo callback (heavier haptic + halo flash in the parent). */
function AttributePill({
  label,
  value,
  accent,
  delay,
  isCrescendo,
  onCrescendo,
  prefersReducedMotion,
}: {
  label: string;
  value: number;
  accent: string;
  delay: number;
  isCrescendo: boolean;
  onCrescendo?: () => void;
  prefersReducedMotion: boolean;
}) {
  const [display, setDisplay] = useState(prefersReducedMotion ? value : 0);
  // Drives the pop-on-land scale animation. Toggling this is what tells
  // framer-motion to animate from current scale to the keyframes.
  const [landed, setLanded] = useState(prefersReducedMotion);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value);
      setLanded(true);
      if (isCrescendo) onCrescendo?.();
      return;
    }
    // RAF id lives in the effect scope (not inside the setTimeout callback)
    // so the cleanup can actually cancel it — a function returned from a
    // setTimeout callback is discarded, so the old `return () =>
    // cancelAnimationFrame(raf)` inside the timer was dead code and the
    // count-up kept ticking after unmount.
    let raf = 0;
    const startTimer = window.setTimeout(() => {
      hapticLight();
      const start = performance.now();
      const dur = 360;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(Math.round(value * eased));
        if (t < 1) {
          raf = requestAnimationFrame(tick);
        } else {
          // Number landed — pop the pill scale and fire crescendo if this
          // is the final pill in the row.
          setLanded(true);
          if (isCrescendo) onCrescendo?.();
        }
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(startTimer);
      cancelAnimationFrame(raf);
    };
  }, [value, delay, isCrescendo, onCrescendo, prefersReducedMotion]);

  return (
    <motion.div
      className="flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 backdrop-blur-md"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: `1px solid ${accent}40`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 12px ${accent}1a`,
        minWidth: 44,
      }}
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={
        landed && !prefersReducedMotion
          ? { opacity: 1, y: 0, scale: [1, 1.18, 1] }
          : { opacity: 1, y: 0, scale: 1 }
      }
      transition={
        landed && !prefersReducedMotion
          ? { duration: 0.32, ease: [0.22, 1, 0.36, 1] }
          : { duration: 0.35, delay: delay / 1000, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <span className="text-[8px] uppercase tracking-[0.2em] font-semibold" style={{ color: `${accent}cc` }}>
        {label}
      </span>
      <span
        className="text-base font-display font-black tabular-nums leading-none"
        style={{ color: '#fff', textShadow: `0 0 12px ${accent}66` }}
      >
        {display}
      </span>
    </motion.div>
  );
}

/**
 * 84+ hero reveal. The walkout card IS the real {@link PlayerCard} under a
 * cinematic frame — no bespoke card visual, so the walkout matches every
 * other card surface in the app pixel for pixel.
 *
 * Beats (all durations in PACK_ANIM.walkout):
 *   enter  → card scales in face-down (tier back, holo ring, halo)
 *   name   → typewriter name + tier label under the card
 *   breath → held-breath stillness; particles dim, no haptic
 *   flip   → 3D Y-flip reveals the real PlayerCard; flash, shockwave,
 *            and a massive OVR ticker floods the frame
 *   stats  → 6 attribute pills tick 0 → value and pop on landing; the
 *            final pill triggers the crescendo (halo bloom + confetti +
 *            heavy haptic)
 *   hold   → potential bar slides in; gentle card bob
 *   done   → onComplete()
 *
 * Total ≈ 6.3s. Tap anywhere on the scene (or the explicit Skip pill at
 * the bottom) to skip — a thin progress arc on the pill shows how long
 * is left. Tier-coloured particles drift the whole cinematic for ambient
 * atmosphere; legendary tier adds the stadium dressing.
 */
export function WalkoutReveal({ player, onComplete, onAdvance }: WalkoutRevealProps) {
  const { t } = useTranslation();
  const tier = tierForOvr(player.overall);
  // Hall of Legends provenance. Without this the feature is invisible at its
  // own money moment — a 95 hall icon and a 95 ordinary pull revealed
  // identically. Resolves against the seed set + this save's archive; an
  // unknown id degrades to a normal reveal, per the `legendId` contract.
  const retiredLegends = useGameStore(s => s.retiredLegends);
  const legend = resolveLegend(player.legendId, retiredLegends);
  const isLegendary = player.overall >= LEGENDARY_OVR_THRESHOLD;
  const prefersReducedMotion = useReducedMotionPref();

  const [phase, setPhase] = useState<'enter' | 'name' | 'breath' | 'flip' | 'stats' | 'hold' | 'done'>('enter');
  // Crescendo flash — pulses on top of the halo when the LAST stat pill
  // lands. The visual payoff that closes the stats sequence.
  const [crescendoPulse, setCrescendoPulse] = useState(false);
  // Held in a ref so unmount can cancel the deferred reset and we never
  // setState on an unmounted component (would warn + leak).
  const crescendoResetTimerRef = useRef<number | null>(null);

  const triggerCrescendo = useCallback(() => {
    hapticHeavy();
    setCrescendoPulse(true);
    if (crescendoResetTimerRef.current !== null) {
      window.clearTimeout(crescendoResetTimerRef.current);
    }
    crescendoResetTimerRef.current = window.setTimeout(() => {
      crescendoResetTimerRef.current = null;
      setCrescendoPulse(false);
    }, 900);
  }, []);

  useEffect(() => () => {
    if (crescendoResetTimerRef.current !== null) {
      window.clearTimeout(crescendoResetTimerRef.current);
      crescendoResetTimerRef.current = null;
    }
  }, []);

  const name = `${player.firstName} ${player.lastName}`.toUpperCase();
  const typed = useTypewriter(
    name,
    PACK_ANIM.walkout.typewriterPerCharMs,
    phase === 'name' || phase === 'breath' || phase === 'flip' || phase === 'stats' || phase === 'hold',
    !!prefersReducedMotion,
  );

  // Total cinematic length — used by the skip-progress arc.
  const enterMs = PACK_ANIM.walkout.enterMs;
  const nameMs = Math.max(560, name.length * PACK_ANIM.walkout.typewriterPerCharMs + 140);
  const breathMs = PACK_ANIM.walkout.breathMs;
  const flipMs = PACK_ANIM.walkout.flipMs;
  const statsMs = PACK_ANIM.walkout.statsMs;
  const holdMs = PACK_ANIM.walkout.holdMs;
  const totalMs = enterMs + nameMs + breathMs + flipMs + statsMs + holdMs;

  useEffect(() => {
    hapticLight();
    const t1 = window.setTimeout(() => { setPhase('name'); hapticMedium(); }, enterMs);
    // Held breath — the moment of silence before the climax. No haptic
    // on entry; the absence of feedback IS the feedback.
    const t2 = window.setTimeout(() => { setPhase('breath'); }, enterMs + nameMs);
    // Climax — flip + heavy haptic + (kicked off in render) big OVR overlay.
    const t3 = window.setTimeout(() => { setPhase('flip'); hapticHeavy(); }, enterMs + nameMs + breathMs);
    const t4 = window.setTimeout(() => { setPhase('stats'); }, enterMs + nameMs + breathMs + flipMs);
    const t5 = window.setTimeout(() => { setPhase('hold'); hapticMedium(); }, enterMs + nameMs + breathMs + flipMs + statsMs);
    const t6 = window.setTimeout(() => { setPhase('done'); onComplete(); }, totalMs);

    return () => { [t1, t2, t3, t4, t5, t6].forEach(window.clearTimeout); };
  }, [enterMs, nameMs, breathMs, flipMs, statsMs, holdMs, totalMs, onComplete]);

  const skip = () => {
    // Already finished and holding on the final frame — a tap means "hurry up",
    // so advance to the next hero/summary immediately instead of doing nothing.
    if (phase === 'done') { onAdvance?.(); return; }
    setPhase('done');
    onComplete();
  };

  const revealed = phase === 'flip' || phase === 'stats' || phase === 'hold';
  const statsActive = phase === 'stats' || phase === 'hold';
  // OVR overlay rides the flip → start of stats. Fades out as the stats
  // pills start landing so it never competes with them.
  const ovrOverlayActive = phase === 'flip';
  // Held-breath beat — visual cue is that we briefly de-saturate the halo
  // / dim the particles so the moment really lands as silence.
  const isBreath = phase === 'breath';
  // The back is masked with the SAME art the face renders, so the flip is
  // shape-perfect whatever shield or frame this player carries. Mirrors the
  // getPlayerCardArt call inside PlayerCard (never a chip at this size).
  const backMaskSrc = getPlayerCardArt(player.overall, {
    ballonDorTop10: typeof player.ballonDOrTop10HoldSeason === 'number',
    packFrame: player.packFrame,
  }).src;
  const tierGradient = `linear-gradient(135deg, ${tier.gradientFrom} 0%, ${tier.gradientVia} 45%, ${tier.gradientTo} 100%)`;

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0, scale: 1 }}
      // Slow cinematic camera push-in across the walkout.
      animate={{ opacity: 1, scale: prefersReducedMotion ? 1 : 1.05 }}
      exit={{ opacity: 0 }}
      transition={{ opacity: { duration: 0.25 }, scale: { duration: 6.5, ease: 'easeOut' } }}
      onClick={skip}
    >
      {/* Deep tier vignette — darker than the overlay behind it so the grid
          of reveal cards visually recedes even further during the walkout. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 46%, ${tier.gradientFrom}26 0%, rgba(0,0,0,0.82) 52%, #000 85%)`,
        }}
      />

      {/* Soft tier-coloured particle drift — ambient atmosphere that runs
          the whole cinematic. Reads as fairy dust rising through the
          frame; never competes with the hero card for attention.
          Dims during the held-breath beat so the silence is felt as
          silence, then snaps back to full intensity at the climax. */}
      {!prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ opacity: isBreath ? 0.35 : 1 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <ParticleDrift accent={tier.gradientVia} count={isLegendary ? 20 : 14} />
        </motion.div>
      )}

      {/* Legendary stadium dressing — spotlight, igniting floodlights, fog,
          a hero silhouette behind the card, and a crowd flecked with
          camera flashes. Only the very top tier earns the full walkout. */}
      {isLegendary && <WalkoutStadium accent={tier.gradientVia} revealed={revealed} />}

      {/* Legendary rotating sun rays — tempo slowed; blur dropped so rays
          stay on the compositor fast path. */}
      {isLegendary && !prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ willChange: 'transform' }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 32, ease: 'linear' }}
        >
          <div
            className="w-[160vw] h-[160vw] max-w-none rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, rgba(253,224,71,0.0) 0deg, rgba(253,224,71,0.16) 6deg, rgba(253,224,71,0.0) 14deg, rgba(253,224,71,0.0) 45deg, rgba(253,224,71,0.12) 52deg, rgba(253,224,71,0.0) 60deg, rgba(253,224,71,0.0) 90deg, rgba(253,224,71,0.16) 98deg, rgba(253,224,71,0.0) 106deg, rgba(253,224,71,0.0) 135deg, rgba(253,224,71,0.12) 142deg, rgba(253,224,71,0.0) 150deg, rgba(253,224,71,0.0) 180deg, rgba(253,224,71,0.16) 188deg, rgba(253,224,71,0.0) 196deg, rgba(253,224,71,0.0) 225deg, rgba(253,224,71,0.12) 232deg, rgba(253,224,71,0.0) 240deg, rgba(253,224,71,0.0) 270deg, rgba(253,224,71,0.16) 278deg, rgba(253,224,71,0.0) 286deg, rgba(253,224,71,0.0) 315deg, rgba(253,224,71,0.12) 322deg, rgba(253,224,71,0.0) 330deg, rgba(253,224,71,0.0) 360deg)',
            }}
          />
        </motion.div>
      )}

      {/* Tier halo behind the card */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[54%] rounded-full pointer-events-none"
        style={{
          width: 460,
          height: 460,
          background: `radial-gradient(circle, ${tier.gradientVia}44 0%, ${tier.gradientTo}1a 38%, transparent 72%)`,
          filter: 'blur(30px)',
        }}
      />

      {/* Legendary breathing aura */}
      {isLegendary && !prefersReducedMotion && (
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[54%] rounded-full pointer-events-none"
          style={{
            width: '80vw',
            maxWidth: 520,
            height: 520,
            background: `radial-gradient(ellipse at center, ${tier.gradientVia}33 0%, ${tier.gradientTo}1a 45%, transparent 72%)`,
            willChange: 'transform, opacity',
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: [0.55, 0.9, 0.55], scale: [0.96, 1.05, 0.96] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Floor glow disc */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-[64%] rounded-full pointer-events-none"
        style={{
          width: 280,
          height: 64,
          background: `radial-gradient(ellipse at center, ${tier.gradientTo}aa 0%, transparent 70%)`,
          filter: 'blur(8px)',
        }}
      />

      {/* Flip-beat flash — short bright overlay on card flip. */}
      <AnimatePresence>
        {phase === 'flip' && !prefersReducedMotion && (
          <motion.div
            key="flash"
            className="absolute inset-0 bg-white pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.22, 0] }}
            transition={{ duration: 0.35, times: [0, 0.35, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Crescendo halo pulse — fires when the LAST stat pill lands. A
          brief bright bloom centred on the card closes the stats reveal
          with a "yes!" moment before settling into the hold phase. */}
      <AnimatePresence>
        {crescendoPulse && !prefersReducedMotion && (
          <motion.div
            key="crescendo-pulse"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[54%] rounded-full pointer-events-none"
            style={{
              width: 560,
              height: 560,
              background: `radial-gradient(circle, #fff 0%, ${tier.gradientVia}55 22%, transparent 60%)`,
              filter: 'blur(18px)',
              mixBlendMode: 'screen',
            }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: [0, 0.95, 0], scale: [0.7, 1.15, 1.3] }}
            transition={{ duration: 0.85, times: [0, 0.32, 1], ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Crescendo confetti burst — a quick burst of tier-coloured sparks
          on the last stat landing. Legendary-only confetti already fires
          elsewhere; this one runs for every walkout so the close beat
          always lands with a sensory hit. */}
      {crescendoPulse && !prefersReducedMotion && (
        <PackConfetti count={16} hueBase={48} hueRange={28} />
      )}

      {/* Floor shockwave rings on flip — expand outward at the reveal
          moment for weight. Three staggered rings over ~1.3s each. */}
      {revealed && [0, 0.18, 0.36].map((d, i) => (
        <motion.div
          key={`ring-${i}`}
          className="absolute left-1/2 -translate-x-1/2 top-[66%] rounded-full pointer-events-none"
          style={{
            border: `2px solid ${tier.gradientVia}`,
            boxShadow: `0 0 24px ${tier.gradientVia}`,
          }}
          initial={{ width: 40, height: 14, opacity: 0.9 }}
          animate={{ width: 560, height: 200, opacity: 0 }}
          transition={{ duration: 1.3, delay: d, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}

      {/* Hero card — 3D flip wrapper around the face-down back and a real
          PlayerCard on the face. Scales the xl PlayerCard (220px) up to
          244px so the walkout reads larger than any other card surface
          without introducing a bespoke visual.
          The card rises ~36px during the stats/hold beats so the stats
          row + potential bar below have breathing room on small phones
          (iPhone SE class). The upward shift feels intentional — the
          card lifting to make space for its own info to come in. */}
      <motion.div
        className="relative"
        style={{
          width: WALKOUT_CARD_W,
          aspectRatio: '2 / 3',
          perspective: 1400,
          willChange: 'transform, opacity',
        }}
        initial={{ opacity: 0, scale: 0.45, y: 40 }}
        animate={{
          opacity: 1,
          scale: phase === 'hold' && !prefersReducedMotion ? [1, 1.015, 1] : 1,
          y: phase === 'stats' || phase === 'hold'
            ? (phase === 'hold' && !prefersReducedMotion ? [-50, -54, -50] : -50)
            : 0,
        }}
        transition={
          phase === 'hold' && !prefersReducedMotion
            ? { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }
            : phase === 'stats'
              ? { y: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }, default: { type: 'spring', stiffness: 220, damping: 22 } }
              : { type: 'spring', stiffness: 220, damping: 22 }
        }
      >
        {/* Holographic rotating ring just outside the card edge */}
        <div className="absolute -inset-[4px] rounded-[22px] holo-ring pointer-events-none" aria-hidden />

        {/* Tier-tinted inner glow — static under reduced motion. */}
        <motion.div
          className="absolute -inset-[2px] rounded-[20px] pointer-events-none"
          style={{ background: tierGradient, filter: 'blur(12px)', opacity: 0.55 }}
          animate={prefersReducedMotion ? undefined : { opacity: [0.42, 0.72, 0.42] }}
          transition={prefersReducedMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Flip card wrapper */}
        <motion.div
          className="absolute inset-0"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: revealed ? 180 : 0 }}
          transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Back — one universal card back, same silhouette and aspect as
              the face it turns into (see CardBack). */}
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
            <CardBack maskSrc={backMaskSrc} revealed={revealed} />
          </div>

          {/* Face — the real PlayerCard, reused across the app. Scaled up to
              244px from its natural xl (220px) so the walkout hero reads
              larger than any other card in the app. */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            aria-hidden={!revealed}
          >
            <div style={{ transform: `scale(${CARD_SCALE})`, transformOrigin: 'center' }}>
              <PlayerCard
                player={player}
                size="xl"
                interactive="none"
                showConditionView={false}
              />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Massive OVR overlay — the biggest dopamine number ticks up over the
          card at the flip moment, then fades to let the stats land.

          It MUST stay below the hero card in this tree. Declared above it (as
          it was until measured) the card simply paints over it: the element
          mounts, sizes and reaches full opacity dead centre on the card, and
          nothing of it ever reaches the screen. Every walkout take ever
          captured is missing the number for that reason. */}
      <AnimatePresence>
        {ovrOverlayActive && !prefersReducedMotion && (
          <OvrOverlay
            key="ovr-overlay"
            value={player.overall}
            accent={tier.gradientVia}
            durationMs={PACK_ANIM.walkout.ovrOverlayMs}
            rollMs={PACK_ANIM.walkout.ovrRollMs}
          />
        )}
      </AnimatePresence>


      {/* Nameplate + potential below the card. Anchored to the safe area
          (with a small buffer) instead of a viewport percentage so the
          content stays within reach of the bottom on small phones and
          doesn't overlap the card on iPhone SE / 8 / mini class devices.
          Skip pill sits beneath this with its own safe-area inset. */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),16px)] mb-12 text-center max-w-[90vw] px-4 pointer-events-none">
        {/* Rarity chip — a tier-tinted pill rather than flat caption text, so
            the headline rarity reads as a premium badge and matches the
            best-pull chip on the results screen. Star reinforces it's a
            top-tier (Gold / Legendary) walkout-grade pull. */}
        <motion.div
          className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-full text-[9px] font-display font-bold uppercase tracking-[0.28em] text-white"
          style={{
            background: `linear-gradient(135deg, ${tier.gradientFrom}40, ${tier.gradientTo}26)`,
            border: `1px solid ${tier.gradientVia}80`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 20px -10px ${tier.gradientVia}`,
            textShadow: '0 1px 4px rgba(0,0,0,0.6)',
          }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: phase === 'enter' ? 0 : 1, y: phase === 'enter' ? 6 : 0 }}
          transition={{ duration: 0.35 }}
        >
          <span aria-hidden style={{ color: tier.gradientVia, textShadow: `0 0 8px ${tier.gradientVia}` }}>{legend ? '♛' : '★'}</span>
          <span>{legend ? 'Hall of Legends' : tier.label}</span>
        </motion.div>

        <h1
          className="font-display font-black leading-none tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]"
          style={{
            fontSize: 'clamp(22px, 6.5vw, 36px)',
            backgroundImage: `linear-gradient(90deg, ${tier.gradientFrom}, ${tier.gradientVia}, ${tier.gradientTo})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            minHeight: '1.1em',
          }}
        >
          {typed || ' '}
          {phase === 'name' && !prefersReducedMotion && (
            <motion.span
              className="inline-block ml-0.5"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              style={{ color: tier.gradientVia }}
            >
              |
            </motion.span>
          )}
        </h1>

        {/* Era line — the one sentence of provenance a Hall of Legends card
            carries. Rendered only once the name has landed so it reads as the
            reveal's closing beat, not competing chrome. */}
        {legend && (
          <motion.p
            className="mt-1.5 text-[11px] leading-snug text-white/75 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 'enter' || phase === 'name' ? 0 : 1 }}
            transition={{ duration: 0.4 }}
          >
            {legend.era}
          </motion.p>
        )}

        {/* Attribute row — six FIFA-style pills tick from 0 → final value in
            sequence during the `stats` phase, with a sub-haptic on each
            and a scale-pop on land. The last pill triggers the crescendo
            (halo bloom + confetti + heavy haptic) — the moment that pays
            off the cinematic. Position and nationality are already on the
            card itself, so we don't double up on a "scouting" pill here. */}
        <AnimatePresence>
          {statsActive && (
            <motion.div
              key="stats-row"
              className="mt-3 flex justify-center gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {ATTRIBUTE_ROW.map((attr, i) => (
                <AttributePill
                  key={attr.key}
                  label={attr.label}
                  value={player.attributes[attr.key]}
                  accent={tier.gradientVia}
                  delay={i * PACK_ANIM.walkout.statsStaggerMs}
                  isCrescendo={i === ATTRIBUTE_ROW.length - 1}
                  onCrescendo={triggerCrescendo}
                  prefersReducedMotion={!!prefersReducedMotion}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Potential bar — slides in during hold. */}
        <motion.div
          className="mt-3 mx-auto max-w-[240px]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: phase === 'hold' ? 1 : 0, y: phase === 'hold' ? 0 : 10 }}
          transition={{ duration: 0.4, delay: phase === 'hold' ? 0.15 : 0 }}
        >
          <div
            className="flex items-center justify-between text-[10px] uppercase tracking-widest mb-1"
            style={{ color: tier.gradientVia }}
          >
            <span>{t('walkoutReveal.potential')}</span>
            <span>{player.potential}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${tier.gradientFrom}, ${tier.gradientTo})` }}
              initial={{ width: 0 }}
              animate={{ width: phase === 'hold' ? `${player.potential}%` : '0%' }}
              transition={{ duration: 0.7, delay: phase === 'hold' ? 0.3 : 0, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      </div>

      {/* Skip pill — a real button (clearer than the previous static text)
          with a thin progress ring that drains over the cinematic length so
          the user can see how long is left. Appears after 0.8s to avoid
          fighting with the entrance beat. */}
      <motion.button
        type="button"
        onClick={(e) => { e.stopPropagation(); skip(); }}
        className={cn(
          'absolute bottom-[max(env(safe-area-inset-bottom),18px)] left-1/2 -translate-x-1/2',
          'flex items-center gap-2 pl-2.5 pr-3.5 py-1.5 rounded-full',
          'text-[10px] uppercase tracking-[0.28em] font-semibold text-white/85',
          'bg-white/[0.07] border border-white/20 backdrop-blur-md',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_24px_-12px_rgba(0,0,0,0.55)]',
          'active:scale-[0.96] transition-[transform,background-color] duration-150',
          'hover:bg-white/[0.12]',
        )}
        aria-label={t('walkoutReveal.skipCinematic')}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: phase === 'done' ? 0 : 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.8, ease: 'easeOut' }}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
          {/* Track */}
          <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          {/* Progress arc — animates from full to empty over the cinematic
              duration via the SVG dasharray trick. */}
          <motion.circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke={tier.gradientVia}
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 9}
            transform="rotate(-90 12 12)"
            initial={{ strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 9 }}
            transition={{ duration: totalMs / 1000, ease: 'linear' }}
          />
        </svg>
        <span>{t('walkoutReveal.skip')}</span>
      </motion.button>

      {/* SR announcement at reveal. */}
      {revealed && (
        <div className="sr-only" aria-live="polite" role="status">
          {`${legend ? 'Hall of Legends' : tier.label} pull — ${player.firstName} ${player.lastName}, ${player.overall} overall, ${player.position}, ${player.nationality}.${legend ? ` ${legend.era}` : ''}`}
        </div>
      )}

      {/* Legendary-only confetti accent on flip. */}
      {revealed && isLegendary && !prefersReducedMotion && (
        <PackConfetti count={20} hueBase={48} hueRange={24} />
      )}
    </motion.div>
  );
}
