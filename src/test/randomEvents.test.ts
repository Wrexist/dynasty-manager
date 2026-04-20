import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Player, Club, Message } from '@/types/game';
import { generateRandomEvents } from '@/utils/randomEvents';
import {
  RANDOM_EVENT_BASE_CHANCE,
  BUSTUP_MORALE_HIT,
  INTL_FATIGUE_FITNESS_LOSS,
  FAN_RALLY_MORALE_BOOST,
  MEDIA_SCRUTINY_CONFIDENCE_HIT,
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
    // Seq: [base-pass, weight-roll landing on fan_rally]. With recentWins>=3
    // fan_rally weight is 18. Event list cumulative weights (before fan_rally):
    //   bustup=8, intl_fatigue=6 → fan_rally starts at 14. Weight-roll = r*total.
    // Easiest: force the roll to land inside the fan_rally slice by returning
    // a number > (8+6)/total but within the fan_rally window. Total with high
    // recentWins/boardConfidence is 8+6+18+12+4+10 = 58; fan_rally occupies
    // [14,32). Pick r = 20/58 ≈ 0.345.
    mockRandomSequence([0, 20 / 58]);
    const { players, ids } = buildSquad(5, () => ({ morale: 60 }));
    const club = makeClub({ playerIds: ids });
    const out = generateRandomEvents(club, players, [], 5, 1, ['W', 'W', 'W'], 70);
    for (const id of ids) {
      expect(out.playerUpdates[id]?.morale).toBe(60 + FAN_RALLY_MORALE_BOOST);
    }
    expect(out.messages.some(m => m.title === 'Fan Support Surge')).toBe(true);
  });

  it('bustup branch decrements exactly two players\' morale', () => {
    // bustup occupies [0, 8) in the weight range. r=0 picks bustup.
    mockRandomSequence([0, 0]);
    const { players, ids } = buildSquad(5, () => ({ morale: 60 }));
    const club = makeClub({ playerIds: ids });
    const out = generateRandomEvents(club, players, [], 5, 1, [], 50);
    const decremented = Object.values(out.playerUpdates).filter(u => u.morale === 60 - BUSTUP_MORALE_HIT);
    expect(decremented).toHaveLength(2);
    expect(out.messages.some(m => m.title === 'Dressing Room Bust-Up')).toBe(true);
  });

  it('intl_fatigue branch decreases fitness and requires an eligible player', () => {
    // intl_fatigue range [8, 14) at baseline. With recentWins=0, boardConf<60
    // totals 8+6+8+6+4+10 = 42. intl_fatigue slice is [8,14). r = 10/42.
    mockRandomSequence([0, 10 / 42, 0]); // last 0 picks first eligible player
    const { players, ids } = buildSquad(4, () => ({ overall: 70, fitness: 90 }));
    const club = makeClub({ playerIds: ids });
    const out = generateRandomEvents(club, players, [], 5, 1, [], 50);
    const fatigued = Object.values(out.playerUpdates).find(u => u.fitness === 90 - INTL_FATIGUE_FITNESS_LOSS);
    expect(fatigued).toBeTruthy();
    expect(out.messages.some(m => m.title === 'International Fatigue')).toBe(true);
  });

  it('media_scrutiny branch produces a negative confidence delta', () => {
    // With recentLosses>=3, media_scrutiny weight is 15.
    // Weights: 8+6+8+6+15+10 = 53. media_scrutiny occupies [28, 43).
    mockRandomSequence([0, 30 / 53]);
    const { players, ids } = buildSquad(5);
    const club = makeClub({ playerIds: ids });
    const out = generateRandomEvents(club, players, [], 5, 1, ['L', 'L', 'L'], 50);
    expect(out.confidenceDelta).toBe(-MEDIA_SCRUTINY_CONFIDENCE_HIT);
    expect(out.messages.some(m => m.title === 'Media Scrutiny')).toBe(true);
  });
});
