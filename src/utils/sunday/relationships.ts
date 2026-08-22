/**
 * Sunday League — the lightweight relationships layer.
 *
 * WHAT THIS IS FOR. A Sunday side is not eleven attribute vectors, it is a
 * group of blokes who give each other lifts. The substrate for that already
 * existed — `SundaySquadMember.friends` / `rivals` were typed and drawn once at
 * founding — and was read by absolutely nothing: recruits signed with empty
 * arrays, departures left dangling ids, and no system anywhere asked who got on
 * with whom. This module makes it live, and keeps it small.
 *
 * THE DESIGN, IN FOUR RULES.
 *
 *   1. LINKS EMERGE FROM HISTORY, NEVER FROM A DICE ROLL ALONE. A friendship
 *      needs `SUNDAY_FRIENDSHIP_APPS` afternoons in the same XI behind it; a
 *      rivalry needs real friction — being stuck behind the same man for a
 *      month, or losing the armband to him.
 *   2. LINKS ARE RARE. One per week, squad-wide, and only for the single
 *      best-qualified pair. A dressing room should end a career with a handful
 *      of live links, not a graph.
 *   3. WHATEVER CAN BE DERIVED IS NOT STORED. Position rivals and mentor pairs
 *      are computed from position, streaks, age and commitment wherever they
 *      are needed. Nothing about them is persisted, so nothing about them can
 *      go stale or dangle.
 *   4. EVERY ID REFERENCES A LIVE SQUAD MEMBER. `applySundayDeparture` is the
 *      single place a departure is felt, and every path out of the club goes
 *      through it: release, quit, cascade, event departure, defection,
 *      retirement. The validator enforces the result.
 *
 * THE EFFECTS ARE FOUR, SMALL AND LABELLED: match-day chemistry (±2 mental),
 * the mood when a mate leaves (which feeds the existing quit roll and so makes
 * two mates leaving together emergent), who vouched for the new signing, and a
 * growth multiplier for a young player with a veteran in his position group.
 */
import type { Player, SundaySquadMember } from '@/types/game';
import {
  SUNDAY_CASCADE_QUIT_MAX, SUNDAY_CHEMISTRY_FRIEND, SUNDAY_CHEMISTRY_RIVAL,
  SUNDAY_CHEMISTRY_ROWS_MAX, SUNDAY_FORMER_TEAMMATES_MAX, SUNDAY_FRIENDSHIP_APPS,
  SUNDAY_FRIENDSHIP_CHANCE, SUNDAY_FRIENDSHIP_GOODWILL_MULT,
  SUNDAY_FRIENDSHIP_GOODWILL_WEEKS, SUNDAY_FRIEND_LEFT_HAPPINESS,
  SUNDAY_LINKS_PER_WEEK, SUNDAY_MAX_FRIENDS, SUNDAY_MAX_RIVALS, SUNDAY_MENTOR_AGE,
  SUNDAY_MENTOR_COMMITMENT, SUNDAY_MENTOR_PROSPECT_AGE, SUNDAY_POSITION_RIVAL_CHANCE,
  SUNDAY_POSITION_RIVAL_STREAK, SUNDAY_RIVAL_LEFT_HAPPINESS,
  SUNDAY_UNSETTLED_THRESHOLD, SUNDAY_VOUCH_PER_COMMITMENT, SUNDAY_VOUCH_PER_INFLUENCE,
} from '@/config/sundayLeague';
import type { SundayRng } from './rng';

const clampHappiness = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));

const firstName = (players: Record<string, Player>, id: string): string =>
  players[id]?.firstName ?? 'someone';

// ── Shared afternoons ───────────────────────────────────────────────────────

/**
 * Credit one match to every pair who took the field together.
 *
 * Called per member from the match write-back, with the set of squad members
 * who actually played. Costs one small object per player per match and is
 * pruned back to the live squad by `applySundayDeparture`, which is what keeps
 * the map bounded by squad size rather than by career length.
 */
export function bumpSundayAppsWith(
  current: Readonly<Record<string, number>> | undefined,
  tookIds: ReadonlySet<string>,
  selfId: string,
): Record<string, number> {
  const next: Record<string, number> = { ...(current ?? {}) };
  for (const id of tookIds) {
    if (id === selfId) continue;
    next[id] = (next[id] ?? 0) + 1;
  }
  return next;
}

/** Keep only the counts that name somebody still on the books. */
function keepAppsWith(
  current: Readonly<Record<string, number>> | undefined,
  liveIds: ReadonlySet<string>,
  selfId: string,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(current ?? {}).filter(([id]) => id !== selfId && liveIds.has(id)),
  );
}

/** How many matches these two have played together. Symmetric by construction,
 *  but read off whichever side is asked so a half-written map cannot lie. */
export function sundaySharedApps(a: SundaySquadMember, b: SundaySquadMember): number {
  return Math.max(a.appsWith?.[b.playerId] ?? 0, b.appsWith?.[a.playerId] ?? 0);
}

// ── Departures ──────────────────────────────────────────────────────────────

export interface SundayDepartureInput {
  /** The squad AFTER the leavers have been filtered out. */
  squad: readonly SundaySquadMember[];
  players: Record<string, Player>;
  /** Who has gone, with the name they will be remembered by. Captured by the
   *  caller BEFORE the `players` entry is deleted. */
  departed: readonly { id: string; name: string }[];
  season: number;
}

export interface SundayDepartureResult {
  squad: SundaySquadMember[];
  /** Factual week-log lines. Written only for a man the loss has actually
   *  tipped into unsettled — everybody else feels it quietly. */
  lines: string[];
  /** Ids who lost a mate this week, for the capped cascade roll. */
  bereavedIds: string[];
}

/**
 * Feel a departure across the rest of the squad.
 *
 * ONE function, called by EVERY path out of the club, doing three jobs that
 * were previously done nowhere:
 *
 *   - scrubs the departed ids out of every friends / rivals list and out of the
 *     shared-appearance map (the invariant the validator now enforces). It
 *     scrubs by "is this man still here?", not by "did he leave today?", so it
 *     repairs an already-dangling id as well as preventing a new one.
 *   - remembers a departed FRIEND by name on `formerTeammates`, because the
 *     `players` record is deleted on the way out and an id would be a ghost.
 *   - moves happiness: losing a mate hurts, losing somebody you could not stand
 *     helps a little.
 */
export function applySundayDeparture(input: SundayDepartureInput): SundayDepartureResult {
  const { departed, players, season } = input;
  const goneIds = new Set(departed.map(d => d.id));
  const nameById = new Map(departed.map(d => [d.id, d.name]));
  const liveIds = new Set(input.squad.map(m => m.playerId));
  const lines: string[] = [];
  const bereavedIds: string[] = [];

  const squad = input.squad.map(m => {
    const stale = (id: string) => goneIds.has(id) || !liveIds.has(id) || id === m.playerId;
    const lostFriends = m.friends.filter(id => goneIds.has(id));
    const lostRivals = m.rivals.filter(id => goneIds.has(id));
    const friends = m.friends.filter(id => !stale(id));
    const rivals = m.rivals.filter(id => !stale(id));
    const appsWith = keepAppsWith(m.appsWith, liveIds, m.playerId);

    if (!lostFriends.length && !lostRivals.length) {
      const unchanged = friends.length === m.friends.length
        && rivals.length === m.rivals.length
        && Object.keys(appsWith).length === Object.keys(m.appsWith ?? {}).length;
      return unchanged ? m : { ...m, friends, rivals, appsWith };
    }

    const formerTeammates = [
      ...lostFriends.map(id => ({ name: nameById.get(id) ?? 'someone', season })),
      ...m.formerTeammates,
    ].slice(0, SUNDAY_FORMER_TEAMMATES_MAX);

    const happiness = clampHappiness(
      m.happiness
      + lostFriends.length * SUNDAY_FRIEND_LEFT_HAPPINESS
      + lostRivals.length * SUNDAY_RIVAL_LEFT_HAPPINESS,
    );
    if (lostFriends.length) bereavedIds.push(m.playerId);
    const tipped = lostFriends.length > 0
      && happiness <= SUNDAY_UNSETTLED_THRESHOLD
      && m.happiness > SUNDAY_UNSETTLED_THRESHOLD;
    if (tipped) {
      lines.push(`${firstName(players, m.playerId)} has not said much since ${nameById.get(lostFriends[0])?.split(' ')[0] ?? 'his mate'} left.`);
    }

    return {
      ...m,
      friends,
      rivals,
      appsWith,
      formerTeammates,
      happiness,
      unsettled: tipped ? true : m.unsettled,
    };
  });

  return { squad, lines, bereavedIds };
}

/**
 * Who, if anybody, follows a mate out of the door on the same Sunday.
 *
 * Deliberately a SEPARATE, capped roll rather than a second pass of the weekly
 * quit roll: the friend-left hit has already pushed these men down, and letting
 * the ordinary roll run again on the new numbers would let one departure take
 * three or four with it in a single week. The cascade is one man
 * (`SUNDAY_CASCADE_QUIT_MAX`), the most upset one, and it does not chain — his
 * own friends feel it, but their reaction waits for next week's roll.
 */
export function pickSundayCascadeQuits(input: {
  rng: SundayRng;
  squad: readonly SundaySquadMember[];
  bereavedIds: readonly string[];
  quitThreshold: number;
  chanceFor: (member: SundaySquadMember) => number;
}): string[] {
  const { rng, squad, bereavedIds, quitThreshold, chanceFor } = input;
  if (!bereavedIds.length) return [];
  const bereaved = new Set(bereavedIds);
  const candidates = squad
    .filter(m => bereaved.has(m.playerId) && m.happiness <= quitThreshold)
    .sort((a, b) => a.happiness - b.happiness || a.playerId.localeCompare(b.playerId));
  const out: string[] = [];
  for (const m of candidates) {
    if (out.length >= SUNDAY_CASCADE_QUIT_MAX) break;
    if (rng.chance(chanceFor(m))) out.push(m.playerId);
  }
  return out;
}

// ── Derived pairs — computed where needed, stored nowhere ───────────────────

/**
 * The man he is stuck behind: same position, started for a month while he has
 * watched for a month. Both sides of that are already on the record
 * (`startedStreak` / `benchedStreak`), so there is nothing to persist and
 * nothing to go stale when the manager finally picks him.
 */
export function sundayPositionRival(
  member: SundaySquadMember,
  squad: readonly SundaySquadMember[],
  players: Record<string, Player>,
): string | null {
  if (member.benchedStreak < SUNDAY_POSITION_RIVAL_STREAK) return null;
  const me = players[member.playerId];
  if (!me) return null;
  const ahead = squad
    .filter(other => other.playerId !== member.playerId
      && other.startedStreak >= SUNDAY_POSITION_RIVAL_STREAK
      && players[other.playerId]?.position === me.position)
    .sort((a, b) => b.startedStreak - a.startedStreak || a.playerId.localeCompare(b.playerId));
  return ahead[0]?.playerId ?? null;
}

/** Rough position families — a centre-half learns from a centre-half, not from
 *  a winger. Deliberately coarse: a Sunday squad has fifteen men in it. */
function positionGroup(position: string): string {
  if (position === 'GK') return 'GK';
  if (['CB', 'LB', 'RB'].includes(position)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(position)) return 'MID';
  return 'ATT';
}

/**
 * The veteran taking a young player under his wing, or null.
 *
 * A mentor is old enough to have stopped playing for himself
 * (`SUNDAY_MENTOR_AGE`), either committed or the sort of man the club is
 * organised around (captain, old captain, ex-pro, pub legend), and in the
 * prospect's position group. The prospect is under
 * `SUNDAY_MENTOR_PROSPECT_AGE`. Nothing about the pair is stored: it is true
 * while both are here and false the moment either is not.
 */
export function sundayMentor(
  member: SundaySquadMember,
  squad: readonly SundaySquadMember[],
  players: Record<string, Player>,
  captainId: string | null = null,
): string | null {
  const me = players[member.playerId];
  if (!me || me.age >= SUNDAY_MENTOR_PROSPECT_AGE) return null;
  const group = positionGroup(me.position);
  const mentors = squad
    .filter(other => {
      if (other.playerId === member.playerId) return false;
      const p = players[other.playerId];
      if (!p || p.age < SUNDAY_MENTOR_AGE) return false;
      if (positionGroup(p.position) !== group) return false;
      return other.commitment >= SUNDAY_MENTOR_COMMITMENT
        || other.playerId === captainId
        || other.archetype === 'captain'
        || other.archetype === 'ex-pro'
        || other.archetype === 'legend';
    })
    .sort((a, b) => (players[b.playerId]!.age - players[a.playerId]!.age)
      || b.commitment - a.commitment
      || a.playerId.localeCompare(b.playerId));
  return mentors[0]?.playerId ?? null;
}

// ── Match-day chemistry ─────────────────────────────────────────────────────

export interface SundayChemistry {
  /** Points of `mental` for each starter, applied by `buildMatchdayTeam`. */
  byPlayer: Map<string, number>;
  /** Named rows for the match-day breakdown, in the same shape as every other
   *  adjustment. Structural rather than imported so this module stays a leaf. */
  rows: { label: string; delta: number }[];
}

/**
 * Who is playing next to a mate and who is playing next to somebody he cannot
 * stand.
 *
 * Applied once per player, not once per friend: a clique of three does not
 * compound into +6, because the effect is "he is enjoying his afternoon", not
 * "he has allies". An AI side passes an empty squad — the opposition have no
 * Sunday records of their own, so they get no chemistry either way, which is
 * stated here rather than left to be discovered.
 */
export function sundayChemistry(
  xi: readonly Player[],
  squad: readonly SundaySquadMember[],
): SundayChemistry {
  const byPlayer = new Map<string, number>();
  const rows: { label: string; delta: number }[] = [];
  if (!squad.length || !xi.length) return { byPlayer, rows };

  const onPitch = new Map(xi.map(p => [p.id, p]));
  const byId = new Map(squad.map(m => [m.playerId, m]));
  const friendPairs = new Set<string>();
  const rivalPairs = new Set<string>();
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  for (const p of xi) {
    const m = byId.get(p.id);
    if (!m) continue;
    const friend = m.friends.find(id => onPitch.has(id));
    const rival = m.rivals.find(id => onPitch.has(id));
    let delta = 0;
    if (friend) { delta += SUNDAY_CHEMISTRY_FRIEND; friendPairs.add(pairKey(p.id, friend)); }
    if (rival) { delta += SUNDAY_CHEMISTRY_RIVAL; rivalPairs.add(pairKey(p.id, rival)); }
    if (delta !== 0) byPlayer.set(p.id, delta);
  }

  const nameOf = (id: string) => onPitch.get(id)?.firstName ?? 'someone';
  for (const key of [...friendPairs].slice(0, SUNDAY_CHEMISTRY_ROWS_MAX)) {
    const [a, b] = key.split('|');
    rows.push({ label: `${nameOf(a)} and ${nameOf(b)}, side by side as always`, delta: SUNDAY_CHEMISTRY_FRIEND });
  }
  for (const key of [...rivalPairs].slice(0, SUNDAY_CHEMISTRY_ROWS_MAX)) {
    const [a, b] = key.split('|');
    rows.push({ label: `${nameOf(a)} and ${nameOf(b)} are not speaking`, delta: SUNDAY_CHEMISTRY_RIVAL });
  }
  return { byPlayer, rows };
}

// ── Formation ───────────────────────────────────────────────────────────────

function linkFriends(
  squad: readonly SundaySquadMember[],
  a: string,
  b: string,
): SundaySquadMember[] {
  return squad.map(m => {
    if (m.playerId === a && !m.friends.includes(b)) {
      return { ...m, friends: [...m.friends, b].slice(0, SUNDAY_MAX_FRIENDS), rivals: m.rivals.filter(id => id !== b) };
    }
    if (m.playerId === b && !m.friends.includes(a)) {
      return { ...m, friends: [...m.friends, a].slice(0, SUNDAY_MAX_FRIENDS), rivals: m.rivals.filter(id => id !== a) };
    }
    return m;
  });
}

/**
 * One man decides he has had enough of another. Deliberately ONE-DIRECTIONAL:
 * the lad who cannot get in the side resents the lad who is in it, and the man
 * in possession of the shirt has not noticed a thing. That asymmetry is the
 * honest version of a Sunday League feud and it costs nothing to model.
 */
export function addSundayRival(
  squad: readonly SundaySquadMember[],
  holderId: string,
  targetId: string,
): SundaySquadMember[] {
  return squad.map(m => {
    if (m.playerId !== holderId) return m;
    if (m.rivals.includes(targetId) || m.friends.includes(targetId)) return m;
    if (m.rivals.length >= SUNDAY_MAX_RIVALS) return m;
    return { ...m, rivals: [...m.rivals, targetId] };
  });
}

export interface FormSundayLinksInput {
  rng: SundayRng;
  squad: readonly SundaySquadMember[];
  players: Record<string, Player>;
  season: number;
  week: number;
}

/**
 * Form at most `SUNDAY_LINKS_PER_WEEK` new link from the week just played.
 *
 * FRIENDSHIP is offered to the single pair with the most shared afternoons past
 * the threshold — not to every eligible pair — which is what keeps the count of
 * live links in single figures over a ten-season career. A recent promise kept
 * or a recent talked-round on either side multiplies the odds: the mode already
 * writes those moments into the biography, so the friendship that follows one
 * is legible rather than arbitrary.
 *
 * ENMITY only forms from friction that has actually happened: a man benched for
 * a month while somebody in his position starts every week. (The other source,
 * losing the armband, is applied at the moment it happens — see
 * `resolveSundayEvent`.)
 *
 * The caller supplies a week-keyed sub-stream of its own, so these draws cannot
 * move the sponsor, recruit or event draws in the main weekly advance.
 */
export function formSundayLinks(input: FormSundayLinksInput): { squad: SundaySquadMember[]; lines: string[] } {
  const { rng, players, season, week } = input;
  let squad = [...input.squad];
  const lines: string[] = [];
  if (squad.length < 2) return { squad, lines };

  const goodwill = (m: SundaySquadMember) => m.memories.some(mem =>
    (mem.kind === 'promise-kept' || mem.kind === 'talked-round')
    && mem.season === season && week - mem.week <= SUNDAY_FRIENDSHIP_GOODWILL_WEEKS);

  // Best friendship candidate: most shared afternoons, both with room.
  let bestPair: { a: SundaySquadMember; b: SundaySquadMember; apps: number } | null = null;
  for (let i = 0; i < squad.length; i++) {
    for (let j = i + 1; j < squad.length; j++) {
      const a = squad[i];
      const b = squad[j];
      if (a.friends.includes(b.playerId) || b.friends.includes(a.playerId)) continue;
      if (a.rivals.includes(b.playerId) || b.rivals.includes(a.playerId)) continue;
      if (a.friends.length >= SUNDAY_MAX_FRIENDS || b.friends.length >= SUNDAY_MAX_FRIENDS) continue;
      const apps = sundaySharedApps(a, b);
      if (apps < SUNDAY_FRIENDSHIP_APPS) continue;
      if (!bestPair || apps > bestPair.apps) bestPair = { a, b, apps };
    }
  }

  let formed = 0;
  if (bestPair) {
    const chance = SUNDAY_FRIENDSHIP_CHANCE
      * (goodwill(bestPair.a) || goodwill(bestPair.b) ? SUNDAY_FRIENDSHIP_GOODWILL_MULT : 1);
    if (rng.chance(chance)) {
      squad = linkFriends(squad, bestPair.a.playerId, bestPair.b.playerId);
      lines.push(`${firstName(players, bestPair.a.playerId)} and ${firstName(players, bestPair.b.playerId)} have started car-sharing to games.`);
      formed++;
    }
  }

  // Best enmity candidate: longest-suffering understudy in the squad.
  if (formed < SUNDAY_LINKS_PER_WEEK) {
    const stuck = squad
      .filter(m => m.rivals.length < SUNDAY_MAX_RIVALS)
      .map(m => ({ m, aheadId: sundayPositionRival(m, squad, players) }))
      .filter((x): x is { m: SundaySquadMember; aheadId: string } => !!x.aheadId
        && !x.m.friends.includes(x.aheadId) && !x.m.rivals.includes(x.aheadId))
      .sort((x, y) => y.m.benchedStreak - x.m.benchedStreak || x.m.playerId.localeCompare(y.m.playerId))[0];
    if (stuck && rng.chance(SUNDAY_POSITION_RIVAL_CHANCE)) {
      squad = addSundayRival(squad, stuck.m.playerId, stuck.aheadId);
      lines.push(`${firstName(players, stuck.m.playerId)} has stopped passing to ${firstName(players, stuck.aheadId)} in training.`);
      formed++;
    }
  }

  return { squad, lines };
}

// ── Recruitment ─────────────────────────────────────────────────────────────

/**
 * Who put the new lad's name forward.
 *
 * Weighted by influence and commitment, because the man who knows everybody and
 * still turns up is the man who brings people. Exactly ONE draw, the same as
 * the uniform pick it replaces, so the weekly stream's sequence is unchanged.
 * Both callers — the weekly recruit roll and the event-spawned recruit — use
 * this; before it, one picked at random and the other always named the first
 * man in the squad array.
 */
export function pickSundayVoucher(
  rng: SundayRng,
  squad: readonly SundaySquadMember[],
  players: Record<string, Player>,
): { id: string; firstName: string } | null {
  const eligible = squad.filter(m => !!players[m.playerId]);
  if (!eligible.length) return null;
  const chosen = rng.weighted(eligible, m => Math.max(
    0.1,
    m.influence * SUNDAY_VOUCH_PER_INFLUENCE + m.commitment * SUNDAY_VOUCH_PER_COMMITMENT,
  ));
  if (!chosen) return null;
  return { id: chosen.playerId, firstName: players[chosen.playerId].firstName };
}

/**
 * Sign the new man to the lad who vouched for him.
 *
 * "He came with a mate" has to be true the moment he walks in, or the source
 * line on his card is decoration. Applied only when both still have room; the
 * link is mutual because this one genuinely is.
 */
export function linkSundayVoucher(
  squad: readonly SundaySquadMember[],
  recruitId: string,
  voucherId: string | null,
): SundaySquadMember[] {
  if (!voucherId || voucherId === recruitId) return [...squad];
  if (!squad.some(m => m.playerId === voucherId)) return [...squad];
  return linkFriends(squad, recruitId, voucherId);
}

// ── Reading a member's links ────────────────────────────────────────────────

/** Names of his mates who are still here, in squad order. */
export function sundayFriendNames(
  member: SundaySquadMember,
  players: Record<string, Player>,
): string[] {
  return member.friends.map(id => players[id]).filter(Boolean).map(p => p!.firstName);
}

/** Names of the men he cannot stand who are still here. */
export function sundayRivalNames(
  member: SundaySquadMember,
  players: Record<string, Player>,
): string[] {
  return member.rivals.map(id => players[id]).filter(Boolean).map(p => p!.firstName);
}
