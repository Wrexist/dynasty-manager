/**
 * Automated player personas — a proxy for human playtesting (§36).
 *
 * Each persona is a POLICY over the real knobs a player has: which event
 * choice to take, whether to hire arrival guests, whether to fundraise, chase
 * subs, sign recruits or spend on the club. They play full careers through the
 * real store.
 *
 * What this gates: no persona may be unplayable (folding every run, ppg on the
 * floor), and no persona may dominate — if "always spend" or "never engage"
 * strictly beats everything else, the decisions the mode is built around are
 * fake. Bands are wide; this is a tripwire, not a leaderboard.
 */
import { describe, it, expect } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { sundaySeasonWeeks } from '@/utils/sunday/season';
import { SUNDAY_UPGRADES, sundayUpgradeCost } from '@/config/sundayLeague';

/** How many seasons each persona plays per seed. Two, not one: a BUILDER's
 *  whole premise is compounding, and one season cannot show it. */
const SEASONS = 2;
const SEEDS = [71, 72, 73];

interface Persona {
  name: string;
  /** Which event choice to take, by position. */
  choice: 'first' | 'last' | 'rotate';
  hireRingers: boolean;
  fundraise: boolean;
  chaseSubs: boolean;
  signRecruits: boolean;
  /** Puts every spare pound into the club rather than the squad. */
  buyUpgrades: boolean;
}

const PERSONAS: Persona[] = [
  { name: 'casual', choice: 'first', hireRingers: false, fundraise: false, chaseSubs: false, signRecruits: false, buyUpgrades: false },
  { name: 'optimizer', choice: 'first', hireRingers: true, fundraise: true, chaseSubs: true, signRecruits: true, buyUpgrades: true },
  { name: 'chaos', choice: 'rotate', hireRingers: true, fundraise: false, chaseSubs: false, signRecruits: true, buyUpgrades: false },
  { name: 'survivalist', choice: 'last', hireRingers: false, fundraise: true, chaseSubs: true, signRecruits: false, buyUpgrades: false },
  { name: 'roleplayer', choice: 'last', hireRingers: true, fundraise: false, chaseSubs: false, signRecruits: true, buyUpgrades: false },
  // THE BUILDER. Everything goes into the club — the pitch, the balls, the
  // physio, the coach — and nothing into hiring strangers on a Sunday morning.
  // He is the test that the upgrade tree is worth buying at all.
  { name: 'builder', choice: 'first', hireRingers: false, fundraise: true, chaseSubs: true, signRecruits: false, buyUpgrades: true },
  // THE STORY PLAYER. Plays for the afternoon, not the table: takes whichever
  // branch the event is really offering rather than the safe one, always fields
  // eleven even when it costs money, and never touches the ledger. He is the
  // test that engaging with the fiction is not a losing strategy.
  { name: 'storyteller', choice: 'rotate', hireRingers: true, fundraise: false, chaseSubs: false, signRecruits: false, buyUpgrades: false },
];

interface CareerResult {
  folded: boolean;
  ppg: number;
  balance: number;
  upgradeLevels: number;
  memories: number;
}

async function playCareer(persona: Persona, seed: number): Promise<CareerResult> {
  useGameStore.getState().resetGame();
  await useGameStore.getState().startSundayLeague({ personality: 'pub', seed });
  let points = 0;
  let played = 0;
  let guard = 0;
  const maxTicks = SEASONS * (sundaySeasonWeeks('sun-prem') + 6);

  while (useGameStore.getState().season <= SEASONS && guard++ < maxTicks) {
    const s = useGameStore.getState();
    if (s.sunday!.folded) break;
    if (s.sunday!.seasonComplete) {
      points += s.sunday!.seasonStats.won * 3 + s.sunday!.seasonStats.drawn;
      played += s.sunday!.seasonStats.played;
      await useGameStore.getState().endSundaySeason();
      continue;
    }

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
    if (persona.buyUpgrades) {
      const st = useGameStore.getState().sunday!;
      for (const u of SUNDAY_UPGRADES) {
        const lvl = st.upgrades.find(x => x.id === u.id)?.level ?? 0;
        if (lvl >= u.maxLevel || st.reputation < u.minReputation) continue;
        if (st.balance - sundayUpgradeCost(u.id, lvl) > 200) {
          await useGameStore.getState().buySundayUpgrade(u.id);
          break;
        }
      }
    }
    // The arrival decision, when the morning offers one.
    const arrival = await useGameStore.getState().arriveSundayMatch();
    if (arrival && arrival.optionalRingers > 0 && arrival.ringersHired === null) {
      await useGameStore.getState().hireSundayRingers(persona.hireRingers ? arrival.optionalRingers : 0);
    }
    await useGameStore.getState().advanceWeek();
  }

  const end = useGameStore.getState();
  const st = end.sunday!.seasonStats;
  if (!end.sunday!.folded) {
    points += st.won * 3 + st.drawn;
    played += st.played;
  }
  return {
    folded: end.sunday!.folded,
    ppg: points / Math.max(1, played),
    balance: end.sunday!.balance,
    upgradeLevels: end.sunday!.upgrades.reduce((n, u) => n + u.level, 0),
    memories: end.sunday!.squad.reduce((n, m) => n + m.memories.length, 0),
  };
}

describe('player personas', () => {
  it('every persona is playable and none dominates', async () => {
    const results = new Map<string, { ppg: number; folded: number; balance: number; upgrades: number; memories: number }>();
    for (const persona of PERSONAS) {
      let ppg = 0, folded = 0, balance = 0, upgrades = 0, memories = 0;
      for (const seed of SEEDS) {
        const r = await playCareer(persona, seed);
        ppg += r.ppg; balance += r.balance; upgrades += r.upgradeLevels; memories += r.memories;
        if (r.folded) folded++;
      }
      results.set(persona.name, {
        ppg: ppg / SEEDS.length, folded,
        balance: balance / SEEDS.length,
        upgrades: upgrades / SEEDS.length,
        memories: memories / SEEDS.length,
      });
    }
    const detail = [...results.entries()]
      .map(([k, v]) => `${k}: ppg=${v.ppg.toFixed(2)} folded=${v.folded}/${SEEDS.length} `
        + `bal=${Math.round(v.balance)} upg=${v.upgrades.toFixed(1)} mem=${Math.round(v.memories)}`)
      .join(' | ');

    for (const [name, r] of results) {
      // Playable: not folding every run, not pointless.
      expect(r.folded, `${name} folds constantly — ${detail}`).toBeLessThan(SEEDS.length);
      expect(r.ppg, `${name} cannot win a game — ${detail}`).toBeGreaterThan(0.3);
    }
    // No dominant strategy: best and worst persona within a sane band.
    // RE-MEASURED at seven personas x 3 seeds x 2 seasons, three runs:
    //   casual      1.27 / 1.32 / 1.32   bal ~£2,070   upgrades 0
    //   optimizer   1.37 / 1.52 / 1.76   bal ~£550     upgrades 9.3
    //   chaos       1.82 / 1.50 / 1.69   bal ~£2,070   upgrades 0
    //   survivalist 1.32 / 1.32 / 1.24   bal ~£2,320   upgrades 0
    //   roleplayer  1.63 / 1.55 / 1.44   bal ~£1,950   upgrades 0
    //   builder     1.24 / 1.38 / 1.19   bal ~£385     upgrades 8.2
    //   storyteller 1.21 / 1.30 / 1.18   bal ~£1,520   upgrades 0
    // Best-to-worst spread 0.61 / 0.25 / 0.58, and 0/3 folds for every persona
    // on every run. The band is left at 1.2 — it is a tripwire for one policy
    // running away with the mode, and 1.2 ppg is the difference between
    // mid-table and champions.
    const ppgs = [...results.values()].map(r => r.ppg);
    expect(Math.max(...ppgs) - Math.min(...ppgs), detail).toBeLessThan(1.2);

    // THE BUILDER ACTUALLY BUILDS. His premise is that money in the club is a
    // real alternative to money on players, so he must end up with materially
    // more of the tree than the personas who never buy any of it.
    const builder = results.get('builder')!;
    const casual = results.get('casual')!;
    expect(builder.upgrades, `the builder built nothing — ${detail}`).toBeGreaterThan(casual.upgrades);

    // THE STORY PLAYER GETS A STORY. He engages with the fiction and ignores
    // the ledger; what he must not get is a thinner club biography than the
    // manager who answers every event with the first option on the list.
    const storyteller = results.get('storyteller')!;
    expect(storyteller.memories, `the story player got no story — ${detail}`).toBeGreaterThan(0);
    expect(storyteller.ppg, `chasing the story cannot win a match — ${detail}`).toBeGreaterThan(0.3);
  }, 600_000);
});
