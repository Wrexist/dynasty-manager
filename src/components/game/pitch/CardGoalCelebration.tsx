import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Player } from '@/types/game';
import { PlayerCard } from '@/components/game/PlayerCard';
import { useTranslation } from '@/hooks/useTranslation';
import { getPlayerCardArt } from '@/utils/uiHelpers';
import { cn } from '@/lib/utils';
import { PITCH_RENDER } from '@/config/pitchChoreography';
import type { PitchHitTarget } from './PitchCanvas';
import { withAlpha } from './pitchColors';
import { celebrationCardWidth, pitchCardPose, type CardPose } from './pitchGeometry';

// Your goal, in Cards mode: the scorer's card lifts off his spot on the pitch,
// flies to centre and grows to full size in front of a light burst, the foil
// catches the light, club-colour confetti falls, and the new scoreline lands
// underneath — then the card flies back down to where he is standing. His
// pitch card is hidden for the duration (PitchView passes `hiddenId`), so the
// card that leaves the pitch is the same one that comes back.
//
// Reduced motion: no flight, rays, sheen or confetti — the card fades in at
// centre, holds, and fades out.

interface CardGoalCelebrationProps {
  player: Player;
  /** Live screen positions from the renderer — where the card leaves from and
   *  returns to (read at both moments, so it lands where he is NOW). */
  hitTargetsRef: React.MutableRefObject<PitchHitTarget[] | null>;
  /** Overlay size (the pitch container), CSS px. */
  width: number;
  height: number;
  color: string;
  minute: string;
  assistName?: string;
  homeShort: string;
  awayShort: string;
  homeGoals: number;
  awayGoals: number;
  scoredByHome: boolean;
  confettiCount?: number;
  reducedMotion?: boolean;
  onDone: () => void;
}

/** `PlayerCard size="xl"` lays out at this width; we scale it to the card. */
const PLAYER_CARD_XL_W = 220;
const GOLD = '#f5b915';
// Same photosensitivity cap as GoalCelebration: one smooth fade, well below a
// full-luminance flash.
const FLASH_PEAK = 0.42;

type Phase = 'fly' | 'hold' | 'return';

export function CardGoalCelebration({
  player, hitTargetsRef, width, height, color, minute, assistName,
  homeShort, awayShort, homeGoals, awayGoals, scoredByHome,
  confettiCount = 16, reducedMotion, onDone,
}: CardGoalCelebrationProps) {
  const { t } = useTranslation();
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const cardW = celebrationCardWidth(width, height);
  const cardH = cardW * 1.5;
  // Card centre sits a little above the middle: GOAL! above, the score below.
  const centre: CardPose = { x: width / 2 - cardW / 2, y: height * 0.47 - cardH / 2, scale: 1 };

  // Where it leaves from — fixed at mount.
  const [from] = useState<CardPose>(() =>
    pitchCardPose(hitTargetsRef.current?.find(h => h.id === player.id), cardW, width, height));
  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'hold' : 'fly');
  const [back, setBack] = useState<CardPose>(from);

  const { CARD_GOAL_FLY_MS, CARD_GOAL_HOLD_MS, CARD_GOAL_RETURN_MS, CARD_GOAL_REDUCED_MS } = PITCH_RENDER;

  const timers = useRef<number[]>([]);
  const startReturn = useRef<() => void>(() => {});
  startReturn.current = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    if (reducedMotion) { onDoneRef.current(); return; }
    setBack(pitchCardPose(hitTargetsRef.current?.find(h => h.id === player.id), cardW, width, height));
    setPhase('return');
    timers.current.push(window.setTimeout(() => onDoneRef.current(), CARD_GOAL_RETURN_MS));
  };

  useEffect(() => {
    const q = timers.current;
    if (reducedMotion) {
      q.push(window.setTimeout(() => startReturn.current(), CARD_GOAL_REDUCED_MS));
    } else {
      q.push(window.setTimeout(() => setPhase('hold'), CARD_GOAL_FLY_MS));
      q.push(window.setTimeout(() => startReturn.current(), CARD_GOAL_FLY_MS + CARD_GOAL_HOLD_MS));
    }
    return () => { timers.current.forEach(window.clearTimeout); timers.current = []; };
    // Mount-only: the parent re-renders every match minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A tap hurries it along: straight to the flight home.
  const skip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (phase !== 'return') startReturn.current();
  };

  const art = getPlayerCardArt(player.overall, {
    ballonDorTop10: typeof player.ballonDOrTop10HoldSeason === 'number',
    packFrame: player.packFrame,
  });
  const artMask = {
    WebkitMaskImage: `url(${art.src})`,
    maskImage: `url(${art.src})`,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  } as const;

  const confetti = useMemo(
    () => (reducedMotion ? [] : Array.from({ length: Math.max(0, confettiCount) }, (_, i) => ({
      left: 8 + Math.random() * 84,
      delay: CARD_GOAL_FLY_MS / 1000 * 0.8 + Math.random() * 0.35,
      hue: i % 3,
      rotate: Math.random() * 360,
      drift: (Math.random() * 2 - 1) * 36,
    }))),
    [reducedMotion, confettiCount, CARD_GOAL_FLY_MS],
  );

  const out = phase === 'return';
  const landed = phase === 'hold';
  // x/y place the top-left corner; scale and rotation act about the centre.
  const pose = out ? back : centre;
  const name = player.lastName || player.firstName || '';
  const cx = width / 2;
  const cy = height * 0.47;
  const raysD = cardW * 2.8;
  const flyS = CARD_GOAL_FLY_MS / 1000;

  return (
    <div
      className="absolute inset-0 z-10 overflow-hidden"
      role="button"
      aria-label={t('pitchView.cardCelebrationLabel', { name, minute })}
      onClick={skip}
      data-testid="card-goal-celebration"
      data-phase={phase}
    >
      {/* Dim the play so the card owns the moment. */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: out ? 0 : 0.5 }}
        transition={{ duration: out ? CARD_GOAL_RETURN_MS / 1000 : 0.35 }}
      />

      {!reducedMotion && (
        <>
          {/* Light rays turning slowly behind the card, in the club's colour. */}
          <motion.div
            className="pointer-events-none absolute rounded-full"
            style={{
              left: cx - raysD / 2, top: cy - raysD / 2, width: raysD, height: raysD,
              background: `repeating-conic-gradient(from 0deg, ${withAlpha(color, 0)} 0deg 7deg, ${withAlpha(color, 0.67)} 9deg 12deg, ${withAlpha(GOLD, 0.33)} 14deg 16deg, ${withAlpha(color, 0)} 18deg 24deg)`,
              WebkitMaskImage: 'radial-gradient(circle, #000 18%, transparent 68%)',
              maskImage: 'radial-gradient(circle, #000 18%, transparent 68%)',
            }}
            initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
            animate={{ opacity: out ? 0 : landed ? 0.9 : 0, scale: out ? 0.6 : 1, rotate: 90 }}
            transition={{ opacity: { duration: 0.4 }, scale: { duration: 0.6, ease: 'easeOut' }, rotate: { duration: 8, ease: 'linear' } }}
          />
          {/* Tier halo hugging the card. */}
          <motion.div
            className="pointer-events-none absolute rounded-full"
            style={{
              left: cx - cardW, top: cy - cardW, width: cardW * 2, height: cardW * 2,
              background: `radial-gradient(circle, ${withAlpha(GOLD, 0.4)}, ${withAlpha(color, 0.2)} 45%, ${withAlpha(color, 0)} 70%)`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: out ? 0 : landed ? 1 : 0 }}
            transition={{ duration: 0.35 }}
          />
          {/* The landing: a ring bursting out and one capped flash. */}
          {landed && (
            <>
              <motion.div
                className="pointer-events-none absolute rounded-full border-4"
                style={{ left: cx - cardW / 2, top: cy - cardW / 2, width: cardW, height: cardW, borderColor: GOLD }}
                initial={{ opacity: 0.9, scale: 0.5 }}
                animate={{ opacity: 0, scale: 2.6 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
              <motion.div
                className="pointer-events-none absolute inset-0"
                style={{ background: 'radial-gradient(circle at 50% 47%, rgba(255,255,255,0.85), rgba(255,255,255,0) 55%)' }}
                initial={{ opacity: FLASH_PEAK }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </>
          )}
        </>
      )}

      {/* The card itself — the scorer's real card, flying. */}
      <div className="pointer-events-none absolute inset-0" style={{ perspective: 900 }}>
        <motion.div
          className="absolute left-0 top-0"
          style={{ width: cardW, height: cardH, transformStyle: 'preserve-3d' }}
          initial={reducedMotion ? { ...centre, opacity: 0 } : { ...from, opacity: 1, rotate: 0, rotateY: 0 }}
          animate={reducedMotion
            ? { ...centre, opacity: out ? 0 : 1 }
            : {
              ...pose,
              opacity: 1,
              rotate: phase === 'fly' ? [0, -9, 3, 0] : 0,
              rotateY: landed ? [0, 8, 0, -8, 0] : 0,
            }}
          transition={reducedMotion
            ? { duration: 0.3 }
            : out
              ? { duration: CARD_GOAL_RETURN_MS / 1000, ease: [0.5, 0, 0.75, 0] }
              : {
                x: { type: 'spring', stiffness: 170, damping: 19 },
                y: { type: 'spring', stiffness: 170, damping: 19 },
                scale: { type: 'spring', stiffness: 150, damping: 15 },
                rotate: { duration: flyS, times: [0, 0.35, 0.75, 1] },
                rotateY: landed ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 },
              }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center drop-shadow-[0_10px_24px_rgba(0,0,0,0.6)]"
          >
            <div style={{ transform: `scale(${cardW / PLAYER_CARD_XL_W})`, transformOrigin: 'center' }}>
              <PlayerCard player={player} size="xl" interactive="none" showConditionView={false} />
            </div>
          </div>
          {/* Foil sheen across the art, clipped to the card's own silhouette. */}
          {!reducedMotion && landed && (
            <div className="absolute inset-0 overflow-hidden" style={artMask}>
              <motion.div
                className="absolute inset-y-0 w-[70%]"
                style={{
                  background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.08) 38%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.08) 62%, transparent 80%)',
                  mixBlendMode: 'overlay',
                }}
                initial={{ x: '-110%' }}
                animate={{ x: '160%' }}
                transition={{ duration: 0.9, delay: 0.1, ease: [0.45, 0, 0.2, 1] }}
              />
            </div>
          )}
        </motion.div>
      </div>

      {confetti.map((c, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute top-0 h-full w-1.5"
          style={{ left: `${c.left}%` }}
          initial={{ y: '-4%', x: 0, opacity: 0 }}
          animate={{ y: '100%', x: c.drift, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.9, delay: c.delay, ease: 'easeIn' }}
        >
          <motion.div
            className="h-2 w-1.5 rounded-sm"
            style={{ backgroundColor: c.hue === 0 ? color : c.hue === 1 ? GOLD : '#ffffff' }}
            initial={{ rotate: c.rotate }}
            animate={{ rotate: c.rotate + 240 }}
            transition={{ duration: 1.9, delay: c.delay, ease: 'easeIn' }}
          />
        </motion.div>
      ))}

      {/* GOAL! above the card. */}
      <motion.p
        className="pointer-events-none absolute inset-x-0 text-center font-display text-4xl font-extrabold uppercase tracking-tight text-primary drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]"
        style={{ top: Math.max(4, cy - cardH / 2 - 50) }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={landed || (reducedMotion && !out) ? { opacity: 1, scale: 1 } : { opacity: 0, scale: out ? 1.1 : 0.4 }}
        transition={landed ? { type: 'spring', stiffness: 380, damping: 16 } : { duration: 0.2 }}
      >
        {t('pitchView.goal')}
      </motion.p>

      {/* Lower third: the new score, the scorer and minute, the assist. */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-1 px-3"
        style={{ top: cy + cardH / 2 + 10 }}
        initial={{ opacity: 0, y: 10 }}
        animate={landed || (reducedMotion && !out) ? { opacity: 1, y: 0 } : { opacity: 0, y: out ? 0 : 10 }}
        transition={{ duration: 0.25, delay: landed ? 0.15 : 0 }}
      >
        <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-card/85 px-3 py-1 backdrop-blur-md">
          <span className={cn('text-xs font-bold', scoredByHome ? 'text-primary' : 'text-foreground/60')}>{homeShort}</span>
          <span className="font-display text-xl font-extrabold tabular-nums text-foreground">{homeGoals}<span className="mx-0.5 text-foreground/50">–</span>{awayGoals}</span>
          <span className={cn('text-xs font-bold', scoredByHome ? 'text-foreground/60' : 'text-primary')}>{awayShort}</span>
        </div>
        <p className="text-xs font-semibold text-foreground drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          ⚽ {name}<span className="ml-1.5 tabular-nums text-primary">{minute}</span>
          {assistName && <span className="ml-2 text-foreground/70">{t('pitchView.assistBy', { name: assistName })}</span>}
        </p>
      </motion.div>
    </div>
  );
}
