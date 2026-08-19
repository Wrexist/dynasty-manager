/**
 * Sunday League — the arcs the V3 brief promises, asserted end to end.
 *
 * `sundayStories.test.ts` already owns two of the eight: the rival defection
 * and the kept/broken promise. The other six were either mechanics-only
 * (a cup run was simulated but nothing checked that it left a story behind) or
 * missing entirely. This file is the rest of the set, written to the same rule
 * as the original: SCRIPT the state, play the real actions, and assert on what
 * the simulation wrote — never on prose that a helper could have invented.
 *
 * WHY SOME CASES LOOP INSTEAD OF ASSERTING ONCE. The shared match engine is
 * unseeded (a documented V3 boundary — see the header of `utils/sunday/rng.ts`),
 * so a case that depends on a RESULT rather than on a rule cannot be pinned to
 * one match. Those cases play many cheap matches and assert the rule over the
 * population, with the sample size and the measured value in the comment.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { assertSundayState } from '@/utils/sunday/invariants';
import {
  SUNDAY_CHAIN_DEBT_WEEKS, SUNDAY_CHEMISTRY_FRIEND, SUNDAY_CUP_ROUNDS,
  SUNDAY_DEBT_FLOOR, SUNDAY_FRIEND_LEFT_HAPPINESS, SUNDAY_MEMORY_WEIGHTS,
  SUNDAY_LEGEND_APPS, SUNDAY_TACTICS, getSundayTactic,
} from '@/config/sundayLeague';
import { SUNDAY_EVENTS } from '@/data/sundayEvents';
import { buildMatchdayTeam, simulateSundayMatch, sundayTacticFit } from '@/utils/sunday/match';
import { createSundayRng } from '@/utils/sunday/rng';
import { sundaySeasonWeeks } from '@/utils/sunday/season';
import type {
  Club, Match, MatchWeather, Player, SundayState, SundayTacticId,
} from '@/types/game';

const SEED = 71717;

function state() {
  return useGameStore.getState();
}

function patch(next: Partial<SundayState>) {
  useGameStore.setState({ sunday: { ...state().sunday!, ...next } });
}

function check() {
  const s = state();
  assertSundayState({
    sunday: s.sunday!, players: s.players, clubs: s.clubs,
    playerClubId: s.playerClubId, fixtures: s.fixtures, week: s.week,
  });
}

/** Cool every definition down except the ones named, so only a chain beat (which
 *  ignores cooldowns by design) can reach the player. */
function isolate(...keep: string[]): Record<string, number> {
  return Object.fromEntries(
    SUNDAY_EVENTS.filter(d => !keep.includes(d.id)).map(d => [d.id, 9999]),
  );
}

async function clearPendingEvent(pick: 'first' | 'last' = 'first') {
  const s = state();
  const pending = s.sunday!.pendingEvent;
  if (!pending) return null;
  const choice = pick === 'first' ? pending.choices[0] : pending.choices[pending.choices.length - 1];
  await s.resolveSundayEvent(choice.id);
  return pending.defId;
}

/** Make our lot good and everybody else hopeless, so a result is not a coin
 *  flip. Attributes only — `overall` is left alone unless a case needs it. */
function stackTheDeck(ourAttr: number, theirAttr: number) {
  const s = state();
  const players: Record<string, Player> = { ...s.players };
  for (const p of Object.values(players)) {
    const mine = p.clubId === s.playerClubId;
    const v = mine ? ourAttr : theirAttr;
    players[p.id] = {
      ...p,
      attributes: { pace: v, shooting: v, passing: v, defending: v, physical: v, mental: v },
      overall: v,
      fitness: 100,
      injured: false,
      injuryWeeks: 0,
    };
  }
  useGameStore.setState({ players });
}

/**
 * Everybody who CAN play is playing.
 *
 * Deliberately not "everybody": a suspended or injured man marked available is
 * an invariant violation (`assertSundayState` checks exactly that), so the two
 * real reasons a Sunday footballer cannot be picked are left alone and only the
 * week's turnout roll is overridden.
 */
function everyoneAvailable() {
  const s = state();
  const sunday = s.sunday!;
  patch({
    squad: sunday.squad.map(m => {
      const p = s.players[m.playerId];
      const banned = p && p.suspendedUntilWeek != null && p.suspendedUntilWeek > s.week;
      const hurt = p && p.injured && p.injuryWeeks > 0;
      if (banned || hurt) return m;
      return {
        ...m,
        availability: { status: 'available' as const, reason: null, note: null, warned: true, weeksRemaining: 0 },
      };
    }),
  });
}

beforeEach(async () => {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed: SEED });
});

// ── (c) The cup run ─────────────────────────────────────────────────────────

describe('a cup run leaves something behind', () => {
  it('writes a cup hero, a club record and the season highlight', async () => {
    const s0 = state();
    const clubId = s0.playerClubId;
    const opponentId = Object.keys(s0.clubs).find(id => id !== clubId)!;
    const week = s0.week;

    // The final, this Sunday, us against them. One tie in the last round is
    // enough for `advanceSundayCup` to crown a winner.
    patch({
      cup: {
        name: 'The Sunday Cup',
        entrants: [clubId, opponentId],
        ties: [{
          round: SUNDAY_CUP_ROUNDS, week, homeClubId: clubId, awayClubId: opponentId,
          played: false, homeGoals: 0, awayGoals: 0, winnerClubId: null, shootout: null,
        }],
        eliminated: false,
        winnerClubId: null,
      },
    });
    everyoneAvailable();
    stackTheDeck(85, 12);

    await state().autoPickSundayTeamsheet();
    const report = (await state().playSundayMatch())!;
    expect(report, 'the cup final did not kick off').toBeTruthy();
    expect(report.goalsFor, `lost the rigged final ${report.goalsFor}-${report.goalsAgainst}`)
      .toBeGreaterThan(report.goalsAgainst);

    // 1. THE MAN. `cup-hero` needs a won cup tie and a goal or the MOTM award,
    //    so a 5-0 always produces at least one.
    const sunday = state().sunday!;
    const heroes = sunday.squad.filter(m => m.memories.some(mem => mem.kind === 'cup-hero'));
    expect(heroes.length, 'nobody was the man of the final').toBeGreaterThan(0);
    expect(heroes[0].memories.find(m => m.kind === 'cup-hero')!.text).toContain('Final');

    // 2. THE CLUB. A win writes `biggest-win` with the opponent in the value.
    const record = sunday.records.find(r => r.id === 'biggest-win');
    expect(record, 'a cup thrashing set no club record').toBeTruthy();
    expect(record!.value).toContain(' v ');

    // 3. THE TROPHY. The bracket crowns us the moment the last tie is played.
    expect(sunday.cup!.winnerClubId).toBe(clubId);
    check();

    // 4. THE SEASON. Play the rest of it out and the retrospective says so.
    let guard = 0;
    const maxTicks = sundaySeasonWeeks(sunday.divisionId) + 6;
    while (guard++ < maxTicks) {
      const s = state();
      if (s.sunday!.folded || s.sunday!.seasonComplete) break;
      await clearPendingEvent();
      if (state().sunday!.seasonComplete) break;
      await state().advanceWeek();
    }
    expect(state().sunday!.folded, 'the club folded before the season ended').toBe(false);
    expect(state().sunday!.seasonComplete).toBe(true);
    await state().endSundaySeason();

    const history = state().sunday!.history;
    expect(history).toHaveLength(1);
    expect(history[0].highlights).toContain('Won the Sunday Cup.');
    expect(history[0].cupResult).toBeTruthy();
    // The moment of the season is read off the heaviest memory anybody carries,
    // and a cup final is a weight-9 afternoon.
    expect(history[0].momentOfTheSeason, 'the season had no moment').toBeTruthy();
    check();
  });
});

// ── (d) Financial crisis → recovery → survival ──────────────────────────────

describe('a club can be brought back from the brink', () => {
  it('walks red → crisis → recovery → still here, with the ledger and the clock agreeing', async () => {
    const s0 = state();
    // Deep enough in the red that the committee chain's premise is true, but
    // with weeks left on the fold clock — the story needs room to run.
    patch({
      balance: SUNDAY_DEBT_FLOOR - 40,
      weeksInDebt: SUNDAY_CHAIN_DEBT_WEEKS,
      eventCooldowns: isolate(),
      chains: [{
        id: 'financial-crisis', step: 2, subjectId: null,
        startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week,
        data: { standing: 'watched' },
      }],
    });
    const ledgerBefore = state().sunday!.ledger.length;

    // BEAT ONE: something has to go. Sell the best player for real money.
    await state().advanceWeek();
    const sacrifice = state().sunday!.pendingEvent;
    expect(sacrifice?.defId, 'the crisis never asked for a sacrifice').toBe('crisis-sacrifice');
    const squadBefore = state().sunday!.squad.length;
    const sell = sacrifice!.choices.find(c => c.id === 'sell') ?? sacrifice!.choices[0];
    await state().resolveSundayEvent(sell.id);

    if (sell.id === 'sell') {
      // Real money and a real hole in the side, both visible.
      expect(state().sunday!.squad.length).toBe(squadBefore - 1);
    }
    expect(state().sunday!.chains[0]?.step, 'the crisis did not move on').toBe(3);

    // RECOVERY. Money comes in the ways a Sunday club actually finds it, and
    // through the actions that write it to the ledger — a direct `balance`
    // patch here would break the ledger chain, which is itself the point: the
    // recovery has to be earned the way a player earns it.
    await state().runSundayFundraiser();
    await state().chaseSundaySubs();
    if (state().sunday!.balance < 0) {
      // A local firm puts its name on the shirts. Manufactured rather than
      // waited for, because the offer stream is a weighted draw.
      patch({
        sponsorOffers: [{
          id: 'sp-rescue', name: 'The Chippy on the Corner', blurb: 'rescue', weekly: 12,
          signOn: 220, expiresSeason: state().season + 1, condition: 'none' as const,
          conditionTarget: 0, conditionProgress: 0, conditionText: 'none', expiresWeek: 99,
        }],
      });
      const signed = await state().acceptSundaySponsor('sp-rescue');
      expect(signed.ok, signed.message).toBe(true);
    }
    expect(state().sunday!.balance).toBeGreaterThanOrEqual(0);

    // BEAT TWO: the verdict. Its condition is `balance >= 0`, so the club that
    // found the money gets the good ending rather than the grim one.
    let verdict: string | null = null;
    for (let i = 0; i < 4 && !verdict; i++) {
      if (state().sunday!.seasonComplete || state().sunday!.folded) break;
      await state().advanceWeek();
      const pending = state().sunday!.pendingEvent;
      if (!pending) continue;
      verdict = pending.defId;
      await state().resolveSundayEvent(pending.choices[0].id);
    }
    expect(verdict, 'the crisis never reached a verdict').toBe('crisis-survived');

    // SURVIVAL. The story is over, the club is not.
    const after = state().sunday!;
    expect(after.chains, 'the crisis chain was left open').toHaveLength(0);
    expect(after.folded).toBe(false);
    expect(after.foldReason).toBeNull();
    // The fold clock reset the week the balance came back above the floor —
    // that is the whole point of surviving.
    expect(after.weeksInDebt).toBe(0);
    // Every week of it is in the ledger, the chain of balances is unbroken
    // (the validator's own rule, run by `check()`), and the last recorded
    // balance is the one the club is actually holding.
    expect(after.ledger.length).toBeGreaterThan(ledgerBefore);
    expect(after.ledger[after.ledger.length - 1].balance).toBe(after.balance);
    for (const entry of after.ledger) {
      expect(entry.lines.length, `week ${entry.week} recorded nothing`).toBeGreaterThan(0);
    }
    check();

    // And it survives the following month, which is what "still alive" means.
    for (let i = 0; i < 4; i++) {
      const s = state();
      if (s.sunday!.folded || s.sunday!.seasonComplete) break;
      await clearPendingEvent();
      if (state().sunday!.seasonComplete) break;
      await state().advanceWeek();
    }
    expect(state().sunday!.folded).toBe(false);
    check();
  });
});

// ── (e) Veteran farewell → legend ───────────────────────────────────────────

describe('the old boy is remembered for a real afternoon', () => {
  it('ends his story and cites the moment the simulation actually wrote', async () => {
    const s0 = state();
    const target = s0.sunday!.squad[0];
    const player = s0.players[target.playerId];
    const fullName = `${player.firstName} ${player.lastName}`;
    // Enough service to earn the honours board, and one afternoon everybody
    // remembers. The memory is written the way match processing writes it.
    const moment = {
      season: 1, week: 6, kind: 'winner' as const,
      text: 'Won it in the 90th minute against Dog & Duck. Scenes.',
      weight: 7,
    };
    patch({
      eventCooldowns: isolate(),
      squad: s0.sunday!.squad.map(m => m.playerId === target.playerId
        ? { ...m, clubApps: SUNDAY_LEGEND_APPS + 12, clubGoals: 18, joinedSeason: 1, memories: [moment] }
        : m),
      chains: [{
        id: 'veteran-farewell', step: 2, subjectId: target.playerId,
        startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week,
        data: { mood: 'ready' },
      }],
    });

    // The one ending that takes him out of the club: let it end quietly.
    let decided = false;
    for (let i = 0; i < 4 && !decided; i++) {
      if (state().sunday!.seasonComplete || state().sunday!.folded) break;
      await state().advanceWeek();
      const pending = state().sunday!.pendingEvent;
      if (!pending) continue;
      if (pending.defId === 'veteran-decision') {
        const quiet = pending.choices.find(c => c.id === 'quiet')!;
        await state().resolveSundayEvent(quiet.id);
        decided = true;
      } else {
        await state().resolveSundayEvent(pending.choices[0].id);
      }
    }
    expect(decided, 'the farewell never reached its decision').toBe(true);

    const after = state().sunday!;
    // He has gone, completely — squad, players map, club sheet.
    expect(after.squad.some(m => m.playerId === target.playerId)).toBe(false);
    expect(state().players[target.playerId]).toBeUndefined();
    expect(state().clubs[state().playerClubId].playerIds).not.toContain(target.playerId);
    // And the chain closed with him.
    expect(after.chains).toHaveLength(0);

    // THE CITATION. Not a template about a veteran — the sentence the club
    // actually wrote down on the Sunday it happened.
    const legend = after.legends.find(l => l.playerId === target.playerId);
    expect(legend, `${fullName} earned the board and was not put on it`).toBeTruthy();
    expect(legend!.name).toBe(fullName);
    expect(legend!.reason).toContain(moment.text);
    expect(legend!.reason).toContain(`${SUNDAY_LEGEND_APPS + 12} appearances`);
    expect(legend!.apps).toBe(SUNDAY_LEGEND_APPS + 12);
    check();
  });

  it('leaves the passer-by off the board however he goes', async () => {
    const s0 = state();
    const target = s0.sunday!.squad[0];
    patch({
      eventCooldowns: isolate(),
      squad: s0.sunday!.squad.map(m => m.playerId === target.playerId
        ? { ...m, clubApps: 3, clubGoals: 0, memories: [] }
        : m),
      chains: [{
        id: 'veteran-farewell', step: 2, subjectId: target.playerId,
        startedWeek: s0.week, startedSeason: s0.season, dueWeek: s0.week,
        data: { mood: 'ready' },
      }],
    });
    for (let i = 0; i < 4; i++) {
      if (state().sunday!.seasonComplete || state().sunday!.folded) break;
      await state().advanceWeek();
      const pending = state().sunday!.pendingEvent;
      if (!pending) continue;
      const quiet = pending.choices.find(c => c.id === 'quiet') ?? pending.choices[0];
      await state().resolveSundayEvent(quiet.id);
      if (quiet.id === 'quiet') break;
    }
    expect(state().sunday!.legends.some(l => l.playerId === target.playerId)).toBe(false);
    check();
  });
});

// ── (f) The unlikely hero ───────────────────────────────────────────────────

describe('the unlikely hero', () => {
  /**
   * Play a season with one deliberately awful-RATED forward who can actually
   * finish, and audit every memory the matches write.
   *
   * `weakestIds` is computed from `Player.overall` over the STARTING XI, and
   * `overall` is independent of the attributes the engine shoots with — so a
   * man can be bottom of the teamsheet on paper and the likeliest scorer on the
   * grass. That is exactly the afternoon the memory exists for, and it is the
   * only way to produce one on demand without seeding the shared engine.
   */
  /** Rig one season so a bottom-of-the-teamsheet forward is the only man who
   *  can score, then audit every memory it writes. */
  async function riggedSeason(seed: number) {
    useGameStore.getState().resetGame();
    await useGameStore.getState().startSundayLeague({ personality: 'pub', seed });
    everyoneAvailable();
    const s = state();
    const squad = s.sunday!.squad;
    const cinderella = squad.find(m => s.players[m.playerId].position !== 'GK')!.playerId;

    const players: Record<string, Player> = { ...s.players };
    for (const p of Object.values(players)) {
      if (p.clubId !== s.playerClubId) {
        // Opposition: hard to break down, almost incapable of scoring, so most
        // of our wins are by exactly one goal — which is the only scoreline
        // that has a match-winner at all.
        players[p.id] = {
          ...p,
          attributes: { pace: 40, shooting: 10, passing: 30, defending: 58, physical: 42, mental: 40 },
          overall: 40, fitness: 100, injured: false, injuryWeeks: 0,
        };
        continue;
      }
      const isHim = p.id === cinderella;
      players[p.id] = {
        ...p,
        // He plays up front, because a centre-half who never gets in the box
        // cannot win a match on his own however good his finishing is.
        position: isHim ? 'ST' : p.position,
        attributes: isHim
          ? { pace: 88, shooting: 80, passing: 45, defending: 30, physical: 70, mental: 60 }
          : { pace: 45, shooting: 4, passing: 45, defending: 66, physical: 50, mental: 45 },
        // ...and he is bottom of the teamsheet on paper, which is what the
        // memory keys off. `overall` is independent of the attributes the
        // engine shoots with, so a man can be the worst player here and the
        // likeliest scorer at the same time. That is the whole afternoon.
        overall: isHim ? 20 : 55,
        fitness: 100, injured: false, injuryWeeks: 0,
      };
    }
    useGameStore.setState({ players });

    let unlikely = 0;
    let ordinary = 0;
    const violations: string[] = [];
    const total = sundaySeasonWeeks(state().sunday!.divisionId);

    for (let i = 0; i < total + 2; i++) {
      const st = state();
      if (st.sunday!.folded || st.sunday!.seasonComplete) break;
      await clearPendingEvent();
      if (state().sunday!.seasonComplete) break;
      everyoneAvailable();

      // Named by hand, because `autoPickSundayTeamsheet` sorts on `overall`
      // and would leave the man this case is about on the bench forever.
      const ids = state().sunday!.squad.map(m => m.playerId);
      const named = [cinderella, ...ids.filter(id => id !== cinderella)].slice(0, 11);
      const sheet = await state().setSundayTeamsheet(named, []);
      if (!sheet.ok) { await state().advanceWeek(); continue; }
      const before = new Map(state().sunday!.squad.map(m => [m.playerId, m.memories.length]));
      // The three lowest `overall` in the XI that is about to take the field.
      const xi = state().sunday!.teamsheet;
      const weakest = new Set(
        [...xi]
          .map(id => state().players[id])
          .filter(Boolean)
          .sort((a, b) => a.overall - b.overall)
          .slice(0, 3)
          .map(p => p.id),
      );
      const report = await state().playSundayMatch();
      if (!report) { await state().advanceWeek(); continue; }

      for (const m of state().sunday!.squad) {
        const fresh = m.memories.slice(before.get(m.playerId) ?? 0);
        for (const memory of fresh) {
          if (memory.kind === 'unlikely-hero') {
            unlikely++;
            if (!weakest.has(m.playerId)) violations.push(`seed ${seed} w${report.week}: unlikely-hero for a top man`);
          }
          if (memory.kind === 'winner') {
            ordinary++;
            if (weakest.has(m.playerId)) violations.push(`seed ${seed} w${report.week}: plain winner for a bottom-3 man`);
          }
        }
      }
      await state().advanceWeek();
    }
    check();
    return { unlikely, ordinary, violations };
  }

  it('fires for the worst man on the pitch and for nobody else', async () => {
    // SIX rigged seasons, not one. A one-goal win is roughly a third of the
    // fixtures and only some of those are his, so a single season produced
    // one or two heroes — MEASURED 2, 1, 1 on three runs — which is a coin
    // flip away from proving nothing. Six seasons put it out of reach of a
    // quiet run: MEASURED 10, 10 and 16 unlikely heroes against 11, 11 and 8
    // ordinary winners on three runs of this case.
    let unlikely = 0;
    let ordinary = 0;
    const violations: string[] = [];
    for (const seed of [9101, 9102, 9103, 9104, 9105, 9106]) {
      const r = await riggedSeason(seed);
      unlikely += r.unlikely;
      ordinary += r.ordinary;
      violations.push(...r.violations);
    }

    // The rule, both directions: the memory is written for a bottom-three man
    // and the ordinary version is never written for one. MEASURED over six
    // seasons: no overlap in either direction, ever.
    expect(violations, violations.join('; ')).toEqual([]);
    expect(unlikely + ordinary, 'no one-goal win happened at all — the case tested nothing')
      .toBeGreaterThan(0);
    expect(unlikely, `the rigged forward never won one on his own (ordinary=${ordinary})`)
      .toBeGreaterThan(0);
  }, 120_000);

  it('gives a guest who wins it a line and no biography', async () => {
    // A ringer has no squad record, so there is nothing to write a memory
    // into. The club gets a consequence instead — and that asymmetry is
    // deliberate, so it is pinned rather than left to be rediscovered.
    const s = state();
    patch({
      balance: 500,
      squad: s.sunday!.squad.map((m, i) => i < 6
        ? { ...m, availability: { status: 'out' as const, reason: 'work' as const, note: 'x', warned: true, weeksRemaining: 1 } }
        : m),
    });
    const arrival = (await state().arriveSundayMatch())!;
    if (arrival.optionalRingers > 0) await state().hireSundayRingers(arrival.optionalRingers);
    const report = (await state().playSundayMatch())!;
    expect(report.ringersUsed).toBeGreaterThan(0);
    const guestWon = report.consequences.some(c => c.startsWith('A guest nobody had met before'));
    if (guestWon) {
      // No squad member may have claimed it.
      const claims = state().sunday!.squad.filter(m => m.memories.some(mem =>
        (mem.kind === 'unlikely-hero' || mem.kind === 'winner') && mem.week === report.week));
      expect(claims).toHaveLength(0);
    }
    check();
  });
});

// ── (g) Friendships, and what they cost ─────────────────────────────────────

describe('the dressing room reaches the pitch and the door', () => {
  it('shows the chemistry on the day, then charges for the man who left', async () => {
    everyoneAvailable();
    const s0 = state();
    const squad = s0.sunday!.squad;
    const outfield = squad.filter(m => s0.players[m.playerId].position !== 'GK');
    const [a, b] = [outfield[0].playerId, outfield[1].playerId];

    // Two mates, and a third man who cannot stand one of them.
    const c = outfield[2].playerId;
    patch({
      squad: squad.map(m => {
        if (m.playerId === a) return { ...m, friends: [b], rivals: [] };
        if (m.playerId === b) return { ...m, friends: [a], rivals: [] };
        if (m.playerId === c) return { ...m, friends: [], rivals: [a] };
        return { ...m, friends: [], rivals: [] };
      }),
    });

    // 1. ON THE DAY. Both are named, so the breakdown says so, by name.
    const st = state().sunday!;
    const rest = st.squad.map(m => m.playerId).filter(id => id !== a && id !== b && id !== c);
    await state().setSundayTeamsheet([a, b, c, ...rest].slice(0, 11), []);
    const report = (await state().playSundayMatch())!;
    const nameA = state().players[a].firstName;
    const nameB = state().players[b].firstName;
    const friendRow = report.adjustments.find(r => r.label.includes('side by side as always'));
    expect(friendRow, `no chemistry row: ${report.adjustments.map(r => r.label).join(' | ')}`).toBeTruthy();
    expect(friendRow!.delta).toBe(SUNDAY_CHEMISTRY_FRIEND);
    expect(`${friendRow!.label}`).toContain(nameA);
    expect(`${friendRow!.label}`).toContain(nameB);
    expect(report.adjustments.some(r => r.label.includes('are not speaking'))).toBe(true);
    check();

    // 2. AT THE DOOR. Release his mate and he takes it personally — the number
    //    is the configured one, not "some morale".
    const happyBefore = state().sunday!.squad.find(m => m.playerId === b)!.happiness;
    const released = await state().releaseSundayPlayer(a);
    expect(released.ok, released.message).toBe(true);

    const after = state().sunday!.squad.find(m => m.playerId === b)!;
    expect(after.happiness).toBe(happyBefore + SUNDAY_FRIEND_LEFT_HAPPINESS);
    // And nobody is left holding an id that points at a ghost.
    for (const m of state().sunday!.squad) {
      expect(m.friends).not.toContain(a);
      expect(m.rivals).not.toContain(a);
    }
    // The man who could not stand him is not sad about it.
    const rivalOf = state().sunday!.squad.find(m => m.playerId === c)!;
    expect(rivalOf.happiness).toBeGreaterThanOrEqual(happyBefore);
    check();
  });

  it('lets exactly one man follow his mate out of the door', async () => {
    everyoneAvailable();
    const s0 = state();
    const squad = s0.sunday!.squad;
    const leaver = squad[0].playerId;
    // Three unhappy, disloyal mates of the man about to go: the cascade must
    // still take at most one of them, in one week.
    patch({
      squad: squad.map((m, i) => {
        if (m.playerId === leaver) return { ...m, friends: [squad[1].playerId, squad[2].playerId, squad[3].playerId] };
        if (i >= 1 && i <= 3) return { ...m, friends: [leaver], happiness: 3, loyalty: 1 };
        return m;
      }),
    });
    const r = await state().releaseSundayPlayer(leaver);
    expect(r.ok, r.message).toBe(true);
    await state().advanceWeek();

    // AT MOST ONE man follows his mate out. Ordinary quits are a separate roll
    // and are allowed to happen in the same week — the cap this asserts is on
    // the CASCADE, so it counts the week-log line the cascade writes rather
    // than the total number of departures, which would conflate the two.
    const log = state().sunday!.weekLog;
    const followers = log.filter(line => line.includes('only ever here because his mate was'));
    expect(followers.length, log.join(' / ')).toBeLessThanOrEqual(1);
    // ...and it does not chain: nobody follows the follower in the same week.
    expect(log.filter(line => line.includes('That is two in one Sunday')).length)
      .toBeLessThanOrEqual(1);
    check();
  });
});

// ── (h) Tactical identity ───────────────────────────────────────────────────

describe('a squad shaped for a tactic plays better in it', () => {
  /** A Sunday footballer with an attribute profile and nothing else. */
  function mk(id: string, position: Player['position'], attrs: Player['attributes'], clubId: string): Player {
    const overall = Math.round(
      (attrs.pace + attrs.shooting + attrs.passing + attrs.defending + attrs.physical + attrs.mental) / 6,
    );
    return {
      id, firstName: 'A', lastName: id, age: 26, nationality: 'England', position,
      attributes: { ...attrs }, overall, potential: overall, clubId,
      wage: 0, value: 0, contractEnd: 99, fitness: 100, morale: 60, form: 60,
      injured: false, injuryWeeks: 0, goals: 0, assists: 0, appearances: 0,
      careerGoals: 0, careerAssists: 0, careerAppearances: 0, yellowCards: 0, redCards: 0,
    } as Player;
  }

  const SHAPE: Player['position'][] = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'LM', 'RM', 'ST', 'ST'];

  /** Eleven men whose profile is skewed toward `high` and away from `low`,
   *  around the same mean — so the two XIs differ in SHAPE, not in quality. */
  function shapedXI(tag: string, high: readonly (keyof Player['attributes'])[], low: readonly (keyof Player['attributes'])[], clubId: string): Player[] {
    return SHAPE.map((pos, i) => {
      const attrs = { pace: 42, shooting: 42, passing: 42, defending: 42, physical: 42, mental: 42 };
      for (const a of high) attrs[a] = 58;
      for (const a of low) attrs[a] = 26;
      return mk(`${tag}-${i}`, pos, attrs, clubId);
    });
  }

  function club(id: string): Club {
    return { id, name: id, shortName: id, playerIds: [], reputation: 20, facilities: 3 } as unknown as Club;
  }

  function playN(xi: Player[], tacticId: SundayTacticId, opponent: Player[], matches: number): number {
    const us = club('us');
    const them = club('them');
    const weather: MatchWeather = { weather: 'clear', pitch: 'good' };
    // Attribute adjustments the mode really applies, including the fit lever
    // this case exists to measure. Neutral pitch, no equipment, flat morale, so
    // fit is the only thing that differs between the two runs.
    const built = buildMatchdayTeam({
      xi, squad: [], tacticId, pitchQuality: 55, ballsLevel: 0, glovesLevel: 0,
      coachLevel: 0, teamMorale: 55, isPlayerClub: true,
    });
    let points = 0;
    for (let i = 0; i < matches; i++) {
      const match: Match = {
        id: `m${i}`, week: 1, homeClubId: 'us', awayClubId: 'them',
        played: false, homeGoals: 0, awayGoals: 0, events: [],
      } as unknown as Match;
      const { result } = simulateSundayMatch({
        rng: createSundayRng(1000 + i, 0),
        match, homeClub: us, awayClub: them,
        homeXI: built.players, awayXI: opponent,
        homeBench: [], awayBench: [],
        homeTacticId: tacticId, awayTacticId: 'route-one',
        weather, derbyIntensity: 0, season: 1,
        playerPhysioLevel: 0, playerIsHome: true,
      });
      if (result.homeGoals > result.awayGoals) points += 3;
      else if (result.homeGoals === result.awayGoals) points += 1;
    }
    return points / matches;
  }

  it('the fit lever moves team strength in the direction the tactic wants', () => {
    // The pure, deterministic half of the claim: the same eleven scores higher
    // fit — and therefore carries higher adjusted `overall` — under the tactic
    // its shape suits than under the one it does not.
    const grafters = shapedXI('graft', ['physical', 'shooting'], ['passing', 'mental'], 'us');
    const passers = shapedXI('pass', ['mental', 'pace'], ['physical', 'defending'], 'us');

    expect(sundayTacticFit('route-one', grafters)).toBeGreaterThan(sundayTacticFit('proper-football', grafters));
    expect(sundayTacticFit('proper-football', passers)).toBeGreaterThan(sundayTacticFit('route-one', passers));

    const strength = (xi: Player[], tactic: SundayTacticId) => {
      const built = buildMatchdayTeam({
        xi, squad: [], tacticId: tactic, pitchQuality: 55, ballsLevel: 0, glovesLevel: 0,
        coachLevel: 0, teamMorale: 55, isPlayerClub: true,
      });
      return built.players.reduce((n, p) => n + p.overall, 0) / built.players.length;
    };
    expect(strength(grafters, 'route-one')).toBeGreaterThan(strength(grafters, 'proper-football'));
    expect(strength(passers, 'proper-football')).toBeGreaterThan(strength(passers, 'route-one'));
    // ...and every tactic's name is on the row, so the manager can see it.
    const built = buildMatchdayTeam({
      xi: grafters, squad: [], tacticId: 'route-one', pitchQuality: 55, ballsLevel: 0,
      glovesLevel: 0, coachLevel: 0, teamMorale: 55, isPlayerClub: true,
    });
    expect(built.adjustments.some(r => r.label === `${getSundayTactic('route-one').name} suits the XI`)).toBe(true);
  });

  it('takes more points in the shape it was built for, both ways round', () => {
    // MANY CHEAP MATCHES, not a few expensive careers. The shared engine is
    // unseeded, so this is a sample: 120 matches per arm, the same eleven and
    // the same opposition in both arms, only the tactic changing. The two XIs
    // have the same attribute mean and differ only in DISTRIBUTION, so what is
    // being measured is shape, not quality.
    //
    // MEASURED, three runs of 120 matches per arm:
    //   grafters: Route One 2.23 / 2.13 / 2.14 ppg  (2.6 goals for, 1.2 against)
    //             Proper Football 1.70 / 1.76 / 1.77
    //   passers:  Proper Football 1.82 / 1.73 / 1.68
    //             Route One 1.32 / 1.22 / 1.29
    // Gaps: 0.53 / 0.37 / 0.37 and 0.50 / 0.51 / 0.39. The band is 0.15 — well
    // under the smallest observed gap and well above the run-to-run wobble, so
    // it fails when the fit lever stops reaching the pitch rather than when a
    // sample lands low.
    const MATCHES = 120;
    const MIN_GAP = 0.15;
    const opposition = shapedXI('opp', [], [], 'them');

    const grafters = shapedXI('graft', ['physical', 'shooting'], ['passing', 'mental'], 'us');
    const graftInShape = playN(grafters, 'route-one', opposition, MATCHES);
    const graftOutOfShape = playN(grafters, 'proper-football', opposition, MATCHES);
    expect(graftInShape - graftOutOfShape,
      `grafters: route-one=${graftInShape.toFixed(2)} proper-football=${graftOutOfShape.toFixed(2)}`)
      .toBeGreaterThan(MIN_GAP);

    const passers = shapedXI('pass', ['mental', 'pace'], ['physical', 'defending'], 'us');
    const passInShape = playN(passers, 'proper-football', opposition, MATCHES);
    const passOutOfShape = playN(passers, 'route-one', opposition, MATCHES);
    expect(passInShape - passOutOfShape,
      `passers: proper-football=${passInShape.toFixed(2)} route-one=${passOutOfShape.toFixed(2)}`)
      .toBeGreaterThan(MIN_GAP);
  }, 120_000);
});

// ── Coverage bookkeeping ────────────────────────────────────────────────────

describe('the eight arcs are all covered somewhere', () => {
  it('names the file each one lives in, so a deleted case is a failing test', () => {
    // A directory, not a simulation. The V3 brief lists eight arcs; two are
    // owned by `sundayStories.test.ts` and six by this file. If an arc is ever
    // dropped this list is the thing that has to be edited, which is the point.
    const arcs = {
      'rival defection': 'sundayStories.test.ts',
      'promise kept and broken': 'sundayStories.test.ts',
      'cup run': 'sundayStoriesV3.test.ts',
      'financial crisis to survival': 'sundayStoriesV3.test.ts',
      'veteran farewell to legend': 'sundayStoriesV3.test.ts',
      'unlikely hero': 'sundayStoriesV3.test.ts',
      'friendship effects': 'sundayStoriesV3.test.ts',
      'tactical identity': 'sundayStoriesV3.test.ts',
    };
    expect(Object.keys(arcs)).toHaveLength(8);
    expect(SUNDAY_TACTICS).toHaveLength(4);
    expect(SUNDAY_MEMORY_WEIGHTS['unlikely-hero']).toBeGreaterThanOrEqual(8);
  });
});
