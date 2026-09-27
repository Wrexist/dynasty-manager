import { useEffect, useMemo, useRef } from 'react';
import { motion, animate, useMotionValueEvent, useTransform, type MotionValue } from 'framer-motion';
import { PACK_ANIM } from '@/config/packs';
import { PackArt } from './PackArt';
import { packArtMaskStyle } from './packHelpers';

/**
 * The pack's seal, torn off across the top by the player's finger.
 *
 * Everything here is DRIVEN by `progress` (0 → 1, owned by the overlay, which
 * also owns the gesture, the sound and the haptics), so the tear is exactly
 * where the finger is, frame for frame. The layers, back to front:
 *
 *   body    — the pack below the tear line. Static until it opens.
 *   light   — tier-coloured light pouring out of the opening, and a hot slit
 *             along the torn edge, both revealed ALONG the tear (scaleX from
 *             the side the tear started on), so the opening is visibly the
 *             part you have torn and nothing else.
 *   seal    — the strip above the tear line: the torn length is one flap,
 *             hinged at the tear head and lifting as the tear runs; the rest
 *             stays attached until the head reaches it.
 *   spark   — a white-hot point riding the tear head, shedding foil flecks.
 *
 * Only transform and opacity ever animate; every clip-path is static (see
 * `PACK_ANIM.tear`). Under reduced motion the tear still follows the finger —
 * direct manipulation is not decorative motion — but the flecks, the ghost
 * swipe and the strip's fling are dropped.
 */
interface PackRipProps {
  progress: MotionValue<number>;
  /** +1 tears left → right, -1 right → left. Fixed by the first drag. */
  dir: 1 | -1;
  /** The seal has come away and is flying off. */
  flung: boolean;
  /** The pack has opened (explode): the body drops away under the burst. */
  opened: boolean;
  artSrc?: string;
  fallback: React.ReactNode;
  /** Pack accent — the spark and the slit. */
  accent: string;
  /** Colour of the light inside: the best pull's tier, so what leaks out of
   *  the opening is TRUE. Never a colour chosen to excite. */
  innerLight: string;
  /** Charge energy gathering along the tear line before anyone touches it. */
  energy: MotionValue<number>;
  /** Show the ghost swipe that teaches the gesture. */
  hint: boolean;
  reduced: boolean;
  /** Pack box width in px; the tear head is placed by transform, in px. */
  widthPx: number;
}

const FLECKS = 14;

export function PackRip({ progress, dir, flung, opened, artSrc, fallback, accent, innerLight, energy, hint, reduced, widthPx }: PackRipProps) {
  const { segments, seamYPct, jagPct, notches, flingMs } = PACK_ANIM.tear;

  const geometry = useMemo(() => {
    // Deterministic jagged line, so a replayed open tears the same way.
    const yAt = (j: number) => seamYPct + Math.sin(j * 2.399) * jagPct + Math.sin(j * 5.117) * (jagPct * 0.45);
    const pts = Array.from({ length: segments + 1 }, (_, j) => ({ x: (j / segments) * 100, y: yAt(j) }));
    const line = pts.map(p => `${p.x}% ${p.y}%`);
    const stripClip = `polygon(0 0, 100% 0, ${[...line].reverse().join(', ')})`;
    const bodyClip = `polygon(${line.join(', ')}, 100% 100%, 0 100%)`;
    return { stripClip, bodyClip };
  }, [segments, seamYPct, jagPct]);

  const art = (
    <PackArt
      src={artSrc}
      loading="eager"
      className="absolute inset-0 w-full h-full object-contain object-center"
      fallback={fallback}
    />
  );

  // ── The seal as a hinged flap ──
  // The torn length of the strip is ONE rigid piece, hinged at the tear head
  // and lifting further as the tear runs; the untorn remainder stays put.
  // Each is the whole strip seen through a sliding window: an overflow-hidden
  // box translated one way with its content translated back the other, so the
  // window reveals exactly [0, head] (or [head, end]) using transforms alone.
  // It replaced a row of slices lifted by different amounts, whose edges
  // stepped against each other however many slices there were.
  const w = widthPx;
  const tornWinX = useTransform(progress, p => (dir > 0 ? (p - 1) * w : (1 - p) * w));
  const tornInnerX = useTransform(progress, p => (dir > 0 ? (1 - p) * w : -(1 - p) * w));
  const restWinX = useTransform(progress, p => (dir > 0 ? p * w : -p * w));
  const restInnerX = useTransform(progress, p => (dir > 0 ? -p * w : p * w));
  // Lift: quick at first (the seal breaking free), then easing as it opens.
  // Positive (clockwise) for a left-to-right tear: hinged at the head on its
  // right, the free end swings UP and away from the pack, never down over it.
  const flapRotate = useTransform(progress, p => dir * (4 + 22 * Math.sqrt(p)));
  const flapY = useTransform(progress, p => -3 * p);

  // The opening, revealed along the tear from where it started.
  const opening = useTransform(progress, p => p);
  const openingOpacity = useTransform(progress, [0, 0.06, 1], [0, 1, 1]);
  const headX = useTransform(progress, p => (dir > 0 ? p : 1 - p) * widthPx);
  const headOpacity = useTransform(progress, p => (p > 0.005 && p < 0.995 ? 1 : 0));

  // Foil flecks shed from the tear head, recycled from a fixed pool.
  const fleckRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const nextFleck = useRef(0);
  const lastNotch = useRef(0);
  useMotionValueEvent(progress, 'change', p => {
    const notch = Math.floor(p * notches);
    if (notch <= lastNotch.current) return;
    lastNotch.current = notch;
    if (reduced || notch % 2 !== 0) return;
    const el = fleckRefs.current[nextFleck.current++ % FLECKS];
    if (!el) return;
    const x = (dir > 0 ? p : 1 - p) * widthPx;
    const vx = -dir * (18 + Math.random() * 40);
    const vy = -(20 + Math.random() * 46);
    animate(
      el,
      { x: [x, x + vx], y: [0, vy, vy + 30], rotate: [0, (Math.random() - 0.5) * 540], opacity: [1, 1, 0], scale: [1, 0.9, 0.5] },
      { duration: 0.55 + Math.random() * 0.3, ease: 'easeOut' },
    );
  });
  useEffect(() => { if (progress.get() === 0) lastNotch.current = 0; }, [progress]);

  const seamTop = `${seamYPct}%`;

  return (
    <div className="absolute inset-0">
      {/* Body — the pack below the tear line. */}
      <motion.div
        className="absolute inset-0"
        style={{ clipPath: geometry.bodyClip }}
        initial={false}
        animate={opened
          ? { y: [0, -5, 70], scaleY: [1, 1.03, 0.97], opacity: [1, 1, 0] }
          : { y: 0, scaleY: 1, opacity: 1 }}
        transition={opened ? { duration: 0.62, times: [0, 0.22, 1], ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
      >
        {art}
      </motion.div>

      {/* Light layers leave with the pack: once it opens, the burst is the
          light, and a slit hanging over an empty stage is a leftover. */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={false}
        animate={{ opacity: opened ? 0 : 1 }}
        transition={{ duration: opened ? 0.18 : 0 }}
      >
      {/* Light pouring up out of the opening — kept inside the pack's width. */}
      <motion.div
        className="absolute left-[9%] right-[9%] pointer-events-none"
        style={{
          top: `calc(${seamTop} - 120px)`,
          height: 124,
          scaleX: opening,
          opacity: openingOpacity,
          originX: dir > 0 ? 0 : 1,
          background: `radial-gradient(ellipse 60% 100% at 50% 100%, ${innerLight}cc 0%, ${innerLight}44 45%, transparent 75%)`,
          mixBlendMode: 'screen',
        }}
      />
      {/* The hot slit along the torn edge — white foil fibres and light,
          clipped to the pack's own silhouette so it never overhangs it. */}
      <div className="absolute inset-0 pointer-events-none" style={artSrc ? packArtMaskStyle(artSrc) : undefined}>
      <motion.div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          top: `calc(${seamTop} - 5px)`,
          height: 10,
          scaleX: opening,
          opacity: openingOpacity,
          originX: dir > 0 ? 0 : 1,
          borderRadius: 99,
          background: `linear-gradient(180deg, transparent, ${innerLight} 30%, #fff 50%, ${innerLight} 70%, transparent)`,
          boxShadow: `0 0 18px ${innerLight}, 0 0 36px ${innerLight}88`,
        }}
      />
      </div>

      {/* Charge energy gathering along the line it will tear on. */}
      <motion.div
        className="absolute left-[6%] right-[6%] pointer-events-none"
        style={{
          top: `calc(${seamTop} - 1px)`,
          height: 2,
          opacity: energy,
          borderRadius: 99,
          background: `linear-gradient(90deg, transparent, ${accent}, #fff, ${accent}, transparent)`,
          boxShadow: `0 0 12px ${accent}`,
        }}
      />
      </motion.div>

      {/* The seal: the torn flap, and the part still attached. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute inset-0 overflow-hidden" style={{ x: restWinX }}>
          <motion.div className="absolute inset-0" style={{ x: restInnerX, clipPath: geometry.stripClip }}>
            {art}
          </motion.div>
        </motion.div>
      </div>
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={false}
        animate={flung
          ? reduced
            ? { opacity: 0 }
            : { x: dir * (w * 0.55), y: -150, rotate: dir * 30, opacity: [1, 1, 0] }
          : { x: 0, y: 0, rotate: 0, opacity: 1 }}
        transition={flung ? { duration: flingMs / 1000, ease: [0.2, 0.8, 0.3, 1] } : { duration: 0 }}
      >
        <motion.div
          className="absolute inset-0 overflow-hidden"
          style={{ x: tornWinX, y: flapY, rotate: flapRotate, originX: dir > 0 ? '100%' : '0%', originY: seamTop }}
        >
          <motion.div className="absolute inset-0" style={{ x: tornInnerX, clipPath: geometry.stripClip }}>
            <div className="absolute inset-0" style={artSrc ? packArtMaskStyle(artSrc) : undefined}>
              {art}
              {/* Shading: the flap turns away from the light as it lifts. */}
              <motion.div
                className="absolute inset-0"
                style={{
                  opacity: openingOpacity,
                  background: `linear-gradient(${dir > 0 ? 90 : 270}deg, rgba(0,0,0,0.45), rgba(0,0,0,0) 70%)`,
                }}
              />
              {/* The torn edge: foil's pale backing along the flap's bottom. */}
              <motion.div
                className="absolute left-0 right-0"
                style={{
                  top: `calc(${seamTop} - 6px)`,
                  height: 9,
                  opacity: openingOpacity,
                  background: 'linear-gradient(180deg, transparent, rgba(255,250,240,0.95) 55%, rgba(210,200,190,0.9))',
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Tear head: a white-hot point riding the tear, and the flecks it sheds. */}
      <div className="absolute left-0 right-0 pointer-events-none" style={{ top: seamTop, height: 0 }}>
        <motion.div
          className="absolute"
          style={{
            x: headX,
            opacity: headOpacity,
            left: -14,
            top: -14,
            width: 28,
            height: 28,
            borderRadius: 99,
            background: `radial-gradient(circle, #fff 0%, #fff 18%, ${accent} 42%, transparent 70%)`,
            boxShadow: `0 0 22px ${accent}, 0 0 44px #ffffffaa`,
          }}
        />
        {!reduced && Array.from({ length: FLECKS }).map((_, k) => (
          <span
            key={k}
            ref={el => { fleckRefs.current[k] = el; }}
            className="absolute rounded-[1px]"
            style={{
              left: -2,
              top: -1,
              width: 3 + (k % 3) * 2,
              height: 2 + (k % 2),
              opacity: 0,
              background: k % 3 === 0 ? '#fff' : `linear-gradient(90deg, ${accent}, #fff)`,
              boxShadow: `0 0 5px ${accent}`,
            }}
          />
        ))}
      </div>

      {/* Ghost swipe: a light running along the seal to show the gesture. */}
      {hint && !reduced && (
        <div className="absolute left-0 right-0 pointer-events-none" style={{ top: seamTop, height: 0 }}>
          <motion.div
            className="absolute"
            style={{
              left: -8,
              top: -8,
              width: 16,
              height: 16,
              borderRadius: 99,
              background: 'radial-gradient(circle, #fff 0%, rgba(255,255,255,0.6) 35%, transparent 70%)',
            }}
            initial={{ x: widthPx * 0.08, opacity: 0 }}
            animate={{ x: [widthPx * 0.08, widthPx * 0.92], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.1, times: [0, 0.15, 0.8, 1], ease: [0.45, 0, 0.3, 1], repeat: Infinity, repeatDelay: 0.9 }}
          />
        </div>
      )}
    </div>
  );
}
