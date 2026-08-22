/**
 * SundayFace — the portrait nothing was drawing.
 *
 * Every Sunday player is generated with a persisted `appearance` (skin tone,
 * hair style and colour, height, build, facial hair, accessory) and until now
 * not one pixel of it reached a screen. This is a flat, stylised, inline-SVG
 * head: a bloke who plays on a Sunday, not an EA head model. Legible at 24px in
 * a list row and still honest at 80px on a hero card.
 *
 * THE FOUR RULES IT FOLLOWS, all learned from `PlayerAvatar`:
 *
 *   1. `memo()`. Twenty of these render in one list.
 *   2. SCALAR PROPS ONLY. Never pass a `Player` — the object identity changes
 *      on every store write that touches the players map, which defeats memo
 *      for every instance on the screen. Callers spread a `PlayerAppearance`
 *      (get one from `sundayFaceSpec`, which also covers the undefined case).
 *   3. `useId()` for anything in `<defs>`. Duplicate gradient ids across twenty
 *      instances silently cross-wire: every face ends up painted with whichever
 *      one mounted last.
 *   4. SIZE-TIERED DETAIL. A 24px row draws a silhouette, a hairline and two
 *      eyes; the seams, the gradient and the stubble only appear at sizes
 *      where they are more than noise.
 *
 * WHAT IT DOES NOT DRAW. `accessory` has five values and only one of them is on
 * a man's head — a wristband, an armband and sleeve tape are all below the
 * neck. Only the headband is rendered; the rest are the kit's business, not the
 * portrait's. `bootColor` is not a prop for the same reason.
 */
import { memo, useId } from 'react';
import {
  PLAYER_HAIR_COLORS, PLAYER_HAIR_STYLES, PLAYER_SKIN_TONES,
} from '@/config/playerAppearance';
import { darken, lighten } from '@/utils/colorUtils';
import { cn } from '@/lib/utils';

export interface SundayFaceProps {
  /** Index into `PLAYER_SKIN_TONES`. */
  skinTone: number;
  /** Index into `PLAYER_HAIR_STYLES`. */
  hairStyle: number;
  /** Index into `PLAYER_HAIR_COLORS`. */
  hairColor: number;
  /** 0 short, 1 medium, 2 tall. Moves the head in the frame, nothing else —
   *  a portrait cannot show height, but it can show a longer neck. */
  height?: number;
  /** 0 lean, 1 average, 2 stocky. Widens the jaw and the shoulders. */
  build?: number;
  /** 0 none, 1 stubble, 2 goatee, 3 short beard, 4 full beard. */
  facialHair?: number;
  /** 0 none, 1 headband. 2-4 are not on the head; see the file header. */
  accessory?: number;
  /** The shirt at the bottom of the frame. Defaults to a neutral so the
   *  portrait works before a kit is known. */
  shirtColor?: string;
  shirtTrim?: string;
  /** Rendered px. Detail tiers key off this. */
  size?: number;
  /** When given, the portrait is announced; otherwise it is decorative and
   *  hidden, because it always sits beside the man's name. */
  label?: string;
  className?: string;
}

const clampIndex = (v: number | undefined, len: number): number => {
  const n = Math.trunc(Number(v) || 0);
  return n >= 0 && n < len ? n : 0;
};

/** Round a coordinate. Path arithmetic on a jaw width produces things like
 *  `20.900000000000002`, which is nine bytes of float noise per point in the
 *  rendered DOM and makes a diff of two portraits unreadable. */
const n = (v: number): number => Math.round(v * 100) / 100;

/** Styles that read as "there is hair on top" versus "there is not", for the
 *  small tier where the twelve cuts collapse to a silhouette. */
const BALD = new Set(['none']);
/** Cuts that sit close to the skull. Everything else gets volume. */
const CROPPED = new Set(['buzz', 'short', 'fade', 'undercut']);

export const SundayFace = memo(function SundayFace({
  skinTone,
  hairStyle,
  hairColor,
  height = 1,
  build = 1,
  facialHair = 0,
  accessory = 0,
  shirtColor = '#3B4252',
  shirtTrim = '#2A303C',
  size = 32,
  label,
  className,
}: SundayFaceProps) {
  const uid = useId().replace(/:/g, '');
  const isLarge = size >= 44;
  const isMedium = size >= 22;

  const skin = PLAYER_SKIN_TONES[clampIndex(skinTone, PLAYER_SKIN_TONES.length)];
  const hair = PLAYER_HAIR_COLORS[clampIndex(hairColor, PLAYER_HAIR_COLORS.length)];
  const style = PLAYER_HAIR_STYLES[clampIndex(hairStyle, PLAYER_HAIR_STYLES.length)];
  const shade = darken(skin, 0.18);
  const beardColor = darken(hair, 0.1);

  // Build widens the jaw and the shoulders; height lifts the head a touch so a
  // tall man's neck shows. Both are small on purpose — this is a face, not a
  // body.
  //
  // THE FRAME, which is the thing that was wrong when it first reached a
  // screen: the head sat low in the 32-unit box on a shallow arc of shoulder,
  // so it read as a head hovering over a hill rather than a bust. The head now
  // starts near the top of the frame and the shoulders rise to y=24, which is
  // where a portrait crops a real one.
  const buildIdx = clampIndex(build, 3);
  const jaw = 8.6 + (buildIdx - 1) * 0.9;
  const top = 6.8 - (clampIndex(height, 3) - 1) * 0.5;
  const cx = 16;
  const cy = top + 7;
  /** Where the shoulders swallow the neck. Fixed, so the neck cannot grow a gap
   *  under a tall man's chin. */
  const shoulderY = 24;

  const beard = clampIndex(facialHair, 5);
  const hasVolume = !BALD.has(style) && !CROPPED.has(style);
  const gradientId = `sf-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn('shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {label && <title>{label}</title>}

      {isLarge && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lighten(skin, 0.08)} />
            <stop offset="100%" stopColor={shade} />
          </linearGradient>
        </defs>
      )}

      {/* Shoulders. Drawn first so the head and neck sit on top of them. The
          control point is `2 * apex - 32`, so this arc tops out at y=23 and
          reaches the full width of the frame — the portrait is a bust, and the
          first draft's narrow hill left the head apparently floating. */}
      <path
        d={`M ${n(cx - 15 - (buildIdx - 1))} 32 Q ${cx} 14 ${n(cx + 15 + (buildIdx - 1))} 32 Z`}
        fill={shirtColor}
      />
      {isMedium && (
        <path
          d={`M ${n(cx - 4.4)} ${n(shoulderY - 0.4)} Q ${cx} ${n(shoulderY + 2.4)} ${n(cx + 4.4)} ${n(shoulderY - 0.4)}`}
          fill="none"
          stroke={shirtTrim}
          strokeWidth={isLarge ? 1.4 : 1.1}
          strokeLinecap="round"
        />
      )}

      {/* Neck. Reaches the collar rather than running a fixed length, so the
          height offset moves the head without opening a gap beneath it. */}
      <rect
        x={n(cx - 2.5)}
        y={n(cy + 4)}
        width={5}
        height={n(Math.max(1.5, shoulderY + 1.5 - (cy + 4)))}
        rx={1.4}
        fill={shade}
      />

      {/* Head */}
      <path
        d={[
          `M ${n(cx - jaw / 2)} ${n(cy - 1)}`,
          `Q ${n(cx - jaw / 2)} ${n(cy - 7.4)} ${cx} ${n(cy - 7.4)}`,
          `Q ${n(cx + jaw / 2)} ${n(cy - 7.4)} ${n(cx + jaw / 2)} ${n(cy - 1)}`,
          `Q ${n(cx + jaw / 2)} ${n(cy + 5.6)} ${cx} ${n(cy + 6.2)}`,
          `Q ${n(cx - jaw / 2)} ${n(cy + 5.6)} ${n(cx - jaw / 2)} ${n(cy - 1)}`,
          'Z',
        ].join(' ')}
        fill={isLarge ? `url(#${gradientId})` : skin}
      />

      {/* Ears — only where they are more than two stray pixels, and tucked
          into the jaw line rather than stuck onto it. */}
      {isMedium && (
        <>
          <ellipse cx={n(cx - jaw / 2 + 0.15)} cy={n(cy + 0.5)} rx={0.72} ry={1.15} fill={shade} />
          <ellipse cx={n(cx + jaw / 2 - 0.15)} cy={n(cy + 0.5)} rx={0.72} ry={1.15} fill={shade} />
        </>
      )}

      {/* Facial hair, under the hair so a beard never overdraws a fringe. */}
      {beard >= 3 && (
        <path
          d={[
            `M ${n(cx - jaw / 2)} ${n(cy + 0.4)}`,
            `Q ${n(cx - jaw / 2)} ${n(cy + 5.8)} ${cx} ${n(cy + 6.2)}`,
            `Q ${n(cx + jaw / 2)} ${n(cy + 5.8)} ${n(cx + jaw / 2)} ${n(cy + 0.4)}`,
            `Q ${n(cx + jaw / 2 - 1)} ${n(cy + 3.4)} ${cx} ${n(cy + 3.2)}`,
            `Q ${n(cx - jaw / 2 + 1)} ${n(cy + 3.4)} ${n(cx - jaw / 2)} ${n(cy + 0.4)}`,
            'Z',
          ].join(' ')}
          fill={beardColor}
          opacity={beard === 3 ? 0.92 : 1}
        />
      )}
      {/* A goatee is a patch ON THE CHIN, not a disc in the middle of a face.
          It was the latter — rx 1.7 centred exactly where the mouth goes — so
          on a ginger squad member it read as a clown's nose and on a grey one
          as an open mouth. It now sits low enough to touch the chin line. */}
      {beard === 2 && isMedium && (
        <ellipse cx={cx} cy={n(cy + 5.4)} rx={1.7} ry={0.8} fill={beardColor} />
      )}
      {beard === 1 && isLarge && (
        <path
          d={`M ${n(cx - jaw / 2 + 1)} ${n(cy + 2.2)} Q ${cx} ${n(cy + 6.4)} ${n(cx + jaw / 2 - 1)} ${n(cy + 2.2)}`}
          fill={beardColor}
          opacity={0.28}
        />
      )}

      {/* Hair. Three tiers of cut, not twelve: at portrait scale the difference
          between a fade and an undercut is one pixel, and pretending otherwise
          just adds nodes.

          THE EDGE, added after looking at a squad list. Hair is a flat fill and
          the palette runs from black to near-white, so a light blond or a grey
          head on a pale skin tone had nothing separating the two shapes and
          read as a swim cap rather than as hair. A hairline stroke in a darker
          shade of the hair's own colour fixes every combination at once — it
          costs two attributes on a path that is already there, and it is only
          drawn at the large tier, where the cut is more than a silhouette. */}
      {!BALD.has(style) && (
        <path
          stroke={isLarge ? darken(hair, 0.32) : undefined}
          strokeWidth={isLarge ? 0.5 : undefined}
          d={hasVolume
            ? [
                `M ${n(cx - jaw / 2 - 0.6)} ${n(cy - 1.2)}`,
                `Q ${n(cx - jaw / 2 - 1.2)} ${n(cy - 9.6)} ${cx} ${n(cy - 9.6)}`,
                `Q ${n(cx + jaw / 2 + 1.2)} ${n(cy - 9.6)} ${n(cx + jaw / 2 + 0.6)} ${n(cy - 1.2)}`,
                `Q ${n(cx + jaw / 2 - 0.4)} ${n(cy - 5)} ${cx} ${n(cy - 4.6)}`,
                `Q ${n(cx - jaw / 2 + 0.4)} ${n(cy - 5)} ${n(cx - jaw / 2 - 0.6)} ${n(cy - 1.2)}`,
                'Z',
              ].join(' ')
            : [
                `M ${n(cx - jaw / 2)} ${n(cy - 2.4)}`,
                `Q ${n(cx - jaw / 2)} ${n(cy - 8.4)} ${cx} ${n(cy - 8.4)}`,
                `Q ${n(cx + jaw / 2)} ${n(cy - 8.4)} ${n(cx + jaw / 2)} ${n(cy - 2.4)}`,
                `Q ${n(cx + jaw / 2 - 0.6)} ${n(cy - 5.2)} ${cx} ${n(cy - 5)}`,
                `Q ${n(cx - jaw / 2 + 0.6)} ${n(cy - 5.2)} ${n(cx - jaw / 2)} ${n(cy - 2.4)}`,
                'Z',
              ].join(' ')}
          fill={hair}
        />
      )}
      {/* The two cuts with a silhouette worth one extra node each. */}
      {isMedium && style === 'mohawk' && (
        <rect x={n(cx - 1.4)} y={n(cy - 12)} width={2.8} height={5} rx={1.2} fill={hair} />
      )}
      {isMedium && style === 'man_bun' && (
        <circle cx={n(cx + jaw / 2 + 0.6)} cy={n(cy - 6.4)} r={1.9} fill={hair} />
      )}

      {/* Headband — the only accessory that lives on a head. */}
      {isMedium && clampIndex(accessory, 5) === 1 && (
        <rect
          x={n(cx - jaw / 2 - 0.8)}
          y={n(cy - 4.6)}
          width={n(jaw + 1.6)}
          height={1.8}
          rx={0.9}
          fill={shirtTrim}
        />
      )}

      {/* Eyes. Two dots is the whole face at this scale, and it is enough. */}
      {isMedium && (
        <>
          <circle cx={n(cx - 2.2)} cy={n(cy + 0.2)} r={isLarge ? 0.78 : 0.68} fill="#1F2430" />
          <circle cx={n(cx + 2.2)} cy={n(cy + 0.2)} r={isLarge ? 0.78 : 0.68} fill="#1F2430" />
        </>
      )}

      {/* Brow and mouth — large only. Below that they read as smudges. */}
      {isLarge && (
        <>
          <path
            d={`M ${n(cx - 3.4)} ${n(cy - 1.4)} Q ${n(cx - 2.2)} ${n(cy - 2.1)} ${n(cx - 1)} ${n(cy - 1.5)}`}
            fill="none" stroke={beardColor} strokeWidth={0.55} strokeLinecap="round" opacity={0.75}
          />
          <path
            d={`M ${n(cx + 1)} ${n(cy - 1.5)} Q ${n(cx + 2.2)} ${n(cy - 2.1)} ${n(cx + 3.4)} ${n(cy - 1.4)}`}
            fill="none" stroke={beardColor} strokeWidth={0.55} strokeLinecap="round" opacity={0.75}
          />
          {beard < 3 && (
            <path
              d={`M ${n(cx - 1.6)} ${n(cy + 3)} Q ${cx} ${n(cy + 3.9)} ${n(cx + 1.6)} ${n(cy + 3)}`}
              fill="none" stroke={darken(skin, 0.42)} strokeWidth={0.55} strokeLinecap="round"
            />
          )}
        </>
      )}
    </svg>
  );
});
