import type { Club, CornerRoutine, FreeKickRoutine } from '@/types/game';
import { CORNER_ROUTINES, FREE_KICK_ROUTINES, DEFAULT_SET_PIECE_ROUTINES } from '@/config/setPieces';

/** Returns the active corner routine definition for a club, defaulting to far-post-delivery */
export function getCornerRoutine(club: Club) {
  const id: CornerRoutine = club.setPieceRoutines?.corner ?? DEFAULT_SET_PIECE_ROUTINES.corner;
  return CORNER_ROUTINES[id] ?? CORNER_ROUTINES[DEFAULT_SET_PIECE_ROUTINES.corner];
}

/** Returns the active free-kick routine definition for a club */
export function getFreeKickRoutine(club: Club) {
  const id: FreeKickRoutine = club.setPieceRoutines?.freeKick ?? DEFAULT_SET_PIECE_ROUTINES.freeKick;
  return FREE_KICK_ROUTINES[id] ?? FREE_KICK_ROUTINES[DEFAULT_SET_PIECE_ROUTINES.freeKick];
}

/**
 * Adjust a header candidate weight for a corner routine.
 * Near-post-flick favours physical (aerial) players; short-corner / driven-low
 * tilt toward shooters with lower physical dominance.
 */
export function applyCornerHeaderBias(baseWeight: number, physical: number, shooting: number, physicalBias: number): number {
  // Shift a small portion of the weight between physical and shooting according to bias
  const delta = (physical - shooting) * physicalBias;
  return Math.max(1, baseWeight + delta);
}
