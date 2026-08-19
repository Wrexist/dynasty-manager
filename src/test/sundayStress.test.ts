/**
 * Sunday League stress harness — the mandatory "can I run many seasons without
 * corrupting state" test.
 *
 * Plays whole careers on auto-pilot across a spread of seeds and club
 * personalities, validating EVERY invariant after EVERY week. The pilot is not
 * passive: it answers events, signs recruits, accepts sponsors, buys upgrades
 * and fundraises, because an idle manager exercises a fraction of the state
 * machine. A failure names the seed, season and week, so any regression is
 * reproducible from the message alone.
 */
import { describe, it, expect } from 'vitest';
import { useGameStore } from '@/store/gameStore';
import { validateSundayState } from '@/utils/sunday/invariants';
import { sundaySeasonWeeks } from '@/utils/sunday/season';
import {
  SUNDAY_DIVISIONS, SUNDAY_FORMER_TEAMMATES_MAX, SUNDAY_LEGENDS_MAX, SUNDAY_MAX_FRIENDS,
  SUNDAY_MAX_RIVALS, SUNDAY_MAX_SQUAD, SUNDAY_MEMORIES_MAX, SUNDAY_RECORDS_MAX,
  SUNDAY_STATE_VERSION, SUNDAY_UPGRADES, getSundayUpgrade, sundayUpgradeCost,
} from '@/config/sundayLeague';
import type { SundayClubPersonalityId } from '@/types/game';

const SEASONS_PER_RUN = 4;
const RUNS: { seed: number; personality: SundayClubPersonalityId }[] = [
  { seed: 101, personality: 'pub' },
  { seed: 102, personality: 'washed' },
  { seed: 103, personality: 'chaos' },
  { seed: 104, personality: 'eleven' },
  { seed: 105, personality: 'serious' },
  { seed: 106, personality: 'youth' },
  { seed: 107, personality: 'moneyball' },
  { seed: 108, personality: 'family' },
];

function validateOrThrow(tag: string) {
  const s = useGameStore.getState();
  const result = validateSundayState({
    sunday: s.sunday!, players: s.players, clubs: s.clubs,
    playerClubId: s.playerClubId, fixtures: s.fixtures, week: s.week,
  });
  if (!result.ok) {
    throw new Error(`[${tag}] invariants violated:\n  - ${result.problems.join('\n  - ')}`);
  }
  // Cross-cutting sanity the validator does not own: nothing anywhere may be
  // NaN or negative where negativity is impossible.
  const sunday = s.sunday!;
  if (!Number.isFinite(sunday.balance)) throw new Error(`[${tag}] balance is ${sunday.balance}`);
  for (const p of Object.values(s.players)) {
    if (!Number.isFinite(p.overall) || p.overall < 1) throw new Error(`[${tag}] ${p.id} overall ${p.overall}`);
    if (p.goals < 0 || p.appearances < 0) throw new Error(`[${tag}] ${p.id} negative stats`);
  }
}

/**
 * Every collection that grows with time, checked against the bound that is
 * supposed to hold it.
 *
 * The decade run is the only place a leak is visible: each of these is fed once
 * a week or once a season, so a missing `.slice()` looks like nothing at all
 * over four seasons and like an unloadable save over ten. The Sunday state is
 * serialised into the save slot whole, so unbounded growth here is not a memory
 * problem, it is a save-corruption problem.
 */
function boundedOrThrow(tag: string) {
  const s = useGameStore.getState();
  const sunday = s.sunday!;
  const fail = (what: string) => { throw new Error(`[${tag}] ${what}`); };

  if (sunday.v !== SUNDAY_STATE_VERSION) fail(`state version drifted to ${sunday.v}`);
  if (sunday.ledger.length > 60) fail(`ledger has ${sunday.ledger.length} weeks`);
  if (sunday.eventLog.length > 60) fail(`eventLog has ${sunday.eventLog.length} entries`);
  if (sunday.weekLog.length > 14) fail(`weekLog has ${sunday.weekLog.length} lines`);
  if (sunday.records.length > SUNDAY_RECORDS_MAX) fail(`records has ${sunday.records.length} entries`);
  if (sunday.legends.length > SUNDAY_LEGENDS_MAX) fail(`legends has ${sunday.legends.length} entries`);
  if (sunday.squad.length > SUNDAY_MAX_SQUAD) fail(`squad has ${sunday.squad.length}`);
  // At most one player story and one club story, forever — the cap that stops
  // the mode telling four tangled stories about the same fortnight.
  if (sunday.chains.length > 2) fail(`chains has ${sunday.chains.length} live stories`);
  if (s.messages.length > 100) fail(`inbox has ${s.messages.length} messages`);

  for (const m of sunday.squad) {
    if (m.memories.length > SUNDAY_MEMORIES_MAX) fail(`${m.playerId} carries ${m.memories.length} memories`);
    if (m.friends.length > SUNDAY_MAX_FRIENDS) fail(`${m.playerId} has ${m.friends.length} friends`);
    if (m.rivals.length > SUNDAY_MAX_RIVALS) fail(`${m.playerId} has ${m.rivals.length} rivals`);
    if (m.formerTeammates.length > SUNDAY_FORMER_TEAMMATES_MAX) {
      fail(`${m.playerId} remembers ${m.formerTeammates.length} former team-mates`);
    }
    // `appsWith` is pruned to the live squad on every departure, so it is
    // bounded by squad size and not by career length. Ten seasons is where
    // the difference between those two shows up.
    const appsWith = Object.keys(m.appsWith ?? {});
    if (appsWith.length > SUNDAY_MAX_SQUAD) fail(`${m.playerId} has ${appsWith.length} appsWith entries`);
    const liveIds = new Set(sunday.squad.map(x => x.playerId));
    for (const id of appsWith) {
      if (!liveIds.has(id)) fail(`${m.playerId} still counts afternoons with the departed ${id}`);
    }
  }
  // ...and the whole thing still fits in a save slot without anybody noticing.
  const bytes = JSON.stringify(sunday).length;
  if (bytes > 120_000) fail(`sunday state serialises to ${bytes} bytes`);
}

/** One week of a manager who is paying attention. */
async function pilotWeek() {
  const store = useGameStore.getState();
  const sunday = store.sunday!;

  if (sunday.pendingEvent) {
    // Rotate through choices across weeks so every branch gets exercised.
    const pick = sunday.pendingEvent.choices[store.week % sunday.pendingEvent.choices.length];
    await store.resolveSundayEvent(pick.id);
  }
  for (const offer of useGameStore.getState().sunday!.sponsorOffers) {
    await useGameStore.getState().acceptSundaySponsor(offer.id);
  }
  const s1 = useGameStore.getState().sunday!;
  if (s1.recruits.length && s1.squad.length < 18 && s1.balance > s1.recruits[0].fee + 150) {
    await useGameStore.getState().signSundayRecruit(s1.recruits[0].id);
  }
  if (useGameStore.getState().sunday!.balance < 120) {
    await useGameStore.getState().runSundayFundraiser();
  }
  const s2 = useGameStore.getState().sunday!;
  for (const u of SUNDAY_UPGRADES) {
    const lvl = s2.upgrades.find(x => x.id === u.id)?.level ?? 0;
    if (lvl >= getSundayUpgrade(u.id).maxLevel) continue;
    const cost = sundayUpgradeCost(u.id, lvl);
    if (s2.balance - cost > 250 && s2.reputation >= u.minReputation) {
      await useGameStore.getState().buySundayUpgrade(u.id);
      break;
    }
  }
  // Half the time pick the team by hand (auto), half the time let the advance
  // pick it — both paths must stay valid.
  if (useGameStore.getState().week % 2 === 0) {
    await useGameStore.getState().autoPickSundayTeamsheet();
  }
  await useGameStore.getState().advanceWeek();
}

describe('sunday stress harness', () => {
  it('survives whole careers across seeds and personalities with invariants intact', async () => {
    const outcomes: string[] = [];
    for (const run of RUNS) {
      useGameStore.getState().resetGame();
      await useGameStore.getState().startSundayLeague({ personality: run.personality, seed: run.seed });
      validateOrThrow(`seed ${run.seed} boot`);

      let season = 1;
      let guard = 0;
      const maxTicks = SEASONS_PER_RUN * (sundaySeasonWeeks('sun-prem') + 6);
      while (season <= SEASONS_PER_RUN && guard++ < maxTicks) {
        const s = useGameStore.getState();
        if (s.sunday!.folded) break;
        if (s.sunday!.seasonComplete) {
          await useGameStore.getState().endSundaySeason();
          validateOrThrow(`seed ${run.seed} rollover into season ${season + 1}`);
          season = useGameStore.getState().season;
          continue;
        }
        await pilotWeek();
        const after = useGameStore.getState();
        validateOrThrow(`seed ${run.seed} season ${after.season} week ${after.week}`);
      }
      expect(guard, `seed ${run.seed} hit the tick guard — a season is not terminating`).toBeLessThan(maxTicks);

      const end = useGameStore.getState();
      const sunday = end.sunday!;
      outcomes.push(
        `seed ${run.seed} (${run.personality}): seasons=${end.season} div=${sunday.divisionId} ` +
        `folded=${sunday.folded} balance=${sunday.balance} squad=${sunday.squad.length} ` +
        `history=${sunday.history.length}`,
      );

      // A run that survived must have real history; a folded one must say why.
      if (sunday.folded) {
        expect(sunday.foldReason).toBeTruthy();
      } else {
        expect(end.season).toBe(SEASONS_PER_RUN + 1);
        expect(sunday.history).toHaveLength(SEASONS_PER_RUN);
        // The division must be one that exists.
        expect(SUNDAY_DIVISIONS.some(d => d.id === sunday.divisionId)).toBe(true);
        // History rows must be internally consistent.
        for (const h of sunday.history) {
          expect(h.played).toBe(h.won + h.drawn + h.lost);
          expect(h.points).toBe(h.won * 3 + h.drawn);
        }
      }
    }
    // Emergent-story check: across eight managed careers, at most a small
    // minority may fold. Active management is supposed to be enough.
    const folded = outcomes.filter(o => o.includes('folded=true')).length;
    expect(folded, outcomes.join('\n')).toBeLessThanOrEqual(2);
    // And the runs must not all tell the same story: divisions reached differ.
    const divisions = new Set(outcomes.map(o => /div=(\S+)/.exec(o)?.[1]));
    expect(divisions.size).toBeGreaterThan(1);
  }, 600_000);

  it('a decade in one save neither leaks memory into the save nor stalls', async () => {
    useGameStore.getState().resetGame();
    await useGameStore.getState().startSundayLeague({ personality: 'serious', seed: 999 });
    let guard = 0;
    /** Save slots the run has round-tripped through, with the season it did it. */
    const roundTrips: string[] = [];
    while (useGameStore.getState().season <= 10 && guard++ < 500) {
      const s = useGameStore.getState();
      if (s.sunday!.folded) break;
      if (s.sunday!.seasonComplete) {
        const season = s.season;
        await useGameStore.getState().endSundaySeason();
        // EVERY season boundary, not just the last one: an invariant that only
        // breaks in season seven is exactly what a decade test is for.
        validateOrThrow(`decade season ${season} rollover`);
        boundedOrThrow(`decade season ${season}`);
        // A save round trip at three points across the decade. The failure
        // this guards against is a save that grows a field it cannot read
        // back — silent until a player reloads in season nine.
        if (season === 3 || season === 7 || season === 10) {
          const before = JSON.stringify(useGameStore.getState().sunday);
          useGameStore.getState().saveGame(1);
          useGameStore.getState().flushSave();
          useGameStore.getState().resetGame(2);
          expect(useGameStore.getState().loadGame(1), `season ${season} would not load back`).toBe(true);
          expect(JSON.stringify(useGameStore.getState().sunday)).toBe(before);
          validateOrThrow(`decade season ${season} reload`);
          roundTrips.push(`S${season}`);
        }
        continue;
      }
      await pilotWeek();
    }
    const s = useGameStore.getState();
    if (s.sunday!.folded) return;
    expect(s.season).toBe(11);
    expect(roundTrips, 'the decade never round-tripped through a save slot').toEqual(['S3', 'S7', 'S10']);
    boundedOrThrow('decade end');

    // A ten-season veteran actually HAS a story — the spine is writing.
    const veteran = [...s.sunday!.squad].sort((a, b) => b.clubApps - a.clubApps)[0];
    if (veteran && veteran.clubApps > 30) {
      expect(veteran.memories.length).toBeGreaterThan(2);
    }
    // The world must not accumulate: one division of clubs, one squad of
    // players plus the opposition, nothing orphaned.
    expect(Object.keys(s.clubs).length).toBeLessThanOrEqual(12);
    const clubIds = new Set(Object.keys(s.clubs));
    for (const p of Object.values(s.players)) {
      expect(clubIds.has(p.clubId)).toBe(true);
    }
    validateOrThrow('decade run');
  }, 600_000);
});
