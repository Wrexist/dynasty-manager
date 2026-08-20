/**
 * How well a man suits the shirt he has been given.
 *
 * WHY THIS IS ITS OWN FILE. `LineupEditor` has drawn this three-way ring on
 * the 45-league tactics board since before `PitchBoard` existed, as a private
 * `getCompatibility`. The Sunday teamsheet now draws the same board and owes
 * the player the same answer, and a second private copy is how two boards end
 * up disagreeing about whether a left-back can play right-back. So it is one
 * exported function, imported by both.
 *
 * Pure: no store, no React, no `t()`. `canPlayPosition` stays where it is —
 * this is the tier ON TOP of it, not a replacement.
 */
import { canPlayPosition, type Position } from '@/types/game';

export type PositionFit = 'natural' | 'compatible' | 'wrong';

/**
 * @param player   position and the printed ALT POS list, nothing else
 * @param slotPos  the formation slot he is standing in
 *
 * `alternatePositions` counts as NATURAL, not merely compatible: they are part
 * of the player's printed card position list (FC26-style "ALT POS"), and FUT
 * chemistry lights those slots green. Only `POSITION_COMPATIBILITY`'s
 * second-guess adjacencies are amber.
 */
export function positionFit(
  player: { position: Position; alternatePositions?: Position[] },
  slotPos: Position,
): PositionFit {
  if (player.position === slotPos) return 'natural';
  if (player.alternatePositions?.includes(slotPos)) return 'natural';
  if (canPlayPosition(player, slotPos)) return 'compatible';
  return 'wrong';
}
