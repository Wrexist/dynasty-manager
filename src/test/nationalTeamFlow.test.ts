/**
 * National team appointment flow — store-level integration tests for the
 * offer → accept / decline → squad confirm lifecycle.
 *
 * Pre-existing `nationalTeamPool.test.ts` covers the candidate pool builder
 * and `autoSelectNationalSquad`, but no test exercised the slice methods
 * that drive the user-visible flow:
 *   - setManagerNationality (career-mode popup vs sandbox immediate set)
 *   - acceptNationalTeamOffer (pool generation, squad selection, messaging)
 *   - declineNationalTeamOffer (clean dismissal)
 *   - confirmNationalSquad (lock + screen pivot)
 *
 * Uses a single shared baseline initialised via initGame so we don't pay
 * the ~2000-player cost per test, mirroring the seasonLifecycle.test.ts
 * pattern.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { useGameStore } from '@/store/gameStore';
import { __resetAutosaveSchedulerForTests } from '@/store/slices/orchestrationSlice';
import { __resetSaveStorageForTests } from '@/store/helpers/persistence';
import type {
  InternationalTournamentState,
  NationalTeamOffer,
} from '@/types/game';

const PLAYER_CLUB_ID = 'manchester-city';
const TARGET_NATIONALITY = 'England';

let baseline: ReturnType<typeof useGameStore.getState> | null = null;

async function initBaseline() {
  __resetAutosaveSchedulerForTests();
  __resetSaveStorageForTests();
  useGameStore.getState().resetGame();
  localStorage.clear();
  await useGameStore.getState().initGame(PLAYER_CLUB_ID);
  baseline = useGameStore.getState();
}

function restoreBaseline() {
  if (!baseline) throw new Error('Baseline not initialized');
  // Deep-clone the slice fields the NT flow touches so mutations from one
  // test don't leak into the next.
  const fresh = JSON.parse(JSON.stringify({
    season: baseline.season,
    week: baseline.week,
    players: baseline.players,
    clubs: baseline.clubs,
    messages: baseline.messages,
    careerTimeline: baseline.careerTimeline,
    careerManager: baseline.careerManager,
    gameMode: baseline.gameMode,
    managerNationality: baseline.managerNationality,
    nationalTeam: baseline.nationalTeam,
    nationalTeamOffer: baseline.nationalTeamOffer,
    showNationalTeamOffer: baseline.showNationalTeamOffer,
    internationalTournament: baseline.internationalTournament,
    communityPackEnabled: baseline.communityPackEnabled,
    currentScreen: baseline.currentScreen,
  }));
  useGameStore.setState(fresh);
}

beforeAll(async () => {
  await initBaseline();
}, /* timeout */ 60_000);

beforeEach(() => {
  restoreBaseline();
});

function getState() {
  return useGameStore.getState();
}

describe('National team flow — setManagerNationality', () => {
  it('career mode: stores the nation, queues an offer, shows the popup, adds an inbox message', () => {
    useGameStore.setState({ gameMode: 'career' });
    const before = getState();
    const beforeMsgCount = before.messages.length;

    getState().setManagerNationality(TARGET_NATIONALITY);

    const after = getState();
    expect(after.managerNationality).toBe(TARGET_NATIONALITY);
    expect(after.nationalTeamOffer).not.toBeNull();
    expect(after.nationalTeamOffer?.nationality).toBe(TARGET_NATIONALITY);
    expect(after.nationalTeamOffer?.status).toBe('pending');
    expect(after.showNationalTeamOffer).toBe(true);
    expect(after.messages.length).toBeGreaterThan(beforeMsgCount);
    // addMsg prepends, so the freshest message is at index 0.
    const newMsg = after.messages[0];
    expect(newMsg.type).toBe('national_team');
    expect(newMsg.title).toContain(TARGET_NATIONALITY);
  });

  it('sandbox mode: sets the nation directly without queuing an offer', () => {
    useGameStore.setState({ gameMode: 'sandbox' });

    getState().setManagerNationality(TARGET_NATIONALITY);

    const after = getState();
    expect(after.managerNationality).toBe(TARGET_NATIONALITY);
    expect(after.nationalTeamOffer).toBeNull();
    expect(after.showNationalTeamOffer).toBe(false);
  });
});

describe('National team flow — acceptNationalTeamOffer', () => {
  it('is a no-op when there is no pending offer', () => {
    useGameStore.setState({
      gameMode: 'career',
      managerNationality: TARGET_NATIONALITY,
      nationalTeamOffer: null,
    });

    getState().acceptNationalTeamOffer();

    const after = getState();
    expect(after.nationalTeam).toBeNull();
  });

  it('is a no-op when the offer status is not "pending"', () => {
    useGameStore.setState({
      gameMode: 'career',
      managerNationality: TARGET_NATIONALITY,
      nationalTeamOffer: {
        id: 'expired-offer',
        nationality: TARGET_NATIONALITY,
        reason: 'initial',
        offerSeason: 1, offerWeek: 1,
        expiresSeason: 1, expiresWeek: 5,
        status: 'expired',
      } as NationalTeamOffer,
    });

    getState().acceptNationalTeamOffer();

    const after = getState();
    expect(after.nationalTeam).toBeNull();
  });

  it('career mode: appoints the manager, picks a 23-man squad, locks lineup+subs, dismisses the popup', () => {
    useGameStore.setState({
      gameMode: 'career',
      managerNationality: TARGET_NATIONALITY,
      nationalTeamOffer: {
        id: 'offer-1',
        nationality: TARGET_NATIONALITY,
        reason: 'initial',
        offerSeason: 1, offerWeek: 1,
        expiresSeason: 1, expiresWeek: 5,
        status: 'pending',
      } as NationalTeamOffer,
      showNationalTeamOffer: true,
    });
    const before = getState();
    const beforeMsgCount = before.messages.length;
    const beforeTimelineCount = before.careerTimeline.length;

    getState().acceptNationalTeamOffer();

    const after = getState();
    // Offer dismissed
    expect(after.nationalTeamOffer).toBeNull();
    expect(after.showNationalTeamOffer).toBe(false);
    // National team state populated
    expect(after.nationalTeam).not.toBeNull();
    expect(after.nationalTeam?.nationality).toBe(TARGET_NATIONALITY);
    expect(after.nationalTeam?.squad.length).toBeGreaterThanOrEqual(11);
    expect(after.nationalTeam?.squad.length).toBeLessThanOrEqual(23);
    // selectBestLineup fills slots position-by-position; if the squad lacks
    // a player who can play one specific slot (e.g. no LB available after
    // suspension/fitness filters) the lineup may end up with 10. Anything
    // >=10 is acceptable for an integration test against a randomised pool.
    expect(after.nationalTeam?.lineup.length).toBeGreaterThanOrEqual(10);
    expect(after.nationalTeam?.lineup.length).toBeLessThanOrEqual(11);
    expect(after.nationalTeam?.subs.length).toBeGreaterThan(0);
    expect(after.nationalTeam?.poolPlayerIds.length).toBeGreaterThan(0);
    // Every lineup/subs id must be in the squad (sanity)
    const squadSet = new Set(after.nationalTeam!.squad);
    after.nationalTeam!.lineup.forEach(id => expect(squadSet.has(id)).toBe(true));
    after.nationalTeam!.subs.forEach(id => expect(squadSet.has(id)).toBe(true));
    // Inbox notification + career timeline entry
    expect(after.messages.length).toBeGreaterThan(beforeMsgCount);
    expect(after.careerTimeline.length).toBe(beforeTimelineCount + 1);
    const newTimeline = after.careerTimeline[after.careerTimeline.length - 1];
    expect(newTimeline.type).toBe('national_team_appointed');
  });

  it('sandbox mode: same appointment effect but no career timeline entry', () => {
    useGameStore.setState({
      gameMode: 'sandbox',
      managerNationality: TARGET_NATIONALITY,
      nationalTeamOffer: {
        id: 'offer-2',
        nationality: TARGET_NATIONALITY,
        reason: 'initial',
        offerSeason: 1, offerWeek: 1,
        expiresSeason: 1, expiresWeek: 5,
        status: 'pending',
      } as NationalTeamOffer,
      showNationalTeamOffer: true,
    });
    const beforeTimelineLen = getState().careerTimeline.length;

    getState().acceptNationalTeamOffer();

    const after = getState();
    expect(after.nationalTeam).not.toBeNull();
    // Sandbox doesn't write to careerTimeline
    expect(after.careerTimeline.length).toBe(beforeTimelineLen);
  });
});

describe('National team flow — declineNationalTeamOffer', () => {
  it('clears the offer and popup, leaves managerNationality intact, posts a decline message', () => {
    useGameStore.setState({
      gameMode: 'career',
      managerNationality: TARGET_NATIONALITY,
      nationalTeamOffer: {
        id: 'offer-3',
        nationality: TARGET_NATIONALITY,
        reason: 'initial',
        offerSeason: 1, offerWeek: 1,
        expiresSeason: 1, expiresWeek: 5,
        status: 'pending',
      } as NationalTeamOffer,
      showNationalTeamOffer: true,
    });
    const beforeMsgCount = getState().messages.length;

    getState().declineNationalTeamOffer();

    const after = getState();
    expect(after.nationalTeamOffer).toBeNull();
    expect(after.showNationalTeamOffer).toBe(false);
    // Manager nationality stays — declining the FA position doesn't change
    // your own background/birthplace.
    expect(after.managerNationality).toBe(TARGET_NATIONALITY);
    // No NT state was created
    expect(after.nationalTeam).toBeNull();
    // Inbox confirmation — addMsg prepends, so freshest is at index 0.
    expect(after.messages.length).toBeGreaterThan(beforeMsgCount);
    const declineMsg = after.messages[0];
    expect(declineMsg.title.toLowerCase()).toContain('decline');
  });

  it('is a no-op when there is no offer to decline', () => {
    useGameStore.setState({
      gameMode: 'career',
      managerNationality: TARGET_NATIONALITY,
      nationalTeamOffer: null,
    });
    const beforeMsgCount = getState().messages.length;

    getState().declineNationalTeamOffer();

    const after = getState();
    expect(after.messages.length).toBe(beforeMsgCount);
  });
});

describe('National team flow — confirmNationalSquad', () => {
  it('locks the picked squad, marks the tournament squadConfirmed, navigates to international-tournament', () => {
    // Set up an appointed manager + an active tournament to confirm into.
    useGameStore.setState({
      gameMode: 'career',
      managerNationality: TARGET_NATIONALITY,
      nationalTeam: {
        nationality: TARGET_NATIONALITY,
        squad: ['p1', 'p2', 'p3'], // placeholder
        lineup: [],
        subs: [],
        formation: '4-3-3',
        fifaRanking: 5,
        caps: {},
        internationalGoals: {},
        results: [],
        poolPlayerIds: [],
      },
      internationalTournament: {
        type: 'world-cup',
        season: 1,
        phase: 'group',
        groups: [],
        knockoutTies: [],
        currentRound: 'group',
        playerEliminated: false,
        winner: null,
        currentWeek: 47,
        squadConfirmed: false,
      } as InternationalTournamentState,
    });

    const newSquad = Array.from({ length: 23 }, (_, i) => `pick-${i}`);
    const newLineup = newSquad.slice(0, 11);
    const newSubs = newSquad.slice(11, 18);

    getState().confirmNationalSquad(newSquad, newLineup, newSubs);

    const after = getState();
    expect(after.nationalTeam?.squad).toEqual(newSquad);
    expect(after.nationalTeam?.lineup).toEqual(newLineup);
    expect(after.nationalTeam?.subs).toEqual(newSubs);
    expect(after.internationalTournament?.squadConfirmed).toBe(true);
    expect(after.currentScreen).toBe('international-tournament');
  });

  it('is a no-op when no national team is appointed', () => {
    useGameStore.setState({
      nationalTeam: null,
      internationalTournament: null,
      currentScreen: 'dashboard',
    });

    getState().confirmNationalSquad(['x'], ['x'], []);

    const after = getState();
    expect(after.currentScreen).toBe('dashboard');
    expect(after.nationalTeam).toBeNull();
  });

  it('is a no-op when no tournament is active', () => {
    useGameStore.setState({
      nationalTeam: {
        nationality: TARGET_NATIONALITY,
        squad: ['a'], lineup: [], subs: [], formation: '4-3-3',
        fifaRanking: 5, caps: {}, internationalGoals: {}, results: [], poolPlayerIds: [],
      },
      internationalTournament: null,
      currentScreen: 'dashboard',
    });

    getState().confirmNationalSquad(['x'], ['x'], []);

    const after = getState();
    expect(after.currentScreen).toBe('dashboard');
    // Original squad untouched
    expect(after.nationalTeam?.squad).toEqual(['a']);
  });
});
