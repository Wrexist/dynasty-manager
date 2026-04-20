import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Player, Club } from '@/types/game';
import { generateStorylines } from '@/utils/storylines';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1', firstName: 'John', lastName: 'Doe', age: 25, position: 'CM',
    nationality: 'England', overall: 70, potential: 80, value: 1_000_000, wage: 10_000,
    clubId: 'club-a', contractEnd: 3, goals: 0, assists: 0, appearances: 10,
    fitness: 85, morale: 70, form: 60, injured: false, injuryWeeks: 0,
    yellowCards: 0, redCards: 0, suspended: false, suspendedUntil: 0,
    attributes: { pace: 65, shooting: 60, passing: 75, defending: 55, physical: 65, mental: 70 },
    ...overrides,
  } as Player;
}

function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'club-a', name: 'Club A', shortName: 'A', color: '#000', secondaryColor: '#FFF',
    budget: 10_000_000, reputation: 3, fanBase: 50, wageBill: 500_000, formation: '4-4-2',
    playerIds: [], lineup: [], subs: [], divisionId: 'eng',
    facilities: 5, youthRating: 5, boardPatience: 5,
    ...overrides,
  } as Club;
}

function baseCtx(overrides: Partial<Parameters<typeof generateStorylines>[0]> = {}) {
  return {
    week: 10,
    season: 1,
    playerClubId: 'club-a',
    clubs: { 'club-a': makeClub() },
    players: {} as Record<string, Player>,
    recentResults: { won: 0, drawn: 0, lost: 0 },
    leaguePosition: 10,
    boardConfidence: 60,
    fanMood: 60,
    ...overrides,
  };
}

// Storylines fires on Math.random() < 0.40 and then picks a random candidate.
// Queue-based spy handles both calls deterministically.
function mockRandomSequence(seq: number[]) {
  let i = 0;
  return vi.spyOn(Math, 'random').mockImplementation(() => {
    const v = seq[Math.min(i, seq.length - 1)];
    i++;
    return v;
  });
}

describe('generateStorylines', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns {messages:[], event:null} when the trigger roll misses', () => {
    mockRandomSequence([0.9]); // > 0.40 trigger
    const ctx = baseCtx({
      players: { 'p1': makePlayer({ id: 'p1', clubId: 'club-a' }) },
    });
    expect(generateStorylines(ctx)).toEqual({ messages: [], event: null });
  });

  it('returns empty when squad is empty (no candidates)', () => {
    mockRandomSequence([0.1]); // trigger would pass, but squad is empty
    const ctx = baseCtx({ players: {} });
    expect(generateStorylines(ctx)).toEqual({ messages: [], event: null });
  });

  it('returns empty when the club is missing', () => {
    mockRandomSequence([0.1]);
    const ctx = baseCtx({ playerClubId: 'not-a-club' });
    expect(generateStorylines(ctx)).toEqual({ messages: [], event: null });
  });

  it('emits a losing-streak event when 3+ losses and a single candidate is available', () => {
    // trigger pass + first candidate picked
    mockRandomSequence([0.1, 0]);
    const ctx = baseCtx({
      recentResults: { won: 0, drawn: 0, lost: 4 },
      players: { 'p1': makePlayer({ id: 'p1', clubId: 'club-a' }) },
    });
    const out = generateStorylines(ctx);
    expect(out.messages).toHaveLength(1);
    expect(out.event).not.toBeNull();
    expect(out.event!.options).toHaveLength(3);
    expect(out.messages[0].title).toBe('Dressing Room Unrest');
  });

  it('winning-streak candidate fires when won>=4 and is the only candidate', () => {
    mockRandomSequence([0.1, 0]);
    const ctx = baseCtx({
      recentResults: { won: 5, drawn: 0, lost: 0 },
      players: { 'p1': makePlayer({ id: 'p1', clubId: 'club-a', overall: 60 }) },
    });
    const out = generateStorylines(ctx);
    expect(out.event?.title).toBe('Riding the Wave');
  });

  it('injury-crisis candidate surfaces a message without an event', () => {
    // 3 injured + no other candidates qualifying.
    mockRandomSequence([0.1, 0]);
    const players: Record<string, Player> = {};
    for (let i = 0; i < 3; i++) {
      players[`inj-${i}`] = makePlayer({
        id: `inj-${i}`, clubId: 'club-a', injured: true, injuryWeeks: 2,
        overall: 60, // below star threshold (75) — suppresses the star-linked candidate
        age: 26,     // above youth threshold (21) — suppresses youth candidate
      });
    }
    const ctx = baseCtx({ players });
    const out = generateStorylines(ctx);
    expect(out.messages[0]?.title).toBe('Injury Crisis Deepening');
    expect(out.event).toBeNull();
  });
});
