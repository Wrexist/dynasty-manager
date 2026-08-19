/**
 * PitchBoard — the half-pitch and its slots, as a component that takes props.
 *
 * WHAT THIS IS AND WHERE IT CAME FROM. `LineupEditor` already drew exactly the
 * board every tactics surface in the game needs: an SVG half-pitch with the
 * markings, formation slots laid out at left%/top% from `FORMATION_POSITIONS`,
 * CSS-animated so a formation change slides the tiles rather than snapping
 * them, and tap-to-select → tap-to-swap. Its problem was that it took no props
 * at all — it read the club, the players and the lineup straight out of the
 * store, so nothing else could ever use it. This is that layer, extracted, with
 * every decision handed back to the caller.
 *
 * WHAT IT OWNS
 *   - the pitch (viewBox, markings, colours from `@/config/ui`)
 *   - where a slot sits, via the SHARED Y-mapping (`SLOT_Y_RANGE` /
 *     `SLOT_Y_BOTTOM`) so this board, `SubstitutionSheet` and the tactics
 *     screen all draw the same 4-3-3
 *   - the interactive element for each slot, and its accessibility: one real
 *     <button> per slot, keyboard-reachable, ≥44px, labelled
 *   - the slide animation between formations
 *
 * WHAT IT DOES NOT OWN
 *   - selection state. Deliberately: the tactics screen can select a BENCH
 *     player (which is not on this board) and then tap a slot, so a board that
 *     owned `selectedId` could not express the move it exists for. It takes
 *     `selectedId` and reports taps.
 *   - what a token looks like. `renderToken` returns VISUALS ONLY — the button
 *     is this component's. A token that brings its own `role="button"` would
 *     nest two interactive elements for one action, which is the same invalid
 *     DOM the Sunday teamsheet had to have fixed.
 *
 * A NOTE FOR THE NEXT CALLER. `SubstitutionSheet` draws this same pitch a
 * second time, with badges layered over the tiles and no empty slots. It is the
 * obvious next consumer and was left alone here on purpose: this change is
 * already load-bearing for the 45-league game, and one refactor at a time is
 * how that stays true.
 */
import { memo, type ReactNode } from 'react';
import { PITCH_COLORS, pitchSlotPoint } from '@/config/ui';
import { cn } from '@/lib/utils';
import type { FormationSlot } from '@/types/game';

// Half-pitch viewBox — the bottom half only, i.e. your own team's shape.
const VP_Y = 46;
const VP_H = 59;
const VP_W = 68;

/** Everything a caller needs to decide what one slot looks like and does. */
export interface PitchBoardSlotContext {
  index: number;
  slot: FormationSlot;
  /** Null for an empty slot. Holes are kept — a formation slot with no player
   *  is a real state and compacting it would shift everyone onto wrong slots. */
  occupantId: string | null;
  isSelected: boolean;
}

export interface PitchBoardProps {
  /** The shape, e.g. `FORMATION_POSITIONS[club.formation]`. */
  slots: readonly FormationSlot[];
  /** Parallel to `slots`. `''`, `null` or `undefined` mean an empty slot. */
  occupants: readonly (string | null | undefined)[];
  /** The currently-selected id, which may be a player who is NOT on this
   *  board (a bench player being placed). */
  selectedId?: string | null;
  /** A slot was tapped — occupied or empty. */
  onSlotTap: (ctx: PitchBoardSlotContext) => void;
  /** Visuals for an occupied slot. Must not contain its own button. */
  renderToken: (ctx: PitchBoardSlotContext & { occupantId: string }) => ReactNode;
  /** Visuals for an empty slot. Defaults to a dashed placeholder naming the
   *  position. */
  renderEmpty?: (ctx: PitchBoardSlotContext) => ReactNode;
  /** The button's accessible name. Defaults to the position and its state. */
  slotLabel?: (ctx: PitchBoardSlotContext) => string;
  /** Extra classes on the slot wrapper — fading, ring colours, whatever the
   *  caller's compatibility rules say. */
  slotClassName?: (ctx: PitchBoardSlotContext) => string | undefined;
  /** SVG painted on the pitch, under the tokens. Chemistry lines, the
   *  formation skeleton. Use `pitchSlotPoint` from `@/config/ui` for
   *  coordinates, so an overlay lands exactly on its token. */
  underlay?: ReactNode;
  className?: string;
  /** Announced to a screen reader as the board's purpose. */
  ariaLabel?: string;
}

function defaultLabel({ slot, occupantId }: PitchBoardSlotContext): string {
  return occupantId ? `${slot.pos} slot` : `Empty ${slot.pos} slot`;
}

export const PitchBoard = memo(function PitchBoard({
  slots,
  occupants,
  selectedId = null,
  onSlotTap,
  renderToken,
  renderEmpty,
  slotLabel,
  slotClassName,
  underlay,
  className,
  ariaLabel,
}: PitchBoardProps) {
  return (
    <div
      className={cn('relative w-full mx-auto', className)}
      style={{ aspectRatio: `${VP_W}/${VP_H}`, maxWidth: 'min(28rem, 100%)' }}
      role={ariaLabel ? 'group' : undefined}
      aria-label={ariaLabel}
    >
      <svg
        viewBox={`0 ${VP_Y} ${VP_W} ${VP_H}`}
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {/* Pitch background & markings */}
        <rect x="0" y="0" width="68" height="105" rx="1.5" fill={PITCH_COLORS.FILL} />
        <rect x="2" y="2" width="64" height="101" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        <line x1="2" y1="52.5" x2="66" y2="52.5" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        <circle cx="34" cy="52.5" r="9.15" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        <circle cx="34" cy="52.5" r="0.5" fill={PITCH_COLORS.LINE} />
        <rect x="13.85" y="86.5" width="40.3" height="16.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        <rect x="24.85" y="97.5" width="18.3" height="5.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        <rect x="29" y="103" width="10" height="2" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        <path d="M 26.85 86.5 A 9.15 9.15 0 0 1 41.15 86.5" fill="none" stroke={PITCH_COLORS.LINE} strokeWidth="0.3" />
        {underlay}
      </svg>

      {slots.map((slot, i) => {
        const raw = occupants[i];
        const occupantId = raw ? raw : null;
        const ctx: PitchBoardSlotContext = {
          index: i,
          slot,
          occupantId,
          isSelected: !!occupantId && occupantId === selectedId,
        };
        const { x, y } = pitchSlotPoint(slot);
        const left = (x / VP_W) * 100;
        const top = ((y - VP_Y) / VP_H) * 100;

        return (
          <div
            key={`slot-${i}`}
            className={cn(
              // Animate left/top so a formation switch visibly slides each
              // tile to its new slot rather than snapping in place.
              'absolute transition-[left,top,opacity] duration-300 ease-out',
              slotClassName?.(ctx),
            )}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: ctx.isSelected ? 40 : 10 + i,
            }}
          >
            <button
              type="button"
              onClick={() => onSlotTap(ctx)}
              aria-label={(slotLabel ?? defaultLabel)(ctx)}
              aria-pressed={ctx.isSelected}
              // The tile inside is already ~52×69; `min-h`/`min-w` only bite on
              // an empty slot, where the placeholder would otherwise be smaller
              // than a thumb.
              className="block min-w-[44px] min-h-[44px] rounded-[7px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              {occupantId
                ? renderToken({ ...ctx, occupantId })
                : renderEmpty
                  ? renderEmpty(ctx)
                  : (
                    <span
                      className="w-[52px] aspect-[3/4] rounded-[7px] border border-dashed border-white/20 bg-white/5 flex items-center justify-center"
                    >
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-white/50" aria-hidden>
                        {slot.pos}
                      </span>
                    </span>
                  )}
            </button>
          </div>
        );
      })}
    </div>
  );
});
