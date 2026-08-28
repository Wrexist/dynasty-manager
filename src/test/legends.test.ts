import { describe, it, expect } from 'vitest';
import type { Player, RetiredLegend } from '@/types/game';
import { SEED_LEGENDS } from '@/data/legends';
import {
  isLegendWorthy,
  buildRetiredLegend,
  addLegendToArchive,
  drawLegend,
  buildPlayerFromLegend,
} from '@/utils/legends';
import { generatePackContents } from '@/utils/packGeneration';
import { generatePlayer, calculateOverall } from '@/utils/playerGen';
import {
  LEGEND_MIN_PEAK_OVR,
  LEGEND_MIN_PEAK_OVR_WITH_BALLON_DOR,
  LEGEND_ARCHIVE_CAP,
  LEGEND_CARD_AGE,
  FORCED_RETIREMENT_AGE,
} from '@/config/gameBalance';
import { PACK_TIERS, PACK_TIER_MAP, packLegendChance, PACK_CARD_FRAMES } from '@/config/packs';
import { getNationalPoolSync, loadNationalPool } from '@/data/nationalPlayerPoolAccess';
import { migrateSaveData } from '@/utils/saveMigration';

function mkRetiree(over: Partial<Player> = {}): Player {
  const p = generatePlayer('ST', 78, 'club-x', 12);
  return {
    ...p,
    age: FORCED_RETIREMENT_AGE,
    overall: 74,
    peakOverall: 94,
    careerGoals: 300,
    careerAssists: 90,
    careerAppearances: 600,
    goals: 4, assists: 1, appearances: 20,
    joinedSeason: 3,
    ...over,
  };
}

describe('Hall of Legends — eligibility', () => {
  it('archives a 93+ peak outright, with or without Ballon d\'Or pedigree', () => {
    expect(isLegendWorthy({ overall: 70, peakOverall: LEGEND_MIN_PEAK_OVR })).toBe(true);
    expect(isLegendWorthy({ overall: 70, peakOverall: LEGEND_MIN_PEAK_OVR, ballonDorTop10Ever: false })).toBe(true);
  });

  it('archives a 90+ peak only with Ballon d\'Or pedigree', () => {
    expect(isLegendWorthy({ overall: 70, peakOverall: LEGEND_MIN_PEAK_OVR_WITH_BALLON_DOR, ballonDorTop10Ever: true })).toBe(true);
    expect(isLegendWorthy({ overall: 70, peakOverall: LEGEND_MIN_PEAK_OVR_WITH_BALLON_DOR })).toBe(false);
    expect(isLegendWorthy({ overall: 70, peakOverall: LEGEND_MIN_PEAK_OVR_WITH_BALLON_DOR - 1, ballonDorTop10Ever: true })).toBe(false);
  });

  it('judges peak, never final overall — a declined great still qualifies', () => {
    // The whole point: at 40 the overall is long gone, the peak is not.
    expect(isLegendWorthy({ overall: 68, peakOverall: 94 })).toBe(true);
    expect(isLegendWorthy({ overall: 94, peakOverall: undefined })).toBe(true); // absent peak reads as current
  });
});

describe('Hall of Legends — archive record', () => {
  it('freezes the retiree at his peak with attributes rescaled to match', () => {
    const p = mkRetiree();
    const legend = buildRetiredLegend(p, 15, 'Arsenal');
    expect(legend.peakOverall).toBe(94);
    expect(legend.source).toBe('career');
    expect(legend.id).toBe(`legend-${p.id}`);
    expect(legend.retiredSeason).toBe(15);
    expect(legend.era).toContain('Arsenal');
    // Attributes were scaled UP from the declined shape toward the peak.
    const ratio = 94 / 74;
    for (const key of Object.keys(p.attributes) as (keyof Player['attributes'])[]) {
      expect(legend.attributes[key]).toBeGreaterThanOrEqual(p.attributes[key]);
      expect(legend.attributes[key]).toBeLessThanOrEqual(Math.min(99, Math.ceil(p.attributes[key] * ratio)));
    }
    // Career totals fold in the final season's live stats.
    expect(legend.careerGoals).toBe(304);
    expect(legend.careerApps).toBe(620);
  });

  it('is idempotent per player and caps the archive keeping the best', () => {
    const a = buildRetiredLegend(mkRetiree({ id: 'p-a' }), 10);
    let archive = addLegendToArchive([], a);
    expect(addLegendToArchive(archive, a)).toBe(archive); // same reference — no-op

    // Fill to cap with 90-peaks, then a 95 must displace one, a 89 must not.
    archive = [];
    for (let i = 0; i < LEGEND_ARCHIVE_CAP; i++) {
      archive = addLegendToArchive(archive, buildRetiredLegend(mkRetiree({ id: `p-${i}`, peakOverall: 90 }), 10));
    }
    expect(archive.length).toBe(LEGEND_ARCHIVE_CAP);
    const big = buildRetiredLegend(mkRetiree({ id: 'p-big', peakOverall: 95 }), 11);
    const after = addLegendToArchive(archive, big);
    expect(after.length).toBe(LEGEND_ARCHIVE_CAP);
    expect(after.some(l => l.id === 'legend-p-big')).toBe(true);
    const small = buildRetiredLegend(mkRetiree({ id: 'p-small', peakOverall: 89 }), 11);
    expect(addLegendToArchive(after, small)).toBe(after);
  });
});

describe('Hall of Legends — career-card fidelity', () => {
  it('a deep-declined retiree\'s record never prints a rating its attributes cannot play', () => {
    // The audit's measured failure: peak 94 from a 72 final shape derived at
    // 91 after one blind ratio pass, so the card printed 94 and played 91.
    // The build now converges iteratively and, where saturation stops the
    // climb, prints what the attributes support instead.
    for (const [finalOvr, peak] of [[72, 94], [66, 95], [84, 94], [70, 93]] as const) {
      const p = mkRetiree({ overall: finalOvr, peakOverall: peak });
      const legend = buildRetiredLegend(p, 12);
      const derived = calculateOverall(legend.attributes, legend.position);
      expect(Math.abs(derived - legend.peakOverall),
        `final ${finalOvr} / peak ${peak}: printed ${legend.peakOverall}, plays ${derived}`)
        .toBeLessThanOrEqual(1);
      expect(legend.peakOverall).toBeLessThanOrEqual(peak);
    }
  });

  it('captures alternate positions both into the record and back onto the card', () => {
    const p = mkRetiree({ alternatePositions: ['CAM', 'LW'] });
    const legend = buildRetiredLegend(p, 12);
    expect(legend.altPos).toEqual(['CAM', 'LW']);
    const card = buildPlayerFromLegend(legend, 5);
    expect(card.alternatePositions).toEqual(['CAM', 'LW']);
  });
});

describe('Hall of Legends — seed set integrity', () => {
  it('has unique ids and card-worthy ratings (88–95)', () => {
    const ids = new Set(SEED_LEGENDS.map(l => l.id));
    expect(ids.size).toBe(SEED_LEGENDS.length);
    for (const l of SEED_LEGENDS) {
      expect(l.source).toBe('seed');
      expect(l.peakOverall).toBeGreaterThanOrEqual(88);
      expect(l.peakOverall).toBeLessThanOrEqual(95);
      expect(l.retiredSeason).toBeNull();
      expect(l.era.length).toBeGreaterThan(20);
    }
  });

  it('attributes broadly justify the printed rating for the position', () => {
    // The match engine reads attributes, not overall — a 94 card whose derived
    // overall is 78 would play like a 78 and read as a scam. ±8 window.
    for (const l of SEED_LEGENDS) {
      const derived = calculateOverall(l.attributes, l.position);
      expect(Math.abs(derived - l.peakOverall), `${l.lastName} (${l.position}) derived ${derived} vs ${l.peakOverall}`).toBeLessThanOrEqual(8);
    }
  });

  it('never uses a real player\'s name — seeds are fictional by legal necessity', async () => {
    await loadNationalPool();
    const realNames = new Set<string>();
    for (const pool of Object.values(getNationalPoolSync())) {
      for (const t of pool) realNames.add(`${t.fn.toLowerCase()}|${t.ln.toLowerCase()}`);
    }
    for (const l of SEED_LEGENDS) {
      expect(realNames.has(`${l.firstName.toLowerCase()}|${l.lastName.toLowerCase()}`),
        `${l.firstName} ${l.lastName} collides with a real player`).toBe(false);
    }
  });
});

describe('Hall of Legends — the card', () => {
  it('mints at the legend\'s own peak, prime age, legends frame, pack wage discount', () => {
    const legend = SEED_LEGENDS[0];
    const card = buildPlayerFromLegend(legend, 5);
    expect(card.overall).toBe(legend.peakOverall);
    expect(card.potential).toBe(legend.peakOverall);
    expect(card.age).toBe(LEGEND_CARD_AGE);
    expect(card.age).toBeLessThan(FORCED_RETIREMENT_AGE - 5); // never an instant deletion
    expect(card.legendId).toBe(legend.id);
    expect(card.packFrame).toBe('legends');
    expect(PACK_CARD_FRAMES[card.packFrame!]).toBeTruthy(); // frame resolves to real art
    expect(card.wageFactor).toBeDefined();
    expect(card.attributes).toEqual(legend.attributes);
    expect(card.firstName).toBe(legend.firstName);
    expect(card.nationality).toBe(legend.nationality);
    expect(card.clubId).toBe('');
  });

  it('drawLegend prefers the save\'s own archive at the configured bias', () => {
    const own = buildRetiredLegend(mkRetiree({ id: 'own-1' }), 9);
    // rand < bias → archive; rand >= bias → seeds. Inject both branches.
    expect(drawLegend([own], () => 0).id).toBe('legend-own-1');
    expect(drawLegend([own], () => 0.99).source).toBe('seed');
    // Empty archive always seeds.
    expect(drawLegend([], () => 0).source).toBe('seed');
  });
});

describe('Hall of Legends — packs', () => {
  it('the ladder is monotone and only the three serious paid tiers carry it', () => {
    expect(packLegendChance('daily')).toBe(0);
    expect(packLegendChance('gold')).toBe(0);
    expect(packLegendChance('premium')).toBeGreaterThan(0);
    expect(packLegendChance('rare')).toBeGreaterThan(packLegendChance('premium'));
    expect(packLegendChance('icon')).toBeGreaterThan(packLegendChance('rare'));
    // Disclosure duty: any tier with a chance is a paid tier.
    for (const t of PACK_TIERS) {
      if ((t.legendChance ?? 0) > 0) expect(t.productId).toBeTruthy();
    }
  });

  it('a forced legend roll deals a hall card in the guaranteed slot', () => {
    const own = buildRetiredLegend(mkRetiree({ id: 'own-2' }), 9);
    const players = generatePackContents('icon', 5, { forceLegendRoll: true, legendArchive: [own] });
    expect(players.length).toBe(1);
    const card = players[0];
    expect(card.legendId).toBeTruthy();
    expect(card.packFrame).toBe('legends');
    // Issued at the legend's own peak — the Legends tier's +4 must NOT stack.
    const pool: RetiredLegend[] = [...SEED_LEGENDS, own];
    const source = pool.find(l => l.id === card.legendId)!;
    expect(source).toBeTruthy();
    expect(card.overall).toBe(source.peakOverall);
    // Always satisfies the tier's guaranteed floor.
    expect(card.overall).toBeGreaterThanOrEqual(PACK_TIER_MAP.icon.guaranteedMinOvr);
  });

  it('a forced-off roll never deals a legend, whatever the config chance', () => {
    for (let i = 0; i < 10; i++) {
      const players = generatePackContents('icon', 5, { forceLegendRoll: false });
      expect(players.every(p => !p.legendId)).toBe(true);
    }
  });

  it('a legend deal is allowed on a pity open and over-delivers its promise', () => {
    // Suppressing the roll under pity made the flat disclosed chance false
    // for exactly the users pity compensates. Every legend is 88+, above the
    // pity floor, so the deal satisfies the pity promise by construction.
    const players = generatePackContents('icon', 5, { pityTriggered: true, forceLegendRoll: true });
    expect(players[0].legendId).toBeTruthy();
    expect(players[0].overall).toBeGreaterThanOrEqual(88);
  });

  it('multi-card packs keep their full card count when the legend fires', () => {
    const players = generatePackContents('premium', 5, { forceLegendRoll: true });
    expect(players.length).toBe(PACK_TIER_MAP.premium.cards);
    expect(players.filter(p => p.legendId).length).toBe(1);
  });
});

describe('Hall of Legends — save migration', () => {
  it('v91 saves gain an empty archive and land on v92', () => {
    const migrated = migrateSaveData({ version: 91, players: {}, clubs: {} } as Record<string, unknown>);
    expect((migrated as { version: number }).version).toBeGreaterThanOrEqual(92);
    expect((migrated as { retiredLegends: unknown[] }).retiredLegends).toEqual([]);
  });
});
