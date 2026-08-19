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
import { SUNDAY_UPGRADES, sundayUpgradeCost } from '@/config/sundayLeague';
import type { SundayNewsKind } from '@/config/sundayIcons';
import { sundayPitchQuality } from '@/store/slices/sunday/matchday';
import { summariseAvailability } from './availability';
import { sundayUpgradeUpkeep, sundayWeeklyBurn } from './finance';
import { buildSundayTable } from './season';

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

