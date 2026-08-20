/**
 * Sunday League — one place the screens read from.
 *
 * WHY THIS EXISTS. The mode's screens were each doing their own joins: the
 * squad id→Player map with its own `filter(Boolean)`, its own availability
 * summary, its own weekly-burn arithmetic. Three copies of a join is three
 * chances for two screens to disagree about the same club, and the immersion
 * work multiplies the surfaces that have to agree. Every number below comes out
 * of the canonical helper that already owns it — `sundayPitchQuality`,
 * `summariseAvailability`, `sundayWeeklyBurn`, `sundayUpgradeUpkeep` — so this
 * file adds a shape, never an opinion.
 *
 * EVERYTHING HERE IS DERIVED. No new state, nothing persisted, no `t()`, no
 * React, no store access. Give it a `SundayState` and it gives back a plain
 * object. That is what keeps the screens logic-free, which is the project rule
 * these helpers exist to satisfy.
 *
 * ON IMPORTING FROM THE SLICE. `sundayPitchQuality` and `findSundayFixture` are
 * pure functions that happen to live in `store/slices/sunday/matchday.ts`. The
 * screens already import them from there; re-implementing either here to keep
 * this file's import list tidy would be exactly the divergence the file exists
 * to prevent.
 */
import type {
  Club, Match, Player, SundayMemory, SundaySponsorDeal, SundaySquadMember,
  SundayState, SundayTacticId, SundayUpgradeId,
} from '@/types/game';
import {
  SUNDAY_PERSONALITIES, SUNDAY_UPGRADES, SUNDAY_UPGRADE_MOTHBALL_REFUND,
  getSundayUpgrade, sundayUpgradeCost, sundayUpgradeMoraleBump,
  sundayUpgradeRepBump, type SundayPersonalityInfo,
} from '@/config/sundayLeague';
import type { SundayNewsKind } from '@/config/sundayIcons';
import { sundayPitchQuality } from '@/store/slices/sunday/matchday';
import { summariseAvailability } from './availability';
import { sundayUpgradeUpkeep, sundayWeeklyBurn } from './finance';
import { buildSundayTable } from './season';

// ── Club personalities ──────────────────────────────────────────────────────

/** The three things about a club personality that change how a season feels. */
export type SundayTraitId = 'ability' | 'turnout' | 'chaos';

export interface SundayPersonalityTrait {
  id: SundayTraitId;
  /** 1-5, ranked WITHIN the catalogue — see `sundayPersonalityTraits`. */
  pips: number;
}

/** Highest pip a trait can show. Exported so a renderer draws exactly as many
 *  empty pips as the scale has, rather than guessing. */
export const SUNDAY_TRAIT_PIPS = 5;

/**
 * Rank one personality's three modifiers against the whole catalogue.
 *
 * WHY RANKED AND NOT ABSOLUTE. `qualityMod` runs from -5 to +8 and
 * `varianceMult` from 0.8 to 1.5; neither is a 0-100 quantity, and inventing a
 * scale for them would mean inventing two magic constants that go stale the
 * moment somebody adds a ninth personality. The spread of the catalogue IS the
 * scale: 1 pip is the least of the eight, 5 is the most, and the numbers come
 * from `SUNDAY_PERSONALITIES` itself.
 *
 * WHY THESE THREE. They are the three modifiers a player can feel from the
 * first month — how good the squad is (`qualityMod`), whether it turns up
 * (`commitmentMod`), and how far results swing (`varianceMult`). The rest —
 * ego, morale, reputation, income — are real but second-order, and a card with
 * seven bars on it is a spec sheet, not a choice.
 *
 * NO GOOD/BAD TONE ANYWHERE. Chaos at 5 is not a warning and ability at 1 is
 * not a failure; they are styles. That is why the renderer draws pips in one
 * ink rather than the app's green/amber/red meter.
 */
export function sundayPersonalityTraits(
  personality: SundayPersonalityInfo,
): SundayPersonalityTrait[] {
  const rank = (values: readonly number[], value: number): number => {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    if (hi === lo) return Math.ceil(SUNDAY_TRAIT_PIPS / 2);
    return 1 + Math.round(((value - lo) / (hi - lo)) * (SUNDAY_TRAIT_PIPS - 1));
  };
  return [
    { id: 'ability', pips: rank(SUNDAY_PERSONALITIES.map(p => p.qualityMod), personality.qualityMod) },
    { id: 'turnout', pips: rank(SUNDAY_PERSONALITIES.map(p => p.commitmentMod), personality.commitmentMod) },
    { id: 'chaos', pips: rank(SUNDAY_PERSONALITIES.map(p => p.varianceMult), personality.varianceMult) },
  ];
}

// ── The squad, joined once ──────────────────────────────────────────────────

/** A squad member and the `Player` he is. Both halves, guaranteed present. */
export interface SundaySquadRow {
  member: SundaySquadMember;
  player: Player;
}

/**
 * The squad as rows, in squad order.
 *
 * `SundaySquadMember` holds only the Sunday half of a man; the football half
 * lives on the `Player` with the same id. Every screen needs both, and every
 * screen was doing this join itself — including the `filter(Boolean)` that a
 * dangling id makes mandatory (see the project's own gotcha list). Once, here.
 */
export function sundaySquadView(
  sunday: SundayState,
  players: Record<string, Player>,
): SundaySquadRow[] {
  const out: SundaySquadRow[] = [];
  for (const member of sunday.squad) {
    const player = players[member.playerId];
    if (player) out.push({ member, player });
  }
  return out;
}

/**
 * The moments a club actually retells about one man, heaviest first.
 *
 * `SundaySquadMember.memories` is written in the order things happened and
 * capped by weight elsewhere; a biography wants the opposite order — the
 * afternoon everyone remembers at the top, this Sunday's booking at the bottom.
 * Ties break on recency so two equally-weighted moments read newest-first.
 *
 * Here rather than in the card for the reason everything else in this file is
 * here: it is a derivation, the screens are renderers, and it is testable
 * without a DOM.
 */
export function sundayTopMemories(
  member: SundaySquadMember,
  limit: number,
): SundayMemory[] {
  return [...member.memories]
    .sort((a, b) => b.weight - a.weight || b.season - a.season || b.week - a.week)
    .slice(0, Math.max(0, limit));
}

// ── The club, in numbers ────────────────────────────────────────────────────

export interface SundayClubSummary {
  balance: number;
  /** 0-100, as the match engine sees it. */
  pitch: number;
  reputation: number;
  morale: number;
  squadSize: number;
  /** Definitely turning up. */
  available: number;
  /** Can be NAMED — available plus doubts. The teamsheet's number. */
  selectable: number;
  doubts: number;
  out: number;
  /** Weekly running cost with no fixture and no income. */
  burn: number;
  /** The share of that burn which is the standing cost of what the club owns. */
  upkeep: number;
}

/**
 * Every headline number about the club, from the helper that owns each one.
 *
 * `available` and `selectable` are BOTH here on purpose: they are two true
 * readings of the same squad and they differ by the doubts. A screen that
 * shows one beside a list built from the other is the bug this pair exists to
 * make impossible — see `isSundaySelectable`.
 */
export function sundayClubSummary(sunday: SundayState, week: number): SundayClubSummary {
  const avail = summariseAvailability(sunday.squad);
  return {
    balance: sunday.balance,
    pitch: sundayPitchQuality(sunday, week),
    reputation: sunday.reputation,
    morale: sunday.teamMorale,
    squadSize: sunday.squad.length,
    available: avail.available,
    selectable: avail.selectable,
    doubts: avail.doubts,
    out: avail.out,
    burn: sundayWeeklyBurn(sunday.divisionId, sunday.upgrades),
    upkeep: sundayUpgradeUpkeep(sunday.divisionId, sunday.upgrades),
  };
}

// ── The news feed ───────────────────────────────────────────────────────────

export interface SundayNewsEntry {
  kind: SundayNewsKind;
  /** English. Game data / narrative, never UI chrome — do not translate. */
  text: string;
  /** Where the save records one. Null for the two sources that carry no date;
   *  see the ordering rule on `sundayNewsFeed`. */
  season: number | null;
  week: number | null;
  /** The man it is about, when it is about one. */
  playerId?: string;
  /** Stable within one feed, so a list can key on it. */
  id: string;
}

/**
 * Everything that has happened lately, merged.
 *
 * DERIVED, not stored: five existing lists in `SundayState`, read and tagged.
 * Nothing is written anywhere to make this work.
 *
 * ORDERING, and why it is not one sort. Two of the five sources carry no date,
 * so pretending they can be interleaved with the three that do would mean
 * inventing timestamps:
 *
 *   1. `weekLog` — the week just closed. It needs no date because
 *      `advanceSundayWeek` REPLACES it every week (`buildWeekRecap`), so every
 *      line in it is from the most recent week by construction. Newest first.
 *   2. `eventLog`, `records` and squad `memories` — all three are stamped with
 *      a season and a week. Sorted by that, newest first.
 *   3. `rivalry.story` — a capped diary of the feud with no dates at all.
 *      Newest last in the array, so newest first here, and placed after the
 *      dated entries rather than guessed into them.
 *
 * `limit` caps the whole feed, applied after the merge.
 */
export function sundayNewsFeed(sunday: SundayState, limit = 20): SundayNewsEntry[] {
  const week: SundayNewsEntry[] = [...sunday.weekLog]
    .reverse()
    .map((text, i) => ({ kind: 'week' as const, text, season: null, week: null, id: `week-${i}` }));

  const dated: SundayNewsEntry[] = [];
  for (const e of sunday.eventLog) {
    dated.push({
      kind: 'event', text: e.summary, season: e.season, week: e.week,
      id: `event-${e.season}-${e.week}-${e.defId}`,
    });
  }
  for (const r of sunday.records) {
    dated.push({
      kind: 'record', text: `${r.label}: ${r.value}${r.detail ? ` — ${r.detail}` : ''}`,
      season: r.season, week: r.week, id: `record-${r.id}-${r.season}-${r.week}`,
    });
  }
  for (const m of sunday.squad) {
    for (const mem of m.memories) {
      dated.push({
        kind: 'memory', text: mem.text, season: mem.season, week: mem.week,
        playerId: m.playerId, id: `memory-${m.playerId}-${mem.season}-${mem.week}-${mem.kind}`,
      });
    }
  }
  dated.sort((a, b) => (b.season! - a.season!) || (b.week! - a.week!));

  const rivalry: SundayNewsEntry[] = sunday.rivalry
    ? [...sunday.rivalry.story].reverse().map((text, i) => ({
        kind: 'rivalry' as const, text, season: null, week: null, id: `rivalry-${i}`,
      }))
    : [];

  return [...week, ...dated, ...rivalry].slice(0, Math.max(0, limit));
}

// ── The opposition ──────────────────────────────────────────────────────────

export interface SundayOppositionCard {
  club: Club | null;
  /** How they play, when the save has recorded it. Held for the season, so a
   *  manager can learn a side — `divisionStyles` is written at world build and
   *  at each rollover. Null for a cup opponent from outside the division. */
  tactic: SundayTacticId | null;
  formation: string | null;
  /** Their place in the division table, or null if they are not in it. */
  position: number | null;
  /** Their last five, newest first. */
  form: ('W' | 'D' | 'L')[];
  played: number;
}

/**
 * Who you are playing, in the four things a manager actually wants to know.
 *
 * Reads `divisionStyles` DIRECTLY rather than through `sundayStyleOf`: the
 * fallback path in that helper re-derives a style from the club's nominal XI,
 * which needs the whole players map and is a decision the match makes, not a
 * thing a briefing card should assert. An absent entry honestly reads as
 * "no idea how they play" here.
 */
export function sundayOppositionCard(
  clubId: string,
  sunday: SundayState,
  clubs: Record<string, Club>,
  fixtures: readonly Match[],
): SundayOppositionCard {
  const club = clubs[clubId] ?? null;
  const table = buildSundayTable(fixtures, sunday.divisionClubIds);
  const idx = table.findIndex(r => r.clubId === clubId);
  const row = idx >= 0 ? table[idx] : null;

  const form: ('W' | 'D' | 'L')[] = [];
  const theirs = fixtures
    .filter(m => m.played && (m.homeClubId === clubId || m.awayClubId === clubId))
    .sort((a, b) => b.week - a.week);
  for (const m of theirs.slice(0, 5)) {
    const home = m.homeClubId === clubId;
    const us = home ? m.homeGoals : m.awayGoals;
    const them = home ? m.awayGoals : m.homeGoals;
    form.push(us > them ? 'W' : us === them ? 'D' : 'L');
  }

  const stored = sunday.divisionStyles?.[clubId];
  return {
    club,
    tactic: stored ?? null,
    formation: club?.formation ?? null,
    position: idx >= 0 ? idx + 1 : null,
    form,
    played: row?.played ?? theirs.length,
  };
}

// ── What happened elsewhere ─────────────────────────────────────────────────

export type SundayBuzzKind = 'upset' | 'heaviest' | 'streak' | 'leader';

export interface SundayLeagueBuzzEntry {
  kind: SundayBuzzKind;
  /** English. Game data / narrative, never UI chrome — do not translate.
   *  Same rule as `SundayNewsEntry.text`. */
  text: string;
  id: string;
}

/**
 * The rest of the division, in three lines.
 *
 * WHY. A Sunday league table is eight rows of numbers that move once a week,
 * and nothing on the League screen ever said that anything happened to anyone
 * else. The other seven clubs were a list of names the player's own results
 * pushed up and down.
 *
 * NOTHING HERE IS INVENTED. Every line is a statement about a fixture that was
 * actually played or a row that is actually in `buildSundayTable` — the same
 * table the season rollover judges promotion on. The player's own match is
 * excluded: he watched it.
 *
 * ON THE UPSET LINE'S TENSE. "Four places between them" is measured on the
 * table AS IT STANDS, after the result, which is why it is phrased in the
 * present. A gap that the result itself closed reads as no gap and is not
 * reported, which is the conservative direction to be wrong in.
 */
export function sundayLeagueBuzz(
  sunday: SundayState,
  clubs: Record<string, Club>,
  fixtures: readonly Match[],
  playerClubId: string,
  limit = 3,
): SundayLeagueBuzzEntry[] {
  const table = buildSundayTable(fixtures, sunday.divisionClubIds);
  const pos = new Map(table.map((r, i) => [r.clubId, i + 1]));
  const played = fixtures.filter(
    m => m.played && pos.has(m.homeClubId) && pos.has(m.awayClubId),
  );
  if (played.length === 0) return [];

  const latest = Math.max(...played.map(m => m.week));
  const elsewhere = played.filter(
    m => m.week === latest && m.homeClubId !== playerClubId && m.awayClubId !== playerClubId,
  );
  const name = (id: string) => clubs[id]?.shortName ?? id;
  const out: SundayLeagueBuzzEntry[] = [];

  // The upset: the biggest table gap a lower-placed side beat.
  let upset: { id: string; gap: number; won: string; lost: string; score: string } | null = null;
  let heaviest: { id: string; margin: number; won: string; lost: string; score: string } | null = null;
  for (const m of elsewhere) {
    if (m.homeGoals === m.awayGoals) continue;
    const homeWon = m.homeGoals > m.awayGoals;
    const won = homeWon ? m.homeClubId : m.awayClubId;
    const lost = homeWon ? m.awayClubId : m.homeClubId;
    const score = `${Math.max(m.homeGoals, m.awayGoals)}-${Math.min(m.homeGoals, m.awayGoals)}`;
    const gap = (pos.get(won) ?? 0) - (pos.get(lost) ?? 0);
    if (gap >= 3 && (!upset || gap > upset.gap)) upset = { id: m.id, gap, won, lost, score };
    const margin = Math.abs(m.homeGoals - m.awayGoals);
    if (margin >= 3 && (!heaviest || margin > heaviest.margin)) {
      heaviest = { id: m.id, margin, won, lost, score };
    }
  }
  if (upset) {
    out.push({
      kind: 'upset', id: `upset-${upset.id}`,
      text: `${name(upset.won)} beat ${name(upset.lost)} ${upset.score}. ${upset.gap} places between them.`,
    });
  }
  if (heaviest && heaviest.id !== upset?.id) {
    out.push({
      kind: 'heaviest', id: `heaviest-${heaviest.id}`,
      text: `${name(heaviest.won)} ${heaviest.score} ${name(heaviest.lost)}.`,
    });
  }

  // A run somebody else is on. `form` is chronological and capped at five.
  for (const row of table) {
    if (out.length >= limit) break;
    if (row.clubId === playerClubId) continue;
    let run = 0;
    for (let i = row.form.length - 1; i >= 0 && row.form[i] === 'W'; i--) run++;
    if (run >= 3) {
      out.push({
        kind: 'streak', id: `streak-${row.clubId}`,
        text: `${name(row.clubId)} have won ${run} in a row.`,
      });
      break;
    }
  }

  if (out.length < limit && table[0]?.played > 0) {
    out.push({
      kind: 'leader', id: `leader-${table[0].clubId}`,
      text: `${name(table[0].clubId)} lead the division on ${table[0].points} points.`,
    });
  }

  return out.slice(0, Math.max(0, limit));
}

// ── The clubhouse ───────────────────────────────────────────────────────────

export interface SundayUpgradeSceneItem {
  id: SundayUpgradeId;
  name: string;
  /** 0 when never bought. */
  level: number;
  maxLevel: number;
  owned: boolean;
  maxed: boolean;
  /** What the next level costs, or null when there is no next level. */
  nextCost: number | null;
}

export interface SundayUpgradeScene {
  items: SundayUpgradeSceneItem[];
  /** Total levels bought across everything — the one number that says how far
   *  the club has come without needing ten. */
  totalLevels: number;
}

/**
 * The club's fabric, upgrade by upgrade, in the catalogue's order.
 *
 * Every upgrade appears, owned or not, so a scene can draw the absence of
 * floodlights as easily as their presence. Costs come from `sundayUpgradeCost`,
 * the same function the buy action charges — a card that quotes its own price
 * is a card that can be wrong.
 */
export function sundayUpgradeScene(sunday: SundayState): SundayUpgradeScene {
  const level = (id: SundayUpgradeId) => sunday.upgrades.find(u => u.id === id)?.level ?? 0;
  const items = SUNDAY_UPGRADES.map(info => {
    const lvl = level(info.id);
    const maxed = lvl >= info.maxLevel;
    return {
      id: info.id,
      name: info.name,
      level: lvl,
      maxLevel: info.maxLevel,
      owned: lvl > 0,
      maxed,
      nextCost: maxed ? null : sundayUpgradeCost(info.id, lvl),
    };
  });
  return { items, totalLevels: items.reduce((n, i) => n + i.level, 0) };
}

/** A club number an upgrade moves, named so a screen can put an icon on it. */
export type SundayUpgradeStat = 'pitch' | 'reputation' | 'morale' | 'upkeep';

/** One number, before and after the next level is bought. */
export interface SundayUpgradeChange {
  stat: SundayUpgradeStat;
  from: number;
  to: number;
}

export interface SundayUpgradePreview {
  id: SundayUpgradeId;
  /** English catalogue name — game data. */
  name: string;
  /** The flavour line. One at a time on screen, never ten. */
  description: string;
  /** The written claim, for the effects no number can carry. */
  effectText: string;
  level: number;
  maxLevel: number;
  owned: boolean;
  maxed: boolean;
  /** The club is not established enough yet. */
  locked: boolean;
  minReputation: number;
  /** What the next level costs, or null when there is no next level. */
  cost: number | null;
  /** Whether the club can pay `cost` today. False when there is nothing to buy. */
  affordable: boolean;
  /** What selling one level back would return, or null when none is owned. */
  refund: number | null;
  /** What buying the next level would visibly change. Empty when the effects
   *  are all things no club number reports. */
  changes: SundayUpgradeChange[];
}

/**
 * One upgrade, priced and previewed: what it costs and what it MOVES.
 *
 * WHY THIS EXISTS. The Clubhouse used to answer "what does the roller do?"
 * with two sentences of prose per upgrade, ten upgrades deep — 955 characters
 * of catalogue on one screen, describing effects the player could not check.
 * A manager buying a roller wants one thing: the pitch is 38 and it will be
 * 52. Every `from`/`to` below is computed by the SAME function that owns the
 * number in the game — `sundayPitchQuality` for the surface,
 * `sundayUpgradeUpkeep` for the bill, `sundayUpgradeRepBump` /
 * `sundayUpgradeMoraleBump` for the two the till pays at purchase — so a
 * preview cannot promise something the buy action does not deliver.
 *
 * The effects that no club number reports (a physio who heals faster, a coach
 * who improves the shape's fit) have no `change` and keep their `effectText`.
 * That is the honest split: numbers where there is a number, words where the
 * words are the only truth available.
 */
export function sundayUpgradePreview(
  sunday: SundayState,
  week: number,
  id: SundayUpgradeId,
): SundayUpgradePreview {
  const info = getSundayUpgrade(id);
  const level = sunday.upgrades.find(u => u.id === id)?.level ?? 0;
  const maxed = level >= info.maxLevel;
  const cost = maxed ? null : sundayUpgradeCost(id, level);
  const locked = sunday.reputation < info.minReputation;

  // The state as it would be one level from here. Nothing is written; this
  // object exists only to be measured by the helpers that own each number.
  const next: SundayState = {
    ...sunday,
    upgrades: sunday.upgrades.some(u => u.id === id)
      ? sunday.upgrades.map(u => (u.id === id ? { ...u, level: u.level + 1 } : u))
      : [...sunday.upgrades, { id, level: 1 }],
  };

  const changes: SundayUpgradeChange[] = [];
  if (!maxed) {
    if (info.effects.includes('pitch-quality')) {
      changes.push({
        stat: 'pitch',
        from: sundayPitchQuality(sunday, week),
        to: sundayPitchQuality(next, week),
      });
    }
    const rep = sundayUpgradeRepBump(id);
    if (rep > 0) {
      changes.push({
        stat: 'reputation',
        from: sunday.reputation,
        to: Math.min(100, sunday.reputation + rep),
      });
    }
    const morale = sundayUpgradeMoraleBump(id);
    if (morale > 0) {
      changes.push({
        stat: 'morale',
        from: sunday.teamMorale,
        to: Math.min(100, sunday.teamMorale + morale),
      });
    }
    // Every level costs something to keep, which is the trade-off the upkeep
    // constant exists to create. Always last: it is the price of the others.
    changes.push({
      stat: 'upkeep',
      from: sundayUpgradeUpkeep(sunday.divisionId, sunday.upgrades),
      to: sundayUpgradeUpkeep(sunday.divisionId, next.upgrades),
    });
  }

  return {
    id,
    name: info.name,
    description: info.description,
    effectText: info.effectText,
    level,
    maxLevel: info.maxLevel,
    owned: level > 0,
    maxed,
    locked,
    minReputation: info.minReputation,
    cost,
    affordable: cost != null && sunday.balance >= cost,
    refund: level > 0
      ? Math.round(sundayUpgradeCost(id, level - 1) * SUNDAY_UPGRADE_MOTHBALL_REFUND)
      : null,
    changes,
  };
}

export interface SundaySponsorBoard {
  deal: SundaySponsorDeal;
  /** 0-1 toward the condition, or null when the deal carries no condition. */
  progress: number | null;
  /** True once the condition has been met. */
  met: boolean;
  /** Seasons left to run, counting the current one. */
  seasonsLeft: number;
}

/**
 * The boards round the pitch.
 *
 * `conditionProgress` is measured against `conditionTarget` within one season
 * (the rollover resets it), which is why the ratio is computed here rather than
 * carried on the deal. `season` is a parameter rather than a default because
 * `seasonsLeft` is meaningless without it and a wrong default would be worse
 * than an argument.
 */
export function sundaySponsorBoards(sunday: SundayState, season: number): SundaySponsorBoard[] {
  return sunday.sponsors.map(deal => {
    const hasCondition = deal.condition !== 'none' && deal.conditionTarget > 0;
    const progress = hasCondition
      ? Math.max(0, Math.min(1, deal.conditionProgress / deal.conditionTarget))
      : null;
    return {
      deal,
      progress,
      met: hasCondition ? deal.conditionProgress >= deal.conditionTarget : true,
      seasonsLeft: Math.max(0, deal.expiresSeason - season + 1),
    };
  });
}

