/**
 * Form is a mean-reverting read of recent results, for every club.
 *
 * It used to be a one-way ratchet. The per-match change was +5 / -2 / -8 for a
 * win / draw / defeat — net -1.6 per match across any league, where wins and
 * defeats are equal in number — plus a rating term centred on 7.0 against a
 * measured league-mean rating of 6.3, another -1.4. Nothing pulled it back. On a
 * real save AI form fell 65 -> 40 -> 25 -> 15 over three seasons, the champions'
 * squad sat pinned at 100, and because form is 15% of shot quality in the engine
 * the whole world's scoring declined season on season (audit S6).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { nextMatchForm, applyAIMatchEvents } from '@/store/slices/orchestration/helpers';
import { FORM_NEUTRAL, FORM_MIN, FORM_MAX } from '@/config/gameBalance';
import type { Club, Player, Position } from '@/types/game';
import { mulberry32 } from './helpers/matchCalibration';

const originalRandom = Math.random;
afterEach(() => { Math.random = originalRandom; });

function mkPlayer(id: string, clubId: string, position: Position, form: number): Player {
  return {
    id, firstName: id, lastName: id, age: 25, position, nationality: 'England',
    // Overall at the AI rating pivot, so the synthetic rating's quality term is 0.
    overall: 70, potential: 75, value: 1_000_000, wage: 10_000,
    clubId, contractEnd: 3, goals: 0, assists: 0, appearances: 0,
    fitness: 90, morale: 70, form, injured: false, injuryWeeks: 0,
    yellowCards: 0, redCards: 0,
    attributes: { pace: 70, shooting: 70, passing: 70, defending: 70, physical: 70, mental: 70 },
  } as Player;
}

const SHAPE: Position[] = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'CDM', 'LW', 'RW', 'ST'];

/**
 * Play `n` AI matches between two squads through the real AI post-match path.
 * `pattern` is the home side's results, cycled ('W' / 'D' / 'L'), so the test
 * measures the rule rather than a lucky or unlucky random run. Returns each
 * squad's mean form at the end.
 */
function runAiSeries(n: number, pattern: string, startForm: number) {
  // Only the synthetic rating's ±0.3 noise is random.
  Math.random = mulberry32(0xF0F0);
  const players: Record<string, Player> = {};
  const home = SHAPE.map((pos, i) => mkPlayer(`h${i}`, 'home', pos, startForm));
  const away = SHAPE.map((pos, i) => mkPlayer(`a${i}`, 'away', pos, startForm));
  for (const p of [...home, ...away]) players[p.id] = p;
  const clubs = {
    home: { id: 'home', facilities: 5 } as Club,
    away: { id: 'away', facilities: 5 } as Club,
  };
  for (let m = 0; m < n; m++) {
    const r = pattern[m % pattern.length];
    const [hg, ag] = r === 'W' ? [1, 0] : r === 'D' ? [0, 0] : [0, 1];
    applyAIMatchEvents([], players, clubs, m + 1,
      home.map(p => players[p.id]), away.map(p => players[p.id]), hg, ag, undefined, 'home', 'away');
  }
  const mean = (ids: Player[]) => ids.reduce((s, p) => s + players[p.id].form, 0) / ids.length;
  return { home: mean(home), away: mean(away) };
}

describe('nextMatchForm', () => {
  it('never lowers form after a win or raises it after a defeat', () => {
    for (let form = FORM_MIN; form <= FORM_MAX; form += 5) {
      for (let rating = 3; rating <= 10; rating += 0.5) {
        const afterWin = nextMatchForm(form, true, false, rating);
        const afterLoss = nextMatchForm(form, false, true, rating);
        expect(afterWin, `win from ${form} at ${rating}`).toBeGreaterThanOrEqual(form);
        expect(afterLoss, `defeat from ${form} at ${rating}`).toBeLessThanOrEqual(form);
        if (form < FORM_MAX) expect(afterWin).toBeGreaterThan(form);
        if (form > FORM_MIN) expect(afterLoss).toBeLessThan(form);
      }
    }
  });

  it('is neutral for an average performance in a draw at neutral form', () => {
    expect(nextMatchForm(FORM_NEUTRAL, false, false, 6.3)).toBe(FORM_NEUTRAL);
  });

  it('pulls a player on a run of draws back toward neutral from either side', () => {
    let hot = 95;
    let cold = 12;
    for (let i = 0; i < 30; i++) {
      hot = nextMatchForm(hot, false, false, 6.3);
      cold = nextMatchForm(cold, false, false, 6.3);
    }
    expect(hot).toBeLessThan(60);
    expect(cold).toBeGreaterThan(40);
  });
});

describe('AI form over a season (real applyAIMatchEvents path)', () => {
  it('does not drift when results are even', () => {
    // 38 matches of win / defeat / draw in turn — a mid-table pair. Old rule:
    // -1.6 per match from the result split and -1.7 from the rating term, so
    // both squads reached the 10 floor inside twenty matches.
    const { home, away } = runAiSeries(38, 'WLD', 65);
    for (const mean of [home, away]) {
      expect(mean).toBeGreaterThan(FORM_NEUTRAL - 10);
      expect(mean).toBeLessThan(FORM_NEUTRAL + 10);
    }
  });

  it('keeps a dominant side off the cap and a struggling side off the floor', () => {
    // Home wins 7, draws 2, loses 1 in every ten. Old rule: winners pinned at
    // 100, losers at 10. Form should still say who is flying and who is not.
    const { home: winners, away: losers } = runAiSeries(60, 'WWWDWWLWDW', 65);
    expect(winners).toBeLessThan(95);
    expect(winners).toBeGreaterThan(62);
    expect(losers).toBeGreaterThan(15);
    expect(losers).toBeLessThan(40);
  });
});
