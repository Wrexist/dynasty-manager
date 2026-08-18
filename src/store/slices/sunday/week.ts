/**
 * Sunday League — the weekly game loop.
 *
 * The order below is the design, not an accident, and each step depends on the
 * one above it:
 *
 *   1. play the fixture if it has not been played (auto-picking a side rather
 *      than blocking, so the loop can never deadlock)
 *   2. simulate the rest of the division
 *   3. settle the books — ONCE, here, for the whole week
 *   4. consequences: reputation, morale drift, unhappiness, people walking out
 *   5. sponsors: pay, expire, offer
 *   6. recruits: expire, arrive
 *   7. one event, if the week has room for one
 *   8. advance the week, tick absences, roll next week's availability
 *   9. rebuild the table and check whether the season is over
 *
 * Steps 3 and 8 are the two that MUST happen exactly once per week; both are
 * driven off `state.week`, which only this function advances.
 */
import type {
  Club, Match, Player, SundaySponsorDeal, SundaySponsorOffer, SundaySquadMember,
  SundayState, SundayLedgerLine,
} from '@/types/game';
import { getTeamStrength } from '@/utils/playerGen';
import {
  SUNDAY_BANKRUPT_FLOOR, SUNDAY_BANKRUPT_GRACE_WEEKS, SUNDAY_LEDGER_MAX,
  SUNDAY_MORALE_MOOD_PULL, SUNDAY_MORALE_NEUTRAL, SUNDAY_HAPPINESS_DRIFT, SUNDAY_QUIT_BASE_CHANCE,
  SUNDAY_QUIT_PER_LOYALTY, SUNDAY_QUIT_THRESHOLD, SUNDAY_RECRUIT_CHANCE,
  SUNDAY_RECRUIT_MAX, SUNDAY_SPONSOR_BONUS_WEEKS, SUNDAY_SPONSOR_FAIL_REP,
  SUNDAY_SPONSOR_MAX_DEALS, SUNDAY_SPONSOR_MIN_REPUTATION, SUNDAY_SPONSOR_OFFER_CHANCE,
  SUNDAY_SPONSOR_OFFER_WEEKS, SUNDAY_SPONSOR_SIGNON_WEEKS, SUNDAY_SPONSOR_WEEKLY_BASE,
  SUNDAY_SPONSOR_WEEKLY_PER_REP, SUNDAY_UNSETTLED_THRESHOLD, SUNDAY_EVENT_CHANCE,
  SUNDAY_MAX_SQUAD, SUNDAY_MIN_START, SUNDAY_THIN_SQUAD, SUNDAY_DEBT_FLOOR,
  SUNDAY_CUP_ROUND_PRIZE, SUNDAY_CUP_ROUNDS, SUNDAY_WEEK_LOG_MAX,
  SUNDAY_AI_GOALS_BASE, SUNDAY_AI_GOALS_SWING, SUNDAY_AI_HOME_ADVANTAGE,
  SUNDAY_FORM_DRIFT, SUNDAY_FORM_NEUTRAL, SUNDAY_PITCH_DAMAGE_HEAL,
  SUNDAY_PHYSIO_HEAL_PER_LEVEL, SUNDAY_FLAG_EXPIRY_WEEKS,
} from '@/config/sundayLeague';
import { SUNDAY_SPONSORS, SUNDAY_SPONSOR_CONDITION_TEXT, SUNDAY_TAUNTS } from '@/data/sundayNames';
import { buildWeekLedger } from '@/utils/sunday/finance';
import { rollSundayAvailability, tickAbsence } from '@/utils/sunday/availability';
import { makeMemory, rememberMoment } from '@/utils/sunday/memories';
import { generateSundayRecruit, sundaySquadNeeds } from '@/utils/sunday/generation';
import {
  pickSundayEvent, toEventPerson, cooldownWeekFor, isOnceSundayEvent,
  forceSundayChainStep, pruneSundayChains, pruneSundayFlags, sundayChainSubjectName,
  sundayCupView, sundayStoryFlags,
} from '@/utils/sunday/events';
import type { SundayEventContext } from '@/data/sundayEvents';
import { sundayChainClosingLine } from '@/data/sundayEvents';
import {
  advanceSundayCup, buildSundayTable, sundaySeasonWeeks, sundayCupRoundName,
} from '@/utils/sunday/season';
import { createSundayRng, subSeed, type SundayRng } from '@/utils/sunday/rng';
import { runSundayMatch } from './matchday';
import type { Get, Set } from './shared';
import { clamp, clampRound, sundayMessage } from './shared';

/** Simulate the division's other fixtures for a week. */
function simulateOtherFixtures(
  rng: SundayRng,
  fixtures: Match[],
  week: number,
  playerClubId: string,
  clubs: Record<string, Club>,
  players: Record<string, Player>,
): Match[] {
  return fixtures.map(m => {
    if (m.week !== week || m.played) return m;
    if (m.homeClubId === playerClubId || m.awayClubId === playerClubId) return m;
    const hc = clubs[m.homeClubId];
    const ac = clubs[m.awayClubId];
    if (!hc || !ac) return { ...m, played: true };
    // A cheap, honest model: team strength plus home advantage, Poisson-ish
    // goals. Running the full engine for every AI fixture would triple the cost
    // of a week to produce numbers nobody reads event-by-event.
    const hStr = getTeamStrength(hc.playerIds.map(id => players[id]).filter(Boolean).slice(0, 11)) * SUNDAY_AI_HOME_ADVANTAGE;
    const aStr = getTeamStrength(ac.playerIds.map(id => players[id]).filter(Boolean).slice(0, 11));
    const total = hStr + aStr || 1;
    const homeExp = SUNDAY_AI_GOALS_BASE + SUNDAY_AI_GOALS_SWING * (hStr / total);
    const awayExp = SUNDAY_AI_GOALS_BASE + SUNDAY_AI_GOALS_SWING * (aStr / total);
    const draw = (exp: number) => {
      // Sum of three uniforms scaled to the expectation: cheap, bounded and
      // shaped enough that 0-0 and 5-4 both happen at plausible rates.
      const u = rng.next() + rng.next() + rng.next();
      return Math.max(0, Math.round((u / 3) * exp * 2));
    };
    return { ...m, played: true, homeGoals: draw(homeExp), awayGoals: draw(awayExp), events: [] };
  });
}

/** Build a sponsor offer scaled to the club's standing. */
function buildSponsorOffer(rng: SundayRng, sunday: SundayState, week: number, season: number): SundaySponsorOffer | null {
  const taken = new Set(sunday.sponsors.map(s => s.name));
  const candidates = SUNDAY_SPONSORS.filter(s => !taken.has(s.name));
  const template = rng.pick(candidates);
  if (!template) return null;
  const weekly = Math.max(
    5,
    Math.round((SUNDAY_SPONSOR_WEEKLY_BASE + sunday.reputation * SUNDAY_SPONSOR_WEEKLY_PER_REP) * template.payMult),
  );
  const condition = rng.pick(template.conditions) ?? 'none';
  const target = condition === 'none' ? 0
    : condition === 'win-streak' ? rng.int(2, 4)
      : condition === 'avoid-defeat' ? rng.int(3, 6)
        : condition === 'goals' ? rng.int(18, 32)
          : condition === 'attendance' ? rng.int(4, 8)
            : rng.int(10, 18);
  return {
    id: `sun-sp-${season}-${week}-${template.name.replace(/\W+/g, '')}`,
    name: template.name,
    blurb: template.blurb,
    weekly,
    signOn: weekly * SUNDAY_SPONSOR_SIGNON_WEEKS,
    expiresSeason: season + 1,
    condition,
    conditionTarget: target,
    conditionProgress: 0,
    conditionText: (SUNDAY_SPONSOR_CONDITION_TEXT[condition] ?? '').replace('{n}', String(target)),
    expiresWeek: week + SUNDAY_SPONSOR_OFFER_WEEKS,
  };
}

/** Update a live deal's progress toward its condition. */
function trackSponsorConditions(
  sponsors: readonly SundaySponsorDeal[],
  sunday: SundayState,
  playedThisWeek: boolean,
): SundaySponsorDeal[] {
  const s = sunday.seasonStats;
  return sponsors.map(deal => {
    let progress = deal.conditionProgress;
    switch (deal.condition) {
      case 'win-streak': progress = Math.max(progress, s.bestWinRun); break;
      case 'avoid-defeat': progress = Math.max(progress, s.bestUnbeatenRun); break;
      case 'goals': progress = s.goalsFor; break;
      case 'attendance':
        // Counted per MATCH, not per week — without the guard a single
        // full-strength side kept scoring the condition every quiet week.
        progress = playedThisWeek && sunday.lastMatch && sunday.lastMatch.startedWith >= 11 ? progress + 1 : progress;
        break;
      case 'discipline': progress = s.forfeits + s.noShows; break;
      default: break;
    }
    return progress === deal.conditionProgress ? deal : { ...deal, conditionProgress: progress };
  });
}

/** Build the week's recap for the hub. Replaces the previous week's lines. */
function buildWeekRecap(
  sunday: SundayState,
  lastMatch: SundayState['lastMatch'],
  net: number,
  extra: readonly string[],
): string[] {
  const lines: string[] = [];
  if (lastMatch) {
    lines.push(lastMatch.forfeited
      ? `Fixture not fulfilled against ${lastMatch.opponentName}.`
      : `${lastMatch.goalsFor}-${lastMatch.goalsAgainst} ${lastMatch.goalsFor > lastMatch.goalsAgainst ? 'win' : lastMatch.goalsFor === lastMatch.goalsAgainst ? 'draw' : 'defeat'} ${lastMatch.home ? 'at home to' : 'away at'} ${lastMatch.opponentName}.`);
  } else {
    lines.push('No fixture. A rare quiet Sunday.');
  }
  lines.push(net >= 0
    ? `Up £${Math.round(net)} on the week.`
    : `Down £${Math.abs(Math.round(net))} on the week.`);
  lines.push(...extra);
  void sunday;
  return lines.slice(-SUNDAY_WEEK_LOG_MAX);
}

/**
 * Advance one Sunday League week.
 *
 * Async only to match `advanceWeek`'s signature; it does no I/O.
 */
export function advanceSundayWeek(set: Set, get: Get): void {
  const start = get();
  const sunday0 = start.sunday;
  if (!sunday0) return;

  // A folded club cannot advance. The retrospective is the end of the run.
  if (sunday0.folded) {
    set({ currentScreen: 'sunday-history' });
    return;
  }
  // The season is over; the history screen owns the summary AND the rollover.
  // Deliberately NOT the shared 'season-summary' — that page renders the club
  // game's turnover/awards state, none of which exists in this mode.
  if (sunday0.seasonComplete) {
    set({ currentScreen: 'sunday-history' });
    return;
  }
  // An unanswered event blocks the week — that is what makes a decision a
  // decision rather than a notification.
  if (sunday0.pendingEvent) return;

  // ── 1. The player's fixture ──────────────────────────────────────────────
  runSundayMatch(set, get);

  const state = get();
  const sunday = state.sunday;
  if (!sunday) return;
  const week = state.week;
  const season = state.season;
  const clubId = state.playerClubId;
  // Week-keyed stream, same reasoning as `runSundayMatch`: the ledger draws one
  // chance per player who took the field, and how many took the field depends
  // on the (unseeded) engine's substitutions — so drawing from the persistent
  // cursor made the cursor's position, and with it every later draw, differ
  // between a reloaded and an unreloaded save. Keyed to the week, this advance
  // produces the same event, the same sponsor approach and the same recruit
  // whether or not the app was killed in between.
  const rng = createSundayRng(subSeed(sunday.seed, `advance:${season}:${week}`), 0);

  // ── 2. The rest of the division ──────────────────────────────────────────
  const fixtures = simulateOtherFixtures(rng, [...state.fixtures], week, clubId, state.clubs, state.players);

  // Cup rounds the player is not in still have to be played out, or the
  // bracket cannot advance past the round they were eliminated in.
  let cup = sunday.cup;
  if (cup) {
    const roundThisWeek = cup.ties.find(t => t.week === week)?.round;
    if (roundThisWeek != null) {
      const strengthOf = (cid: string) => {
        const c = state.clubs[cid];
        if (!c) return 30;
        const squad = c.playerIds.map(id => state.players[id]).filter(Boolean).slice(0, 11);
        return squad.length ? getTeamStrength(squad) : 30;
      };
      const ties = cup.ties.map(t => {
        if (t.round !== roundThisWeek || t.played) return t;
        const h = strengthOf(t.homeClubId) * 1.1;
        const a = strengthOf(t.awayClubId);
        const share = h / (h + a || 1);
        let hg = rng.int(0, 2) + (rng.chance(share) ? 1 : 0);
        const ag = rng.int(0, 2) + (rng.chance(1 - share) ? 1 : 0);
        let sh: { home: number; away: number } | null = null;
        if (hg === ag) {
          sh = { home: rng.int(2, 5), away: rng.int(2, 5) };
          if (sh.home === sh.away) sh.home++;
        }
        const winner = sh ? (sh.home > sh.away ? t.homeClubId : t.awayClubId) : (hg > ag ? t.homeClubId : t.awayClubId);
        // Guard: a 0-0 that produced no shootout would be an unwinnable tie.
        if (hg === ag && !sh) hg = ag + 1;
        return { ...t, played: true, homeGoals: hg, awayGoals: ag, winnerClubId: winner, shootout: sh };
      });
      cup = advanceSundayCup({ ...cup, ties }, sunday.divisionId, roundThisWeek);
    }
  }

  // ── 3. The books ─────────────────────────────────────────────────────────
  const lastMatch = sunday.lastMatch;
  const playedThisWeek = lastMatch && lastMatch.week === week && lastMatch.season === season;
  // Discipline and treatment come off the REPORT, which is persisted, not off
  // `state.currentMatchResult`, which is not. The game autosaves the moment the
  // whistle goes, so a player who reloaded between the match and Next Week used
  // to skip the red-card fine and the physio bill entirely — a save-scum the
  // seeded-RNG design explicitly promises does not exist.
  const redCards = playedThisWeek ? lastMatch.redCards : 0;
  const injuriesThisWeek = playedThisWeek ? lastMatch.injuries : 0;
  const playedIds = playedThisWeek ? lastMatch.playedIds : [];

  const ledger = buildWeekLedger({
    rng,
    divisionId: sunday.divisionId,
    personality: sunday.identity.personality,
    reputation: sunday.reputation,
    upgrades: sunday.upgrades,
    sponsors: sunday.sponsors,
    playedIds,
    squad: sunday.squad,
    fixture: playedThisWeek
      ? { home: lastMatch.home, derby: sunday.rivalry?.clubId === lastMatch.opponentClubId, forfeited: lastMatch.forfeited }
      : null,
    redCards,
    injuries: injuriesThisWeek,
    chargeLeagueFee: week === 1,
    ringers: playedThisWeek ? lastMatch.ringersUsed : 0,
  });

  const lines: SundayLedgerLine[] = [...ledger.lines];

  // Cup prize money, paid for the round just survived.
  if (cup && playedThisWeek) {
    const tie = cup.ties.find(t => t.week === week && (t.homeClubId === clubId || t.awayClubId === clubId));
    if (tie?.winnerClubId === clubId) {
      const prize = SUNDAY_CUP_ROUND_PRIZE * (tie.round >= SUNDAY_CUP_ROUNDS ? 2 : 1);
      lines.push({ kind: 'prize', amount: prize, label: `${sundayCupRoundName(tie.round)} prize money` });
    }
  }

  // Only the lines this settlement is CREATING move the balance. Anything the
  // manager spent or raised during the week was applied to `balance` when he
  // did it and is parked in `pendingLedger`; folding it in here as well would
  // charge it twice.
  const settledNet = lines.reduce((n, l) => n + l.amount, 0);
  let balance = sunday.balance + settledNet;

  let squad = sunday.squad.map(m => {
    const owed = ledger.subsOwed[m.playerId] ?? 0;
    return owed ? { ...m, subsOwed: m.subsOwed + owed } : m;
  });

  // ── 4. Consequences ──────────────────────────────────────────────────────
  // Squad morale converges on the dressing room's own mood, weighted by who
  // actually carries the room. Expressed as a PULL TOWARD A TARGET rather than
  // a sum of per-player nudges: the earlier version added a positive term for
  // every reasonably happy player, so a fifteen-man squad drifted to 100 and
  // stayed there regardless of results.
  // Individual happiness decays toward neutral before the room's mood is read
  // off it, so a run of starts cannot compound into a permanently ecstatic
  // squad — the same mean-reversion the morale figure itself gets.
  squad = squad.map(m => ({
    ...m,
    happiness: clampRound(m.happiness + (SUNDAY_MORALE_NEUTRAL - m.happiness) * SUNDAY_HAPPINESS_DRIFT, 0, 100),
  }));

  let teamMorale = sunday.teamMorale;
  if (squad.length) {
    const influenceTotal = squad.reduce((n, m) => n + m.influence, 0) || 1;
    const moodTarget = squad.reduce((n, m) => n + m.happiness * m.influence, 0) / influenceTotal;
    teamMorale += (moodTarget - teamMorale) * SUNDAY_MORALE_MOOD_PULL;
  }
  teamMorale = clamp(teamMorale, 0, 100);

  const weekLogLines: string[] = [];
  let messages = state.messages;
  const players = { ...state.players };
  const clubs = { ...state.clubs };

  // People who have had enough.
  const leaving: string[] = [];
  squad = squad.map(m => {
    const unsettled = m.happiness <= SUNDAY_UNSETTLED_THRESHOLD;
    if (unsettled && !m.unsettled) {
      messages = sundayMessage(
        messages, season, week,
        `${players[m.playerId]?.firstName ?? 'A player'} is not happy`,
        `${players[m.playerId]?.firstName ?? 'He'} has told a couple of the lads he is thinking about packing it in.`,
        'warning',
      );
    }
    if (m.happiness <= SUNDAY_QUIT_THRESHOLD
      && rng.chance(Math.max(0.02, SUNDAY_QUIT_BASE_CHANCE - m.loyalty * SUNDAY_QUIT_PER_LOYALTY))) {
      leaving.push(m.playerId);
    }
    return unsettled === m.unsettled ? m : { ...m, unsettled };
  });

  if (leaving.length) {
    const club = clubs[clubId];
    if (club) clubs[clubId] = { ...club, playerIds: club.playerIds.filter(id => !leaving.includes(id)) };
    for (const id of leaving) {
      const p = players[id];
      if (p) {
        weekLogLines.push(`${p.firstName} ${p.lastName} has packed it in.`);
        messages = sundayMessage(
          messages, season, week, `${p.firstName} has left`,
          `${p.firstName} ${p.lastName} is not coming back. He was not enjoying it and said so.`,
          'warning',
        );
        delete players[id];
      }
    }
    squad = squad.filter(m => !leaving.includes(m.playerId));
    teamMorale = clamp(teamMorale - leaving.length * 3, 0, 100);
  }

  // If the captain was among the leavers, the armband passes to whoever
  // actually runs the dressing room now — the same rule the season rollover
  // applies. Leaving `captainId` pointing at a departed player was the
  // invariant violation the stress harness caught at seed 101, S2W15.
  let captainId = sunday.captainId;
  if (captainId && !squad.some(m => m.playerId === captainId)) {
    captainId = [...squad].sort((a, b) =>
      (b.influence * 2 + b.commitment) - (a.influence * 2 + a.commitment))[0]?.playerId ?? null;
    const newCaptain = captainId ? players[captainId] : null;
    if (newCaptain) weekLogLines.push(`${newCaptain.firstName} has taken the armband.`);
  }

  // ── 5. Sponsors ──────────────────────────────────────────────────────────
  let sponsors = trackSponsorConditions(sunday.sponsors, sunday, !!playedThisWeek);
  let reputation = sunday.reputation;
  const expiring = sponsors.filter(s => s.expiresSeason <= season && week >= sundaySeasonWeeks(sunday.divisionId));
  if (expiring.length) {
    for (const deal of expiring) {
      const met = deal.condition === 'none'
        || (deal.condition === 'discipline'
          ? deal.conditionProgress < deal.conditionTarget
          : deal.conditionProgress >= deal.conditionTarget);
      if (met && deal.condition !== 'none') {
        const bonus = deal.weekly * SUNDAY_SPONSOR_BONUS_WEEKS;
        lines.push({ kind: 'sponsor', amount: bonus, label: `${deal.name} bonus — condition met` });
        balance += bonus;
        weekLogLines.push(`${deal.name} have paid the bonus. They are delighted.`);
      } else if (!met) {
        reputation = clamp(reputation - SUNDAY_SPONSOR_FAIL_REP, 0, 100);
        weekLogLines.push(`${deal.name} have not renewed. You did not hold up your end.`);
      }
    }
    sponsors = sponsors.filter(s => !expiring.includes(s));
  }

  let sponsorOffers = sunday.sponsorOffers.filter(o => o.expiresWeek > week);
  if (
    reputation >= SUNDAY_SPONSOR_MIN_REPUTATION
    && sponsors.length < SUNDAY_SPONSOR_MAX_DEALS
    && sponsorOffers.length === 0
    && rng.chance(SUNDAY_SPONSOR_OFFER_CHANCE)
  ) {
    const offer = buildSponsorOffer(rng, { ...sunday, reputation, sponsors }, week, season);
    if (offer) {
      sponsorOffers = [offer];
      messages = sundayMessage(
        messages, season, week, `${offer.name} want to sponsor you`,
        `${offer.blurb} £${offer.weekly} a week, £${offer.signOn} up front. ${offer.conditionText}`,
        'sponsorship',
      );
    }
  }

  // ── 6. Recruits ──────────────────────────────────────────────────────────
  let recruits = sunday.recruits.filter(r => r.expiresWeek > week);
  const thin = squad.length <= SUNDAY_THIN_SQUAD;
  if (
    squad.length < SUNDAY_MAX_SQUAD
    && recruits.length < SUNDAY_RECRUIT_MAX
    && rng.chance(thin ? SUNDAY_RECRUIT_CHANCE * 1.6 : SUNDAY_RECRUIT_CHANCE)
  ) {
    const squadPlayers = squad.map(m => players[m.playerId]).filter((p): p is Player => !!p);
    recruits = [...recruits, generateSundayRecruit({
      rng, season, week, reputation,
      personality: sunday.identity.personality,
      needs: sundaySquadNeeds(squadPlayers),
      clubhouseLevel: sunday.upgrades.find(u => u.id === 'clubhouse')?.level ?? 0,
      rivalName: sunday.rivalry ? clubs[sunday.rivalry.clubId]?.shortName ?? null : null,
      vouchName: rng.pick(squadPlayers)?.firstName ?? 'someone',
      town: sunday.identity.town,
      index: recruits.length,
    })];
  }

  // The calendar is settled before the event roll, because whether there IS a
  // next Sunday decides whether an event may fire at all.
  const nextWeek = week + 1;
  const totalWeeks = sundaySeasonWeeks(sunday.divisionId);
  const seasonComplete = nextWeek > totalWeeks;

  // ── 7. An event ──────────────────────────────────────────────────────────
  let pendingEvent = sunday.pendingEvent;
  let eventCooldowns = sunday.eventCooldowns;
  let onceFiredIds = sunday.onceFiredIds;
  // A story about somebody who has walked out this week is over. Say so — an
  // arc that simply stops being mentioned is indistinguishable from a bug, and
  // the flag-based version did exactly that.
  const squadIds = new Set(squad.map(m => m.playerId));
  const prunedChains = pruneSundayChains(sunday.chains, squadIds);
  let chains = prunedChains.kept;
  for (const c of prunedChains.dropped) {
    weekLogLines.push(sundayChainClosingLine(c.id, 'gone', sundayChainSubjectName(c)));
  }
  // The once-per-save register, NOT the event log: the log is capped at
  // `SUNDAY_EVENT_LOG_MAX`, so deriving "has this fired?" from it let a
  // once-only event come round again after about five seasons.
  const firedOnce = new Set(onceFiredIds);
  // No event on the season's final advance. The rollover clears `pendingEvent`,
  // so one rolled here was written, shown to nobody, and thrown away — the same
  // reason the availability roll is skipped below.
  //
  // The roll is taken BEFORE the forcing check even though a forced beat
  // ignores it: drawing conditionally would move every later draw in the week
  // whenever a chain happened to be live, so the same seed would produce a
  // different sponsor approach and a different recruit depending on the state
  // of an unrelated story.
  const eventRoll = rng.chance(SUNDAY_EVENT_CHANCE);
  if (!pendingEvent && !seasonComplete) {
    const table = buildSundayTable(fixtures, sunday.divisionClubIds);
    const person = (m: SundaySquadMember | null | undefined) => {
      if (!m) return null;
      const p = players[m.playerId];
      return p ? toEventPerson(m, p) : null;
    };
    const captainMember = sunday.captainId ? squad.find(m => m.playerId === sunday.captainId) : null;
    const unhappyMember = squad.filter(m => m.happiness < 40).sort((a, b) => a.happiness - b.happiness)[0] ?? null;
    const ctx: SundayEventContext = {
      season, week, balance, reputation, teamMorale,
      squadSize: squad.length,
      availableCount: squad.filter(m => m.availability.status !== 'out').length,
      lastResult: playedThisWeek && lastMatch
        ? (lastMatch.goalsFor > lastMatch.goalsAgainst ? 1 : lastMatch.goalsFor === lastMatch.goalsAgainst ? 0 : -1)
        : null,
      winless: sunday.seasonStats.winlessRun,
      winStreak: sunday.seasonStats.winRun,
      leaguePosition: Math.max(1, table.findIndex(r => r.clubId === clubId) + 1),
      leagueSize: table.length,
      hasRival: !!sunday.rivalry,
      rivalHeat: sunday.rivalry?.heat ?? 0,
      hasSponsor: sponsors.length > 0,
      subsOwed: squad.reduce((n, m) => n + m.subsOwed, 0),
      // The books as the fold clock sees them: this week's counter, not last
      // week's, so the crisis chain opens on the state the player is looking at.
      weeksInDebt: balance < SUNDAY_DEBT_FLOOR ? sunday.weeksInDebt + 1 : 0,
      // The cup AFTER this week's tie was played and the bracket advanced, so
      // a beat can never describe an afternoon that has already gone the other
      // way.
      ...sundayCupView({ cup, divisionId: sunday.divisionId }, clubId),
      captain: person(captainMember),
      // Each definition claims its own subject out of `subjects` below; there
      // is deliberately no single pre-picked one to judge every condition
      // against.
      subject: null,
      unhappy: person(unhappyMember),
      flags: sunday.flags,
      chains,
      ...sundayStoryFlags(chains),
      // Filled per definition by the selector, from that definition's own
      // chain. Nothing unchained can read another story's memory.
      chainData: {},
      defectorName: sunday.rivalry?.defector?.name ?? null,
    };
    const pickInput = {
      rng,
      ctx,
      subjects: squad.map(person).filter((p): p is NonNullable<typeof p> => !!p),
      cooldowns: eventCooldowns,
      firedOnce,
      week,
      rivalName: sunday.rivalry ? clubs[sunday.rivalry.clubId]?.shortName ?? null : null,
      clubName: sunday.identity.name,
    };
    // An overdue chain beat is served outright — no weekly roll, no weighted
    // draw. That is the difference between a story and a set-up nobody paid
    // off. A chain that has run out of true beats is CLOSED here, with a line.
    const forced = forceSundayChainStep(pickInput);
    if (forced.stranded.length) {
      for (const id of forced.stranded) {
        const dead = chains.find(c => c.id === id);
        weekLogLines.push(sundayChainClosingLine(id, 'faded', dead ? sundayChainSubjectName(dead) : null));
      }
      chains = chains.filter(c => !forced.stranded.includes(c.id));
    }
    const ev = forced.event ?? (eventRoll ? pickSundayEvent(pickInput) : null);
    if (ev) {
      pendingEvent = ev;
      eventCooldowns = { ...eventCooldowns, [ev.defId]: cooldownWeekFor(ev.defId, week) };
      if (isOnceSundayEvent(ev.defId) && !onceFiredIds.includes(ev.defId)) {
        onceFiredIds = [...onceFiredIds, ev.defId];
      }
    }
  }

  // Rival trash talk, independent of the event system so a heated derby always
  // has a voice even when the event roll goes elsewhere.
  let rivalry = sunday.rivalry;
  if (rivalry && rivalry.heat >= 6 && rng.chance(0.18)) {
    const rivalName = clubs[rivalry.clubId]?.shortName ?? 'them';
    rivalry = { ...rivalry, lastTaunt: (rng.pick(SUNDAY_TAUNTS) ?? '').replace('{rival}', rivalName) };
  }

  // ── 8. Next week ─────────────────────────────────────────────────────────
  const nextFixture = fixtures.find(m => m.week === nextWeek && (m.homeClubId === clubId || m.awayClubId === clubId));
  const nextCupTie = cup?.ties.find(t => t.week === nextWeek && !t.played && (t.homeClubId === clubId || t.awayClubId === clubId));
  const away = nextCupTie ? nextCupTie.awayClubId === clubId : nextFixture ? nextFixture.awayClubId === clubId : false;
  const bigGame = !!nextCupTie
    || (!!nextFixture && !!rivalry && (nextFixture.homeClubId === rivalry.clubId || nextFixture.awayClubId === rivalry.clubId));
  const availCtx = {
    away,
    bigGame,
    hasMinibus: (sunday.upgrades.find(u => u.id === 'minibus')?.level ?? 0) > 0,
    freeWeek: !nextFixture && !nextCupTie,
  };

  // Form decays toward neutral for anyone who did not play this week — a
  // hot streak you cannot get on the pitch stops being a hot streak.
  const playedSet = new Set(playedIds);
  for (const m of squad) {
    const p = players[m.playerId];
    if (!p || playedSet.has(m.playerId)) continue;
    if (p.form !== SUNDAY_FORM_NEUTRAL) {
      const drift = Math.sign(SUNDAY_FORM_NEUTRAL - p.form) * Math.min(SUNDAY_FORM_DRIFT, Math.abs(SUNDAY_FORM_NEUTRAL - p.form));
      players[m.playerId] = { ...p, form: Math.round(p.form + drift) };
    }
  }

  // Injuries and bans tick down on the Player, which availability reads.
  for (const m of squad) {
    const p = players[m.playerId];
    if (!p) continue;
    if (p.injured && p.injuryWeeks > 0) {
      const physio = sunday.upgrades.find(u => u.id === 'physio')?.level ?? 0;
      const heal = 1 + (rng.chance(physio * SUNDAY_PHYSIO_HEAL_PER_LEVEL) ? 1 : 0);
      const remaining = Math.max(0, p.injuryWeeks - heal);
      players[m.playerId] = { ...p, injuryWeeks: remaining, injured: remaining > 0, injuryDetails: remaining > 0 ? p.injuryDetails : undefined };
    }
    // Fitness recovers between Sundays; it is a week, not a Tuesday-Saturday
    // turnaround, so recovery is generous.
    const recovered = Math.min(100, (players[m.playerId]?.fitness ?? 100) + 22 + m.condition);
    players[m.playerId] = { ...players[m.playerId], fitness: recovered };
  }

  // No roll on the season's final advance: there is no "next Sunday" for the
  // availability to describe, and rolling one anyway left a player whose ban
  // expires exactly at the phantom week marked available while `state.week`
  // (which never advances past the last week) still said he was banned — the
  // "suspended but not marked out" violation the stress harness caught at
  // seed 105. The rollover resets availability for the new season itself.
  if (!seasonComplete) {
    const availRng = createSundayRng(subSeed(sunday.seed, `avail:${season}:${nextWeek}`), 0);
    squad = squad.map(m => {
      const longAbsence = m.availability.status === 'out'
        && (m.availability.reason === 'injury' || m.availability.reason === 'holiday')
        && m.availability.weeksRemaining >= 1;
      const ticked = m.availability.weeksRemaining > 0 && m.availability.status === 'out'
        ? tickAbsence(m.availability)
        : m.availability;
      const withTick = { ...m, availability: ticked };
      const rolled = rollSundayAvailability(availRng, withTick, players[m.playerId], availCtx, nextWeek);
      // Coming back from a long lay-off is a moment: the squad screen and the
      // narrative both get to say "he's back".
      const memories = longAbsence && rolled.status === 'available'
        && (players[m.playerId]?.injuryWeeks ?? 0) === 0
        ? rememberMoment(m.memories, makeMemory(season, nextWeek, 'motm',
            `Back after ${Math.max(2, m.availability.weeksRemaining + 1)} weeks out. First name on the sheet.`))
        : m.memories;
      return { ...withTick, memories, availability: rolled };
    });
  }

  // A churned pitch grows back. Three or four quiet weeks and the surface is a
  // surface again, which is what makes playing on a bog a cost the manager can
  // choose to absorb rather than a permanent tax on the club.
  const pitchDamage = Math.max(0, sunday.pitchDamage - SUNDAY_PITCH_DAMAGE_HEAL);

  // ── 9. Table, debt, season end ───────────────────────────────────────────
  const table = buildSundayTable(fixtures, sunday.divisionClubIds);
  // A few pounds overdrawn is a Sunday club having a normal month. The
  // countdown to folding only runs while the hole is genuinely deep.
  const weeksInDebt = balance < SUNDAY_DEBT_FLOOR ? sunday.weeksInDebt + 1 : 0;
  let folded = false;
  let foldReason: string | null = null;
  if (balance < SUNDAY_BANKRUPT_FLOOR || weeksInDebt >= SUNDAY_BANKRUPT_GRACE_WEEKS) {
    folded = true;
    foldReason = balance < SUNDAY_BANKRUPT_FLOOR
      ? 'The club ran out of money and could not pay its way.'
      : 'Weeks deep in the red with no way back. The league withdrew the registration.';
  } else if (squad.length < SUNDAY_MIN_START) {
    folded = true;
    foldReason = 'There were not enough players left to register a side.';
  }

  // A dead club holds no raffles. The event is picked at step 7 and the fold is
  // only known here, so an event could be left demanding an answer from a club
  // that no longer exists — and the retrospective screen has nowhere to ask it.
  if (folded) pendingEvent = null;

  if (weeksInDebt === 1 && !folded) {
    weekLogLines.push('The account is properly in the red now. The referee still wants paying.');
  } else if (weeksInDebt >= SUNDAY_BANKRUPT_GRACE_WEEKS - 2 && !folded) {
    weekLogLines.push('The league have written about the outstanding balance. This is serious.');
  }

  // The week's entry: what the manager did during it, then what it cost to
  // play it. The two together sum exactly to the balance movement the entry
  // records, which is the ledger's whole contract (see `utils/sunday/finance`).
  const weekLines = [...sunday.pendingLedger, ...lines];
  const weekNet = weekLines.reduce((n, l) => n + l.amount, 0);
  const nextLedger = [
    ...sunday.ledger,
    { season, week, lines: weekLines, balance: Math.round(balance) },
  ].slice(-SUNDAY_LEDGER_MAX);

  const nextSunday: SundayState = {
    ...sunday,
    // `rngCursor` is deliberately untouched: this advance drew from its own
    // week-keyed stream, and the persistent cursor belongs to player-initiated
    // actions (fundraisers, ring-rounds, event resolutions) so those cannot be
    // re-rolled by replaying a week.
    squad,
    captainId,
    cup,
    rivalry,
    // The morning belongs to the week that is ending.
    arrival: null,
    // Story markers are swept after `SUNDAY_FLAG_EXPIRY_WEEKS`, and one about
    // somebody who has walked out goes with him.
    flags: pruneSundayFlags(
      Object.fromEntries(Object.entries(sunday.flags)
        .filter(([, setWeek]) => week - setWeek < SUNDAY_FLAG_EXPIRY_WEEKS)),
      squadIds,
    ),
    chains,
    sponsors,
    sponsorOffers,
    recruits,
    balance: Math.round(balance),
    reputation: clampRound(reputation, 0, 100),
    teamMorale: clampRound(teamMorale, 0, 100),
    pitchDamage,
    ledger: nextLedger,
    // Folded into the entry above; the new week starts with a clean slate.
    pendingLedger: [],
    pendingEvent,
    eventCooldowns,
    onceFiredIds,
    weeksInDebt,
    folded,
    foldReason,
    seasonComplete,
    teamsheet: [],
    bench: [],
    teamsheetLocked: false,
    // The log describes the week just completed and is replaced, not appended
    // to: the hub shows "what happened", and an ever-growing list stops being
    // that after about three weeks.
    weekLog: buildWeekRecap(sunday, playedThisWeek ? lastMatch : null, weekNet, weekLogLines),
    seasonStats: {
      ...sunday.seasonStats,
      subsCollected: sunday.seasonStats.subsCollected + ledger.subsCollected,
    },
  };

  set({
    week: seasonComplete ? week : nextWeek,
    totalWeeks,
    fixtures,
    players,
    clubs,
    messages,
    leagueTable: table,
    divisionFixtures: { ...state.divisionFixtures, [sunday.divisionId]: fixtures },
    divisionTables: { ...state.divisionTables, [sunday.divisionId]: table },
    sunday: nextSunday,
    currentMatchResult: null,
    matchPlayerRatings: [],
    currentScreen: folded || seasonComplete ? 'sunday-history' : 'sunday-hub',
  });

  if (start.settings.autoSave) get().saveGame();
}
