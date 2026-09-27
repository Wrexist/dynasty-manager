import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import type { Player } from '@/types/game';
import { CardBack } from '@/components/game/pack/CardBack';
import { getPlayerCardArt } from '@/utils/uiHelpers';
import { PlayerCard } from '@/components/game/PlayerCard';
import { FlagIcon } from '@/components/game/FlagIcon';
import { PACK_ANIM, LEGENDARY_OVR_THRESHOLD, WALKOUT_OVR_THRESHOLD } from '@/config/packs';
import { tierForOvr } from './packHelpers';
import { PackConfetti } from './PackConfetti';
import { WalkoutStadium } from './WalkoutStadium';
import { hapticHeavy, hapticLight, hapticMedium } from '@/utils/haptics';
import { resolveLegend } from '@/utils/legends';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { playPackSfx } from '@/utils/packAudio';

interface WalkoutRevealProps {
  player: Player;
  /** Called when the walkout finishes and the card should fall back into the grid. */
  onComplete: () => void;
  /** Called when the user taps to hurry an already-finished hero — advance now
   *  instead of waiting out the inter-hero linger. */
  onAdvance?: () => void;
}

/** 3D-rendered stage the card lands on (scripts/3d/walkout/plinth.scene.js). */
export const WALKOUT_PLINTH_SRC = '/walkout/plinth.webp';

// The hero card is the real xl PlayerCard (220px natural) scaled up. It reads
// bigger than any other card in the app, but on a short phone it has to leave
// room for the plinth, the clue/name panel and the skip pill below it.
const PLAYER_CARD_XL_W = 220;
const WALKOUT_CARD_MAX_W = 244;
const WALKOUT_CARD_MIN_W = 176;
/** Vertical space reserved for everything that is not the card. */
const WALKOUT_CHROME_H = 330;

function walkoutCardWidth(): number {
  const h = typeof window === 'undefined' ? 844 : window.innerHeight;
  return Math.round(Math.max(WALKOUT_CARD_MIN_W, Math.min(WALKOUT_CARD_MAX_W, (h - WALKOUT_CHROME_H) / 1.5)));
}

/** Where the rating clue starts counting. A walkout only fires at
 *  {@link WALKOUT_OVR_THRESHOLD}+, so every number the count passes through is
 *  one this card could plausibly be — it reads "already good, still climbing"
 *  rather than as a counter running up from zero. */
const RATING_ROLL_FLOOR = WALKOUT_OVR_THRESHOLD - 6;

type Phase = 'enter' | 'nation' | 'position' | 'rating' | 'breath' | 'flip' | 'hold' | 'done';
const CLUE_ORDER: Phase[] = ['nation', 'position', 'rating'];

/** The rating clue's count-up. Driven from JS, so it asks the reduced-motion
 *  preference itself and simply shows the answer when motion is off. Reads
 *  `performance.now()` rather than rAF's argument: the marketing capture rig
 *  slows the page by scaling `performance.now` and cannot touch the rAF
 *  timestamp, and mixing the two made captured counts finish instantly. */
function RatingRoll({ value, rollMs, reduced }: { value: number; rollMs: number; reduced: boolean }) {
  const from = Math.min(RATING_ROLL_FLOOR, value - 1);
  const [display, setDisplay] = useState(reduced ? value : from);
  useEffect(() => {
    if (reduced) { setDisplay(value); return; }
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / rollMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else hapticMedium();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, from, rollMs, reduced]);
  return <>{display}</>;
}

/** One clue slot. Lands big and settles into the row, with a light flash
 *  behind it — each clue is its own small hit. Hidden (but laid out, so the
 *  row never reflows) until its beat. */
function ClueSlot({ shown, accent, reduced, children }: {
  shown: boolean;
  accent: string;
  reduced: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-[72px] w-[88px] items-center justify-center">
      <AnimatePresence>
        {shown && !reduced && (
          <motion.div
            key="flash"
            className="absolute inset-[-18px] rounded-full pointer-events-none"
            style={{ background: `radial-gradient(closest-side, ${accent}88, transparent)` }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 1.4] }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      <motion.div
        className="relative flex flex-col items-center"
        initial={false}
        animate={shown
          ? { opacity: 1, scale: 1, y: 0 }
          : { opacity: 0, scale: reduced ? 1 : 1.7, y: reduced ? 0 : -6 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 26 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * The walkout: the reveal for a {@link WALKOUT_OVR_THRESHOLD}+ pull.
 *
 * Beats (durations in PACK_ANIM.walkout):
 *   enter    → stadium lights ignite; the face-down card drops onto a
 *              3D-rendered plinth
 *   nation   → clue 1: the flag
 *   position → clue 2: the position
 *   rating   → clue 3: the rating counts up
 *   breath   → total stillness
 *   flip     → the card turns on the plinth; flash, floor ring, the rig
 *              flares; the clues give way to the NAME, which has been
 *              withheld until now
 *   hold     → the card slowly turns in the light; potential bar
 *   done     → onComplete()
 *
 * The card is the real {@link PlayerCard}, so the walkout matches every other
 * card surface. Everything the card already prints (OVR, stats) is NOT
 * repeated around it: a second copy of the rating stamped over the card and a
 * row of stat pills under it duplicated the card's own face and made the
 * payoff frame the busiest one in the sequence.
 *
 * Tap anywhere (or the Skip pill, whose ring drains over the cinematic) to
 * skip.
 */
export function WalkoutReveal({ player, onComplete, onAdvance }: WalkoutRevealProps) {
  const { t } = useTranslation();
  const tier = tierForOvr(player.overall);
  // Hall of Legends provenance: without it a 95 hall icon and a 95 ordinary
  // pull reveal identically. An unknown id degrades to a normal reveal.
  const retiredLegends = useGameStore(s => s.retiredLegends);
  const legend = resolveLegend(player.legendId, retiredLegends);
  const isLegendary = player.overall >= LEGENDARY_OVR_THRESHOLD;
  const reduced = !!useReducedMotionPref();
  const [phase, setPhase] = useState<Phase>('enter');
  const cardW = useMemo(walkoutCardWidth, []);

  const { enterMs, clueMs, breathMs, flipMs, holdMs, ratingRollMs } = PACK_ANIM.walkout;
  const totalMs = enterMs + clueMs * CLUE_ORDER.length + breathMs + flipMs + holdMs;

  useEffect(() => {
    hapticLight();
    playPackSfx('walkout-rise');
    let at = enterMs;
    const timers: number[] = [];
    const schedule = (ms: number, fn: () => void) => { timers.push(window.setTimeout(fn, ms)); };
    CLUE_ORDER.forEach(clue => {
      schedule(at, () => { setPhase(clue); hapticMedium(); });
      at += clueMs;
    });
    // The breath has no haptic on purpose — the absence IS the feedback.
    schedule(at, () => setPhase('breath'));
    at += breathMs;
    schedule(at, () => { setPhase('flip'); hapticHeavy(); playPackSfx('rare-pull'); });
    at += flipMs;
    schedule(at, () => setPhase('hold'));
    at += holdMs;
    schedule(at, () => { setPhase('done'); onComplete(); });
    return () => timers.forEach(window.clearTimeout);
  }, [enterMs, clueMs, breathMs, flipMs, holdMs, onComplete]);

  const skip = () => {
    // Already finished and holding on the final frame — a tap means "hurry up".
    if (phase === 'done') { onAdvance?.(); return; }
    setPhase('done');
    onComplete();
  };

  const clueIndex = CLUE_ORDER.indexOf(phase);
  const cluesDone = phase === 'breath';
  const clueShown = (i: number) => cluesDone || (clueIndex >= 0 && clueIndex >= i);
  const revealed = phase === 'flip' || phase === 'hold' || phase === 'done';
  const holding = phase === 'hold' || phase === 'done';

  // The back and the sheen are masked with the SAME art the face renders, so
  // both are shape-perfect whatever shield or frame this player carries.
  const cardArtSrc = getPlayerCardArt(player.overall, {
    ballonDorTop10: typeof player.ballonDOrTop10HoldSeason === 'number',
    packFrame: player.packFrame,
  }).src;
  const artMask = {
    WebkitMaskImage: `url(${cardArtSrc})`,
    maskImage: `url(${cardArtSrc})`,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  } as const;
  const accent = tier.gradientVia;
  const nameGradient = `linear-gradient(90deg, ${tier.gradientFrom}, ${tier.gradientVia}, ${tier.gradientTo})`;
  const plinthW = Math.round(cardW * 1.3);

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={skip}
    >
      {/* Ground: near-black with the tier's colour pooled where the card
          stands, so the rarity reads before anything moves. */}
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 80% 55% at 50% 52%, ${tier.gradientFrom}30 0%, rgba(2,3,6,0.9) 55%, #000 90%)` }}
      />

      <WalkoutStadium accent={accent} revealed={revealed} legendary={isLegendary} />

      {/* Slow camera push across the whole walkout. */}
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center pb-[max(env(safe-area-inset-bottom),12px)]"
        initial={{ scale: 1 }}
        animate={{ scale: reduced ? 1 : 1.04 }}
        transition={{ duration: totalMs / 1000, ease: 'easeOut' }}
      >
        {/* ── The stage: halo, card, plinth ── */}
        <div className="relative flex flex-col items-center" style={{ width: plinthW }}>
          {/* Tier halo behind the card — a gradient falloff, not a blur. */}
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
            style={{
              top: -cardW * 0.25,
              width: cardW * 2.1,
              height: cardW * 2.1,
              background: `radial-gradient(closest-side, ${accent}55 0%, ${tier.gradientTo}22 45%, transparent 100%)`,
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={reduced
              ? { opacity: revealed ? 1 : 0.55, scale: 1 }
              : revealed
                ? { opacity: [0.6, 1, 0.85], scale: [0.95, 1.12, 1] }
                : { opacity: 0.4 + 0.15 * Math.max(0, clueIndex + 1), scale: 0.92 + 0.03 * Math.max(0, clueIndex + 1) }}
            transition={{ duration: revealed ? 0.9 : 0.5, ease: 'easeOut' }}
          />

          {/* The card — drops onto the plinth face-down, flips there. */}
          <motion.div
            className="relative z-10"
            style={{ width: cardW, aspectRatio: '2 / 3', perspective: 1400 }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -90, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 170, damping: 17, delay: 0.15 }}
          >
            {/* Slow turn in the light once it has landed face-up. */}
            <motion.div
              className="absolute inset-0"
              style={{ transformStyle: 'preserve-3d' }}
              animate={holding && !reduced
                ? { rotateY: [0, 7, 0, -7, 0], rotateX: [0, -2, 0, 2, 0] }
                : { rotateY: 0, rotateX: 0 }}
              transition={holding && !reduced
                ? { duration: 6, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.3 }}
            >
              {/* Flip wrapper. The flip overshoots a touch and settles — a
                  card slapped down, not a door swinging. */}
              <motion.div
                className="absolute inset-0"
                style={{ transformStyle: 'preserve-3d' }}
                initial={false}
                animate={{ rotateY: revealed ? 180 : 0, scale: revealed && !reduced ? [1, 1.08, 1] : 1 }}
                transition={reduced
                  ? { duration: 0 }
                  : { rotateY: { duration: 0.75, ease: [0.3, 1.25, 0.4, 1] }, scale: { duration: 0.75, times: [0, 0.45, 1] } }}
              >
                <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
                  <CardBack maskSrc={cardArtSrc} revealed={revealed} />
                  {/* Energy building in the back as the clues land. */}
                  {!reduced && (
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      style={{ ...artMask, background: `radial-gradient(ellipse at 50% 55%, ${accent}, transparent 70%)`, mixBlendMode: 'screen' }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: phase === 'breath' ? 0.75 : Math.max(0, clueIndex + 1) * 0.16 }}
                      transition={{ duration: 0.4 }}
                    />
                  )}
                </div>
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  aria-hidden={!revealed}
                >
                  <div style={{ transform: `scale(${cardW / PLAYER_CARD_XL_W})`, transformOrigin: 'center' }}>
                    <PlayerCard player={player} size="xl" interactive="none" showConditionView={false} />
                  </div>
                  {/* Foil sheen, clipped to the card's own silhouette — the
                      light catching the card as it turns. Never a rectangle:
                      the art's alpha is the card's edge. */}
                  {revealed && !reduced && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={artMask}>
                      <motion.div
                        className="absolute inset-y-0 w-[70%]"
                        style={{
                          background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.08) 38%, rgba(255,255,255,0.42) 50%, rgba(255,255,255,0.08) 62%, transparent 80%)',
                          mixBlendMode: 'overlay',
                        }}
                        initial={{ x: '-110%' }}
                        animate={{ x: ['-110%', '160%'] }}
                        transition={{ duration: 1.1, delay: 0.35, repeat: Infinity, repeatDelay: 2.4, ease: [0.45, 0, 0.2, 1] }}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* The plinth — overlaps the card's foot so the card stands ON it. */}
          <div className="relative pointer-events-none" style={{ width: plinthW, marginTop: -Math.round(plinthW * 0.2) }}>
            <motion.img
              src={WALKOUT_PLINTH_SRC}
              alt=""
              draggable={false}
              className="relative w-full h-auto select-none"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            />
            {/* Tier light pooled on the plinth's top — tints the neutral
                black-and-gold asset to this pull's rarity. */}
            <motion.div
              className="absolute left-[8%] right-[8%] top-0 h-[62%] rounded-[50%] pointer-events-none"
              style={{ background: `radial-gradient(closest-side, ${accent}aa, transparent)`, mixBlendMode: 'screen' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: revealed ? 0.9 : 0.25 + 0.15 * Math.max(0, clueIndex + 1) }}
              transition={{ duration: 0.4 }}
            />
            {/* One floor ring on the flip, across the plinth's top. */}
            {revealed && !reduced && (
              <motion.div
                className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] pointer-events-none"
                style={{ border: `2px solid ${accent}`, boxShadow: `0 0 22px ${accent}, inset 0 0 12px ${accent}` }}
                initial={{ width: plinthW * 0.3, height: plinthW * 0.08, opacity: 1 }}
                animate={{ width: plinthW * 1.9, height: plinthW * 0.46, opacity: 0 }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </div>
        </div>

        {/* ── Clues, then the name ── fixed-height panel so nothing jumps. */}
        <div className="relative mt-3 h-[124px] w-full max-w-[92vw] px-4 text-center pointer-events-none">
          <AnimatePresence mode="wait">
            {!revealed ? (
              <motion.div
                key="clues"
                className="flex items-center justify-center gap-1"
                exit={{ opacity: 0, y: -10, scale: 0.96 }}
                transition={{ duration: 0.2 }}
              >
                <ClueSlot shown={clueShown(0)} accent={accent} reduced={reduced}>
                  <FlagIcon nationality={player.nationality} size={52} className="rounded-[3px] shadow-[0_4px_16px_rgba(0,0,0,0.7)]" />
                </ClueSlot>
                <div className="h-10 w-px bg-white/15" aria-hidden />
                <ClueSlot shown={clueShown(1)} accent={accent} reduced={reduced}>
                  <span className="font-display font-black text-[40px] leading-none tracking-tight text-white drop-shadow-[0_3px_14px_rgba(0,0,0,0.8)]">
                    {player.position}
                  </span>
                </ClueSlot>
                <div className="h-10 w-px bg-white/15" aria-hidden />
                <ClueSlot shown={clueShown(2)} accent={accent} reduced={reduced}>
                  <span
                    className="font-display font-black text-[48px] leading-none tabular-nums"
                    style={{ backgroundImage: nameGradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 3px 12px rgba(0,0,0,0.8))' }}
                  >
                    {clueShown(2) ? <RatingRoll value={player.overall} rollMs={ratingRollMs} reduced={reduced} /> : '00'}
                  </span>
                </ClueSlot>
              </motion.div>
            ) : (
              <motion.div
                key="name"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <motion.div
                  className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-full text-micro font-display font-bold uppercase tracking-[0.28em] text-white"
                  style={{
                    background: `linear-gradient(135deg, ${tier.gradientFrom}40, ${tier.gradientTo}26)`,
                    border: `1px solid ${accent}80`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 20px -10px ${accent}`,
                    textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                  }}
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.35 }}
                >
                  <span aria-hidden style={{ color: accent, textShadow: `0 0 8px ${accent}` }}>{legend ? '♛' : '★'}</span>
                  <span>{legend ? 'Hall of Legends' : tier.label}</span>
                </motion.div>
                {/* The name — withheld until now, wiped on left to right. */}
                <motion.h1
                  className="font-display font-black leading-none tracking-tight"
                  style={{
                    fontSize: 'clamp(24px, 7vw, 38px)',
                    backgroundImage: nameGradient,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                    filter: 'drop-shadow(0 4px 18px rgba(0,0,0,0.85))',
                  }}
                  initial={reduced ? false : { clipPath: 'inset(0 100% 0 0)', letterSpacing: '0.12em' }}
                  animate={{ clipPath: 'inset(0 0% 0 0)', letterSpacing: '-0.01em' }}
                  transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  {`${player.firstName} ${player.lastName}`.toUpperCase()}
                </motion.h1>
                {legend && (
                  <motion.p
                    className="mt-1.5 text-[11px] leading-snug text-white/75 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.7 }}
                  >
                    {legend.era}
                  </motion.p>
                )}
                <motion.div
                  className="mt-3 mx-auto max-w-[240px]"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: holding ? 1 : 0, y: holding ? 0 : 8 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-center justify-between text-micro uppercase tracking-widest mb-1" style={{ color: accent }}>
                    <span>{t('walkoutReveal.potential')}</span>
                    <span>{player.potential}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${tier.gradientFrom}, ${tier.gradientTo})` }}
                      initial={{ width: 0 }}
                      animate={{ width: holding ? `${player.potential}%` : '0%' }}
                      transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
                    />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Flip flash — brief, and centred on the card rather than a full-screen
          fill, so it reads as light off the card. */}
      <AnimatePresence>
        {phase === 'flip' && !reduced && (
          <motion.div
            key="flash"
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 40%, #fff 0%, ${accent}66 22%, transparent 55%)`, mixBlendMode: 'screen' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0] }}
            transition={{ duration: 0.5, times: [0, 0.25, 1] }}
          />
        )}
      </AnimatePresence>

      {revealed && !reduced && (
        <PackConfetti count={isLegendary ? 36 : 18} hueBase={48} hueRange={isLegendary ? 24 : 16} />
      )}

      {/* Skip pill — a real button whose ring drains over the cinematic. */}
      <motion.button
        type="button"
        onClick={(e) => { e.stopPropagation(); skip(); }}
        className={cn(
          'absolute bottom-[max(env(safe-area-inset-bottom),14px)] left-1/2 -translate-x-1/2 min-h-11',
          'flex items-center gap-2 pl-2.5 pr-3.5 py-1.5 rounded-full',
          'text-micro uppercase tracking-[0.28em] font-semibold text-white/85',
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
          <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
          <motion.circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke={accent}
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

      {revealed && (
        <div className="sr-only" aria-live="polite" role="status">
          {`${legend ? 'Hall of Legends' : tier.label} pull — ${player.firstName} ${player.lastName}, ${player.overall} overall, ${player.position}, ${player.nationality}.${legend ? ` ${legend.era}` : ''}`}
        </div>
      )}
    </motion.div>
  );
}
