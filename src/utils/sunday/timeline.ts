/**
 * The afternoon, flattened into rows a timeline can be drawn from.
 *
 * WHAT THIS IS FOR. The narrative feed is prose: it reads well and it is the
 * mode's voice, but you cannot scan it. Nobody reads eighteen sentences to find
 * out when the second goal went in. A timeline answers that in one glance —
 * minute, glyph, name, running score — and it is the standard way a football
 * match is written down, which is precisely why it belongs on a screen that is
 * trying to feel like football.
 *
 * WHAT IT IS NOT. It is not a second, competing account of the match. Every row
 * comes from one engine event, the running score is carried exactly the way
 * `buildSundayNarrative` carries it (`clubId` on a goal is the BENEFITING side,
 * own goals included), and nothing here invents a beat, re-orders one, or
 * describes one the engine did not produce. Feed and timeline are two views of
 * the same event list and can therefore never contradict each other.
 *
 * WHY THE NAMES ARE SNAPSHOTTED. Guests are generated at kick-off and deleted
 * from `players` by the settlement an hour later. An id-only row would render
 * blank for the man who scored the winner. So the name is copied in at build
 * time, the same fix `motmName` already applies.
 */
import type {
  MatchEvent, Player, SundayTimelineEntry, SundayTimelineKind,
} from '@/types/game';

/**
 * Engine event type → timeline kind. Absent means "not on the noticeboard":
 * shots, commentary, kick-off and the announcements are the feed's business.
 *
 * Every scoring type in `SCORING_TYPES` (utils/sunday/match.ts) must appear
 * here or the running score would skip a goal — `sundayTimeline.test.ts` pins
 * the two lists against each other.
 */
const KIND: Readonly<Record<string, SundayTimelineKind>> = {
  goal: 'goal',
  penalty_scored: 'goal',
  extra_time_goal: 'goal',
  free_kick_goal: 'goal',
  long_range_goal: 'goal',
  counter_attack_goal: 'goal',
  header_goal: 'goal',
  solo_goal: 'goal',
  goalkeeper_error: 'goal',
  own_goal: 'own-goal',
  penalty_missed: 'penalty-missed',
  yellow_card: 'yellow',
  red_card: 'red',
  injury: 'injury',
  substitution: 'sub',
};

/** Kinds that move the scoreboard. */
const SCORES: ReadonlySet<SundayTimelineKind> = new Set<SundayTimelineKind>(['goal', 'own-goal']);

export interface SundayTimelineInput {
  events: readonly MatchEvent[];
  /** The club the report belongs to — the one `ours` is measured against. */
  clubId: string;
  /** True when that club is the home side, so the running score is filed the
   *  way the header and the feed both print it. */
  isHome: boolean;
  /** The players map INCLUDING the guests, i.e. the local copy the match was
   *  played with, not the store's. */
  players: Record<string, Player>;
  /** Appended as a final row when a cup tie went to penalties. Home-away. */
  shootout?: { home: number; away: number } | null;
}

/** First name only. Sunday League never uses surnames on a match feed, and a
 *  timeline row is narrower than a feed line. */
const nameOf = (players: Record<string, Player>, id?: string): string | null =>
  (id && players[id]) ? players[id].firstName : null;

export function buildSundayTimeline(input: SundayTimelineInput): SundayTimelineEntry[] {
  const { events, clubId, isHome, players } = input;
  const rows: SundayTimelineEntry[] = [];
  let home = 0;
  let away = 0;
  let brokeForHalfTime = false;

  for (const ev of events) {
    const kind = KIND[ev.type];
    // The break goes in before the first thing that happens after it, which is
    // the same place the narrative puts its `HT x-y` line.
    if (!brokeForHalfTime && ev.minute > 45) {
      brokeForHalfTime = true;
      rows.push({ minute: '', at: 45, kind: 'break', ours: false, name: null, second: null, home, away });
    }
    if (!kind) continue;

    const ours = ev.clubId === clubId;
    if (SCORES.has(kind)) {
      if (ours === isHome) home++; else away++;
    }
    rows.push({
      minute: ev.displayMinute ?? String(ev.minute),
      at: ev.minute,
      kind,
      ours,
      name: nameOf(players, ev.playerId),
      second: nameOf(players, ev.assistPlayerId),
      home,
      away,
    });
  }

  if (input.shootout) {
    rows.push({
      minute: '',
      at: 121,
      kind: 'shootout',
      ours: (input.shootout.home > input.shootout.away) === isHome,
      name: null,
      second: null,
      home: input.shootout.home,
      away: input.shootout.away,
    });
  }

  return rows;
}
