import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Player, Club, Message } from '@/types/game';
import { generateRandomEvents, randomEventWeights, buildRandomEventContext, RANDOM_EVENT_TEMPLATES } from '@/utils/randomEvents';
import {
  RANDOM_EVENT_BASE_CHANCE,
  BUSTUP_MORALE_HIT,
  INTL_FATIGUE_FITNESS_LOSS,
  FAN_RALLY_MORALE_BOOST,
  MEDIA_SCRUTINY_CONFIDENCE_HIT,
  BOARDROOM_PRAISE_CONFIDENCE_BOOST,
  CONFIDENCE_MAX,
} from '@/config/gameBalance';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1', firstName: 'John', lastName: 'Doe', age: 25, position: 'CM',
    nationality: 'England', overall: 70, potential: 80, value: 1_000_000, wage: 10_000,
    clubId: 'club-a', contractEnd: 3,
    goals: 0, assists: 0, appearances: 10,
    careerGoals: 0, careerAssists: 0, careerAppearances: 10,
    fitness: 85, morale: 70, form: 60, injured: false, injuryWeeks: 0,
    yellowCards: 0, redCards: 0,
    attributes: { pace: 65, shooting: 60, passing: 75, defending: 55, physical: 65, mental: 70 },
    ...overrides,
  };
}

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'club-a', name: 'Club A', shortName: 'A', color: '#000', secondaryColor: '#FFF',
    budget: 50_000_000, reputation: 3, fanBase: 50, wageBill: 500_000, formation: '4-4-2',
    playerIds: [], lineup: [], subs: [], divisionId: 'eng',
    facilities: 5, youthRating: 5, boardPatience: 5,
    ...overrides,
  };
}

function buildSquad(size: number, overridesPerIndex?: (i: number) => Partial<Player>) {
  const players: Record<string, Player> = {};
  const ids: string[] = [];
  for (let i = 0; i < size; i++) {
    const id = `p-${i}`;
    ids.push(id);
    players[id] = makePlayer({ id, lastName: `Player${i}`, ...(overridesPerIndex?.(i) ?? {}) });
  }
  return { players, ids };
}

// `Math.random()` is called multiple times inside generateRandomEvents:
// 1. base-chance check, 2. weighted event pick, 3+. branch-local rolls
// (e.g. fan_rally doesn't roll further; intl_fatigue rolls to pick a player).
// mockRandomSequence returns the next value from the queue, repeating the
// last value forever so a test doesn't have to enumerate every downstream call.
function mockRandomSequence(seq: number[]) {
  let i = 0;
  return vi.spyOn(Math, 'random').mockImplementation(() => {
    const v = seq[Math.min(i, seq.length - 1)];
    i++;
    return v;
  });
}

/** A weight-roll fraction that lands in the middle of `id`'s slice of this
 *  week's draw table — computed, not hand-summed, so adding a template does not
 *  silently retarget every test. */
function rollFor(id: string, club: Club, players: Record<string, Player>, week: number, season: number, recent: ('W' | 'D' | 'L')[], conf: number): number {
  const table = randomEventWeights(buildRandomEventContext(club, players, week, season, recent, conf));
  const total = table.reduce((s, e) => s + e.weight, 0);
  let start = 0;
  for (const e of table) {
    if (e.id === id) {
      if (e.weight <= 0) throw new Error(`${id} has no weight in this context`);
      return (start + e.weight / 2) / total;
    }
    start += e.weight;
  }
  throw new Error(`unknown event ${id}`);
}

describe('generateRandomEvents', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns an unchanged result when the base-chance roll misses', () => {
    mockRandomSequence([RANDOM_EVENT_BASE_CHANCE + 0.5]); // miss
    const { players, ids } = buildSquad(12);
    const club = makeClub({ playerIds: ids });
    const messages: Message[] = [];
    const out = generateRandomEvents(club, players, messages, 5, 1, ['W'], 60);
    expect(out.messages).toEqual(messages);
    expect(out.playerUpdates).toEqual({});
    expect(out.clubUpdate).toEqual({});
    expect(out.confidenceDelta).toBe(0);
  });

  it('bails early when the squad has fewer than 2 players', () => {
    mockRandomSequence([0]); // pass the base check
    const { players, ids } = buildSquad(1);
    const club = makeClub({ playerIds: ids });
    const out = generateRandomEvents(club, players, [], 5, 1, [], 50);
    expect(Object.keys(out.playerUpdates)).toHaveLength(0);
  });

  it('fan_rally branch boosts every squad member\'s morale and emits one message', () => {
    // Seq: [base-pass, weight-roll landing on fan_rally].
    const { players, ids } = buildSquad(5, () => ({ morale: 60 }));
    const club = makeClub({ playerIds: ids });
    mockRandomSequence([0, rollFor('fan_rally', club, players, 5, 1, ['W', 'W', 'W'], 70)]);
    const out = generateRandomEvents(club, players, [], 5, 1, ['W', 'W', 'W'], 70);
    for (const id of ids) {
      expect(out.playerUpdates[id]?.morale).toBe(60 + FAN_RALLY_MORALE_BOOST);
    }
    expect(out.messages.some(m => m.title === 'Fan Support Surge')).toBe(true);
  });

  it('bustup branch decrements exactly two players\' morale', () => {
    // bustup is first in the table; r=0 picks it.
    mockRandomSequence([0, 0]);
    const { players, ids } = buildSquad(5, () => ({ morale: 60 }));
    const club = makeClub({ playerIds: ids });
    const out = generateRandomEvents(club, players, [], 5, 1, [], 50);
    const decremented = Object.values(out.playerUpdates).filter(u => u.morale === 60 - BUSTUP_MORALE_HIT);
    expect(decremented).toHaveLength(2);
    expect(out.messages.some(m => m.title === 'Dressing Room Bust-Up')).toBe(true);
  });

  it('intl_fatigue branch decreases fitness and requires an eligible player', () => {
    const { players, ids } = buildSquad(4, () => ({ overall: 70, fitness: 90 }));
    const club = makeClub({ playerIds: ids });
    mockRandomSequence([0, rollFor('intl_fatigue', club, players, 5, 1, [], 50), 0]); // last 0 picks first eligible player
    const out = generateRandomEvents(club, players, [], 5, 1, [], 50);
    const fatigued = Object.values(out.playerUpdates).find(u => u.fitness === 90 - INTL_FATIGUE_FITNESS_LOSS);
    expect(fatigued).toBeTruthy();
    expect(out.messages.some(m => m.title === 'International Fatigue')).toBe(true);
  });

  it('media_scrutiny branch produces a negative confidence delta', () => {
    // With recentLosses>=3, media_scrutiny weight is 15.
    const { players, ids } = buildSquad(5);
    const club = makeClub({ playerIds: ids });
    mockRandomSequence([0, rollFor('media_scrutiny', club, players, 5, 1, ['L', 'L', 'L'], 50)]);
    const out = generateRandomEvents(club, players, [], 5, 1, ['L', 'L', 'L'], 50);
    expect(out.confidenceDelta).toBe(-MEDIA_SCRUTINY_CONFIDENCE_HIT);
    expect(out.messages.some(m => m.title === 'Media Scrutiny')).toBe(true);
  });
});

// ── content: the added templates ─────────────────────────────────────────────

/** A squad with someone for every template to be about: veterans, youngsters,
 *  tired players, a signing from this season. Morale/fitness/form mid-range so
 *  every delta is visible (no clamping at 10 or 100). */
function richSquad(season: number) {
  return buildSquad(14, i => ({
    age: i < 3 ? 32 : i < 7 ? 19 : 25,
    overall: 60 + i,
    potential: 80,
    morale: 60,
    fitness: i % 2 === 0 ? 70 : 90,
    form: 60,
    joinedSeason: i === 10 ? season : season - 2,
  }));
}

/** The bands the original six events set (per player, and for the board/budget). */
const BOUNDS = { morale: [-10, 10], fitness: [-15, 10], form: [0, 10], confidence: [-3, 3], budgetFraction: [0, 0.1] } as const;

describe('random event templates', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('has at least 16 templates with unique ids', () => {
    expect(RANDOM_EVENT_TEMPLATES.length).toBeGreaterThanOrEqual(16);
    expect(new Set(RANDOM_EVENT_TEMPLATES.map(t => t.id)).size).toBe(RANDOM_EVENT_TEMPLATES.length);
  });

  for (const template of RANDOM_EVENT_TEMPLATES) {
    it(`${template.id}: fires with one message and stays inside the original effect bands`, () => {
      const season = 3;
      const { players, ids } = richSquad(season);
      const club = makeClub({ playerIds: ids });
      const recent: ('W' | 'D' | 'L')[] = ['W', 'W', 'L', 'L', 'W'];
      mockRandomSequence([0, rollFor(template.id, club, players, 20, season, recent, 55), 0.3]);
      const out = generateRandomEvents(club, players, [], 20, season, recent, 55);

      expect(out.messages, 'exactly one inbox message').toHaveLength(1);
      expect(out.messages[0].title.length).toBeGreaterThan(0);
      expect(out.messages[0].body).not.toMatch(/undefined|NaN|\{|\}/);
      for (const [pid, upd] of Object.entries(out.playerUpdates)) {
        const before = players[pid];
        for (const stat of ['morale', 'fitness', 'form'] as const) {
          if (upd[stat] === undefined) continue;
          const d = upd[stat]! - before[stat];
          expect(d, `${template.id} ${stat}`).toBeGreaterThanOrEqual(BOUNDS[stat][0]);
          expect(d, `${template.id} ${stat}`).toBeLessThanOrEqual(BOUNDS[stat][1]);
        }
      }
      expect(out.confidenceDelta).toBeGreaterThanOrEqual(BOUNDS.confidence[0]);
      expect(out.confidenceDelta).toBeLessThanOrEqual(BOUNDS.confidence[1]);
      if (out.clubUpdate.budget !== undefined) {
        const frac = (out.clubUpdate.budget - club.budget) / club.budget;
        expect(frac).toBeGreaterThanOrEqual(BOUNDS.budgetFraction[0]);
        expect(frac).toBeLessThanOrEqual(BOUNDS.budgetFraction[1]);
      }
    });
  }

  it('is a quiet week when the event has nobody to be about', () => {
    // veteran_mentor with no veterans in the squad.
    const { players, ids } = buildSquad(6, () => ({ age: 24 }));
    const club = makeClub({ playerIds: ids });
    mockRandomSequence([0, rollFor('veteran_mentor', club, players, 10, 2, [], 50)]);
    const out = generateRandomEvents(club, players, [], 10, 2, [], 50);
    expect(out.messages).toHaveLength(0);
    expect(out.playerUpdates).toEqual({});
  });

  it('never calls a season-1 squad member "homesick" (everyone joined in season 1)', () => {
    const { players, ids } = buildSquad(6, () => ({ joinedSeason: 1 }));
    const club = makeClub({ playerIds: ids });
    const table = randomEventWeights(buildRandomEventContext(club, players, 10, 1, [], 50));
    expect(table.find(e => e.id === 'homesick_signing')!.weight).toBe(0);
  });

  it('context steers the draw: winter bugs, praise after a winning run', () => {
    const { players, ids } = buildSquad(6);
    const club = makeClub({ playerIds: ids });
    const w = (week: number, recent: ('W' | 'D' | 'L')[]) =>
      Object.fromEntries(randomEventWeights(buildRandomEventContext(club, players, week, 2, recent, 50)).map(e => [e.id, e.weight]));
    expect(w(20, []).sickness_bug).toBeGreaterThan(w(5, []).sickness_bug);
    expect(w(10, ['W', 'W', 'W']).boardroom_praise).toBeGreaterThan(w(10, []).boardroom_praise);
    expect(w(10, ['L', 'L']).players_meeting).toBeGreaterThan(w(10, []).players_meeting);
  });

  it('boardroom praise never pushes board confidence past the maximum', () => {
    // The first event that RAISES confidence, and it is likeliest after a
    // winning run — when the board is already near the top. weekAdvance only
    // floored the delta, so 99 + 3 used to persist as 102.
    const { players, ids } = buildSquad(6);
    const club = makeClub({ playerIds: ids });
    const wins: ('W' | 'D' | 'L')[] = ['W', 'W', 'W'];
    for (const conf of [CONFIDENCE_MAX - 1, CONFIDENCE_MAX]) {
      mockRandomSequence([0, rollFor('boardroom_praise', club, players, 10, 2, wins, conf)]);
      const out = generateRandomEvents(club, players, [], 10, 2, wins, conf);
      expect(out.messages.some(m => m.title === 'Chairman\'s Backing')).toBe(true);
      expect(conf + out.confidenceDelta).toBeLessThanOrEqual(CONFIDENCE_MAX);
      vi.restoreAllMocks();
    }
    mockRandomSequence([0, rollFor('boardroom_praise', club, players, 10, 2, wins, 50)]);
    expect(generateRandomEvents(club, players, [], 10, 2, wins, 50).confidenceDelta).toBe(BOARDROOM_PRAISE_CONFIDENCE_BOOST);
  });
});
