/**
 * Captaincy & the Armband — default assignment, store actions, and the
 * departure/cleanup invariants that must never leave a dangling armband id.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { pickDefaultCaptaincy, reassignCaptaincyOnDeparture } from '@/utils/captaincy';
import { detachPlayerFromAllClubs } from '@/store/helpers/rosterOps';
import type { Club, Player } from '@/types/game';

const CLUB_ID = 'celtic';

function club() {
  const s = useGameStore.getState();
  return s.clubs[s.playerClubId];
}

function makePlayer(id: string, over: Partial<Player> = {}): Player {
  return {
    id, firstName: 'F', lastName: id, age: 25, position: 'CM', nationality: 'ENG',
    overall: 75, potential: 78, value: 1e6, wage: 1e4, contractEnd: 5, morale: 70,
    fitness: 100, form: 60, clubId: CLUB_ID, appearances: 0, goals: 0, assists: 0,
    yellowCards: 0, redCards: 0, careerGoals: 0, careerAssists: 0, careerAppearances: 0,
    attributes: { pace: 70, shooting: 70, passing: 70, defending: 70, physical: 70, mental: 70 },
    personality: { professionalism: 12, ambition: 12, temperament: 12, loyalty: 12, leadership: 12 },
    ...over,
  } as Player;
}

describe('pickDefaultCaptaincy', () => {
  it('picks the highest-leadership senior outfield player as captain, second as vice', () => {
    const squad = [
      makePlayer('gk', { position: 'GK', personality: { professionalism: 12, ambition: 12, temperament: 12, loyalty: 12, leadership: 20 } }),
      makePlayer('leader', { personality: { professionalism: 12, ambition: 12, temperament: 12, loyalty: 12, leadership: 18 } }),
      makePlayer('deputy', { personality: { professionalism: 12, ambition: 12, temperament: 12, loyalty: 12, leadership: 15 } }),
      makePlayer('kid', { age: 18, personality: { professionalism: 12, ambition: 12, temperament: 12, loyalty: 12, leadership: 19 } }),
    ];
    const { captainId, viceCaptainId } = pickDefaultCaptaincy(squad);
    // GK excluded despite top leadership; the 18yo is excluded from the senior pool.
    expect(captainId).toBe('leader');
    expect(viceCaptainId).toBe('deputy');
  });

  it('always fills the armband even for an all-youth outfield squad', () => {
    const squad = [makePlayer('a', { age: 17 }), makePlayer('b', { age: 16 })];
    const { captainId, viceCaptainId } = pickDefaultCaptaincy(squad);
    expect(captainId).toBeTruthy();
    expect(viceCaptainId).toBeTruthy();
    expect(captainId).not.toBe(viceCaptainId);
  });
});

describe('reassignCaptaincyOnDeparture', () => {
  it('promotes the vice when the captain departs', () => {
    const res = reassignCaptaincyOnDeparture({ captainId: 'cap', viceCaptainId: 'vice' }, 'cap');
    expect(res.captainId).toBe('vice');
    expect(res.viceCaptainId).toBeUndefined();
  });

  it('clears the vice when the vice departs, keeping the captain', () => {
    const res = reassignCaptaincyOnDeparture({ captainId: 'cap', viceCaptainId: 'vice' }, 'vice');
    expect(res.captainId).toBe('cap');
    expect(res.viceCaptainId).toBeUndefined();
  });

  it('leaves an untouched pair alone', () => {
    const res = reassignCaptaincyOnDeparture({ captainId: 'cap', viceCaptainId: 'vice' }, 'someoneelse');
    expect(res.captainId).toBe('cap');
    expect(res.viceCaptainId).toBe('vice');
  });
});

describe('detachPlayerFromAllClubs — armband cleanup', () => {
  it('promotes the vice to captain when the captain is detached', () => {
    const clubs: Record<string, Club> = {
      [CLUB_ID]: {
        id: CLUB_ID, name: 'X', shortName: 'X', color: '#000', secondaryColor: '#fff',
        budget: 0, wageBill: 0, reputation: 50, facilities: 5, youthRating: 5, fanBase: 1000,
        boardPatience: 50, playerIds: ['cap', 'vice', 'other'], formation: '4-3-3',
        lineup: ['cap'], subs: [], divisionId: 'scottish-premiership' as Club['divisionId'],
        captainId: 'cap', viceCaptainId: 'vice',
      },
    };
    const out = detachPlayerFromAllClubs(clubs, 'cap');
    expect(out[CLUB_ID].captainId).toBe('vice');
    expect(out[CLUB_ID].viceCaptainId).toBeUndefined();
    expect(out[CLUB_ID].playerIds).not.toContain('cap');
    expect(out[CLUB_ID].lineup).not.toContain('cap');
  });
});

describe('clubSlice — captaincy actions', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('assigns a default captain and vice on a new game', () => {
    const c = club();
    expect(c.captainId).toBeTruthy();
    expect(c.viceCaptainId).toBeTruthy();
    expect(c.captainId).not.toBe(c.viceCaptainId);
    expect(c.playerIds).toContain(c.captainId!);
  });

  it('setCaptain assigns and toggles off; a captain cannot also be vice', () => {
    const ids = club().playerIds;
    const p = ids[0];
    useGameStore.getState().setViceCaptain(p);
    useGameStore.getState().setCaptain(p);
    expect(club().captainId).toBe(p);
    // Making him captain vacated the vice slot he held.
    expect(club().viceCaptainId).not.toBe(p);
    useGameStore.getState().setCaptain(undefined);
    expect(club().captainId).toBeUndefined();
  });

  it('rejects a captain who is not in the squad', () => {
    useGameStore.getState().setCaptain('not-a-real-player');
    expect(club().captainId).not.toBe('not-a-real-player');
  });
});

describe('releasePlayer — captain departure', () => {
  beforeEach(() => {
    useGameStore.getState().initGame(CLUB_ID);
  });

  it('promotes the vice and dips squad morale when the captain is released', () => {
    const s = useGameStore.getState();
    const c = s.clubs[s.playerClubId];
    const captainId = c.captainId!;
    const viceId = c.viceCaptainId!;
    // Give the club plenty of budget so severance never blocks the release.
    useGameStore.setState({ clubs: { ...s.clubs, [c.id]: { ...c, budget: 1e12 } } });

    const before = useGameStore.getState();
    const otherId = before.clubs[before.playerClubId].playerIds.find(id => id !== captainId)!;
    const moraleBefore = before.players[otherId].morale;

    const res = useGameStore.getState().releasePlayer(captainId);
    expect(res.success).toBe(true);

    const after = useGameStore.getState();
    const club2 = after.clubs[after.playerClubId];
    expect(club2.captainId).toBe(viceId);
    expect(club2.playerIds).not.toContain(captainId);
    // Squad morale took a knock.
    expect(after.players[otherId].morale).toBeLessThan(moraleBefore);
    // A captain-departure message was posted.
    expect(after.messages.some(m => m.title === 'Captain Released')).toBe(true);
  });
});
