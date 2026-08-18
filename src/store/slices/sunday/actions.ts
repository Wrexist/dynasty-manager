/**
 * Sunday League — every action's implementation.
 *
 * Separated from the slice (`../sundaySlice.ts`) for ONE reason, and it is a
 * measured one: the slice is composed into `gameStore` at module load, so
 * anything it imports statically lands in the eager boot bundle. Importing the
 * mode's config, content and simulation there cost **44 kB gzipped on first
 * paint** for a mode most players never open, and took the eager budget from
 * 44 kB of headroom to 0.2 kB.
 *
 * So: the slice holds the state and a set of thin async facades, and this
 * module — with the config, the event catalogue, the name pools and the match
 * bridge behind it — is dynamic-imported on first use and cached thereafter.
 * That is why every Sunday action returns a Promise.
 *
 * The rules from the slice still apply here:
 *   - NO ACTION HALF-APPLIES. Every function either writes a complete, valid
 *     state or writes nothing and returns a reason.
 *   - EVERY RANDOM DRAW ADVANCES THE PERSISTED CURSOR (`withRng` returns it;
 *     every caller writes it back in the same `set`).
 */
import type {
  Club, Player, SundayMatchReport, SundayState, SundayTacticId, SundayUpgradeId,
} from '@/types/game';
import type { GameState } from '@/store/storeTypes';
import {
  SUNDAY_CHASE_SUBS_MORALE, SUNDAY_CHASE_SUBS_RECOVERY, SUNDAY_FULL_XI,
  SUNDAY_FUNDRAISER_COOLDOWN, SUNDAY_FUNDRAISER_MAX, SUNDAY_FUNDRAISER_MIN,
  SUNDAY_FUNDRAISER_MORALE, SUNDAY_MAX_BENCH, SUNDAY_MAX_SQUAD, SUNDAY_MIN_START,
  SUNDAY_RINGROUND_COST, SUNDAY_RINGROUND_MORALE, SUNDAY_EVENT_LOG_MAX,
  SUNDAY_POACH_HEAT, SUNDAY_RIVAL_HEAT_MAX, SUNDAY_PROMISE_WEEKS, SUNDAY_PITCH_DAMAGE_MAX,
  getSundayUpgrade, sundayUpgradeCost,
} from '@/config/sundayLeague';
import {
  pruneSundayFlags, resolveSundayChoice, sundayFlagSubjectId, toEventPerson,
} from '@/utils/sunday/events';
import type { SundayEventContext, SundayEventEffects } from '@/data/sundayEvents';
import { ringRoundChance } from '@/utils/sunday/availability';
import { generateSundayRecruit, sundaySquadNeeds } from '@/utils/sunday/generation';
import { buildSundayTable, sundayPosition } from '@/utils/sunday/season';
import { bumpHeat, recordRivalryIncident } from '@/utils/sunday/rivalry';
import { makeMemory, rememberMoment } from '@/utils/sunday/memories';
import { validateSundayState } from '@/utils/sunday/invariants';
import { track } from '@/utils/analytics';
import { addGameBreadcrumb } from '@/utils/sentry';
import { applySundayWorld, buildSundayWorld, type StartSundayOptions } from './boot';
import { autoPickSunday, runSundayMatch } from './matchday';
import { advanceSundayWeek } from './week';
import { rolloverSundaySeason } from './seasonEnd';
import { clamp, clampRound, logWeek, memberOf, sundayMessage, updateMember, withRng, type Get, type Set } from './shared';

export { advanceSundayWeek };
export { ensureArrival, hireSundayRingers } from './matchday';

/** Build the read-only context an event choice's odds are evaluated against.
 *  Rebuilt at resolution time rather than stored with the event, so a choice
 *  is judged against the state as it is NOW — the player may have signed
 *  someone or spent the money since the event fired. */
function buildEventContext(state: GameState, sunday: SundayState): SundayEventContext {
  const table = buildSundayTable(state.fixtures, sunday.divisionClubIds);
  const person = (playerId: string | null) => {
    if (!playerId) return null;
    const m = memberOf(sunday, playerId);
    const p = state.players[playerId];
    return m && p ? toEventPerson(m, p) : null;
  };
  const last = sunday.lastMatch;
  return {
    season: state.season,
    week: state.week,
    balance: sunday.balance,
    reputation: sunday.reputation,
    teamMorale: sunday.teamMorale,
    squadSize: sunday.squad.length,
    availableCount: sunday.squad.filter(m => m.availability.status !== 'out').length,
    lastResult: last ? (last.goalsFor > last.goalsAgainst ? 1 : last.goalsFor === last.goalsAgainst ? 0 : -1) : null,
    winless: sunday.seasonStats.winlessRun,
    winStreak: sunday.seasonStats.winRun,
    leaguePosition: sundayPosition(table, state.playerClubId),
    leagueSize: table.length,
    hasRival: !!sunday.rivalry,
    rivalHeat: sunday.rivalry?.heat ?? 0,
    hasSponsor: sunday.sponsors.length > 0,
    subsOwed: sunday.squad.reduce((n, m) => n + m.subsOwed, 0),
    captain: person(sunday.captainId),
    subject: person(sunday.pendingEvent?.playerId ?? null),
    unhappy: person([...sunday.squad].sort((a, b) => a.happiness - b.happiness)[0]?.playerId ?? null),
    flags: sunday.flags,
    flagged: (() => {
      for (const name of Object.keys(sunday.flags)) {
        const subjectId = sundayFlagSubjectId(name);
        if (subjectId) return person(subjectId);
      }
      return null;
    })(),
    defectorName: sunday.rivalry?.defector?.name ?? null,
  };
}

export function startSundayLeague(set: Set, get: Get, options: StartSundayOptions) {
  // Clean slate, exactly like `startWorldCup`: this is the new-game-into-slot
  // flow, so the slot on disk goes too.
  get().resetGame();
  const world = buildSundayWorld(options);
  applySundayWorld(set, get, world);
  addGameBreadcrumb('game_start', 'Sunday League started', {
    personality: options.personality,
    squadSize: world.sunday.squad.length,
  });
  track('game_started', {
    communityPackEnabled: false,
    gameMode: 'sunday',
    division: world.sunday.divisionId,
  });
  if (get().settings.autoSave) get().saveGame();
}

export function setSundayTactic(set: Set, get: Get, tactic: SundayTacticId) {
  const sunday = get().sunday;
  if (!sunday) return;
  set({ sunday: { ...sunday, tactic } });
}

export function setSundayCaptain(set: Set, get: Get, playerId: string) {
  const state = get();
  const sunday = state.sunday;
  if (!sunday || !memberOf(sunday, playerId)) return;
  const previous = sunday.captainId;
  let squad = sunday.squad;
  // The armband is worth something to the man who gets it and costs
  // something from the man who loses it — otherwise it is a cosmetic dropdown.
  squad = updateMember(squad, playerId, m => ({ happiness: clampRound(m.happiness + 6, 0, 100) }));
  if (previous && previous !== playerId) {
    squad = updateMember(squad, previous, m => ({
      happiness: clampRound(m.happiness - 4 - Math.max(0, m.ego - 12) * 0.5, 0, 100),
    }));
  }
  set({ sunday: { ...sunday, captainId: playerId, squad } });
}

/**
 * Whether the manager may still change the side, and what happens to the
 * resolved Sunday morning if he does.
 *
 * The morning is cached per (season, week) so a reload replays it. That cache
 * used to make a re-picked teamsheet a lie: `ensureArrival` returned the old
 * `presentIds`, so the XI that took the field was the one named BEFORE the
 * change. Two cases, and they are different:
 *
 *   - Nothing committed yet (`ringersHired === null`): the change is honoured
 *     and the morning is thrown away, to be re-derived from the new sheet. No
 *     save-scum in it: `ensureArrival` WRITES the morning's attrition into the
 *     squad (a doubt that cried off is stored as `out`), so a second pass has
 *     no doubts left to re-roll and nobody who is missing can come back.
 *   - Guests already booked (`ringersHired !== null`): money has been
 *     committed against a named side, so the side is fixed. Re-picking after
 *     paying — or, worse, paying for guests and then naming a full XI — is the
 *     one way the arrival decision could be gamed.
 */
function arrivalGuard(state: GameState, sunday: SundayState): { locked: boolean; clearArrival: boolean } {
  const a = sunday.arrival;
  if (!a || a.season !== state.season || a.week !== state.week) return { locked: false, clearArrival: false };
  return a.ringersHired !== null
    ? { locked: true, clearArrival: false }
    : { locked: false, clearArrival: true };
}

/** English, deliberately: same register as every other message these actions
 *  return, all of which are game voice rather than UI chrome. */
const ARRIVAL_LOCKED_MESSAGE = 'The guests are booked and paid for. This is the side.';

export function setSundayTeamsheet(set: Set, get: Get, xi: string[], bench: string[]) {
  const state = get();
  const sunday = state.sunday;
  if (!sunday) return { ok: false, message: 'No Sunday League save is active.' };
  const guard = arrivalGuard(state, sunday);
  if (guard.locked) return { ok: false, message: ARRIVAL_LOCKED_MESSAGE };

  const known = new Map(sunday.squad.map(m => [m.playerId, m]));
  const seen = new Set<string>();
  const cleanXi: string[] = [];
  for (const id of xi) {
    const m = known.get(id);
    if (!m || seen.has(id) || m.availability.status === 'out') continue;
    seen.add(id);
    cleanXi.push(id);
    if (cleanXi.length >= SUNDAY_FULL_XI) break;
  }
  const cleanBench: string[] = [];
  for (const id of bench) {
    const m = known.get(id);
    if (!m || seen.has(id) || m.availability.status === 'out') continue;
    seen.add(id);
    cleanBench.push(id);
    if (cleanBench.length >= SUNDAY_MAX_BENCH) break;
  }

  set({
    sunday: {
      ...sunday,
      teamsheet: cleanXi,
      bench: cleanBench,
      teamsheetLocked: cleanXi.length >= SUNDAY_MIN_START,
      ...(guard.clearArrival ? { arrival: null } : {}),
    },
  });
  if (cleanXi.length < SUNDAY_MIN_START) {
    return { ok: false, message: `Only ${cleanXi.length} named. You need ${SUNDAY_MIN_START} to start a match.` };
  }
  return {
    ok: true,
    message: cleanXi.length < SUNDAY_FULL_XI
      ? `Team named — ${cleanXi.length} men. It will have to do.`
      : 'Team named.',
  };
}

export function autoPickSundayTeamsheet(set: Set, get: Get) {
  const state = get();
  const sunday = state.sunday;
  if (!sunday) return { picked: 0, short: true };
  const guard = arrivalGuard(state, sunday);
  if (guard.locked) return { picked: sunday.teamsheet.length, short: sunday.teamsheet.length < SUNDAY_FULL_XI };
  const { xi, bench } = autoPickSunday(sunday, state.players);
  set({
    sunday: {
      ...sunday,
      teamsheet: xi,
      bench,
      teamsheetLocked: xi.length >= SUNDAY_MIN_START,
      ...(guard.clearArrival ? { arrival: null } : {}),
    },
  });
  return { picked: xi.length, short: xi.length < SUNDAY_FULL_XI };
}

export function playSundayMatch(set: Set, get: Get): SundayMatchReport | null {
  const report = runSundayMatch(set, get);
  if (report && get().settings.autoSave) get().saveGame();
  return report;
}

/**
 * Every `SundayEventEffects` key `resolveSundayEvent` actually applies.
 *
 * The catalogue is data and the resolver is code, so an author can type an
 * effect the switch below has never heard of — which is precisely what
 * happened to `pitchDamage`: two choices in `pitch-unplayable` paid for it,
 * nothing read it, and one of them was a no-op dressed as a decision.
 * `sundayEvents.test.ts` asserts that every key used anywhere in the catalogue
 * appears here, so the next one fails CI instead of shipping.
 */
export const SUNDAY_HANDLED_EFFECT_KEYS: ReadonlySet<keyof SundayEventEffects> = new Set([
  'money', 'morale', 'reputation',
  'subjectHappiness', 'squadHappiness', 'subjectCommitment', 'subjectEgo',
  'subjectOut', 'subjectLeaves', 'subjectLeavesForRival',
  'subjectInjuryWeeks', 'subjectAttrDelta',
  'rivalHeat', 'collectSubs', 'spawnRecruit', 'pitchDamage', 'promiseStart',
  'setFlag', 'clearFlag',
] satisfies (keyof SundayEventEffects)[]);

export function resolveSundayEvent(set: Set, get: Get, choiceId: string) {
  const state = get();
  const sunday = state.sunday;
  const instance = sunday?.pendingEvent;
  if (!sunday || !instance) return null;

  // Only a choice the event actually offered may resolve it. Without this, an
  // unknown id fell through to `resolveSundayChoice`'s defensive no-op — which
  // RESOLVED the event with no effects, i.e. a free escape hatch from every
  // bad outcome for anyone poking the store. Unknown id → the event stays
  // pending and the week stays blocked.
  if (!instance.choices.some(c => c.id === choiceId)) return null;

  const ctx = buildEventContext(state, sunday);
  const { value: resolution, rngCursor } = withRng(sunday, rng => resolveSundayChoice(rng, instance, choiceId, ctx));
  const fx = resolution.effects;

  // Money an event moves is real money and belongs in the books like any other.
  const pendingLedger = [...sunday.pendingLedger];
  let balance = sunday.balance + (fx.money ?? 0);
  if (fx.money) pendingLedger.push({ kind: 'event', amount: fx.money, label: instance.title });
  let teamMorale = clampRound(sunday.teamMorale + (fx.morale ?? 0), 0, 100);
  const reputation = clampRound(sunday.reputation + (fx.reputation ?? 0), 0, 100);
  let squad = sunday.squad;
  let recruits = sunday.recruits;
  let rivalry = sunday.rivalry;
  let subjectLeft = false;
  const players: Record<string, Player> = { ...state.players };
  const clubs: Record<string, Club> = { ...state.clubs };
  let messages = state.messages;

  if (fx.squadHappiness) {
    squad = squad.map(m => ({ ...m, happiness: clampRound(m.happiness + fx.squadHappiness!, 0, 100) }));
  }

  const subjectId = instance.playerId;
  if (subjectId && memberOf(sunday, subjectId)) {
    if (fx.subjectHappiness) {
      squad = updateMember(squad, subjectId, m => ({ happiness: clampRound(m.happiness + fx.subjectHappiness!, 0, 100) }));
    }
    if (fx.subjectCommitment) {
      squad = updateMember(squad, subjectId, m => ({ commitment: clampRound(m.commitment + fx.subjectCommitment!, 1, 20) }));
    }
    if (fx.subjectEgo) {
      squad = updateMember(squad, subjectId, m => ({ ego: clampRound(m.ego + fx.subjectEgo!, 1, 20) }));
    }
    // A knock cannot UNDO a longer one, and the squad record has to agree with
    // the Player. `warm-up-injury` used to overwrite `injuryWeeks` with its own
    // 2 — so a man three weeks into a five-week lay-off came back early because
    // he tweaked something doing a stretch — and then set
    // `availability.weeksRemaining` from the state BEFORE the injury, leaving
    // the squad screen and the player disagreeing about how long he was out.
    if (fx.subjectInjuryWeeks && players[subjectId]) {
      const p = players[subjectId];
      players[subjectId] = {
        ...p,
        injured: true,
        injuryWeeks: Math.max(p.injuryWeeks ?? 0, fx.subjectInjuryWeeks),
      };
    }
    if (fx.subjectOut || fx.subjectInjuryWeeks) {
      const p = players[subjectId];
      const hurt = !!p?.injured && (p?.injuryWeeks ?? 0) > 0;
      squad = updateMember(squad, subjectId, m => ({
        availability: {
          status: 'out' as const,
          reason: hurt ? 'injury' as const : (m.availability.reason ?? 'work' as const),
          note: hurt && p ? `${p.firstName} is injured` : m.availability.note,
          warned: true,
          weeksRemaining: Math.max(hurt ? p!.injuryWeeks : 1, m.availability.weeksRemaining),
        },
      }));
    }
    if (fx.subjectAttrDelta && players[subjectId]) {
      const p = players[subjectId];
      const attrs = { ...p.attributes };
      for (const k of Object.keys(attrs) as (keyof typeof attrs)[]) {
        attrs[k] = clampRound(attrs[k] + fx.subjectAttrDelta, 1, 99);
      }
      players[subjectId] = { ...p, attributes: attrs };
    }
    if (fx.subjectLeaves) {
      const p = players[subjectId];
      squad = squad.filter(m => m.playerId !== subjectId);
      const club = clubs[state.playerClubId];
      if (club) clubs[state.playerClubId] = { ...club, playerIds: club.playerIds.filter(id => id !== subjectId) };
      delete players[subjectId];
      if (p) {
        messages = sundayMessage(messages, state.season, state.week, `${p.firstName} has left`,
          `${p.firstName} ${p.lastName} is no longer available. That is a hole in the squad.`, 'warning');
      }
      // Every reference goes with him: teamsheet, bench slot and armband. The
      // release path guards all three; a departure through an event must too —
      // a dangling captainId is the violation the stress harness caught.
      subjectLeft = true;
    }
    if (fx.subjectLeavesForRival) {
      const p = players[subjectId];
      squad = squad.filter(m => m.playerId !== subjectId);
      const club = clubs[state.playerClubId];
      if (club) clubs[state.playerClubId] = { ...club, playerIds: club.playerIds.filter(id => id !== subjectId) };
      delete players[subjectId];
      subjectLeft = true;
      if (p && rivalry) {
        // The feud gets a face. His name follows both clubs around from here:
        // derby build-ups mention him, and results against them carry him in
        // the incident log.
        const fullName = `${p.firstName} ${p.lastName}`;
        rivalry = recordRivalryIncident(
          bumpHeat({ ...rivalry, defector: { name: fullName, season: state.season } }, 3),
          `Season ${state.season}: ${fullName} crossed the road to ${clubs[rivalry.clubId]?.shortName ?? 'the rival'}. Nobody says his name lightly now.`,
        );
        teamMorale = clampRound(teamMorale - 4, 0, 100);
        messages = sundayMessage(messages, state.season, state.week, `${p.firstName} has joined the rival`,
          `${fullName} is theirs now. The next derby just became personal for everyone.`, 'warning');
      }
    }
    if (fx.promiseStart) {
      squad = updateMember(squad, subjectId, {
        promise: {
          kind: 'start',
          madeSeason: state.season,
          madeWeek: state.week,
          dueWeek: state.week + SUNDAY_PROMISE_WEEKS,
        },
      });
    }
  }

  // Chain flags. `{subject}` binds the flag to this event's player, which is
  // how a multi-step story stays about one person.
  let flags = sunday.flags;
  const bindFlag = (name: string) => name.replace('{subject}', subjectId ?? 'nobody');
  if (fx.setFlag) flags = { ...flags, [bindFlag(fx.setFlag)]: state.week };
  if (fx.clearFlag) {
    const cleared = bindFlag(fx.clearFlag);
    flags = Object.fromEntries(Object.entries(flags).filter(([k]) => k !== cleared));
  }
  // A man who has gone takes his story with him. `rival-bid`'s release branch
  // and its fight-failure branch both left `wants-out:<id>` set on a player who
  // no longer existed, which blocked the chain from ever starting again (up to
  // the six-week flag expiry) and pointed `ctx.flagged` at a ghost. Done
  // generically rather than by matching `'wants-out:'`, so the next chain gets
  // the cleanup for free.
  if (subjectLeft) flags = pruneSundayFlags(flags, new Set(squad.map(m => m.playerId)));

  if (fx.collectSubs) {
    const owed = squad.reduce((n, m) => n + m.subsOwed, 0);
    const recovered = Math.round(owed * fx.collectSubs);
    balance += recovered;
    if (recovered !== 0) pendingLedger.push({ kind: 'subs', amount: recovered, label: 'Subs chased down' });
    squad = squad.map(m => ({ ...m, subsOwed: Math.round(m.subsOwed * (1 - fx.collectSubs!)) }));
  }

  if (fx.rivalHeat && rivalry) {
    rivalry = { ...rivalry, heat: clamp(rivalry.heat + fx.rivalHeat, 0, SUNDAY_RIVAL_HEAT_MAX) };
  }

  // Playing on a churned surface churns it further. `sundayPitchQuality` reads
  // this straight into the match engine's pitch channel, so "we talked him into
  // letting us play" now costs the club something it can feel for a few weeks.
  const pitchDamage = fx.pitchDamage
    ? clampRound(sunday.pitchDamage + fx.pitchDamage, 0, SUNDAY_PITCH_DAMAGE_MAX)
    : sunday.pitchDamage;

  const captainId = subjectLeft && sunday.captainId === subjectId
    ? ([...squad].sort((a, b) => (b.influence * 2 + b.commitment) - (a.influence * 2 + a.commitment))[0]?.playerId ?? null)
    : sunday.captainId;

  let recruitCursor = rngCursor;
  if (fx.spawnRecruit && squad.length < SUNDAY_MAX_SQUAD) {
    const squadPlayers = squad.map(m => players[m.playerId]).filter((p): p is Player => !!p);
    const spawn = withRng({ ...sunday, rngCursor }, rng => generateSundayRecruit({
      rng, season: state.season, week: state.week, reputation,
      personality: sunday.identity.personality,
      needs: sundaySquadNeeds(squadPlayers),
      clubhouseLevel: sunday.upgrades.find(u => u.id === 'clubhouse')?.level ?? 0,
      rivalName: sunday.rivalry ? clubs[sunday.rivalry.clubId]?.shortName ?? null : null,
      vouchName: squadPlayers[0]?.firstName ?? 'someone',
      town: sunday.identity.town,
      index: recruits.length,
      source: fx.spawnRecruit,
    }));
    recruits = [...recruits, spawn.value];
    recruitCursor = spawn.rngCursor;
  }

  const nextSunday: SundayState = {
    ...sunday,
    balance: Math.round(balance),
    teamMorale,
    reputation,
    squad,
    captainId,
    teamsheet: subjectLeft ? sunday.teamsheet.filter(id => id !== subjectId) : sunday.teamsheet,
    bench: subjectLeft ? sunday.bench.filter(id => id !== subjectId) : sunday.bench,
    recruits,
    rivalry,
    flags,
    pitchDamage,
    pendingLedger,
    rngCursor: recruitCursor,
    pendingEvent: null,
    eventLog: [...sunday.eventLog, {
      season: state.season, week: state.week, defId: instance.defId, summary: resolution.outcome,
    }].slice(-SUNDAY_EVENT_LOG_MAX),
    weekLog: logWeek(sunday, resolution.outcome),
  };

  set({ sunday: nextSunday, players, clubs, messages });
  if (get().settings.autoSave) get().saveGame();
  return { outcome: resolution.outcome };
}

export function signSundayRecruit(set: Set, get: Get, recruitId: string) {
  const state = get();
  const sunday = state.sunday;
  if (!sunday) return { ok: false, message: 'No Sunday League save is active.' };
  const recruit = sunday.recruits.find(r => r.id === recruitId);
  // Signing twice is the classic double-tap bug: the guard is the absence of
  // the recruit from the board after the first call.
  if (!recruit) return { ok: false, message: 'He has already signed somewhere else.' };
  if (sunday.squad.length >= SUNDAY_MAX_SQUAD) {
    return { ok: false, message: 'There are already too many names on the sheet.' };
  }
  if (sunday.balance < recruit.fee) {
    return { ok: false, message: `You cannot cover the £${recruit.fee}.` };
  }

  const player: Player = { ...recruit.player, clubId: state.playerClubId, joinedSeason: state.season };
  const club = state.clubs[state.playerClubId];
  if (!club) return { ok: false, message: 'Club missing.' };

  const heat = recruit.source === 'poached' && sunday.rivalry
    ? clamp(sunday.rivalry.heat + SUNDAY_POACH_HEAT, 0, SUNDAY_RIVAL_HEAT_MAX)
    : sunday.rivalry?.heat ?? 0;

  set({
    players: { ...state.players, [player.id]: player },
    clubs: { ...state.clubs, [club.id]: { ...club, playerIds: [...club.playerIds, player.id] } },
    messages: sundayMessage(state.messages, state.season, state.week, `${player.firstName} has signed`,
      `${player.firstName} ${player.lastName} is registered. ${recruit.sourceText}`),
    sunday: {
      ...sunday,
      balance: Math.round(sunday.balance - recruit.fee),
      pendingLedger: recruit.fee > 0
        ? [...sunday.pendingLedger, { kind: 'recruit' as const, amount: -recruit.fee, label: `${player.firstName} ${player.lastName} — signing on` }]
        : sunday.pendingLedger,
      recruits: sunday.recruits.filter(r => r.id !== recruitId),
      rivalry: sunday.rivalry ? { ...sunday.rivalry, heat } : null,
      squad: [...sunday.squad, {
        ...recruit.member,
        playerId: player.id,
        joinedSeason: state.season,
        availability: { status: 'available', reason: null, note: null, warned: true, weeksRemaining: 0 },
      }],
      weekLog: logWeek(sunday, `${player.firstName} ${player.lastName} has signed on.`),
    },
  });
  if (get().settings.autoSave) get().saveGame();
  return { ok: true, message: `${player.firstName} ${player.lastName} is registered.` };
}

export function releaseSundayPlayer(set: Set, get: Get, playerId: string) {
  const state = get();
  const sunday = state.sunday;
  if (!sunday) return { ok: false, message: 'No Sunday League save is active.' };
  const member = memberOf(sunday, playerId);
  if (!member) return { ok: false, message: 'He is not on the books.' };
  if (sunday.squad.length <= SUNDAY_MIN_START) {
    return { ok: false, message: 'You cannot go below the minimum to field a side.' };
  }
  const player = state.players[playerId];
  const club = state.clubs[state.playerClubId];
  const players = { ...state.players };
  delete players[playerId];

  // Telling somebody they are not wanted is noticed by everybody else. A
  // popular player costs more goodwill than an unpopular one.
  const moraleHit = 2 + Math.round(member.influence / 5);
  set({
    players,
    clubs: club ? { ...state.clubs, [club.id]: { ...club, playerIds: club.playerIds.filter(id => id !== playerId) } } : state.clubs,
    sunday: {
      ...sunday,
      squad: sunday.squad.filter(m => m.playerId !== playerId),
      captainId: sunday.captainId === playerId ? null : sunday.captainId,
      teamsheet: sunday.teamsheet.filter(id => id !== playerId),
      bench: sunday.bench.filter(id => id !== playerId),
      // Any chain that was about him goes too.
      flags: pruneSundayFlags(sunday.flags, new Set(sunday.squad.filter(m => m.playerId !== playerId).map(m => m.playerId))),
      teamMorale: clampRound(sunday.teamMorale - moraleHit, 0, 100),
      weekLog: logWeek(sunday, `${player ? player.firstName : 'A player'} has been told he is not needed.`),
    },
  });
  if (get().settings.autoSave) get().saveGame();
  return { ok: true, message: `${player ? `${player.firstName} ${player.lastName}` : 'He'} has been released.` };
}

export function buySundayUpgrade(set: Set, get: Get, upgradeId: SundayUpgradeId) {
  const state = get();
  const sunday = state.sunday;
  if (!sunday) return { ok: false, message: 'No Sunday League save is active.' };
  const info = getSundayUpgrade(upgradeId);
  const current = sunday.upgrades.find(u => u.id === upgradeId)?.level ?? 0;
  if (current >= info.maxLevel) return { ok: false, message: 'Nothing more to buy here.' };
  if (sunday.reputation < info.minReputation) {
    return { ok: false, message: `The club is not established enough for that yet.` };
  }
  const cost = sundayUpgradeCost(upgradeId, current);
  if (sunday.balance < cost) return { ok: false, message: `You are £${cost - Math.round(sunday.balance)} short.` };

  const upgrades = sunday.upgrades.some(u => u.id === upgradeId)
    ? sunday.upgrades.map(u => (u.id === upgradeId ? { ...u, level: u.level + 1 } : u))
    : [...sunday.upgrades, { id: upgradeId, level: 1 }];


  // A few upgrades pay out immediately rather than through the sim.
  const moraleBump = upgradeId === 'kit' ? 3 : upgradeId === 'clubhouse' ? 2 : 0;
  const repBump = upgradeId === 'kit' ? 2 : upgradeId === 'nets' ? 1 : upgradeId === 'floodlights' ? 3 : 0;

  set({
    sunday: {
      ...sunday,
      upgrades,
      balance: Math.round(sunday.balance - cost),
      teamMorale: clampRound(sunday.teamMorale + moraleBump, 0, 100),
      reputation: clampRound(sunday.reputation + repBump, 0, 100),
      // Parked for THIS week's settlement. It used to be appended to the
      // PREVIOUS week's entry without moving that entry's `balance` field —
      // and silently dropped when the ledger was still empty.
      pendingLedger: [...sunday.pendingLedger, { kind: 'upgrade' as const, amount: -cost, label: info.name }],
      weekLog: logWeek(sunday, `Bought: ${info.name}.`),
    },
  });
  if (get().settings.autoSave) get().saveGame();
  return { ok: true, message: `${info.name} — done. £${cost} gone.` };
}

export function acceptSundaySponsor(set: Set, get: Get, offerId: string) {
  const state = get();
  const sunday = state.sunday;
  if (!sunday) return { ok: false, message: 'No Sunday League save is active.' };
  const offer = sunday.sponsorOffers.find(o => o.id === offerId);
  if (!offer) return { ok: false, message: 'That offer has gone.' };
  if (sunday.sponsors.some(s => s.id === offer.id)) return { ok: false, message: 'Already signed.' };

  const { expiresWeek: _lapsed, ...deal } = offer;
  set({
    sunday: {
      ...sunday,
      sponsors: [...sunday.sponsors, deal],
      sponsorOffers: sunday.sponsorOffers.filter(o => o.id !== offerId),
      balance: Math.round(sunday.balance + offer.signOn),
      pendingLedger: offer.signOn > 0
        ? [...sunday.pendingLedger, { kind: 'sponsor' as const, amount: offer.signOn, label: `${offer.name} sign-on` }]
        : sunday.pendingLedger,
      reputation: clampRound(sunday.reputation + 1, 0, 100),
      weekLog: logWeek(sunday, `${offer.name} are on the shirt. £${offer.signOn} up front.`),
    },
  });
  if (get().settings.autoSave) get().saveGame();
  return { ok: true, message: `${offer.name} signed. £${offer.signOn} in the bank.` };
}

export function declineSundaySponsor(set: Set, get: Get, offerId: string) {
  const sunday = get().sunday;
  if (!sunday) return;
  set({ sunday: { ...sunday, sponsorOffers: sunday.sponsorOffers.filter(o => o.id !== offerId) } });
}

export function runSundayFundraiser(set: Set, get: Get) {
  const state = get();
  const sunday = state.sunday;
  if (!sunday) return { ok: false, message: 'No Sunday League save is active.', raised: 0 };
  if (state.week - sunday.lastFundraiserWeek < SUNDAY_FUNDRAISER_COOLDOWN) {
    const weeks = SUNDAY_FUNDRAISER_COOLDOWN - (state.week - sunday.lastFundraiserWeek);
    return { ok: false, message: `Too soon. Give it ${weeks} more week${weeks === 1 ? '' : 's'}.`, raised: 0 };
  }
  const { value: raised, rngCursor } = withRng(sunday, rng =>
    Math.round(rng.int(SUNDAY_FUNDRAISER_MIN, SUNDAY_FUNDRAISER_MAX) * (0.7 + sunday.reputation / 120)));

  set({
    sunday: {
      ...sunday,
      rngCursor,
      balance: Math.round(sunday.balance + raised),
      teamMorale: clampRound(sunday.teamMorale + SUNDAY_FUNDRAISER_MORALE, 0, 100),
      lastFundraiserWeek: state.week,
      pendingLedger: [...sunday.pendingLedger, { kind: 'fundraiser' as const, amount: raised, label: 'Fundraiser' }],
      weekLog: logWeek(sunday, `The fundraiser brought in £${raised}. Everybody had to help.`),
    },
  });
  if (get().settings.autoSave) get().saveGame();
  return { ok: true, message: `£${raised} raised. Nobody enjoyed it.`, raised };
}

export function chaseSundaySubs(set: Set, get: Get) {
  const state = get();
  const sunday = state.sunday;
  if (!sunday) return { ok: false, message: 'No Sunday League save is active.', recovered: 0 };
  const owed = sunday.squad.reduce((n, m) => n + m.subsOwed, 0);
  if (owed <= 0) return { ok: false, message: 'Everybody is square. Enjoy it while it lasts.', recovered: 0 };
  const recovered = Math.round(owed * SUNDAY_CHASE_SUBS_RECOVERY);
  set({
    sunday: {
      ...sunday,
      balance: Math.round(sunday.balance + recovered),
      pendingLedger: [...sunday.pendingLedger, { kind: 'subs' as const, amount: recovered, label: 'Subs chased down' }],
      squad: sunday.squad.map(m => ({
        ...m,
        subsOwed: Math.round(m.subsOwed * (1 - SUNDAY_CHASE_SUBS_RECOVERY)),
        happiness: clampRound(m.happiness + (m.subsOwed > 0 ? SUNDAY_CHASE_SUBS_MORALE : 0), 0, 100),
      })),
      teamMorale: clampRound(sunday.teamMorale + SUNDAY_CHASE_SUBS_MORALE, 0, 100),
      weekLog: logWeek(sunday, `£${recovered} of subs chased down. The group chat is hostile.`),
    },
  });
  if (get().settings.autoSave) get().saveGame();
  return { ok: true, message: `£${recovered} recovered. It cost you some goodwill.`, recovered };
}

export function ringRoundSunday(set: Set, get: Get, playerId: string) {
  const state = get();
  const sunday = state.sunday;
  if (!sunday) return { ok: false, message: 'No Sunday League save is active.' };
  const member = memberOf(sunday, playerId);
  if (!member) return { ok: false, message: 'He is not on the books.' };
  if (member.availability.status !== 'out') return { ok: false, message: 'He is already available.' };
  if (sunday.balance < SUNDAY_RINGROUND_COST) return { ok: false, message: 'You cannot even afford the phone credit.' };

  const chance = ringRoundChance(member);
  if (chance <= 0) {
    return { ok: false, message: 'There is nothing you can say that will change this one.' };
  }
  const { value: talkedRound, rngCursor } = withRng(sunday, rng => rng.chance(chance));
  const player = state.players[playerId];

  set({
    sunday: {
      ...sunday,
      rngCursor,
      balance: Math.round(sunday.balance - SUNDAY_RINGROUND_COST),
      pendingLedger: [...sunday.pendingLedger, {
        kind: 'ring-round' as const,
        amount: -SUNDAY_RINGROUND_COST,
        label: `Ring-round (${player?.firstName ?? 'a phone call'})`,
      }],
      teamMorale: clampRound(sunday.teamMorale + SUNDAY_RINGROUND_MORALE, 0, 100),
      squad: talkedRound
        ? updateMember(sunday.squad, playerId, m => ({
            availability: { status: 'available' as const, reason: null, note: null, warned: true, weeksRemaining: 0 },
            memories: rememberMoment(m.memories, makeMemory(state.season, state.week, 'talked-round',
              'Was going to skip it. One phone call later he was there — and everybody knew who made the call.')),
          }))
        : sunday.squad,
      weekLog: logWeek(sunday, talkedRound
        ? `${player?.firstName ?? 'He'} has been talked round.`
        : `${player?.firstName ?? 'He'} is not budging.`),
    },
  });
  if (get().settings.autoSave) get().saveGame();
  return talkedRound
    ? { ok: true, message: `${player?.firstName ?? 'He'} will be there after all.` }
    : { ok: false, message: `${player?.firstName ?? 'He'} is not coming. That is that.` };
}

export function endSundaySeason(set: Set, get: Get) {
  rolloverSundaySeason(set, get);
}

/**
 * Development-only guard: shout loudly when the store reaches an impossible
 * state. Called from `loadGame` and after a season rollover — the two moments
 * where a whole state arrives at once and a silent corruption would otherwise
 * surface as a blank screen several taps later.
 */
export function assertSundayStateInDev(state: GameState): void {
  if (!import.meta.env.DEV) return;
  if (state.gameMode !== 'sunday' || !state.sunday) return;
  const result = validateSundayState({
    sunday: state.sunday,
    players: state.players,
    clubs: state.clubs,
    playerClubId: state.playerClubId,
    fixtures: state.fixtures,
    week: state.week,
  });
  if (!result.ok) {
    console.error('[Sunday] invalid state:\n  - ' + result.problems.join('\n  - '));
  }
}
