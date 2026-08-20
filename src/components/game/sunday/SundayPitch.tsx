/**
 * The teamsheet as a pitch.
 *
 * WHAT WAS WRONG. Picking a Sunday side was four flat name-lists — named,
 * benched, available, unavailable — on a screen whose whole subject is SHAPE.
 * The mode chose a formation here and never once drew it, so "you have nine
 * men and no right winger" was a sentence you had to assemble yourself out of
 * a count and a warning.
 *
 * WHAT THIS DRAWS, and the two things it has to say that a 45-league board
 * never does:
 *
 *   1. SUNDAY SIDES ARE SHORT. Eleven is the exception. Empty slots are the
 *      signature state of the mode, so they are drawn as MISSING MEN — a grey
 *      silhouette in the shirt nobody turned up to wear — rather than as a
 *      dashed hole that reads like a rendering fault.
 *   2. SEVEN, NOT ELEVEN, IS THE CLIFF. Below `SUNDAY_MIN_START` the game is
 *      forfeited and the season stops mattering. The count chip said "9 of 11",
 *      which makes eleven look like the constraint and hides the one that
 *      actually decides whether football happens. `SundayXiCount` draws the
 *      line where it really is.
 *
 * IT OWNS NO STATE AND NO STORE. Selection, placement and the lock all belong
 * to the screen; this file is given values and hands back taps. That is the
 * same division `PitchBoard` documents, one layer up — and it is what lets the
 * page keep its narrow store subscription (`renderHygiene` pins that).
 *
 * NO BACKDROP-FILTER ANYWHERE IN HERE. Eleven tokens sit on a surface a thumb
 * drags across; the panel around it already pays for one blur.
 */
import { memo } from 'react';
import { PitchBoard, type PitchBoardSlotContext } from '@/components/game/PitchBoard';
import { SundayFace, type SundayFaceProps } from '@/components/game/sunday/SundayFace';
import { SUNDAY_ICON } from '@/config/sundayIcons';
import { SUNDAY_FULL_XI, SUNDAY_MIN_START } from '@/config/sundayLeague';
import { cn } from '@/lib/utils';
import { sundayRatingTier, type SundayRatingTier } from '@/utils/sunday/visuals';
import type { PositionFit } from '@/utils/positionFit';
import type { FormationSlot, SundayAvailabilityStatus } from '@/types/game';

const CaptainIcon = SUNDAY_ICON.captain;
const DoubtIcon = SUNDAY_ICON.doubt;
const WrongPosIcon = SUNDAY_ICON.warning;

/** Rating tier → ink. The same four-band ladder `SundayPlayerCard` uses, so a
 *  man is the same colour on the squad screen and on the pitch. */
const RATING_TONE: Record<SundayRatingTier, string> = {
  standout: 'text-emerald-300',
  good: 'text-primary',
  steady: 'text-foreground',
  limited: 'text-muted-foreground',
};

/** Position fit → the ring round the portrait. Colour AND, for `wrong`, the
 *  position abbreviation printed under the name — never colour alone. */
const FIT_RING: Record<PositionFit, string> = {
  natural: 'ring-emerald-400/70',
  compatible: 'ring-amber-400/70',
  wrong: 'ring-destructive/80',
};

/** The portrait's rendered size. Below `SundayFace`'s large tier (44) on
 *  purpose: at 38px the seams and stubble are noise, and eleven of them are
 *  eleven times the noise. */
const FACE_SIZE = 38;

export interface SundayPitchTokenProps extends Pick<
  SundayFaceProps,
  'skinTone' | 'hairStyle' | 'hairColor' | 'height' | 'build' | 'facialHair' | 'accessory'
> {
  /** Surname, or the whole name when there is only one. Truncated, never wrapped. */
  shortName: string;
  /** 1-99, from `SundaySquadMember.shirtNumber`. */
  shirtNumber: number;
  overall: number;
  fit: PositionFit;
  /** The slot he is standing in. Printed only when the fit is wrong, which is
   *  the case where the ring's colour is doing real work. */
  slotPos: string;
  kitBody: string;
  kitTrim: string;
  availStatus: SundayAvailabilityStatus;
  captain?: boolean;
  selected?: boolean;
  /** Somebody else is selected and this man is not a candidate. */
  faded?: boolean;
  /** A warning in the panel above points at him. */
  flagged?: boolean;
}

/**
 * One man on the board.
 *
 * VISUALS ONLY — `PitchBoard` owns the `<button>`. A token that brought its own
 * would be two tab stops for one action, which is the invalid DOM this screen
 * has already had to have fixed once.
 *
 * SCALARS AND `memo`, for the reason `SundayFace` states: `players` is rewritten
 * by the store on every training tick and week advance, so a token holding a
 * `Player` re-renders whether or not anything about that man changed.
 */
export const SundayPitchToken = memo(function SundayPitchToken({
  shortName, shirtNumber, overall, fit, slotPos, kitBody, kitTrim,
  availStatus, captain, selected, faded, flagged, ...face
}: SundayPitchTokenProps) {
  return (
    <span className={cn('flex flex-col items-center w-[52px] transition-opacity', faded && 'opacity-40')}>
      <span
        className={cn(
          'relative rounded-full shrink-0 ring-2 bg-[hsl(222_32%_11%)]',
          FIT_RING[fit],
          // SELECTION IS A DETACHED HALO, NOT A RING COLOUR, and it has to be.
          // This app's `--primary` is emerald (160 84% 39%), which is the same
          // family as the natural-fit ring — a selected left-back in his own
          // position was indistinguishable from an unselected one, measured in
          // the browser. An outline at an offset is a different SHAPE, so it
          // survives whatever colour the fit ring happens to be, and it leaves
          // the fit ring intact rather than overwriting the information you
          // picked the man up to act on.
          selected && 'outline outline-2 outline-offset-2 outline-white',
          flagged && !selected && 'outline outline-2 outline-offset-2 outline-amber-300',
        )}
        // A DARK DISC, NOT THE KIT COLOUR. The kit is already on the portrait's
        // shoulders; painting the whole disc with it put a green club's eleven
        // green circles on a green pitch, which was measured in a browser and
        // was very nearly invisible. A constant dark ground works for all eight
        // club palettes and lets the shirt still read.
        style={{ width: FACE_SIZE, height: FACE_SIZE, borderRadius: '9999px' }}
      >
        <span className="block rounded-full overflow-hidden" style={{ width: FACE_SIZE, height: FACE_SIZE }}>
          <SundayFace {...face} shirtColor={kitBody} shirtTrim={kitTrim} size={FACE_SIZE} />
        </span>
        {/* CORNER BADGES, NOT WORDS BESIDE THE NAME. Three glyphs sharing the
            name's line cost it roughly half its width, and a Sunday squad is
            full of surnames that do not survive being halved — 'Pilkington'
            came back as 'Pilkingt…' on a 390px screen. The badges are on the
            portrait, where there is unused space, and the name gets the whole
            52px to itself. */}
        {captain && (
          <span className="absolute -top-0.5 -left-0.5 rounded-full bg-background/85 p-[1px]">
            <CaptainIcon className="w-2.5 h-2.5 text-primary fill-primary" aria-hidden />
          </span>
        )}
        {availStatus === 'doubt' && (
          <span className="absolute -top-0.5 -right-0.5 rounded-full bg-background/85 p-[1px]">
            <DoubtIcon className="w-2.5 h-2.5 text-amber-300" aria-hidden />
          </span>
        )}
        {/* Wrong position: the red ring is the loud signal, and this is the one
            that is not a colour. It replaced the slot's abbreviation printed in
            red beside the overall — three more characters on the widest line of
            the widest token. */}
        {fit === 'wrong' && (
          <span
            className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background/85 p-[1px]"
            title={slotPos}
          >
            <WrongPosIcon className="w-2.5 h-2.5 text-destructive" aria-hidden />
          </span>
        )}
      </span>
      <span className="block w-full text-center text-micro font-semibold text-white truncate mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        {shortName}
      </span>
      <span className="flex items-baseline gap-1 text-micro leading-none">
        <span className="tabular-nums text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {shirtNumber}
        </span>
        <span className={cn('font-bold tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]', RATING_TONE[sundayRatingTier(overall)])}>
          {overall}
        </span>
      </span>
    </span>
  );
});

/**
 * A shirt nobody turned up to wear.
 *
 * The silhouette is the point. A dashed outline with a position abbreviation
 * in it reads as an empty UI control; a grey man reads as an absence, which is
 * what it is. `active` is the ONE slot a selected player would actually land
 * in — see the header of `utils/sunday/teamsheet.ts` for why there can only be
 * one, and why pretending otherwise would be lying about the tap.
 */
export const SundayEmptySlot = memo(function SundayEmptySlot({
  slotPos, active, required,
}: {
  slotPos: string;
  /** A man is selected and this is where he goes. */
  active?: boolean;
  /** This slot is inside the first `SUNDAY_MIN_START` — leaving it empty is
   *  not a shape problem, it is a forfeit. */
  required?: boolean;
}) {
  return (
    <span className="flex flex-col items-center w-[52px]">
      <span
        className={cn(
          'relative rounded-full flex items-center justify-center border border-dashed shrink-0',
          active
            ? 'border-primary bg-primary/20'
            : required
              ? 'border-amber-300/60 bg-amber-400/10'
              : 'border-white/25 bg-black/25',
        )}
        style={{ width: FACE_SIZE, height: FACE_SIZE }}
      >
        {/* A head and a pair of shoulders, the same crop `SundayFace` uses, so
            the gap is a man-shaped hole rather than a blank disc. */}
        <svg viewBox="0 0 32 32" className="w-full h-full opacity-45" aria-hidden focusable="false">
          <circle cx="16" cy="13" r="6.4" fill="currentColor" className={active ? 'text-primary' : 'text-white/70'} />
          <path
            d="M 4.5 32 Q 6 22 16 22 Q 26 22 27.5 32 Z"
            fill="currentColor"
            className={active ? 'text-primary' : 'text-white/70'}
          />
        </svg>
      </span>
      <span
        className={cn(
          'text-micro font-semibold uppercase mt-0.5 tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]',
          active ? 'text-primary' : required ? 'text-amber-200' : 'text-white/60',
        )}
      >
        {slotPos}
      </span>
    </span>
  );
});

/**
 * How many are named, and where the cliff is.
 *
 * ELEVEN PIPS, WITH A LINE AFTER THE SEVENTH. The chip read `9 of 11`, so the
 * number the whole mode turns on — turn up with six and the match is forfeited
 * — was invisible until you were already under it. Now the first
 * `SUNDAY_MIN_START` pips are a different weight from the last four and there
 * is a gold rule between them, so a short side is READ as short and a legal one
 * is read as legal.
 *
 * The full sentence lives on the meter's accessible name; the pips carry it for
 * everyone else. Colour is never alone: the count is printed, the pips differ
 * in fill as well as hue, and the rule is a shape.
 */
export function SundayXiCount({ named, label, countLabel, minLabel, ariaLabel }: {
  named: number;
  /** 'Starting'. */
  label: string;
  /** Already interpolated, e.g. `9 / 11`. */
  countLabel: string;
  /** Already interpolated, e.g. `7 to play`. */
  minLabel: string;
  /** The whole constraint, as one sentence, for a screen reader. */
  ariaLabel: string;
}) {
  const legal = named >= SUNDAY_MIN_START;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-micro font-semibold uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </span>
        <span className={cn('text-caption font-bold tabular-nums shrink-0', legal ? 'text-emerald-300' : 'text-amber-300')}>
          {countLabel}
        </span>
      </div>
      <div
        className="flex items-stretch gap-[3px] mt-1.5 h-2"
        role="meter"
        aria-valuenow={named}
        aria-valuemin={0}
        aria-valuemax={SUNDAY_FULL_XI}
        aria-label={ariaLabel}
      >
        {Array.from({ length: SUNDAY_FULL_XI }, (_, i) => {
          const filled = i < named;
          const required = i < SUNDAY_MIN_START;
          return (
            <span key={i} className="flex-1 flex items-stretch min-w-0">
              <span
                className={cn(
                  'flex-1 rounded-sm',
                  filled
                    ? required ? 'bg-emerald-400' : 'bg-emerald-400/55'
                    // HOLLOW, NOT TINTED. A 30%-alpha amber pill at this size
                    // renders as a solid lozenge, so an empty sheet read as
                    // 'seven already named' — exactly backwards. An outline
                    // round nothing is an outline round nothing.
                    : required ? 'ring-1 ring-inset ring-amber-300/80' : 'bg-white/10',
                )}
              />
              {/* The cliff. A rule, not a colour change, so it survives a
                  greyscale screenshot and a colour-blind eye. */}
              {/* The cliff. WHITE, not `primary`: this app's primary is emerald,
                  which is also the fill of a named pip, so a green rule between
                  green pips was just another pip. */}
              {i === SUNDAY_MIN_START - 1 && (
                <span className="w-[3px] mx-[3px] -my-0.5 rounded-sm bg-white/85 shrink-0" aria-hidden />
              )}
            </span>
          );
        })}
      </div>
      {/* The caption starts AT the rule rather than at the left margin, so it
          labels the line it is about instead of floating under the whole bar. */}
      <div className="flex mt-1" aria-hidden>
        <span className="flex-[7]" />
        <span className="flex-[4] text-micro font-semibold text-white/85 whitespace-nowrap">{minLabel}</span>
      </div>
    </div>
  );
}

export interface SundayPitchProps {
  slots: readonly FormationSlot[];
  /** Parallel to `slots`; short at the tail, which is the whole point. */
  occupants: readonly (string | null)[];
  selectedId: string | null;
  /** Read-only: the morning has happened and this is the side. */
  locked?: boolean;
  onSlotTap: (ctx: PitchBoardSlotContext) => void;
  renderToken: (ctx: PitchBoardSlotContext & { occupantId: string }) => React.ReactNode;
  slotLabel: (ctx: PitchBoardSlotContext) => string;
  /**
   * What an EMPTY shirt means here: `active` is the one slot a picked-up
   * reserve would land in, `required` is inside the first `SUNDAY_MIN_START`
   * and therefore a forfeit rather than a shape problem.
   */
  emptyPos?: (ctx: PitchBoardSlotContext) => { active: boolean; required: boolean };
  ariaLabel: string;
}

/**
 * The board. A thin arrangement of `PitchBoard` — everything Sunday-specific is
 * in the two token components above and in the screen that owns the state.
 */
export function SundayPitch({
  slots, occupants, selectedId, locked, onSlotTap, renderToken, slotLabel, emptyPos, ariaLabel,
}: SundayPitchProps) {
  return (
    <PitchBoard
      slots={slots}
      occupants={occupants}
      selectedId={selectedId}
      ariaLabel={ariaLabel}
      onSlotTap={ctx => { if (!locked) onSlotTap(ctx); }}
      slotLabel={slotLabel}
      // NO RING ON THE WRAPPER. The slot wrapper is the label's box, not the
      // shirt's, so a `rounded-full` ring on it drew an oval round the circle
      // AND the position abbreviation under it. `SundayEmptySlot` already tints
      // the target shirt itself, which is both tidier and the thing the tap
      // actually lands on.
      slotClassName={() => cn(locked && 'cursor-default')}
      renderToken={renderToken}
      renderEmpty={ctx => {
        const state = emptyPos?.(ctx) ?? { active: false, required: false };
        return <SundayEmptySlot slotPos={ctx.slot.pos} active={state.active} required={state.required} />;
      }}
      className="my-1"
    />
  );
}
