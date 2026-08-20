/**
 * SundayStory — what the afternoon meant, as a grid.
 *
 * WHAT IT REPLACES. Five stacked rows of `icon + "Label: " + sentence`, all the
 * same width, all the same weight, in the order they happened to be written:
 * hero, lowlight, dressing room, turning point, damage. A verdict, two men, a
 * number and a list of consequences are four different KINDS of thing, and
 * pouring all four down one column made none of them land.
 *
 * THE SHAPE. The verdict is the headline. Underneath it, the two men who
 * decided how you feel about the afternoon sit side by side WITH THEIR FACES —
 * a name and a decimal is a spreadsheet row, a portrait is a person, and the
 * portraits already exist (`SundayFace`) and were being drawn nowhere near the
 * moments they belong to. Then the small facts as chips, then the two pieces of
 * prose that need room, full width.
 *
 * THE GUEST'S FACE IS A HASHED ONE AND THAT IS THE HONEST ANSWER. Ringers are
 * deleted from `players` at the whistle, so a guest who was man of the match
 * has no stored appearance to draw. `sundayFaceSpec` derives one from his id —
 * stable, unique, and the same face he would be given anywhere else in the
 * mode. The alternative is a blank square beside the name of the bloke who won
 * you the game.
 */
import { SundayFace } from '@/components/game/sunday/SundayFace';
import { StatChip } from '@/components/game/sunday/SundayBits';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { SUNDAY_ICON } from '@/config/sundayIcons';
import type { LucideIcon } from '@/config/sundayIcons';
import type { PlayerAppearance } from '@/types/game';

const TurningPointIcon = SUNDAY_ICON.substitution;
const ConsequenceIcon = SUNDAY_ICON.expense;
const HeroIcon = SUNDAY_ICON.hero;
const LowlightIcon = SUNDAY_ICON.lowlight;

export interface SundayStoryPerson {
  name: string;
  rating: number;
  face: PlayerAppearance;
}

export interface SundayStoryProps {
  /** The one-line result, from `sundayResultVerdict`. */
  verdict: string;
  /** What it was like out there — null before the field existed, and null is
   *  then rendered as nothing rather than as "clear". */
  weatherLabel: string | null;
  weatherIcon: LucideIcon | null;
  hero: SundayStoryPerson | null;
  /** Omitted by the caller when the worst man on the day was also the best. */
  lowlight: SundayStoryPerson | null;
  moraleDelta: number;
  guestCount: number;
  turningPoint: string | null;
  consequences: readonly string[];
  /** The club's kit, for the shoulders in each portrait. */
  kitBody: string;
  kitTrim: string;
}

const Person = ({ person, kind, kitBody, kitTrim, label }: {
  person: SundayStoryPerson;
  kind: 'hero' | 'lowlight';
  kitBody: string;
  kitTrim: string;
  label: string;
}) => {
  const Icon = kind === 'hero' ? HeroIcon : LowlightIcon;
  return (
    <div className={cn(
      'min-w-0 rounded-xl border p-3',
      kind === 'hero'
        ? 'border-primary/35 bg-primary/[0.06]'
        : 'border-border/50 bg-white/[0.02]',
    )}>
      {/* Wraps rather than truncates: "MAN OF THE MATCH" is two characters too
          wide for a half-width card at 375px, and "MAN OF THE MAT…" is worse
          than two short lines. No `tracking-wider` here for the same reason. */}
      <p className="flex items-start gap-1 text-micro font-semibold uppercase text-muted-foreground">
        <Icon className={cn('mt-px h-3 w-3 shrink-0', kind === 'hero' ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
        <span className="min-w-0">{label}</span>
      </p>
      {/* The name gets the CARD's width, not what is left over beside a 44px
          portrait — at 375px in a two-up grid that was truncating most surnames
          to an ellipsis. Portrait and rating share the row above it. */}
      <div className="mt-2 flex items-center gap-2">
        <SundayFace {...person.face} size={44} shirtColor={kitBody} shirtTrim={kitTrim} />
        {/* Plain string, not cn(): there is nothing to merge, and cn() would
            drop `text-h3` next to a colour — see SundayTimeline. */}
        <p className={`font-display text-h3 font-bold tabular-nums ${kind === 'hero' ? 'text-primary' : 'text-muted-foreground'}`}>
          {person.rating.toFixed(1)}
        </p>
      </div>
      <p className="mt-1 truncate text-caption font-semibold text-foreground">{person.name}</p>
    </div>
  );
};

export function SundayStory(props: SundayStoryProps) {
  const { t } = useTranslation();
  const { hero, lowlight } = props;
  const WeatherIcon = props.weatherIcon;
  const chips: React.ReactNode[] = [];
  if (props.moraleDelta !== 0) {
    chips.push(
      <StatChip
        key="morale"
        label={t('sunday.story.morale')}
        value={`${props.moraleDelta > 0 ? '+' : ''}${props.moraleDelta}`}
        tone={props.moraleDelta > 0 ? 'good' : 'bad'}
      />,
    );
  }
  if (props.guestCount > 0) {
    chips.push(
      <StatChip key="guests" label={t('sunday.story.guests')} value={String(props.guestCount)} tone="warn" />,
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="font-display text-title font-bold leading-snug text-foreground">{props.verdict}</p>
        {props.weatherLabel && WeatherIcon && (
          <p className="inline-flex items-center gap-1.5 text-micro text-muted-foreground">
            <WeatherIcon className="h-3.5 w-3.5" aria-hidden />
            {props.weatherLabel}
          </p>
        )}
      </div>

      {(hero || lowlight) && (
        <div className={cn('grid gap-2', hero && lowlight ? 'grid-cols-2' : 'grid-cols-1')}>
          {hero && (
            <Person
              person={hero}
              kind="hero"
              kitBody={props.kitBody}
              kitTrim={props.kitTrim}
              label={t('sunday.story.hero')}
            />
          )}
          {lowlight && (
            <Person
              person={lowlight}
              kind="lowlight"
              kitBody={props.kitBody}
              kitTrim={props.kitTrim}
              label={t('sunday.story.lowlight')}
            />
          )}
        </div>
      )}

      {chips.length > 0 && (
        <div className={cn('grid gap-2', chips.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>{chips}</div>
      )}

      {props.turningPoint && (
        <div className="flex items-start gap-2 rounded-xl border border-sky-400/25 bg-sky-500/[0.06] p-3">
          <TurningPointIcon className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden />
          <div className="min-w-0">
            <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
              {t('sunday.story.turningPoint')}
            </p>
            <p className="text-caption leading-relaxed text-foreground">{props.turningPoint}</p>
          </div>
        </div>
      )}

      {props.consequences.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-3">
          <ConsequenceIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
          <div className="min-w-0 space-y-0.5">
            <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
              {t('sunday.story.consequences')}
            </p>
            {props.consequences.map(line => (
              <p key={line} className="text-caption leading-relaxed text-foreground">{line}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
