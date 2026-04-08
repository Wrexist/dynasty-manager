import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { MAX_SQUAD_SIZE } from '@/config/gameBalance';
import { SIGNING_BONUS_WEEKS_PER_YEAR, FREE_AGENT_REP_BASE, FREE_AGENT_REP_SCALE } from '@/config/transfers';

describe('freeAgentBalance', () => {
  describe('config constants', () => {
    it('MAX_SQUAD_SIZE is 32', () => {
      expect(MAX_SQUAD_SIZE).toBe(32);
    });

    it('SIGNING_BONUS_WEEKS_PER_YEAR is 12', () => {
      expect(SIGNING_BONUS_WEEKS_PER_YEAR).toBe(12);
    });

    it('reputation gate formula covers expected ranges', () => {
      // rep 1 → 42, rep 5 → 70
      expect(FREE_AGENT_REP_BASE + 1 * FREE_AGENT_REP_SCALE).toBe(42);
      expect(FREE_AGENT_REP_BASE + 5 * FREE_AGENT_REP_SCALE).toBe(70);
    });

    it('signing bonus is meaningful relative to wages', () => {
      // A 3-year deal at £5K/week should cost £180K, not £30K
      const wage = 5000;
      const years = 3;
      const bonus = wage * years * SIGNING_BONUS_WEEKS_PER_YEAR;
      expect(bonus).toBe(180000);
      expect(bonus).toBeGreaterThan(100000);
    });
  });

  describe('signFreeAgent guards', () => {
    const CLUB_ID = 'celtic';

    beforeEach(() => {
      useGameStore.getState().initGame(CLUB_ID);
    });

    it('should reject signing when squad is at MAX_SQUAD_SIZE', () => {
      const state = useGameStore.getState();
      const club = state.clubs[state.playerClubId];

      // Find a free agent to try to sign
      if (state.freeAgents.length === 0) return; // skip if no free agents
      const freeAgentId = state.freeAgents[0];
      const freeAgent = state.players[freeAgentId];
      if (!freeAgent) return;

      // Pad the club's playerIds to MAX_SQUAD_SIZE
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

      const result = useGameStore.getState().signFreeAgent(freeAgentId, freeAgent.wage, 2);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Squad is full');
    });

    it('should reject signing free agent above reputation threshold', () => {
      const state = useGameStore.getState();
      const club = state.clubs[state.playerClubId];

      // Find a free agent with overall above the club's reputation threshold
      const maxOvr = FREE_AGENT_REP_BASE + club.reputation * FREE_AGENT_REP_SCALE;
      const highOvrAgent = state.freeAgents
        .map(id => state.players[id])
        .filter(Boolean)
        .find(p => p.overall > maxOvr);

      if (!highOvrAgent) {
        // Create one by manipulating state
        const anyAgent = state.freeAgents[0];
        if (!anyAgent) return;
        const player = state.players[anyAgent];
        if (!player) return;

        useGameStore.setState({
          players: {
            ...state.players,
            [anyAgent]: { ...player, overall: maxOvr + 5 },
          },
          clubs: {
            ...state.clubs,
            [state.playerClubId]: { ...club, budget: 999_999_999 },
          },
        });

        const result = useGameStore.getState().signFreeAgent(anyAgent, player.wage, 2);
        expect(result.success).toBe(false);
        expect(result.message).toContain('reputation limit');
        return;
      }

      // Ensure budget
      useGameStore.setState({
        clubs: {
          ...state.clubs,
          [state.playerClubId]: { ...club, budget: 999_999_999 },
        },
      });

      const result = useGameStore.getState().signFreeAgent(highOvrAgent.id, highOvrAgent.wage, 2);
      expect(result.success).toBe(false);
      expect(result.message).toContain('reputation limit');
    });

    it('should allow signing a free agent within reputation and squad limits', () => {
      const state = useGameStore.getState();
      const club = state.clubs[state.playerClubId];
      const maxOvr = FREE_AGENT_REP_BASE + club.reputation * FREE_AGENT_REP_SCALE;

      // Find a free agent within reputation threshold
      const validAgent = state.freeAgents
        .map(id => state.players[id])
        .filter(Boolean)
        .find(p => p.overall <= maxOvr);

      if (!validAgent) return; // skip if none available

      // Ensure budget and squad space
      useGameStore.setState({
        clubs: {
          ...state.clubs,
          [state.playerClubId]: { ...club, budget: 999_999_999 },
        },
      });

      const result = useGameStore.getState().signFreeAgent(validAgent.id, validAgent.wage, 2);
      expect(result.success).toBe(true);
    });
  });

  describe('executeTransfer squad cap', () => {
    const CLUB_ID = 'celtic';

    beforeEach(() => {
      useGameStore.getState().initGame(CLUB_ID);
    });

    it('should reject transfer when squad is at MAX_SQUAD_SIZE', () => {
      const state = useGameStore.getState();
      const club = state.clubs[state.playerClubId];

      // Find a player on the transfer market
      if (state.transferMarket.length === 0) return;
      const listing = state.transferMarket[0];

      // Pad the club's playerIds to MAX_SQUAD_SIZE
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
        transferWindowOpen: true,
      });

      const result = useGameStore.getState().executeTransfer(listing.playerId, listing.askingPrice);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Squad is full');
    });
  });
});
