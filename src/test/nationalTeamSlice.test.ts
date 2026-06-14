/**
 * nationalTeamSlice — manager appointment, offer accept/decline, and squad
 * management (previously untested). The appointment paths generate a real
 * 23-man national pool (the national player pool is loaded by the global test
 * setup). Tournament advancement is owned by orchestration and out of scope.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import type { NationalTeamOffer, NationalTeamState, InternationalTournamentState } from '@/types/game';

const CLUB_ID = 'celtic';
const NAT = 'England';

const pendingOffer = (): NationalTeamOffer => ({
  id: 'offer-1', nationality: NAT, reason: 'initial',
  offerSeason: 1, offerWeek: 1, expiresSeason: 1, expiresWeek: 5, status: 'pending',
});

beforeEach(() => {
  useGameStore.getState().initGame(CLUB_ID);
  // Defensive reset — guarantee a clean national-team baseline per test.
  useGameStore.setState({
    nationalTeam: null, nationalTeamOffer: null,
    managerNationality: null, showNationalTeamOffer: false,
  });
});

describe('nationalTeamSlice — appointment', () => {
  it('setManagerNationality (sandbox) just records the nationality, no offer', () => {
    useGameStore.getState().setManagerNationality(NAT);
    expect(useGameStore.getState().managerNationality).toBe(NAT);
    expect(useGameStore.getState().nationalTeamOffer).toBeNull();
  });

  it('initNationalTeam builds a national team with an auto-selected squad', () => {
    useGameStore.getState().initNationalTeam(NAT);
    const nt = useGameStore.getState().nationalTeam!;
    expect(nt).not.toBeNull();
    expect(nt.nationality).toBe(NAT);
    expect(nt.squad.length).toBeGreaterThanOrEqual(11);
    expect(nt.poolPlayerIds.length).toBeGreaterThan(0);
    expect(useGameStore.getState().managerNationality).toBe(NAT);
  });
});

describe('nationalTeamSlice — offer accept/decline', () => {
  it('acceptNationalTeamOffer appoints the manager and clears the offer', () => {
    useGameStore.setState({ managerNationality: NAT, nationalTeamOffer: pendingOffer(), showNationalTeamOffer: true });
    useGameStore.getState().acceptNationalTeamOffer();

    const s = useGameStore.getState();
    expect(s.nationalTeam).not.toBeNull();
    expect(s.nationalTeam!.nationality).toBe(NAT);
    expect(s.nationalTeam!.squad.length).toBeGreaterThanOrEqual(11);
    expect(s.nationalTeamOffer).toBeNull();
    expect(s.showNationalTeamOffer).toBe(false);
  });

  it('acceptNationalTeamOffer no-ops without a pending offer', () => {
    useGameStore.setState({ managerNationality: NAT, nationalTeamOffer: { ...pendingOffer(), status: 'declined' } });
    useGameStore.getState().acceptNationalTeamOffer();
    expect(useGameStore.getState().nationalTeam).toBeNull();
  });

  it('declineNationalTeamOffer clears the offer', () => {
    useGameStore.setState({ managerNationality: NAT, nationalTeamOffer: pendingOffer(), showNationalTeamOffer: true });
    useGameStore.getState().declineNationalTeamOffer();

    const s = useGameStore.getState();
    expect(s.nationalTeamOffer).toBeNull();
    expect(s.showNationalTeamOffer).toBe(false);
    expect(s.nationalTeam).toBeNull();
  });
});

describe('nationalTeamSlice — squad editing (guards on no team)', () => {
  it('updateNationalSquad and setNationalFormation no-op without a national team', () => {
    useGameStore.getState().updateNationalSquad(['a'], ['b'], ['c']);
    useGameStore.getState().setNationalFormation('4-4-2');
    expect(useGameStore.getState().nationalTeam).toBeNull();
  });

  it('updateNationalSquad and setNationalFormation apply once a team exists', () => {
    useGameStore.getState().initNationalTeam(NAT);
    useGameStore.getState().updateNationalSquad(['s1', 's2'], ['s1'], ['s2']);
    useGameStore.getState().setNationalFormation('4-4-2');

    const nt = useGameStore.getState().nationalTeam!;
    expect(nt.squad).toEqual(['s1', 's2']);
    expect(nt.lineup).toEqual(['s1']);
    expect(nt.formation).toBe('4-4-2');
  });
});

describe('nationalTeamSlice — confirmNationalSquad', () => {
  it('locks the squad, flips squadConfirmed, and routes to the tournament', () => {
    useGameStore.getState().initNationalTeam(NAT);
    useGameStore.setState({
      internationalTournament: { squadConfirmed: false } as InternationalTournamentState,
    });

    useGameStore.getState().confirmNationalSquad(['p1'], ['p1'], []);

    const s = useGameStore.getState();
    expect(s.internationalTournament!.squadConfirmed).toBe(true);
    expect(s.nationalTeam!.squad).toEqual(['p1']);
    expect(s.currentScreen).toBe('international-tournament');
  });
});

describe('nationalTeamSlice — replaceInjuredInternationalPlayer', () => {
  function seedTeam(squad: string[], lineup: string[], subs: string[]) {
    useGameStore.setState({
      nationalTeam: { nationality: NAT, squad, lineup, subs, formation: '4-3-3', fifaRanking: 1, caps: {}, internationalGoals: {}, results: [], poolPlayerIds: [] } as NationalTeamState,
    });
  }

  it('swaps the injured player across squad/lineup/subs', () => {
    const realId = useGameStore.getState().clubs[CLUB_ID].playerIds[0];
    seedTeam(['out', 'keep'], ['out'], []);

    useGameStore.getState().replaceInjuredInternationalPlayer('out', realId);

    const nt = useGameStore.getState().nationalTeam!;
    expect(nt.squad).toEqual([realId, 'keep']);
    expect(nt.lineup).toEqual([realId]);
  });

  it('rejects an unknown replacement or one already in the squad', () => {
    const realId = useGameStore.getState().clubs[CLUB_ID].playerIds[0];
    seedTeam([realId, 'keep'], [realId], []);

    // Unknown id — no change.
    useGameStore.getState().replaceInjuredInternationalPlayer(realId, 'ghost');
    expect(useGameStore.getState().nationalTeam!.squad).toEqual([realId, 'keep']);

    // Already in squad — no change.
    useGameStore.getState().replaceInjuredInternationalPlayer('keep', realId);
    expect(useGameStore.getState().nationalTeam!.squad).toEqual([realId, 'keep']);
  });
});
