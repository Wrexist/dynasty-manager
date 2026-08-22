/**
 * SundayBriefing — the team talk before you go and find out who turned up.
 *
 * WHAT WAS WRONG WITH IT. Nine sibling blocks in one panel, all the same size,
 * all the same weight: the stakes, the pitch, home or away, where they sit,
 * their form, their danger man, how they set up, what happened last time, a
 * milestone, the derby record and the named count. Every one of them was true
 * and useful; together they were a wall, and a wall has no answer to "what
 * should I be worried about here?".
 *
 * THE RANKING. Four bands, loudest first, each visually distinct:
 *
 *   1. WHAT IT MEANS — the tier's own name and the stakes line. A cup final and
 *      a wet Tuesday now differ by a chip, a rim, a colour and a type size, not
 *      by five percent of ring opacity.
 *   2. THEM — everything about the opposition in ONE block behind one heading:
 *      where they sit, their last five, the man who scores, how they line up
 *      and the derby record if there is one. Previously four separate rows.
 *   3. US — how many are named, and the labelled adjustments the XI is really
 *      carrying.
 *   4. THE GROUND, AND MEMORY — the pitch, home or away, the last time these
 *      two met, the man one game short. Quietest: true, but nobody makes a
 *      decision on them.
 *
 * NO WEATHER. It does not exist yet — it is rolled at kick-off, after the
 * ringer draws — and a plausible-looking badge here would be an invention.
 *
 * Everything is a scalar or a resolved string: the page owns the derivation
 * (`deriveSundayStakes`, `sundayStyleOf`, `buildMatchdayTeam`), this owns the
 * ranking.
 */
import { FormPills, SundayCrest } from '@/components/game/sunday/SundayBits';
import { SundayAdjustments } from '@/components/game/sunday/SundayAdjustments';
import { useTranslation } from '@/hooks/useTranslation';
import { SUNDAY_ICON, SUNDAY_TIER_CHIP } from '@/config/sundayIcons';
import type { SundayMatchTier } from '@/types/game';

const RecallIcon = SUNDAY_ICON.recall;
const DangerIcon = SUNDAY_ICON.warning;
const PitchIcon = SUNDAY_ICON.pitch;
const VenueIcon = SUNDAY_ICON.venue;
const RivalIcon = SUNDAY_ICON.rival;

export interface SundayBriefingProps {
  tier: SundayMatchTier;
  /** What to call this afternoon on the chip: the cup round, the derby's name,
   *  or the word for a decider. Empty for a routine league fixture, which gets
   *  no chip at all — a wet Tuesday should look like a wet Tuesday. */
  tierLabel: string;
  /** The arithmetic of what is riding on it, already in English. */
  stakes: string | null;

  // ── Them ──
  opponentName: string;
  opponentColor: string;
  opponentSecondaryColor: string;
  /** League position, or null in a cup tie against a side from another
   *  division — where the table says nothing about them. */
  position: number | null;
  tableSize: number;
  form: readonly ('W' | 'D' | 'L')[];
  dangerName: string | null;
  dangerGoals: number;
  /** How they play and what tends to answer it, in touchline English. */
  styleLine: string | null;
  counterLine: string | null;
  /** The derby line: who runs them, how, and the head-to-head. */
  rivalryLine: string | null;

  // ── Us ──
  namedCount: number;
  minToPlay: number;
  adjustments: readonly { label: string; delta: number }[];

  // ── The ground, and memory ──
  isHome: boolean;
  pitch: number;
  /** `pitchConditionFor(pitch)` — the word, so the briefing and the post-match
   *  panel describe one surface in one vocabulary. */
  pitchCondition: string;
  recall: string | null;
  milestone: string | null;
}

export function SundayBriefing(props: SundayBriefingProps) {
  const { t } = useTranslation();
  const { tier, tierLabel, stakes } = props;
  const loud = tier === 'decider' || tier === 'cup-final';
  const short = props.namedCount < props.minToPlay;

  return (
    <div className="space-y-3">
      {/* 1 · WHAT IT MEANS — absent entirely when nothing is riding on it.
          `deriveSundayStakes` returns a null line for a routine fixture on
          purpose (a stakes line is arithmetic, never atmosphere), so this band
          collapses rather than leaving a gap where a headline should be. */}
      {(tierLabel || stakes) && (
      <div className="space-y-1.5">
        {tierLabel && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-micro font-bold uppercase tracking-wider ${SUNDAY_TIER_CHIP[tier] || 'text-muted-foreground border-border/50'}`}>
            {tier === 'derby' && <RivalIcon className="h-3 w-3" aria-hidden />}
            {tierLabel}
          </span>
        )}
        {stakes && (
          <p className={`font-display font-bold leading-snug ${loud ? 'text-h3 text-primary' : 'text-title text-foreground'}`}>
            {stakes}
          </p>
        )}
      </div>
      )}

      {/* 2 · THEM — one block, one heading, everything known about them. */}
      <div className="rounded-xl border border-border/40 bg-white/[0.03] p-3 space-y-2">
        <div className="flex items-center gap-2">
          <SundayCrest
            shortName={props.opponentName}
            color={props.opponentColor}
            secondaryColor={props.opponentSecondaryColor}
            size={28}
          />
          <span className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">
            {props.opponentName}
          </span>
          {props.position !== null && (
            <span className="shrink-0 text-caption font-semibold tabular-nums text-muted-foreground">
              {props.position}/{props.tableSize}
            </span>
          )}
          <FormPills form={props.form} size="sm" />
        </div>
        {props.styleLine && (
          <p className="text-caption leading-relaxed text-foreground/85">
            {props.styleLine}{' '}
            <span className="text-muted-foreground">{props.counterLine}</span>
          </p>
        )}
        {props.dangerName && props.dangerGoals > 0 && (
          <p className="inline-flex items-center gap-1.5 text-caption text-amber-200">
            <DangerIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{props.dangerName}</span>
            <span className="tabular-nums text-muted-foreground">{props.dangerGoals}</span>
          </p>
        )}
        {props.rivalryLine && (
          <p className="text-caption leading-relaxed text-orange-300">{props.rivalryLine}</p>
        )}
      </div>

      {/* 3 · US */}
      <div className="space-y-2">
        {/* A plain eyebrow rather than `SectionHeader level="eyebrow"`: that
            component merges its level style with `truncate` through cn(), and
            cn() drops a `text-<scale>` class that sits beside a colour, so the
            heading renders at whatever size it inherits. See SundayTimeline. */}
        <p className="flex items-baseline justify-between gap-2 text-micro font-semibold uppercase tracking-wider text-muted-foreground">
          <span>{t('sunday.match.yourSide')}</span>
          <span className={short ? 'tabular-nums text-amber-300' : 'tabular-nums'}>
            {t('sunday.match.namedSide', { n: props.namedCount })}
          </span>
        </p>
        {props.adjustments.length > 0 && (
          <SundayAdjustments rows={props.adjustments} label={t('sunday.match.takingOut')} />
        )}
      </div>

      {/* 4 · THE GROUND, AND MEMORY — true, quiet, decision-free. */}
      <div className="space-y-1.5 border-t border-border/40 pt-2.5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <VenueIcon className="h-3.5 w-3.5" aria-hidden />
            {props.isHome ? t('sunday.match.home') : t('sunday.match.away')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PitchIcon className="h-3.5 w-3.5" aria-hidden />
            {/* THE SAME WORD THE POST-MATCH PANEL USES. This said "Pitch 38"
                while the panel three taps later said "Pitch: good" — both true
                (`pitchConditionFor` puts 32 and up in "good" on purpose, see
                its header) and flatly contradictory read side by side. The
                condition leads; the number it came from follows it. */}
            {t('sunday.match.pitch')} <span className="text-foreground/80">{props.pitchCondition}</span>
            <span className="tabular-nums text-muted-foreground/70">({props.pitch})</span>
          </span>
        </p>
        {props.recall && (
          <p className="text-caption leading-relaxed text-muted-foreground">
            <RecallIcon className="mr-1 -mt-0.5 inline-block h-3.5 w-3.5" aria-hidden />
            {props.recall}
          </p>
        )}
        {props.milestone && (
          <p className="text-caption leading-relaxed text-primary/90">{props.milestone}</p>
        )}
      </div>
    </div>
  );
}
