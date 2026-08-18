/**
 * Automated player personas — a proxy for human playtesting (§36).
 *
 * Each persona is a POLICY over the real knobs a player has: which event
 * choice to take, whether to hire arrival guests, whether to fundraise, chase
 * subs, or sign recruits. They play full seasons through the real store.
 *
 * What this gates: no persona may be unplayable (folding every run, ppg on the
 * floor), and no persona may dominate — if "always spend" or "never engage"
 * strictly beats everything else, the decisions the mode is built around are
 * fake. Bands are wide; this is a tripwire, not a leaderboard.
 */
import { describe, it, expect } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { sundaySeasonWeeks } from '@/utils/sunday/season';

interface Persona {
  name: string;
  /** Which event choice to take, by position. */
  choice: 'first' | 'last' | 'rotate';
  hireRingers: boolean;
  fundraise: boolean;
  chaseSubs: boolean;
  signRecruits: boolean;
}

const PERSONAS: Persona[] = [
  { name: 'casual', choice: 'first', hireRingers: false, fundraise: false, chaseSubs: false, signRecruits: false },
  { name: 'optimizer', choice: 'first', hireRingers: true, fundraise: true, chaseSubs: true, signRecruits: true },
  { name: 'chaos', choice: 'rotate', hireRingers: true, fundraise: false, chaseSubs: false, signRecruits: true },
  { name: 'survivalist', choice: 'last', hireRingers: false, fundraise: true, chaseSubs: true, signRecruits: false },
  { name: 'roleplayer', choice: 'last', hireRingers: true, fundraise: false, chaseSubs: false, signRecruits: true },
];

async function playSeason(persona: Persona, seed: number) {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed });
  const total = sundaySeasonWeeks('sun-4');
  for (let i = 0; i < total + 2; i++) {
    const s = useGameStore.getState();
    if (s.sunday!.folded || s.sunday!.seasonComplete) break;

    const pending = s.sunday!.pendingEvent;
    if (pending) {
      const idx = persona.choice === 'first' ? 0
        : persona.choice === 'last' ? pending.choices.length - 1
          : s.week % pending.choices.length;
      await s.resolveSundayEvent(pending.choices[idx].id);
    }
    for (const o of useGameStore.getState().sunday!.sponsorOffers) {
      await useGameStore.getState().acceptSundaySponsor(o.id);
    }
    if (persona.fundraise && useGameStore.getState().sunday!.balance < 150) {
      await useGameStore.getState().runSundayFundraiser();
    }
    if (persona.chaseSubs) await useGameStore.getState().chaseSundaySubs();
    if (persona.signRecruits) {
      const st = useGameStore.getState().sunday!;
      const r = st.recruits[0];
      if (r && st.squad.length < 18 && st.balance > r.fee + 120) {
        await useGameStore.getState().signSundayRecruit(r.id);
      }
    }
    // The arrival decision, when the morning offers one.
    const arrival = await useGameStore.getState().arriveSundayMatch();
    if (arrival && arrival.optionalRingers > 0 && arrival.ringersHired === null) {
      await useGameStore.getState().hireSundayRingers(persona.hireRingers ? arrival.optionalRingers : 0);
    }
    await useGameStore.getState().advanceWeek();
  }
  const s = useGameStore.getState();
  const st = s.sunday!.seasonStats;
  return {
    folded: s.sunday!.folded,
    ppg: (st.won * 3 + st.drawn) / Math.max(1, st.played),
    balance: s.sunday!.balance,
  };
}

describe('player personas', () => {
  it('every persona is playable and none dominates', async () => {
    const results = new Map<string, { ppg: number; folded: number; balance: number }>();
    for (const persona of PERSONAS) {
      let ppg = 0, folded = 0, balance = 0;
      const seeds = [71, 72, 73];
      for (const seed of seeds) {
        const r = await playSeason(persona, seed);
        ppg += r.ppg; balance += r.balance;
        if (r.folded) folded++;
      }
      results.set(persona.name, { ppg: ppg / seeds.length, folded, balance: balance / seeds.length });
    }
    const detail = [...results.entries()]
      .map(([k, v]) => `${k}: ppg=${v.ppg.toFixed(2)} folded=${v.folded}/3 bal=${Math.round(v.balance)}`)
      .join(' | ');

    for (const [name, r] of results) {
      // Playable: not folding every run, not pointless.
      expect(r.folded, `${name} folds constantly — ${detail}`).toBeLessThanOrEqual(1);
      expect(r.ppg, `${name} cannot win a game — ${detail}`).toBeGreaterThan(0.3);
    }
    // No dominant strategy: best and worst persona within a sane band.
    const ppgs = [...results.values()].map(r => r.ppg);
    expect(Math.max(...ppgs) - Math.min(...ppgs), detail).toBeLessThan(1.2);
  }, 600_000);
});
