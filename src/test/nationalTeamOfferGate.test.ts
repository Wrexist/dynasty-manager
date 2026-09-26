/**
 * R7 — a national-team offer has to be earned.
 *
 * `setManagerNationality` made an `initial` offer in every career, so a rookie
 * (reputation 30) at Brisbane Roar or Keflavík was offered the England job on
 * day one. Offers are now gated by reputation against the nation's standing
 * (`NT_OFFER_REPUTATION_BY_RANKING`): day one only the smaller nations call,
 * and a bigger nation's FA approaches at a season end once the reputation is
 * there.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { createDefaultManager } from '@/utils/managerCareer';
import { nationalTeamOfferReputation } from '@/utils/international';
import { getNationRanking } from '@/data/nations';
import { NT_JOB_MIN_REPUTATION, NT_OFFER_REPUTATION_BY_RANKING } from '@/config/gameBalance';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import type { CareerManager } from '@/types/game';

const CLUB_ID = 'celtic';

function manager(nationality: string, reputationScore?: number): CareerManager {
  const m = createDefaultManager('Gate Tester', nationality, 40, []);
  return {
    ...m,
    ...(reputationScore === undefined ? {} : { reputationScore }),
    contract: { clubId: CLUB_ID, salary: 5000, startSeason: 1, endSeason: 3, bonuses: [] },
  };
}

describe('nationalTeamOfferReputation', () => {
  it('asks more of a manager the bigger the nation', () => {
    expect(getNationRanking('England')).toBeLessThanOrEqual(10);
    expect(nationalTeamOfferReputation('England')).toBe(NT_OFFER_REPUTATION_BY_RANKING[0].minReputation);
    expect(nationalTeamOfferReputation('Italy')).toBe(NT_JOB_MIN_REPUTATION);
    expect(nationalTeamOfferReputation('Norway')).toBeGreaterThan(0);
    expect(nationalTeamOfferReputation('Norway')).toBeLessThan(NT_JOB_MIN_REPUTATION);
    expect(nationalTeamOfferReputation('Scotland')).toBe(0);
    const bands = [1, 12, 31, 60].map(r => NT_OFFER_REPUTATION_BY_RANKING.find(b => r <= b.maxRanking)!.minReputation);
    expect([...bands].sort((a, b) => b - a)).toEqual(bands);
  });

  it('a rookie clears only the smallest band', () => {
    const rookie = createDefaultManager('Rookie', 'England', 35, []).reputationScore;
    expect(rookie).toBeLessThan(nationalTeamOfferReputation('Norway'));
    expect(rookie).toBeGreaterThanOrEqual(nationalTeamOfferReputation('Scotland'));
  });
});

describe('setManagerNationality in a career', () => {
  beforeEach(async () => {
    __resetAutosaveSchedulerForTests();
    __resetSaveStorageForTests();
    useGameStore.getState().resetGame();
    localStorage.clear();
    await useGameStore.getState().initGame(CLUB_ID);
  });

  it('a rookie is not offered England on day one', () => {
    useGameStore.setState({ gameMode: 'career', careerManager: manager('England') });
    useGameStore.getState().setManagerNationality('England');
    const s = useGameStore.getState();
    expect(s.managerNationality).toBe('England');
    expect(s.nationalTeamOffer).toBeNull();
    expect(s.showNationalTeamOffer).toBe(false);
  });

  it('a rookie from a small nation still gets the day-one approach', () => {
    useGameStore.setState({ gameMode: 'career', careerManager: manager('Scotland') });
    useGameStore.getState().setManagerNationality('Scotland');
    const s = useGameStore.getState();
    expect(s.nationalTeamOffer?.nationality).toBe('Scotland');
    expect(s.nationalTeamOffer?.reason).toBe('initial');
    expect(s.showNationalTeamOffer).toBe(true);
  });

  it('an established manager is offered England', () => {
    useGameStore.setState({ gameMode: 'career', careerManager: manager('England', 800) });
    useGameStore.getState().setManagerNationality('England');
    expect(useGameStore.getState().nationalTeamOffer?.nationality).toBe('England');
  });

  it('the FA approaches at a season end once the reputation is there', { timeout: 60_000 }, () => {
    useGameStore.setState({ gameMode: 'career', careerManager: manager('England') });
    useGameStore.getState().setManagerNationality('England');
    expect(useGameStore.getState().nationalTeamOffer).toBeNull();

    // Reputation earned over the season.
    const cm = useGameStore.getState().careerManager!;
    useGameStore.setState({ careerManager: { ...cm, reputationScore: 900 } });
    useGameStore.getState().endSeason();

    const offer = useGameStore.getState().nationalTeamOffer;
    expect(offer?.nationality).toBe('England');
    expect(offer?.reason).toBe('initial');
    expect(offer?.status).toBe('pending');
  });

  it('and not before', { timeout: 60_000 }, () => {
    useGameStore.setState({ gameMode: 'career', careerManager: manager('England') });
    useGameStore.getState().setManagerNationality('England');
    useGameStore.getState().endSeason();
    expect(useGameStore.getState().nationalTeamOffer).toBeNull();
  });
});
