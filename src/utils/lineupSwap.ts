/**
 * The tactics board's swap rule, as a pure function.
 *
 * A swap is an EXCHANGE: each of the two players ends up exactly where the
 * other one was. A starter swapped with the third substitute becomes the third
 * substitute; a starter swapped with a reserve becomes a reserve. The only
 * one-way move is into an empty formation slot, which leaves a hole behind (or,
 * from the bench, simply fills one).
 *
 * It used to be looser: a starter dropped for a bench player was appended to
 * the END of the subs, and one dropped for a reserve was appended too — which
 * on a full bench pushed an unrelated sub to the reserves and raised a "Bench
 * full" toast for a move the player never asked for. An exchange never changes
 * the length of either list, so that cannot happen.
 */

export interface LineupState {
  lineup: string[];
  subs: string[];
}

type Location =
  | { kind: 'xi'; index: number; empty: boolean }
  | { kind: 'sub'; index: number }
  | { kind: 'reserve' };

const EMPTY_SLOT = /^slot-(\d+)$/;

/** The id the board reports for an empty formation slot. */
export function emptySlotId(index: number): string {
  return `slot-${index}`;
}

function locate(id: string, { lineup, subs }: LineupState): Location {
  const empty = id.match(EMPTY_SLOT);
  if (empty) return { kind: 'xi', index: parseInt(empty[1], 10), empty: true };
  const xi = lineup.indexOf(id);
  if (xi >= 0) return { kind: 'xi', index: xi, empty: false };
  const sub = subs.indexOf(id);
  if (sub >= 0) return { kind: 'sub', index: sub };
  return { kind: 'reserve' };
}

/**
 * The lineup and subs after `activeId` is swapped with `targetId`, or `null`
 * when the pair has nothing to exchange (the same player, two reserves, or two
 * empty slots). `targetId` may be an empty slot (`slot-N`); `activeId` may not.
 */
export function applyLineupSwap(state: LineupState, activeId: string, targetId: string): LineupState | null {
  if (activeId === targetId) return null;
  const a = locate(activeId, state);
  const b = locate(targetId, state);
  if (a.kind === 'xi' && a.empty) return null;
  if (a.kind === 'reserve' && b.kind === 'reserve') return null;

  const lineup = [...state.lineup];
  let subs = [...state.subs];

  // Write `id` into location `loc`. A reserve has no array slot — leaving
  // both lists is what makes someone a reserve.
  const place = (loc: Location, id: string) => {
    if (loc.kind === 'xi') lineup[loc.index] = id;
    else if (loc.kind === 'sub') subs[loc.index] = id;
  };

  if (b.kind === 'xi' && b.empty) {
    // One-way: the active player fills the hole and leaves one behind — in
    // the XI a blank slot, on the bench nothing (the bench just gets shorter).
    lineup[b.index] = activeId;
    if (a.kind === 'xi') lineup[a.index] = '';
    else if (a.kind === 'sub') subs = subs.filter((_, i) => i !== a.index);
    return { lineup, subs };
  }

  place(a, targetId);
  place(b, activeId);
  return { lineup, subs };
}
