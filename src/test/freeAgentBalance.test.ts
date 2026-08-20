import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { getMaxFeeSigningOverall } from '@/store/slices/transferSlice';
import { MAX_SQUAD_SIZE, MIN_SQUAD_SIZE } from '@/config/gameBalance';
import { SIGNING_BONUS_WEEKS_PER_YEAR, FREE_AGENT_REP_BASE, FREE_AGENT_REP_SCALE, FREE_AGENT_DIV_BONUS } from '@/config/transfers';
import { LEAGUES } from '@/data/league';

const CLUB_ID = 'celtic';

function initAndGetState() {
  useGameStore.getState().initGame(CLUB_ID);
  return useGameStore.getState();
}

function padSquadToMax(state: ReturnType<typeof useGameStore.getState>) {
  const club = state.clubs[state.playerClubId];
  const fakeIds = Array.from({ length: MAX_SQUAD_SIZE - club.playerIds.length }, (_, i) => `fake-${i}`);
  useGameStore.setState({
    clubs: {
      ...state.clubs,
      [state.playerClubId]: {
        ...club,
        playerIds: [...club.playerIds, ...fakeIds],
        budget: 999_999_999,
      },
    },
  });
}

describe('freeAgentBalance', () => {
  describe('config constants', () => {
    it('MAX_SQUAD_SIZE is 40', () => {
      expect(MAX_SQUAD_SIZE).toBe(40);
    });

    it('SIGNING_BONUS_WEEKS_PER_YEAR is 12', () => {
      expect(SIGNING_BONUS_WEEKS_PER_YEAR).toBe(12);
    });

    it('reputation gate formula covers expected ranges', () => {
      expect(FREE_AGENT_REP_BASE + 1 * FREE_AGENT_REP_SCALE).toBe(42);
      expect(FREE_AGENT_REP_BASE + 5 * FREE_AGENT_REP_SCALE).toBe(70);
    });

    it('division bonus adjusts reputation gate', () => {
      expect(FREE_AGENT_DIV_BONUS[1]).toBe(6);
      expect(FREE_AGENT_DIV_BONUS[4]).toBe(-3);
      // tier 1, rep 5: 35 + 35 + 6 = 76
      expect(FREE_AGENT_REP_BASE + 5 * FREE_AGENT_REP_SCALE + FREE_AGENT_DIV_BONUS[1]).toBe(76);
      // tier 4, rep 1: 35 + 7 - 3 = 39
      expect(FREE_AGENT_REP_BASE + 1 * FREE_AGENT_REP_SCALE + FREE_AGENT_DIV_BONUS[4]).toBe(39);
    });

    it('signing bonus is meaningful relative to wages', () => {
      const wage = 5000;
      const years = 3;
      const bonus = wage * years * SIGNING_BONUS_WEEKS_PER_YEAR;
      expect(bonus).toBe(180000);
    });
  });

  describe('signFreeAgent guards', () => {
    beforeEach(() => { initAndGetState(); });

    it('should reject signing when squad is at MAX_SQUAD_SIZE', () => {
      const state = useGameStore.getState();
      if (state.freeAgents.length === 0) return;
      const freeAgentId = state.freeAgents[0];
      const freeAgent = state.players[freeAgentId];
      if (!freeAgent) return;

      padSquadToMax(state);
      const result = useGameStore.getState().signFreeAgent(freeAgentId, freeAgent.wage, 2);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Squad is full');
    });

    it('should reject signing free agent above reputation threshold', () => {
      const state = useGameStore.getState();
      const club = state.clubs[state.playerClubId];
      const playerTier = LEAGUES.find(l => l.id === state.playerDivision)?.tier || 3;
      const divBonus = FREE_AGENT_DIV_BONUS[playerTier] || 0;
      const maxOvr = FREE_AGENT_REP_BASE + club.reputation * FREE_AGENT_REP_SCALE + divBonus;

      const anyAgent = state.freeAgents[0];
      if (!anyAgent) return;
      const player = state.players[anyAgent];
      if (!player) return;

      useGameStore.setState({
        players: { ...state.players, [anyAgent]: { ...player, overall: maxOvr + 5 } },
        clubs: { ...state.clubs, [state.playerClubId]: { ...club, budget: 999_999_999 } },
      });

      const result = useGameStore.getState().signFreeAgent(anyAgent, player.wage, 2);
      expect(result.success).toBe(false);
      expect(result.message).toContain('reputation limit');
    });

    it('should allow signing a free agent within all limits', () => {
      const state = useGameStore.getState();
      const club = state.clubs[state.playerClubId];
      const playerTier = LEAGUES.find(l => l.id === state.playerDivision)?.tier || 3;
      const divBonus = FREE_AGENT_DIV_BONUS[playerTier] || 0;
      const maxOvr = FREE_AGENT_REP_BASE + club.reputation * FREE_AGENT_REP_SCALE + divBonus;

      const validAgent = state.freeAgents
        .map(id => state.players[id])
        .filter(Boolean)
        .find(p => p.overall <= maxOvr);
      if (!validAgent) return;

      useGameStore.setState({
        clubs: { ...state.clubs, [state.playerClubId]: { ...club, budget: 999_999_999 } },
      });

      const result = useGameStore.getState().signFreeAgent(validAgent.id, validAgent.wage, 2);
      expect(result.success).toBe(true);
    });
  });

  describe('executeTransfer squad cap', () => {
    beforeEach(() => { initAndGetState(); });

    it('should reject transfer when squad is at MAX_SQUAD_SIZE', () => {
      const state = useGameStore.getState();
      if (state.transferMarket.length === 0) return;

      // Take a listing this club could otherwise actually sign. `executeTransfer`
      // checks the reputation cap BEFORE the squad cap, so `transferMarket[0]`
      // — whatever the generated market happened to put first — was a coin flip
      // on which gate answered. CI drew a 92 OVR listing against Celtic's 88 OVR
      // ceiling and got "won't drop to your level" instead of "Squad is full".
      // Selecting with the store's own helper keeps this test on the gate it
      // names, and follows the cap rule if that rule ever changes.
      const club = state.clubs[state.playerClubId];
      const squadBest = club.playerIds.reduce((best, id) => {
        const p = state.players[id];
        return p && p.overall > best ? p.overall : best;
      }, 0);
      const maxOvr = getMaxFeeSigningOverall(club.reputation, state.playerDivision, squadBest);
      const listing = state.transferMarket.find(l => {
        const p = state.players[l.playerId];
        return !!p && p.overall <= maxOvr && !p.onLoan;
      });
      if (!listing) return;

      padSquadToMax(state);
      useGameStore.setState({ transferWindowOpen: true });
      // Budget is not the gate either — `padSquadToMax` already grants funds.
      const result = useGameStore.getState().executeTransfer(listing.playerId, listing.askingPrice);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Squad is full');
    });
  });

  describe('promoteYouth squad cap', () => {
    beforeEach(() => { initAndGetState(); });

    it('should reject promotion when squad is at MAX_SQUAD_SIZE', () => {
      const state = useGameStore.getState();
      const prospects = state.youthAcademy.prospects;
      if (prospects.length === 0) return;

      padSquadToMax(state);
      const result = useGameStore.getState().promoteYouth(prospects[0].playerId);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Squad is full');
    });
  });

  describe('recallLoan squad cap', () => {
    beforeEach(() => { initAndGetState(); });

    it('should reject recall when squad is at MAX_SQUAD_SIZE', () => {
      const state = useGameStore.getState();
      if (state.activeLoans.length === 0) return;

      const loan = state.activeLoans.find(l => l.fromClubId === state.playerClubId && l.recallClause);
      if (!loan) return;

      padSquadToMax(state);
      const result = useGameStore.getState().recallLoan(loan.id);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Squad is full');
    });
  });

  describe('releasePlayer', () => {
    beforeEach(() => { initAndGetState(); });

    it('should release a player and deduct severance', () => {
      const state = useGameStore.getState();
      const club = state.clubs[state.playerClubId];
      // Ensure budget and find a player
      useGameStore.setState({
        clubs: { ...state.clubs, [state.playerClubId]: { ...club, budget: 999_999_999 } },
      });

      const playerId = club.playerIds[club.playerIds.length - 1];
      const player = state.players[playerId];
      if (!player) return;

      const beforeBudget = useGameStore.getState().clubs[state.playerClubId].budget;
      const result = useGameStore.getState().releasePlayer(playerId);

      if (club.playerIds.length <= MIN_SQUAD_SIZE) {
        expect(result.success).toBe(false);
        return;
      }

      expect(result.success).toBe(true);
      expect(result.message).toContain('released');

      const afterState = useGameStore.getState();
      expect(afterState.clubs[state.playerClubId].playerIds).not.toContain(playerId);
      expect(afterState.freeAgents).toContain(playerId);
      expect(afterState.clubs[state.playerClubId].budget).toBeLessThan(beforeBudget);
    });

    it('should reject releasing below MIN_SQUAD_SIZE', () => {
      const state = useGameStore.getState();
      const club = state.clubs[state.playerClubId];

      // Trim squad to exactly MIN_SQUAD_SIZE
      useGameStore.setState({
        clubs: {
          ...state.clubs,
          [state.playerClubId]: {
            ...club,
            playerIds: club.playerIds.slice(0, MIN_SQUAD_SIZE),
            budget: 999_999_999,
          },
        },
      });

      const trimmedClub = useGameStore.getState().clubs[state.playerClubId];
      const playerId = trimmedClub.playerIds[0];
      const result = useGameStore.getState().releasePlayer(playerId);
      expect(result.success).toBe(false);
      expect(result.message).toContain('minimum size');
    });

    it('should reject releasing a player on loan', () => {
      const state = useGameStore.getState();
      const club = state.clubs[state.playerClubId];
      const playerId = club.playerIds[0];
      const player = state.players[playerId];
      if (!player) return;

      useGameStore.setState({
        players: { ...state.players, [playerId]: { ...player, onLoan: true } },
        clubs: { ...state.clubs, [state.playerClubId]: { ...club, budget: 999_999_999 } },
      });

      const result = useGameStore.getState().releasePlayer(playerId);
      expect(result.success).toBe(false);
      expect(result.message).toContain('on loan');
    });
  });
});
