import { Player, Position } from '@/types/game';
import { POSITION_SQUAD_NUMBERS, MAX_SQUAD_NUMBER } from '@/config/squadNumbers';

/**
 * Squad numbers — persistent per-club shirt identity. A number is stored on the
 * player (`squadNumber`) and is unique within the club. Because the "taken" set
 * is always derived from the club's *current* members (plus any retired shirts),
 * a number is freed automatically the moment its owner leaves — no explicit
 * release step is needed anywhere.
 */

/** Lowest free shirt for `position`, honouring the position preference list. */
export function pickSquadNumber(position: Position, taken: Set<number>): number | undefined {
  const prefs = POSITION_SQUAD_NUMBERS[position] || [];
  for (const n of prefs) {
    if (!taken.has(n)) return n;
  }
  for (let n = 1; n <= MAX_SQUAD_NUMBER; n++) {
    if (!taken.has(n)) return n;
  }
  return undefined; // squad larger than 99 — vanishingly unlikely
}

/** Build the taken-number set from a list of players plus optional retired shirts. */
export function collectTakenNumbers(players: Player[], retired?: number[]): Set<number> {
  const taken = new Set<number>();
  for (const p of players) {
    if (p && typeof p.squadNumber === 'number') taken.add(p.squadNumber);
  }
  if (retired) for (const n of retired) taken.add(n);
  return taken;
}

/**
 * Assign a shirt to `player` given the club's existing members. Mutates and
 * returns the player. No-op if the player already holds a number not clashing
 * with the current squad.
 */
export function assignSquadNumber(player: Player, clubMembers: Player[], retired?: number[]): Player {
  const others = clubMembers.filter(p => p && p.id !== player.id);
  const taken = collectTakenNumbers(others, retired);
  if (typeof player.squadNumber === 'number' && !taken.has(player.squadNumber)) {
    return player; // keep a valid, non-clashing existing number
  }
  player.squadNumber = pickSquadNumber(player.position, taken);
  return player;
}

/**
 * Assign a shirt to a player joining `destPlayerIds` (transfer / loan / youth
 * promotion). Resolves the destination roster from `playersMap`, honours the
 * club's retired shirts, and mutates+returns the player.
 */
export function assignNumberOnJoin(
  player: Player,
  destPlayerIds: string[],
  playersMap: Record<string, Player>,
  retiredNumbers?: { number: number }[],
): Player {
  const members = destPlayerIds
    .map(id => (id === player.id ? player : playersMap[id]))
    .filter(Boolean) as Player[];
  const retired = retiredNumbers ? retiredNumbers.map(r => r.number) : undefined;
  return assignSquadNumber(player, members, retired);
}

/**
 * Assign unique shirts to a whole squad in one pass (generation / migration).
 * Players are sorted so GKs and defenders claim their preferred low numbers
 * first. Mutates the players in place and returns them.
 */
export function assignSquadNumbersToSquad(squad: Player[], retired?: number[]): Player[] {
  const ORDER: Position[] = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
  const rank = (pos: Position) => {
    const i = ORDER.indexOf(pos);
    return i === -1 ? ORDER.length : i;
  };
  const taken = new Set<number>();
  if (retired) for (const n of retired) taken.add(n);
  // Preserve any pre-existing, non-clashing numbers first.
  const remaining: Player[] = [];
  for (const p of squad) {
    if (!p) continue;
    if (typeof p.squadNumber === 'number' && !taken.has(p.squadNumber)) {
      taken.add(p.squadNumber);
    } else {
      remaining.push(p);
    }
  }
  remaining.sort((a, b) => rank(a.position) - rank(b.position));
  for (const p of remaining) {
    p.squadNumber = pickSquadNumber(p.position, taken);
    if (typeof p.squadNumber === 'number') taken.add(p.squadNumber);
  }
  return squad;
}
