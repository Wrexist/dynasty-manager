/**
 * The fixture, as the thing the week is actually about.
 *
 * WHY IT EXISTS. The hub used to answer "who are we playing?" in panel three
 * of eight, in a 38px crest and one line of text, with the week's primary
 * action underneath it — below the fold on a 375px phone. Every panel had the
 * same weight, so nothing had any. This card is deliberately the heaviest thing
 * on the screen: both crests, who is at home, how they are playing, what the
 * surface is like, what the result settles, and the one button that moves the
 * week on.
 *
 * PURE AND PROPS-DRIVEN. No store access and nothing derived here — the tier
 * and the stakes line come from `deriveSundayStakes`, the opposition from
 * `sundayOppositionCard`, the pitch from `sundayPitchQuality`, the action from
 * `sundayPrimaryAction`. The hub owns those calls, which keeps this file a
 * renderer and keeps the numbers identical to every other screen's.
 *
 * NO PRE-MATCH WEATHER. Weather is rolled inside `prepareSundayMatch`, after
 * the ringer draws, so it genuinely does not exist yet when this card is drawn.
 * A badge here would be a guess dressed as a fact.
 */
import { motion } from 'framer-motion';
import { GlassPanel } from '@/components/game/GlassPanel';
import { LiquidButton } from '@/components/game/LiquidButton';
import { FormPills, SundayCrest } from '@/components/game/sunday/SundayBits';
import { useTranslation } from '@/hooks/useTranslation';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { cn } from '@/lib/utils';
import { getSundayTactic } from '@/config/sundayLeague';
import { SUNDAY_ICON, SUNDAY_TIER_RIM } from '@/config/sundayIcons';
import type { SundayOppositionCard } from '@/utils/sunday/view';
import type { SundayClubIdentity, SundayMatchTier } from '@/types/game';

const DerbyHeatIcon = SUNDAY_ICON.derbyHeat;
const PitchIcon = SUNDAY_ICON.pitch;
const TacticsIcon = SUNDAY_ICON.tactics;

/**
 * Mown stripes and a centre circle, at the opacity of a memory.
 *
 * DECORATION ONLY, and it does not render at all under reduced motion or
 * performance mode — `MotionConfig` stops transforms but leaves paint alone, so
 * a layer that must not cost anything has to be absent, not still.
 *
 * SVG rather than CSS: `size:check` does not measure the stylesheet, so a
 * gradient here would be an unbudgeted cost. No `backdrop-filter` anywhere near
 * it — this sits inside a panel that already has one.
 */
const PitchBands = () => (
  <svg
    aria-hidden
    className="pointer-events-none absolute inset-0 w-full h-full"
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
  >
    {[0, 1, 2, 3].map(i => (
      <rect key={i} x={i * 25} y="0" width="12.5" height="100" fill="#ffffff" opacity="0.022" />
    ))}
    <circle cx="50" cy="50" r="18" fill="none" stroke="#ffffff" strokeWidth="0.6" opacity="0.05" />
  </svg>
);

/** One side of the fixture: badge, name, and — for the opposition — what is
 *  known about them. */
function Side({ shortName, color, secondaryColor, delay, animate, children }: {
  shortName: string;
  color: string;
  secondaryColor: string;
  delay: number;
  animate: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex flex-col items-center gap-1.5">
      <motion.div
        initial={animate ? { opacity: 0, scale: 0.86 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={animate ? { delay, duration: 0.28, ease: 'easeOut' } : { duration: 0 }}
      >
        <SundayCrest shortName={shortName} color={color} secondaryColor={secondaryColor} size={56} />
      </motion.div>
      <p className="text-caption font-semibold text-foreground text-center leading-tight line-clamp-2 w-full">
        {shortName}
      </p>
      {children}
    </div>
  );
}

export interface SundayFixtureHeroProps {
  /** The player's club. */
  identity: SundayClubIdentity;
  /** What this week is: a fixture, a blank, or the end of the road. */
  mode: 'fixture' | 'free' | 'seasonOver';
  /** Present only in `fixture` mode. */
  opposition: SundayOppositionCard | null;
  isHome: boolean;
  /** How many clubs are in the division, for "3/8". */
  tableSize: number;
  tier: SundayMatchTier;
  /** English, from `deriveSundayStakes`. Arithmetic, never atmosphere. */
  stakesLine: string | null;
  /** The rivalry's own name, when this fixture is the derby. English. */
  derbyName: string | null;
  /** `Div 4 · Week 7/22`, or the cup round and competition. Resolved by the
   *  caller because only it knows whether this is a cup week. */
  contextLabel: string;
  pitch: number;
  ctaLabel: string;
  onCta: () => void;
}

export function SundayFixtureHero({
  identity,
  mode,
  opposition,
  isHome,
  tableSize,
  tier,
  stakesLine,
  derbyName,
  contextLabel,
  pitch,
  ctaLabel,
  onCta,
}: SundayFixtureHeroProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotionPref();
  const opponent = opposition?.club ?? null;
  const showFixture = mode === 'fixture' && !!opponent;
  const oppTactic = opposition?.tactic ? getSundayTactic(opposition.tactic) : null;

  return (
    <GlassPanel className={cn('p-4 relative', SUNDAY_TIER_RIM[tier])}>
      {!reduceMotion && <PitchBands />}
      <div className="relative space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {contextLabel}
          </p>
          {showFixture && (
            <span className="text-micro font-bold uppercase tracking-wider text-primary shrink-0">
              {isHome ? t('sunday.match.home') : t('sunday.match.away')}
            </span>
          )}
        </div>

        {showFixture ? (
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
            <Side
              shortName={identity.shortName}
              color={identity.color}
              secondaryColor={identity.secondaryColor}
              delay={0}
              animate={!reduceMotion}
            />
            <span className="text-micro font-bold uppercase tracking-widest text-muted-foreground self-center pt-5">
              {t('sunday.hub.versus')}
            </span>
            <Side
              shortName={opponent.shortName}
              color={opponent.color}
              secondaryColor={opponent.secondaryColor}
              delay={0.08}
              animate={!reduceMotion}
            >
              {opposition?.position != null && (
                <span className="text-micro font-semibold text-foreground tabular-nums">
                  {opposition.position}/{tableSize}
                </span>
              )}
              <FormPills form={opposition?.form ?? []} size="sm" />
            </Side>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <SundayCrest
              shortName={identity.shortName}
              color={identity.color}
              secondaryColor={identity.secondaryColor}
              size={52}
            />
            <p className="text-body font-semibold text-foreground text-center">
              {mode === 'seasonOver' ? t('sunday.hub.seasonOver') : t('sunday.hub.freeWeek')}
            </p>
          </div>
        )}

        {showFixture && derbyName && (
          <p className="flex items-center justify-center gap-1.5 text-caption font-semibold text-orange-300 text-center">
            <DerbyHeatIcon className="w-4 h-4 shrink-0" aria-hidden />
            <span className="truncate">{derbyName}</span>
          </p>
        )}

        {/* Authored by the arithmetic, not by a writer — see `utils/sunday/tier`.
            Gold when it settles something, plain when it is a round the winner
            simply carries on from. */}
        {showFixture && stakesLine && (
          <p className={cn(
            'text-body font-semibold leading-snug text-center',
            tier === 'decider' || tier === 'cup-final' ? 'text-primary' : 'text-foreground',
          )}>
            {stakesLine}
          </p>
        )}

        {showFixture && (
          <div className="flex items-center justify-center gap-3 text-caption text-muted-foreground">
            <span className="inline-flex items-center gap-1 min-w-0">
              <PitchIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
              <span className="tabular-nums">{t('sunday.hub.pitch')} {Math.round(pitch)}</span>
            </span>
            {oppTactic && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <TacticsIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
                <span className="truncate">{oppTactic.name}</span>
              </span>
            )}
          </div>
        )}

        <LiquidButton tone="primary" className="w-full h-12" onClick={onCta}>
          {ctaLabel}
        </LiquidButton>
      </div>
    </GlassPanel>
  );
}
