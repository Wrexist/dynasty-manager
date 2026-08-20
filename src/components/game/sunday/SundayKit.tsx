/**
 * The strip, drawn.
 *
 * WHY IT EXISTS. `sundayKitSpec` has been deriving a body colour, a trim
 * colour and one of five patterns from the club's id since the visuals helper
 * was written, and until now the only thing that consumed it was
 * `SundayPlayerCard`, which used the two colours to paint a portrait's
 * shoulders and threw the pattern away. A Sunday club's identity is three
 * things — a name somebody thought was funny, two colours from a catalogue,
 * and whichever pattern was in stock — and the third had never been drawn.
 *
 * WHAT IT IS. Shirt, shorts and socks as one inline SVG, the crest on the
 * chest and the number on the front, the way an amateur kit is actually
 * printed. Nothing here is invented: `body`, `trim` and `pattern` come
 * straight from `sundayKitSpec`, the crest outline from `sundayCrestSpec`, and
 * the number from `SundaySquadMember.shirtNumber`.
 *
 * THE RULES IT FOLLOWS, the same ones `SundayFace` and `PlayerAvatar` do:
 *
 *   1. `memo()` and SCALAR PROPS ONLY. Never a spec object — `sundayKitSpec`
 *      returns a fresh one on every call, so a caller that spreads it inline
 *      would defeat the memo on every render.
 *   2. `useId()` for the `<clipPath>`. Two kits on one screen with the same id
 *      silently clip each other's patterns.
 *   3. SIZE-TIERED DETAIL. The pattern is the identity so it is drawn at every
 *      size; the collar, the cuffs, the crest and the number only appear where
 *      they are more than a smudge.
 *
 * NO DECORATIVE LAYERS. Flat fills only: no gradient, no filter, no
 * `backdrop-filter`, nothing that needs gating behind `useReducedMotionPref`
 * because there is nothing here that reduced motion would want turned off.
 */
import { memo, useId } from 'react';
import { cn } from '@/lib/utils';
import { sundayInkOn } from '@/utils/sunday/visuals';
import type { SundayCrestShape, SundayKitPattern } from '@/utils/sunday/visuals';

/** The drawing's own units. Width/height ratio is fixed by this box. */
const VB_W = 64;
const VB_H = 92;

/**
 * The shirt outline. Sleeves are stubs rather than tubes — a hanging kit is
 * seen flat, and a Sunday shirt is one size and hangs like a bin bag.
 */
const SHIRT = [
  'M 21.5 5',
  'Q 32 10.5 42.5 5',
  'L 50 7.6',
  'Q 58.2 10.8 59 20.4',
  'Q 59.3 23.4 56.6 24.8',
  'L 50.4 22',
  'L 48.6 18.4',
  'L 48.6 47',
  'Q 48.6 50 45.6 50',
  'L 18.4 50',
  'Q 15.4 50 15.4 47',
  'L 15.4 18.4',
  'L 13.6 22',
  'L 7.4 24.8',
  'Q 4.7 23.4 5 20.4',
  'Q 5.8 10.8 14 7.6',
  'Z',
].join(' ');

/** Shorts, with a leg split. */
const SHORTS = 'M 16 57 L 48 57 L 50.5 73 L 36.5 73 L 32 63.5 L 27.5 73 L 13.5 73 Z';

/** One sock. Drawn twice, offset. */
const SOCK = 'M 0 0 L 10 0 L 9 12 Q 9 14 6.5 14 L 3.5 14 Q 1 14 1 12 Z';

/** The crest patch, at chest height on the wearer's left. Four outlines, the
 *  same four `sundayCrestSpec` names — a divider is NOT drawn: the patch is
 *  eight units across, and a chevron inside eight units is a smudge. */
const CREST: Record<SundayCrestShape, string> = {
  disc: 'M 36.9 17 A 4.1 4.1 0 1 0 45.1 17 A 4.1 4.1 0 1 0 36.9 17 Z',
  shield: 'M 36.9 13 L 45.1 13 L 45.1 17.3 Q 45.1 20.6 41 21.6 Q 36.9 20.6 36.9 17.3 Z',
  roundel: 'M 36.9 17 A 4.1 4.1 0 1 0 45.1 17 A 4.1 4.1 0 1 0 36.9 17 Z',
  pennant: 'M 36.9 13 L 45.1 13 L 45.1 21.4 L 41 18.5 L 36.9 21.4 Z',
};

/** Keeps a black kit from vanishing into a dark card. */
const EDGE = 'rgba(255,255,255,0.16)';

export interface SundayKitProps {
  /** Shirt colour — `sundayKitSpec().body`. */
  body: string;
  /** Sleeves, collar, shorts and whatever the pattern is printed in —
   *  `sundayKitSpec().trim`. */
  trim: string;
  /** `sundayKitSpec().pattern`. */
  pattern: SundayKitPattern;
  /** `sundayCrestSpec().shape`. Omitted draws a shirt with no badge on it,
   *  which is also a thing that happens. */
  crestShape?: SundayCrestShape;
  /** 1-99, from `SundaySquadMember.shirtNumber`. */
  number?: number;
  /** Rendered HEIGHT in px — a kit is a tall thing, so height is the honest
   *  measure and the width follows from the box. */
  size?: number;
  /** When given, the kit is announced; otherwise it is decorative and hidden,
   *  because it always sits beside the club's name. */
  label?: string;
  className?: string;
}

export const SundayKit = memo(function SundayKit({
  body,
  trim,
  pattern,
  crestShape,
  number,
  size = 72,
  label,
  className,
}: SundayKitProps) {
  const uid = useId().replace(/:/g, '');
  const clipId = `sk-${uid}`;
  const isLarge = size >= 56;
  const isMedium = size >= 36;
  const ink = sundayInkOn(body);
  const numberHalo = ink === '#FFFFFF' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.45)';

  return (
    <svg
      width={Math.round((size * VB_W) / VB_H)}
      height={size}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className={cn('shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {label && <title>{label}</title>}

      <defs>
        <clipPath id={clipId}>
          <path d={SHIRT} />
        </clipPath>
      </defs>

      {/* ── Shirt ── */}
      <path d={SHIRT} fill={body} stroke={EDGE} strokeWidth="0.6" strokeLinejoin="round" />

      {/* The pattern, clipped to the shirt so a hoop cannot run out past a
          sleeve. Drawn at every size: it is the club, not decoration. */}
      <g clipPath={`url(#${clipId})`}>
        {pattern === 'stripes' && [17.5, 26.5, 35.5, 44.5].map(x => (
          <rect key={x} x={x} y="4" width="4.5" height="46" fill={trim} />
        ))}
        {pattern === 'hoops' && [13, 25, 37].map(y => (
          <rect key={y} x="4" y={y} width="56" height="5" fill={trim} />
        ))}
        {pattern === 'halves' && <rect x="32" y="4" width="28" height="46" fill={trim} />}
        {pattern === 'sash' && <path d="M 8 50 L 30 4 L 40 4 L 18 50 Z" fill={trim} />}
      </g>

      {/* Collar and cuffs. The two places a kit's second colour always shows,
          whatever the pattern is. */}
      {isMedium && (
        <>
          <path d="M 21.5 5 Q 32 12.5 42.5 5 Q 32 9.5 21.5 5 Z" fill={trim} />
          <path
            d="M 50.4 22 L 56.6 24.8"
            stroke={trim}
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 13.6 22 L 7.4 24.8"
            stroke={trim}
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}

      {/* The badge. Outlined in the shirt's own ink rather than in a darker
          trim: the patch sits at chest height, which on a halves kit or a sash
          is whichever colour happens to be there, and a trim-coloured badge on
          a trim-coloured half is an invisible badge. The outline is the one
          colour guaranteed to be readable against the shirt. */}
      {isLarge && crestShape && (
        <>
          <path
            d={CREST[crestShape]}
            fill={trim}
            stroke={ink}
            strokeWidth="0.7"
            opacity="0.95"
          />
          {crestShape === 'roundel' && (
            <circle cx="41" cy="17" r="2" fill={body} />
          )}
        </>
      )}

      {/* The number, printed on the front the way a Sunday kit is. The halo is
          what keeps it readable where it crosses a stripe. */}
      {isLarge && number != null && (
        <text
          x="32"
          y="37"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="15"
          fontWeight="800"
          fill={ink}
          stroke={numberHalo}
          strokeWidth="0.6"
          paintOrder="stroke"
        >
          {number}
        </text>
      )}

      {/* ── Shorts ── */}
      <path d={SHORTS} fill={trim} stroke={EDGE} strokeWidth="0.6" strokeLinejoin="round" />
      <rect x="16" y="54" width="32" height="3.6" rx="1.2" fill={body} stroke={EDGE} strokeWidth="0.5" />

      {/* ── Socks ── */}
      {[17, 37].map(x => (
        <g key={x} transform={`translate(${x} 76)`}>
          <path d={SOCK} fill={body} stroke={EDGE} strokeWidth="0.6" strokeLinejoin="round" />
          {isMedium && <rect x="0.4" y="0.4" width="9.2" height="3" fill={trim} />}
        </g>
      ))}
    </svg>
  );
});
