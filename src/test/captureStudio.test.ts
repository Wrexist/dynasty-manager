/**
 * Capture Studio — staged World Cup scenarios for marketing footage.
 *
 * The two invariants that matter:
 *   1. A capture session can NEVER touch a save slot (performSave guard +
 *      slot-preserving clearActiveSession).
 *   2. The staged state is genuinely playable: a real Final tie for the
 *      scenario nations, materialised squads, and (for 'penalties' scenarios)
 *      a level currentMatchResult parked at the shootout phase.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { readSaveSlot } from '@/store/helpers/persistence';
import { CAPTURE_SCENARIOS, getCaptureScenario } from '@/config/captureScenarios';
import { getPlayerNextWorldCupMatch } from '@/utils/internationalMatch';
import { getNation } from '@/data/nations';

const PENALTY_SCENARIO = 'goat-final';   // Argentina vs Portugal, shootout
const KICKOFF_SCENARIO = 'haaland-first'; // Norway vs Brazil, from kickoff
const SLOT = 1;

beforeEach(async () => {
  // Start from a real club game in a real slot so the tests can prove the
  // teleport leaves it intact.
  useGameStore.getState().resetGame(SLOT);
  await useGameStore.getState().initGame('celtic');
  useGameStore.getState().saveGame(SLOT);
});

describe('capture scenario config', () => {
  it('every scenario references nations that exist', () => {
    for (const sc of CAPTURE_SCENARIOS) {
      expect(getNation(sc.playerNation), `${sc.id} playerNation`).toBeTruthy();
      expect(getNation(sc.opponentNation), `${sc.id} opponentNation`).toBeTruthy();
    }
  });

  it('returns false for an unknown scenario id', () => {
    expect(useGameStore.getState().startCaptureScenario('nope')).toBe(false);
  });
});

describe('startCaptureScenario — penalties stage', () => {
  it('boots a throwaway WC session parked at the Final shootout', () => {
    const ok = useGameStore.getState().startCaptureScenario(PENALTY_SCENARIO);
    expect(ok).toBe(true);
    const s = useGameStore.getState();
    const sc = getCaptureScenario(PENALTY_SCENARIO)!;

    expect(s.captureSession).toBe(true);
    expect(s.gameMode).toBe('world-cup');
    expect(s.currentScreen).toBe('match');
    expect(s.playerClubId).toBe(sc.playerNation);

    // Tournament fast-forwarded to an unplayed Final between the two nations.
    const t = s.internationalTournament!;
    expect(t.phase).toBe('knockout');
    expect(t.currentRound).toBe('F');
    const tie = t.knockoutTies.find(k => k.round === 'F' && !k.played)!;
    expect(tie.homeNation).toBe(sc.playerNation);
    expect(tie.awayNation).toBe(sc.opponentNation);

    // Both squads materialised and playable.
    expect(s.clubs[sc.playerNation]?.lineup.length).toBe(11);
    expect(s.clubs[sc.opponentNation]?.lineup.length).toBe(11);

    // Staged 2-2 parked at the shootout, kicks not yet rolled.
    expect(s.matchPhase).toBe('penalties');
    expect(s.currentMatchResult).toMatchObject({
      homeClubId: sc.playerNation,
      awayClubId: sc.opponentNation,
      homeGoals: 2,
      awayGoals: 2,
      played: false,
    });
    expect(s.currentMatchResult!.events).toHaveLength(4);
    expect(s.penaltyShootoutKicks).toHaveLength(0);
  });

  it('credits the staged goals to players who are actually in that nation XI', () => {
    useGameStore.getState().startCaptureScenario(PENALTY_SCENARIO);
    const s = useGameStore.getState();
    for (const ev of s.currentMatchResult!.events) {
      expect(ev.type).toBe('goal');
      const club = s.clubs[ev.clubId];
      expect(club, `scoring club ${ev.clubId}`).toBeTruthy();
      if (ev.playerId) {
        expect(club.lineup).toContain(ev.playerId);
      }
    }
  });

  it('the shootout can actually be rolled from the staged state', () => {
    useGameStore.getState().startCaptureScenario(PENALTY_SCENARIO);
    const res = useGameStore.getState().playWorldCupPenalties();
    expect(res).not.toBeNull();
    expect(useGameStore.getState().penaltyShootoutKicks.length).toBeGreaterThan(0);
  });
});

describe('startCaptureScenario — kickoff stage', () => {
  it('lands on the Final ready to kick off', () => {
    useGameStore.getState().startCaptureScenario(KICKOFF_SCENARIO);
    const s = useGameStore.getState();
    const sc = getCaptureScenario(KICKOFF_SCENARIO)!;

    expect(s.currentScreen).toBe('match');
    expect(s.matchPhase).toBe('none');
    expect(s.currentMatchResult).toBeNull();
    const next = getPlayerNextWorldCupMatch(s.internationalTournament, sc.playerNation);
    expect(next?.opponent).toBe(sc.opponentNation);
    expect(next?.roundLabel).toBe('Final');
  });
});

describe('save-slot safety', () => {
  it('never writes the staged session to the slot', () => {
    const before = readSaveSlot(SLOT);
    expect(before).toBeTruthy();

    useGameStore.getState().startCaptureScenario(PENALTY_SCENARIO);
    // Both the manual and flush paths must be inert during capture.
    useGameStore.getState().saveGame(SLOT);
    useGameStore.getState().flushSave();

    expect(readSaveSlot(SLOT)).toBe(before);
    // The parsed slot still holds the club game, not the staged WC session.
    const parsed = JSON.parse(readSaveSlot(SLOT)!);
    expect(parsed.playerClubId).toBe('celtic');
  });

  it('clearActiveSession wipes memory but leaves the slot on disk', () => {
    const before = readSaveSlot(SLOT);
    useGameStore.getState().clearActiveSession();
    const s = useGameStore.getState();
    expect(s.gameStarted).toBe(false);
    expect(s.playerClubId).toBe('');
    expect(readSaveSlot(SLOT)).toBe(before);
  });

  it('loading a real save exits the capture session', () => {
    useGameStore.getState().startCaptureScenario(PENALTY_SCENARIO);
    expect(useGameStore.getState().captureSession).toBe(true);
    const loaded = useGameStore.getState().loadGame(SLOT);
    expect(loaded).toBe(true);
    expect(useGameStore.getState().captureSession).toBe(false);
    expect(useGameStore.getState().playerClubId).toBe('celtic');
  });

  it('resetGame clears the capture flag', () => {
    useGameStore.getState().startCaptureScenario(PENALTY_SCENARIO);
    useGameStore.getState().resetGame(SLOT);
    expect(useGameStore.getState().captureSession).toBe(false);
  });
});
