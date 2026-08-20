/**
 * Moving men around a Sunday teamsheet.
 *
 * WHY THIS IS NOT IN THE COMPONENT. The board is a renderer; who ends up in
 * which shirt is a rule. The screen used to hold two inline closures
 * (`addToXI`, `removeFromXI`) that between them encoded the bench-overflow
 * policy, and a tactics board needs four more moves than that. Pure functions,
 * no store, no React, testable without a DOM — same contract as `view.ts`.
 *
 * THE ONE FACT EVERYTHING HERE IS SHAPED BY: `SundayState.teamsheet` IS A
 * COMPACT ARRAY. `setSundayTeamsheet` rebuilds it by pushing, so index i means
 * formation slot i and a hole cannot be persisted. There is no way to field a
 * keeper, four defenders and a lone striker with a gap in midfield — the ten
 * men you have always occupy slots 0..9 of the shape.
 *
 * That is why placement has TWO different meanings depending on who is holding
 * the shirt, and why the screen must draw them differently:
 *
 *   - a man ALREADY IN THE XI can only SWAP with another man in the XI.
 *     Sending him to an empty slot would need a hole where he used to be.
 *   - a man OFF the XI fills the FIRST empty slot. Tapping any later empty slot
 *     lands him there too, which is why the screen marks that one slot as the
 *     target rather than letting eleven dashed outlines all look equally live.
 *
 * Every function returns NEW arrays and never mutates its arguments — the store
 * spreads state, and a helper that mutated the array it was handed would write
 * through the spread.
 */
import { SUNDAY_FULL_XI, SUNDAY_MAX_BENCH } from '@/config/sundayLeague';

export interface SundaySide {
  xi: string[];
  bench: string[];
}

/** Where a man currently is. `null` when he is neither named nor benched. */
export type SundaySeat = 'xi' | 'bench' | null;

export function sundaySeatOf(side: SundaySide, playerId: string): SundaySeat {
  if (side.xi.includes(playerId)) return 'xi';
  if (side.bench.includes(playerId)) return 'bench';
  return null;
}

/** The first formation slot with nobody in it, or `null` at a full eleven. */
export function firstEmptySlot(xi: readonly string[]): number | null {
  return xi.length >= SUNDAY_FULL_XI ? null : xi.length;
}

/**
 * Put `playerId` in slot `slotIndex`.
 *
 * Returns the side unchanged when the move is not available, so a caller can
 * compare identities to know whether anything happened.
 *
 *   starter → occupied slot   swap the two shirts
 *   starter → empty slot      refused (see the header: no holes)
 *   off-XI  → occupied slot   he takes the shirt, the man in it goes to the
 *                             bench if there is a seat and out of the squad
 *                             for the day if there is not
 *   off-XI  → empty slot      he fills the first gap, wherever you tapped
 */
export function placeInXI(side: SundaySide, playerId: string, slotIndex: number): SundaySide {
  const seat = sundaySeatOf(side, playerId);
  const target = slotIndex < side.xi.length ? side.xi[slotIndex] : null;
  if (target === playerId) return side;

  if (seat === 'xi') {
    if (target === null) return side;
    const from = side.xi.indexOf(playerId);
    const xi = [...side.xi];
    xi[from] = target;
    xi[slotIndex] = playerId;
    return { xi, bench: side.bench };
  }

  const bench = side.bench.filter(id => id !== playerId);
  if (target === null) {
    if (side.xi.length >= SUNDAY_FULL_XI) return side;
    return { xi: [...side.xi, playerId], bench };
  }
  const xi = [...side.xi];
  xi[slotIndex] = playerId;
  // The displaced man keeps a seat when there is one. Dropping him out of the
  // side entirely on a swap would be a silent demotion.
  if (bench.length < SUNDAY_MAX_BENCH) bench.push(target);
  return { xi, bench };
}

/** Name him as a substitute. From the XI this is a demotion; from nowhere it
 *  is a call-up. Refused when the bench is full. */
export function benchPlayer(side: SundaySide, playerId: string): SundaySide {
  if (side.bench.includes(playerId)) return side;
  const bench = [...side.bench];
  if (bench.length >= SUNDAY_MAX_BENCH) return side;
  bench.push(playerId);
  return { xi: side.xi.filter(id => id !== playerId), bench };
}

/** He is not involved. Off the XI, off the bench. */
export function dropFromSide(side: SundaySide, playerId: string): SundaySide {
  if (sundaySeatOf(side, playerId) === null) return side;
  return {
    xi: side.xi.filter(id => id !== playerId),
    bench: side.bench.filter(id => id !== playerId),
  };
}

/**
 * Name him wherever there is room: the XI first, the bench once the XI is full.
 *
 * This is the one-tap move the old list-based screen offered, kept because the
 * available list still offers it — the board is for placing a man somewhere
 * specific, and this is for "just get him on the sheet".
 */
export function addToSide(side: SundaySide, playerId: string): SundaySide {
  if (sundaySeatOf(side, playerId) !== null) return side;
  if (side.xi.length < SUNDAY_FULL_XI) return { xi: [...side.xi, playerId], bench: side.bench };
  return benchPlayer(side, playerId);
}
