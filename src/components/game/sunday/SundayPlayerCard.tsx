/**
 * A Sunday footballer, as a person rather than a row.
 *
 * WHAT WAS WRONG. The squad screen was a database with an accordion on it: a
 * 36px line of `POS · name · archetype · job · OVR · pill · chevron`, and
 * behind the chevron a full second screen of content — six meters in a 2-column
 * grid, three stat tiles, his story, his relationships and two buttons, all the
 * same weight, stacked flat. Nothing in the collapsed line hinted at any of it,
 * so the accordion was a lucky dip; and his story, which is the only part of
 * the panel written by the simulation rather than read off a struct, was the
 * fifth thing in it.
 *
 * WHAT THIS IS. Two components that make one card:
 *
 *   `SundayPlayerCard`   — the face, the number, the name, and a three-bar
 *                          summary of exactly what expanding reveals.
 *   `SundayPlayerDetail` — the reward for expanding, ranked: who he is, then
 *                          his story, then his numbers, then the two actions.
 *
 * MEMO AND SCALARS. Up to `SUNDAY_MAX_SQUAD` (22) of these render at once, and
 * the store rewrites `players` on every match, training tick and week advance.
 * So the card takes VALUES ONLY — never a `Player`, never a `SundaySquadMember`
 * — and is wrapped in `memo`. The expanded panel is passed in as `detail`,
 * which is `undefined` for every collapsed card and therefore memo-stable; the
 * one open card re-renders freely, which costs nothing because there is one.
 * Same rule `SundayFace` documents and for the same reason.
 *
 * NO BACKDROP-FILTER. Twenty of these scroll under a thumb. The list's single
 * `GlassPanel` already pays for one blur; the cards are flat tints.
 */
import { memo } from 'react';
import { motion } from 'framer-motion';
import { LiquidButton } from '@/components/game/LiquidButton';
import { AvailabilityPill, Meter, PlayerFlags } from '@/components/game/sunday/SundayBits';
import { SundayFace, type SundayFaceProps } from '@/components/game/sunday/SundayFace';
import { useTranslation } from '@/hooks/useTranslation';
import { useReducedMotionPref } from '@/hooks/useReducedMotionPref';
import { cn } from '@/lib/utils';
import { SUNDAY_MEMORY_LEGENDARY_WEIGHT } from '@/config/sundayLeague';
import { SUNDAY_ICON } from '@/config/sundayIcons';
import { sundayRatingTier, type SundayRatingTier } from '@/utils/sunday/visuals';
import type {
  Position, SundayAvailabilityStatus, SundayMemory,
} from '@/types/game';

const ExpandIcon = SUNDAY_ICON.expand;
const ReleaseIcon = SUNDAY_ICON.release;
const CaptainIcon = SUNDAY_ICON.captain;
const MoodIcon = SUNDAY_ICON.mood;
const FitnessIcon = SUNDAY_ICON.fitness;
const FormIcon = SUNDAY_ICON.form;

/**
 * Rating tier → ink. The tier itself is decided by `sundayRatingTier`, which
 * anchors on the pyramid's own quality ladder rather than on the house
 * 80/70/60 thresholds — see the block above it for the measurement that forced
 * that. `steady` is deliberately the neutral foreground and not amber.
 */
const RATING_TONE: Record<SundayRatingTier, string> = {
  standout: 'text-emerald-300',
  good: 'text-primary',
  steady: 'text-foreground',
  limited: 'text-muted-foreground',
};

/** The portrait's rendered size in the card. Comfortably inside `SundayFace`'s
 *  large tier (>= 44), so the seams, the gradient and the stubble are drawn. */
const FACE_SIZE = 52;

/**
 * The three glyphs, spelled out — ONCE, above the list.
 *
 * THE OTHER HALF OF THE ICON DECISION. The cards below label their three
 * meters with a face, a heart and a bolt instead of the words "Mood",
 * "Fitness" and "Form", because those words were being printed fifteen times
 * down a scrolling list. A face is guessable; a heart on a football card is
 * not, and neither is a bolt. So the words are drawn exactly once, in a row
 * whose columns line up with the meters underneath them — 72px of left
 * padding is the card's own `p-2.5` plus `FACE_SIZE` plus its `gap-2.5`, so
 * each word sits directly over the column it names.
 *
 * WHY NOT ONLY THIS. A legend scrolls away; by the sixth card it is off the
 * screen and the row would be three numbers nobody can decode. The glyphs
 * travel with the row, the legend teaches them at the top. Eighteen
 * characters buys back two hundred and twenty-five.
 *
 * `aria-hidden` because it is a decode key for the eye only: every meter
 * already carries its own word as an accessible name, so a screen reader gets
 * the label on the row itself and would otherwise hear this list twice.
 */
export function SundayCardMeterLegend() {
  const { t } = useTranslation();
  const items: [React.ElementType, string][] = [
    [MoodIcon, t('sunday.squad.happiness')],
    [FitnessIcon, t('sunday.squad.fitness')],
    [FormIcon, t('sunday.squad.form')],
  ];
  return (
    <div className="grid grid-cols-3 gap-2 pl-[72px] pr-2.5 pb-0.5" aria-hidden>
      {items.map(([Icon, label]) => (
        <span key={label} className="inline-flex items-center gap-1 text-micro text-muted-foreground truncate">
          <Icon className="w-3 h-3 shrink-0" />
          {label}
        </span>
      ))}
    </div>
  );
}

export interface SundayPlayerCardProps extends Pick<
  SundayFaceProps,
  'skinTone' | 'hairStyle' | 'hairColor' | 'height' | 'build' | 'facialHair' | 'accessory'
> {
  /** Passed back to `onToggle` so the handler can stay stable across renders. */
  playerId: string;
  firstName: string;
  lastName: string;
  position: Position;
  /** 1-99, from `SundaySquadMember.shirtNumber`. */
  shirtNumber: number;
  overall: number;
  /** `SundayArchetypeInfo.name`. Character, not a category label. */
  archetypeName: string;
  /** What he does on weekdays. Game data — English. */
  job: string;
  /** The club's kit, from `sundayKitSpec`. Paints his shoulders and his number. */
  kitBody: string;
  kitTrim: string;
  availStatus: SundayAvailabilityStatus;
  availWarned: boolean;
  /** `SundaySquadMember.happiness`, 0-100. */
  happiness: number;
  /** `Player.fitness`, 0-100 — drained by minutes, recovered over the week. */
  fitness: number;
  /** `Player.form`, 0-100. */
  form: number;
  captain?: boolean;
  unsettled?: boolean;
  promised?: boolean;
  expanded: boolean;
  onToggle: (playerId: string) => void;
  /** The expanded panel. `undefined` while collapsed, which is what keeps this
   *  component's props shallow-equal across a parent re-render. */
  detail?: React.ReactNode;
}

export const SundayPlayerCard = memo(function SundayPlayerCard({
  playerId,
  firstName,
  lastName,
  position,
  shirtNumber,
  overall,
  archetypeName,
  job,
  kitBody,
  kitTrim,
  availStatus,
  availWarned,
  happiness,
  fitness,
  form,
  captain,
  unsettled,
  promised,
  expanded,
  onToggle,
  detail,
  ...face
}: SundayPlayerCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'rounded-xl transition-colors',
        expanded ? 'bg-white/[0.055] ring-1 ring-inset ring-white/10' : 'bg-white/[0.025]',
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(playerId)}
        aria-expanded={expanded}
        className={cn(
          'w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60',
          'hover:bg-white/[0.03]',
        )}
      >
        {/* HIS FACE AND HIS NUMBER. The shoulders are the club's kit, so a
            squad list reads as one team; the number badge is painted in the
            same two colours, which is the whole of a Sunday club's identity. */}
        <span className="relative shrink-0">
          <span className={cn(
            'block rounded-lg overflow-hidden bg-white/[0.05]',
            captain && 'ring-1 ring-primary/60',
          )}>
            <SundayFace
              {...face}
              shirtColor={kitBody}
              shirtTrim={kitTrim}
              size={FACE_SIZE}
              className="block"
            />
          </span>
          <span
            className="absolute -bottom-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full inline-flex items-center justify-center text-micro font-bold tabular-nums ring-1 ring-inset ring-black/25"
            style={{ backgroundColor: kitBody, color: kitTrim }}
          >
            {shirtNumber}
          </span>
        </span>

        <span className="min-w-0 flex-1 space-y-1.5">
          {/* His name is the biggest thing on the card. It used to be the same
              14px as the job under it and the OVR beside it. */}
          <span className="flex items-start gap-2">
            <span className="min-w-0 flex-1">
              <span className="block text-title font-semibold text-foreground truncate leading-tight">
                {firstName} {lastName}
              </span>
              <span className="block text-micro text-muted-foreground truncate">
                {position} · {archetypeName} · {job}
              </span>
            </span>
            <span className={cn('text-title font-bold tabular-nums shrink-0 leading-tight', RATING_TONE[sundayRatingTier(overall)])}>
              {overall}
            </span>
            <ExpandIcon
              className={cn('w-4 h-4 mt-0.5 text-muted-foreground shrink-0 transition-transform', expanded && 'rotate-180')}
              aria-hidden
            />
          </span>

          {/* WHAT EXPANDING HOLDS, in three bars. This is the audit's actual
              complaint about this screen: the collapsed line said nothing
              about the panel behind it, so opening one was a lucky dip. Mood
              is why he leaves, fitness is whether he lasts ninety minutes and
              form is whether he is worth picking — the three the expanded
              panel then gives in full.

              GLYPHS, NOT WORDS. The bars are right and stay; the three words
              beside them were not, because they are the SAME three words on
              every card and there are fifteen cards. Measured, that triple was
              most of why this screen went 925 -> 1364 characters on the glass
              in a pass whose whole point was fewer. A face, a heart and a bolt
              say it once each, in three silhouettes that stay apart at 14px —
              and the label survives verbatim as the meter's accessible name,
              so nothing is lost to a screen reader. See `Meter`'s `iconOnly`.

              A LEGEND AS WELL, NOT INSTEAD. `SundayCardMeterLegend` names the
              three above the list, because a heart and a bolt are not
              self-evident the first time. But it cannot be the whole answer:
              the list scrolls, and by card six a legend is off the screen.
              Icons travel with the row; the legend teaches them once. */}
          <span className="grid grid-cols-3 gap-2">
            <Meter tight iconOnly icon={MoodIcon} label={t('sunday.squad.happiness')} value={happiness} />
            <Meter tight iconOnly icon={FitnessIcon} label={t('sunday.squad.fitness')} value={fitness} />
            <Meter tight iconOnly icon={FormIcon} label={t('sunday.squad.form')} value={form} />
          </span>

          {/* Status and flags on their own row. They used to sit inline after
              the name, where "Thinking of leaving" ate two thirds of it. */}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <AvailabilityPill
              availability={{ status: availStatus, warned: availWarned }}
              subtle={availStatus === 'available'}
            />
            <PlayerFlags captain={captain} unsettled={unsettled} form={form} promised={promised} />
          </span>
        </span>
      </button>

      {detail}
    </div>
  );
});

export interface SundayPlayerDetailProps {
  /** `SundayArchetypeInfo.blurb` — two lines of character, English, authored. */
  blurb: string;
  /** His number again, drawn once more as a watermark. */
  shirtNumber: number;
  /** Why he is not available, in his own words. English, from the save. */
  note: string | null;
  /** Heaviest first — `sundayTopMemories` decides the order, not this. */
  memories: readonly SundayMemory[];
  /** Already-resolved relationship lines. English sentences, joined here. */
  relationships: readonly string[];
  clubApps: number;
  clubGoals: number;
  clubMotm: number;
  subsOwed: number;
  /** All 1-20 except `happiness`, which is 0-100. Scaled for display here so
   *  the card is the only place that knows the meters run to 100. */
  happiness: number;
  commitment: number;
  punctuality: number;
  condition: number;
  temper: number;
  ego: number;
  isCaptain: boolean;
  onMakeCaptain: () => void;
  onRelease: () => void;
}

/** 1-20 attribute → the 0-100 a `Meter` draws. */
const scale20 = (v: number) => v * 5;

/**
 * Everything behind the chevron, ranked.
 *
 * THE ORDER IS THE POINT. Who he is (one line), then HIS STORY on a raised
 * surface, then the club-career numbers, then the six attributes, then the two
 * actions. The story used to be fifth of five; it is the only content on this
 * screen the simulation wrote, and burying it under six meters was the reason
 * a squad of fifteen read as a spreadsheet.
 *
 * The six meters are two ranked rows rather than one flat grid: the top row is
 * whether he will play (turns up / commitment / condition), the bottom row is
 * what he is like when he does (mood / temper / ego).
 */
export function SundayPlayerDetail({
  blurb,
  shirtNumber,
  note,
  memories,
  relationships,
  clubApps,
  clubGoals,
  clubMotm,
  subsOwed,
  happiness,
  commitment,
  punctuality,
  condition,
  temper,
  ego,
  isCaptain,
  onMakeCaptain,
  onRelease,
}: SundayPlayerDetailProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotionPref();

  const numbers: { label: string; value: string; tone?: string }[] = [
    { label: t('sunday.squad.apps'), value: String(clubApps) },
    { label: t('sunday.squad.goals'), value: String(clubGoals) },
    { label: t('sunday.squad.motm'), value: String(clubMotm) },
    {
      label: t('sunday.squad.owed'),
      value: `£${subsOwed}`,
      tone: subsOwed > 0 ? 'text-amber-300' : undefined,
    },
  ];

  return (
    <motion.div
      className="relative px-2.5 pb-2.5 space-y-2.5"
      initial={reduceMotion ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
    >
      {/* The back of the shirt. Decoration, so it is ABSENT under reduced
          motion rather than merely still — `MotionConfig` stops transforms and
          leaves paint alone. */}
      {!reduceMotion && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-1 top-0 text-[40px] leading-none font-display font-bold tabular-nums text-white/[0.04] select-none"
        >
          {shirtNumber}
        </span>
      )}

      <p className="relative text-micro text-muted-foreground leading-relaxed">{blurb}</p>

      {/* Why he is missing, in his own words, beside the pill that says he is.
          Authored by the simulation — never shortened. */}
      {note && (
        <p className="relative text-micro text-amber-200/90 leading-relaxed">{note}</p>
      )}

      {/* HIS STORY. Raised onto its own surface because it is the reward for
          opening the card, not the fifth section of it. */}
      <div className="relative rounded-lg bg-white/[0.04] px-2.5 py-2 space-y-1.5">
        {/* Not uppercased: "HIS STORY HERE" shouted, and this is the one
            heading on the card that introduces a voice rather than a table. */}
        <p className="text-caption font-semibold text-muted-foreground">
          {t('sunday.bio.story')}
        </p>
        {memories.length === 0 ? (
          <p className="text-micro text-muted-foreground">{t('sunday.bio.noStory')}</p>
        ) : (
          <ul className="space-y-1.5">
            {memories.map((mem, i) => (
              <li key={`${mem.season}-${mem.week}-${mem.kind}-${i}`} className="flex items-baseline gap-2">
                <span className="text-micro text-muted-foreground/70 tabular-nums shrink-0 w-[42px]">
                  {t('sunday.bio.seasonWeek', { season: mem.season, week: mem.week })}
                </span>
                <span className="text-micro text-foreground/90 leading-relaxed">
                  {mem.text}
                  {/* The handful of afternoons a club actually retells.
                      Presentation only — the weight is written by the sim. */}
                  {mem.weight >= SUNDAY_MEMORY_LEGENDARY_WEIGHT && (
                    <span className="ml-1 text-micro font-semibold text-primary whitespace-nowrap">
                      · {t('sunday.story.legendary')}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {relationships.length > 0 && (
          <p className="text-micro text-muted-foreground leading-relaxed border-t border-white/[0.06] pt-1.5">
            {relationships.join(' · ')}
          </p>
        )}
      </div>

      {/* WHAT HE HAS DONE HERE. Club-career totals, not this season's. */}
      <div className="relative grid grid-cols-4 gap-1.5">
        {numbers.map(n => (
          <div key={n.label} className="rounded-lg bg-white/[0.04] px-1.5 py-1 text-center min-w-0">
            <p className="text-micro text-muted-foreground truncate">{n.label}</p>
            <p className={cn('text-body font-semibold tabular-nums', n.tone ?? 'text-foreground')}>
              {n.value}
            </p>
          </div>
        ))}
      </div>

      {/* WHAT HE IS. Row one decides whether he plays, row two decides what he
          is like when he does. */}
      <div className="relative grid grid-cols-3 gap-x-3 gap-y-2">
        <Meter tight label={t('sunday.squad.reliability')} value={scale20(punctuality)} />
        <Meter tight label={t('sunday.squad.commitment')} value={scale20(commitment)} />
        <Meter tight label={t('sunday.squad.condition')} value={scale20(condition)} />
        {/* The one place the word and the glyph appear together — shown once,
            on the open card, which is where the collapsed row's face is
            learned. */}
        <Meter tight icon={MoodIcon} label={t('sunday.squad.happiness')} value={happiness} />
        <Meter tight label={t('sunday.squad.temper')} value={scale20(temper)} />
        <Meter tight label={t('sunday.squad.ego')} value={scale20(ego)} />
      </div>

      {/* The two things only this screen can do. Both stay one tap away. */}
      <div className="relative flex gap-2">
        <LiquidButton className="flex-1 py-2" disabled={isCaptain} onClick={onMakeCaptain}>
          <span className="inline-flex items-center gap-1 text-micro">
            <CaptainIcon className="w-3.5 h-3.5" aria-hidden />
            {isCaptain ? t('sunday.sheet.captain') : t('sunday.sheet.makeCaptain')}
          </span>
        </LiquidButton>
        <LiquidButton tone="destructive" className="flex-1 py-2" onClick={onRelease}>
          <span className="inline-flex items-center gap-1 text-micro">
            <ReleaseIcon className="w-3.5 h-3.5" aria-hidden /> {t('sunday.squad.release')}
          </span>
        </LiquidButton>
      </div>
    </motion.div>
  );
}
