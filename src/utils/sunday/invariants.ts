/**
 * Sunday League — state invariants.
 *
 * A single function that answers "is this state possible?". It is used three
 * ways, and the fact that it is the SAME function all three times is the point:
 *
 *   - unit and integration tests assert `ok` after every operation
 *   - the stress harness asserts it after every simulated week
 *   - the slice runs it after a load in development builds, so a corrupt save
 *     surfaces as a named violation instead of a blank screen three taps later
 *
 * Rules here are the ones the design document calls out as impossible states:
 * a player on two teams, a fixture with two results, a duplicated table row, a
 * player simultaneously available and suspended, money that has become NaN.
 * Anything that can be checked cheaply and would be a real bug is checked.
 */
import type {
  Match, Player, SundayState, SundayValidationResult,
} from '@/types/game';
import {
  SUNDAY_MAX_BENCH, SUNDAY_STATE_VERSION, SUNDAY_MIN_START, SUNDAY_FULL_XI,
  SUNDAY_PENDING_LEDGER_MAX,
} from '@/config/sundayLeague';
import { sundaySeasonWeeks } from './season';

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export interface ValidateSundayInput {
  sunday: SundayState;
  players: Record<string, Player>;
  clubs: Record<string, { id: string; playerIds: string[] }>;
  playerClubId: string;
  fixtures: readonly Match[];
  week: number;
}

/**
 * Check every invariant. Never throws — a validator that can crash is useless
 * in the one situation it exists for.
 */
export function validateSundayState(input: ValidateSundayInput): SundayValidationResult {
  const problems: string[] = [];
  const push = (msg: string) => { if (problems.length < 50) problems.push(msg); };

  try {
    const { sunday, players, clubs, playerClubId, fixtures, week } = input;

    if (sunday.v !== SUNDAY_STATE_VERSION) {
      push(`unknown sunday state version ${sunday.v} (expected ${SUNDAY_STATE_VERSION})`);
    }

    // ── Numbers ────────────────────────────────────────────────────────────
    if (!finite(sunday.balance)) push('balance is not a finite number');
    if (!finite(sunday.reputation)) push('reputation is not a finite number');
    if (!finite(sunday.teamMorale)) push('teamMorale is not a finite number');
    if (finite(sunday.reputation) && (sunday.reputation < 0 || sunday.reputation > 100)) {
      push(`reputation out of range: ${sunday.reputation}`);
    }
    if (finite(sunday.teamMorale) && (sunday.teamMorale < 0 || sunday.teamMorale > 100)) {
      push(`teamMorale out of range: ${sunday.teamMorale}`);
    }
    if (!finite(sunday.seed) || !finite(sunday.rngCursor)) push('rng state is not finite');
    if (sunday.rngCursor < 0) push('rng cursor went backwards');

    // ── Squad ──────────────────────────────────────────────────────────────
    const club = clubs[playerClubId];
    if (!club) {
      push('player club missing from clubs map');
    }
    const seen = new Set<string>();
    for (const m of sunday.squad) {
      if (seen.has(m.playerId)) push(`duplicate squad member ${m.playerId}`);
      seen.add(m.playerId);
      const p = players[m.playerId];
      if (!p) { push(`squad member ${m.playerId} has no Player record`); continue; }
      if (p.clubId !== playerClubId) push(`${p.firstName} ${p.lastName} is on the books but his clubId is ${p.clubId}`);
      if (club && !club.playerIds.includes(m.playerId)) push(`${m.playerId} is in the Sunday squad but not in club.playerIds`);
      if (!finite(m.happiness) || m.happiness < 0 || m.happiness > 100) push(`happiness out of range for ${m.playerId}`);
      for (const key of ['commitment', 'punctuality', 'ego', 'loyalty', 'temper', 'influence', 'condition', 'injuryProne'] as const) {
        const v = m[key];
        if (!finite(v) || v < 1 || v > 20) push(`${key} out of range for ${m.playerId}: ${String(v)}`);
      }
      if (!finite(m.subsOwed) || m.subsOwed < 0) push(`subsOwed invalid for ${m.playerId}`);
      if (m.clubApps < 0 || m.clubGoals < 0) push(`negative career totals for ${m.playerId}`);
      if (!finite(p.overall) || p.overall < 1 || p.overall > 99) push(`overall out of range for ${m.playerId}`);

      // A player cannot be both fit to pick and serving a ban.
      const banned = p.suspendedUntilWeek != null && p.suspendedUntilWeek > week;
      if (banned && m.availability.status !== 'out') push(`${m.playerId} is suspended but not marked out`);
      if (p.injured && p.injuryWeeks > 0 && m.availability.status !== 'out') push(`${m.playerId} is injured but not marked out`);
      if (m.availability.status === 'out' && m.availability.reason == null) push(`${m.playerId} is out with no reason`);
      if (m.availability.status === 'available' && m.availability.reason != null) push(`${m.playerId} is available but carries a reason`);
      if (m.availability.weeksRemaining < 0) push(`negative absence length for ${m.playerId}`);

      // Sunday v2 — the story fields.
      if (!Array.isArray(m.memories)) push(`memories missing for ${m.playerId}`);
      else {
        if (m.memories.length > 20) push(`memories unbounded for ${m.playerId} (${m.memories.length})`);
        for (const mem of m.memories) {
          if (!finite(mem.weight) || mem.weight < 1 || mem.weight > 10) push(`memory weight out of range for ${m.playerId}`);
          if (!mem.text) push(`empty memory text for ${m.playerId}`);
        }
      }
      if (m.promise) {
        if (m.promise.kind !== 'start') push(`unknown promise kind for ${m.playerId}`);
        if (!finite(m.promise.dueWeek) || m.promise.dueWeek < m.promise.madeWeek) push(`promise due before it was made for ${m.playerId}`);
      }
    }

    if (club) {
      for (const id of club.playerIds) {
        if (!seen.has(id)) push(`${id} is on club.playerIds but has no Sunday squad record`);
      }
    }

    // ── Teamsheet ──────────────────────────────────────────────────────────
    const sheet = new Set<string>();
    for (const id of sunday.teamsheet) {
      if (sheet.has(id)) push(`${id} named twice in the teamsheet`);
      sheet.add(id);
      if (!seen.has(id)) push(`teamsheet names ${id}, who is not in the squad`);
      const m = sunday.squad.find(x => x.playerId === id);
      if (m && m.availability.status === 'out') push(`teamsheet names ${id}, who is unavailable`);
    }
    if (sunday.teamsheet.length > SUNDAY_FULL_XI) push(`teamsheet has ${sunday.teamsheet.length} players`);
    if (sunday.teamsheetLocked && sunday.teamsheet.length > 0 && sunday.teamsheet.length < SUNDAY_MIN_START) {
      push(`locked teamsheet has only ${sunday.teamsheet.length} players`);
    }
    for (const id of sunday.bench) {
      if (sheet.has(id)) push(`${id} is in the XI and on the bench`);
      if (!seen.has(id)) push(`bench names ${id}, who is not in the squad`);
    }
    if (sunday.bench.length > SUNDAY_MAX_BENCH) push(`bench has ${sunday.bench.length} players`);
    if (sunday.captainId && !seen.has(sunday.captainId)) push('captain is not in the squad');

    // ── Fixtures ───────────────────────────────────────────────────────────
    const fixtureIds = new Set<string>();
    const pairPerWeek = new Set<string>();
    for (const m of fixtures) {
      if (fixtureIds.has(m.id)) push(`duplicate fixture id ${m.id}`);
      fixtureIds.add(m.id);
      if (m.homeClubId === m.awayClubId) push(`fixture ${m.id} is a club against itself`);
      if (!finite(m.homeGoals) || !finite(m.awayGoals)) push(`fixture ${m.id} has non-numeric goals`);
      if (m.homeGoals < 0 || m.awayGoals < 0) push(`fixture ${m.id} has a negative score`);
      if (!m.played && (m.homeGoals !== 0 || m.awayGoals !== 0)) push(`unplayed fixture ${m.id} carries a score`);
      const key = `${m.week}:${[m.homeClubId, m.awayClubId].sort().join('|')}`;
      if (pairPerWeek.has(key)) push(`two fixtures for the same pair in week ${m.week}`);
      pairPerWeek.add(key);
      if (m.week < 1) push(`fixture ${m.id} is scheduled before week 1`);
    }
    // No club may play twice in a week — the whole point of a Sunday.
    const perWeekClub = new Map<string, number>();
    for (const m of fixtures) {
      for (const cid of [m.homeClubId, m.awayClubId]) {
        const k = `${m.week}:${cid}`;
        perWeekClub.set(k, (perWeekClub.get(k) ?? 0) + 1);
      }
    }
    for (const [k, n] of perWeekClub) {
      if (n > 1) push(`club scheduled ${n} times in one week (${k})`);
    }

    // ── Division ───────────────────────────────────────────────────────────
    const divSet = new Set(sunday.divisionClubIds);
    if (divSet.size !== sunday.divisionClubIds.length) push('duplicate club in divisionClubIds');
    if (!divSet.has(playerClubId)) push('player club is not in its own division');
    for (const id of sunday.divisionClubIds) {
      if (!clubs[id]) push(`division names ${id}, which has no club record`);
    }

    // ── Cup ────────────────────────────────────────────────────────────────
    if (sunday.cup) {
      const tieIds = new Set<string>();
      for (const t of sunday.cup.ties) {
        const key = `${t.round}:${t.homeClubId}:${t.awayClubId}`;
        if (tieIds.has(key)) push(`duplicate cup tie ${key}`);
        tieIds.add(key);
        if (t.homeClubId === t.awayClubId) push('cup tie against itself');
        if (t.played && !t.winnerClubId) push(`played cup tie ${key} has no winner`);
        if (t.played && t.winnerClubId && t.winnerClubId !== t.homeClubId && t.winnerClubId !== t.awayClubId) {
          push(`cup tie ${key} won by a club that was not playing`);
        }
        if (!t.played && (t.homeGoals !== 0 || t.awayGoals !== 0)) push(`unplayed cup tie ${key} carries a score`);
      }
      // A club knocked out in round N must not appear in round N+1.
      const losers = new Set<string>();
      for (const t of sunday.cup.ties) {
        if (!t.played || !t.winnerClubId) continue;
        losers.add(t.winnerClubId === t.homeClubId ? t.awayClubId : t.homeClubId);
      }
      for (const t of sunday.cup.ties) {
        if (t.played) continue;
        if (losers.has(t.homeClubId) || losers.has(t.awayClubId)) push('an eliminated club is in a later cup round');
      }
    }

    // ── Calendar ───────────────────────────────────────────────────────────
    const total = sundaySeasonWeeks(sunday.divisionId);
    if (week < 1) push(`week ${week} is before the season starts`);
    if (week > total + 1) push(`week ${week} is past the end of a ${total}-week season`);

    // ── Money ──────────────────────────────────────────────────────────────
    for (const l of sunday.ledger) {
      if (!finite(l.balance)) push(`ledger week ${l.week} has a non-finite balance`);
      for (const line of l.lines) {
        if (!finite(line.amount)) push(`ledger line "${line.label}" has a non-finite amount`);
      }
    }
    // v3: mid-week lines are parked until the settlement folds them in. They
    // must be real lines, and they must not have grown without bound (an
    // action that forgot to clear them would show up here first).
    if (!Array.isArray(sunday.pendingLedger)) push('pendingLedger is missing');
    else {
      if (sunday.pendingLedger.length > SUNDAY_PENDING_LEDGER_MAX) {
        push(`pendingLedger has ${sunday.pendingLedger.length} lines — the settlement is not clearing it`);
      }
      for (const line of sunday.pendingLedger) {
        if (!finite(line.amount)) push(`pending ledger line "${line.label}" has a non-finite amount`);
      }
    }
    if (!finite(sunday.weeksInDebt) || sunday.weeksInDebt < 0) push('weeksInDebt is invalid');

    // ── Sponsors and recruits ──────────────────────────────────────────────
    const sponsorIds = new Set<string>();
    for (const s of sunday.sponsors) {
      if (sponsorIds.has(s.id)) push(`duplicate sponsor ${s.id}`);
      sponsorIds.add(s.id);
      if (!finite(s.weekly) || s.weekly < 0) push(`sponsor ${s.name} pays a nonsense amount`);
    }
    const recruitIds = new Set<string>();
    for (const r of sunday.recruits) {
      if (recruitIds.has(r.id)) push(`duplicate recruit ${r.id}`);
      recruitIds.add(r.id);
      if (seen.has(r.id)) push(`recruit ${r.id} is already in the squad`);
      if (!finite(r.fee) || r.fee < 0) push(`recruit ${r.id} has a nonsense fee`);
    }

    // ── Upgrades ───────────────────────────────────────────────────────────
    const upgradeIds = new Set<string>();
    for (const u of sunday.upgrades) {
      if (upgradeIds.has(u.id)) push(`duplicate upgrade ${u.id}`);
      upgradeIds.add(u.id);
      if (u.level < 0) push(`upgrade ${u.id} has a negative level`);
    }

    // ── Pending event ──────────────────────────────────────────────────────
    if (sunday.pendingEvent && sunday.pendingEvent.choices.length === 0) {
      push('pending event has no choices — the player would be stuck');
    }
    // v3: the once-per-save register. It outlives the capped event log, so it
    // only ever grows — but it can never exceed the catalogue.
    if (!Array.isArray(sunday.onceFiredIds)) push('onceFiredIds is missing');
    else if (new Set(sunday.onceFiredIds).size !== sunday.onceFiredIds.length) {
      push('onceFiredIds contains a duplicate');
    }

    // ── Arrival (v2) ────────────────────────────────────────────────────────
    if (sunday.arrival) {
      const a = sunday.arrival;
      if (a.week !== week) push(`arrival is for week ${a.week} but the state is at week ${week}`);
      const present = new Set<string>();
      for (const id of a.presentIds) {
        if (present.has(id)) push(`arrival names ${id} twice`);
        present.add(id);
        if (!seen.has(id)) push(`arrival names ${id}, who is not in the squad`);
        const m = sunday.squad.find(x => x.playerId === id);
        if (m && m.availability.status === 'out') push(`arrival presents ${id}, who is unavailable`);
      }
      for (const id of a.benchIds) {
        if (present.has(id)) push(`arrival benches ${id}, who is also present in the XI`);
        if (!seen.has(id)) push(`arrival benches ${id}, who is not in the squad`);
      }
      if (a.forcedRingers < 0 || a.optionalRingers < 0) push('arrival ringers negative');
      if (a.ringersHired != null && a.ringersHired > a.optionalRingers) push('arrival hired more ringers than were on offer');
    }

    // ── Chain flags (v2) ────────────────────────────────────────────────────
    for (const [name, setWeek] of Object.entries(sunday.flags ?? {})) {
      if (!finite(setWeek)) push(`flag ${name} has a non-numeric week`);
    }

    // ── Rivalry (v2) ────────────────────────────────────────────────────────
    if (sunday.rivalry) {
      if (!sunday.rivalry.managerName) push('rivalry has no manager name');
      if (!Array.isArray(sunday.rivalry.story)) push('rivalry story missing');
      else if (sunday.rivalry.story.length > 12) push('rivalry story unbounded');
    }
  } catch (err) {
    problems.push(`validator threw: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { ok: problems.length === 0, problems };
}

/** Convenience for tests: throw with every problem listed. */
export function assertSundayState(input: ValidateSundayInput): void {
  const result = validateSundayState(input);
  if (!result.ok) {
    throw new Error(`Sunday state invalid:\n  - ${result.problems.join('\n  - ')}`);
  }
}
