/**
 * Sunday League — event selection and resolution.
 *
 * Two jobs, kept apart on purpose:
 *
 *   `pickSundayEvent`     decides WHICH event fires, honouring conditions,
 *                         cooldowns and once-per-save flags.
 *   `resolveSundayChoice` decides WHAT HAPPENS, returning a plain description
 *                         of the state changes rather than applying them.
 *
 * The split is what makes the whole system testable without a store, and it is
 * why the same effect cannot be applied twice: the slice applies a resolution
 * exactly once and clears `pendingEvent` in the same `set`.
 */
import type {
  Player, SundayChainId, SundayChainState, SundayEventInstance,
  SundayEventChoiceState, SundaySquadMember, SundayState,
} from '@/types/game';
import type { SundayEventContext, SundayEventDef, SundayEventEffects, SundayEventPerson } from '@/data/sundayEvents';
import { SUNDAY_EVENTS, fillSundayEventText } from '@/data/sundayEvents';
import {
  SUNDAY_CHAIN_SEASON_MARGIN, SUNDAY_DEPARTURE_FLAG, SUNDAY_EVENT_COOLDOWN,
  SUNDAY_EVENT_DEPARTURE_GAP, SUNDAY_EVENT_NEGATIVE_DAMPING, SUNDAY_ROUGH_WEEK_FLAG,
  getSundayChain,
} from '@/config/sundayLeague';
import { isSundaySelectable } from './availability';
import { sundayCupRoundName } from './season';
import type { SundayRng } from './rng';

/** Build the read-only view of a squad member an event definition sees. */
export function toEventPerson(m: SundaySquadMember, player: Player): SundayEventPerson {
  return {
    playerId: m.playerId,
    firstName: player.firstName,
    lastName: player.lastName,
    job: m.job,
    archetype: m.archetype,
    position: player.position,
    age: player.age,
    clubApps: m.clubApps,
    available: isSundaySelectable(m),
    happiness: m.happiness,
    ego: m.ego,
    commitment: m.commitment,
    temper: m.temper,
    influence: m.influence,
    overall: player.overall,
    benchedStreak: m.benchedStreak,
  };
}

/** Who an event is about unless it says otherwise: somebody who will actually
 *  be there. Most of the catalogue describes a man in a car park. */
const DEFAULT_SUBJECT_FILTER = (p: SundayEventPerson): boolean => p.available;

/**
 * The cup, as an event definition sees it.
 *
 * Until the cup chain there was no such view, and NO event in the catalogue
 * read the cup at all — a mode with a knockout in it never mentioned the
 * knockout, and could not have done so without risking telling the club about
 * a semi-final it went out of a fortnight ago.
 */
export function sundayCupView(
  sunday: Pick<SundayState, 'cup' | 'divisionId'>,
  clubId: string,
): Pick<SundayEventContext, 'cupAlive' | 'cupRoundsWon' | 'cupRoundName'> {
  const cup = sunday.cup;
  if (!cup) return { cupAlive: false, cupRoundsWon: 0, cupRoundName: null };
  const ours = cup.ties.filter(t => t.homeClubId === clubId || t.awayClubId === clubId);
  const next = ours.find(t => !t.played);
  return {
    cupAlive: !cup.eliminated && !!next,
    cupRoundsWon: ours.filter(t => t.played && t.winnerClubId === clubId).length,
    cupRoundName: next ? sundayCupRoundName(next.round) : null,
  };
}

/** Which KINDS of story are already running. Every chain opener checks the one
 *  that matters to it, which is what keeps the mode to one story per kind. */
export function sundayStoryFlags(
  chains: readonly SundayChainState[],
): Pick<SundayEventContext, 'playerStoryLive' | 'clubStoryLive'> {
  return {
    playerStoryLive: chains.some(c => getSundayChain(c.id).kind === 'player'),
    clubStoryLive: chains.some(c => getSundayChain(c.id).kind === 'club'),
  };
}

export interface PickEventInput {
  rng: SundayRng;
  /** The state the conditions are judged against. `subject` is REPLACED per
   *  definition with the person that definition is allowed to be about, so
   *  callers do not pre-pick one. */
  ctx: SundayEventContext;
  /** Every squad member, as the catalogue sees them. Each definition filters
   *  this itself via `subjectFilter`. */
  subjects: readonly SundayEventPerson[];
  cooldowns: Readonly<Record<string, number>>;
  /** defIds already fired at least once, for `once: true` events. */
  firedOnce: ReadonlySet<string>;
  week: number;
  rivalName: string | null;
  clubName: string;
}

/**
 * Choose an event, or null when nothing is eligible.
 *
 * Anti-repeat is enforced HERE and nowhere else: an event on cooldown is never
 * even considered, so no caller can accidentally re-fire one.
 *
 * SUBJECT SELECTION. One shuffle of the squad is taken up front and every
 * definition claims the first person in that order who passes its
 * `subjectFilter`. The alternative — the old behaviour — was to pre-pick a
 * single random subject and judge every condition against him, which is how
 * "the goalkeeper is in no state" came to be about a centre-half, and how an
 * event with a condition like `ego >= 15` silently never fired in a week where
 * the one pre-picked man happened to be modest.
 */
export function pickSundayEvent(input: PickEventInput): SundayEventInstance | null {
  const { rng, ctx, cooldowns, firedOnce, week, subjects } = input;
  const order = rng.shuffle(subjects);

  const personFor = (def: SundayEventDef, chain: SundayChainState | null): SundayEventPerson | null => {
    if (!def.needsSubject) return null;
    if (def.subjectIsCaptain) return ctx.captain ?? null;
    const filter = def.subjectFilter ?? DEFAULT_SUBJECT_FILTER;
    // A beat of a PLAYER chain is about the man the chain named, full stop.
    // (A club chain names nobody, so its beats pick freely like any other.)
    if (chain?.subjectId) {
      const bound = subjects.find(p => p.playerId === chain.subjectId);
      return bound && filter(bound) ? bound : null;
    }
    return order.find(filter) ?? null;
  };

  // Clustering protection, read once. Both rules exempt chain beats: a story
  // that has started must be allowed to finish on schedule, and the chain cap
  // already rations how many of them there can be.
  // Fresh for about a fortnight: the week the bad thing landed and the one
  // after it.
  const roughWeek = ctx.flags[SUNDAY_ROUGH_WEEK_FLAG];
  const damped = roughWeek != null && week - roughWeek <= 1;
  const lastDeparture = ctx.flags[SUNDAY_DEPARTURE_FLAG];
  const departureBlocked = lastDeparture != null && week - lastDeparture < SUNDAY_EVENT_DEPARTURE_GAP;

  const eligible: { def: SundayEventDef; ctx: SundayEventContext; person: SundayEventPerson | null }[] = [];
  for (const def of SUNDAY_EVENTS) {
    const chain = chainFor(def, ctx);
    // A beat that is not the one its chain is waiting for is not an event.
    if (def.chain && !chain) continue;
    // One departure-causing event per `SUNDAY_EVENT_DEPARTURE_GAP` weeks. Two
    // people walking out on consecutive Sundays is a squad collapse the manager
    // had no chance to react to, not a run of bad luck.
    if (!def.chain && departureBlocked && SUNDAY_DEPARTURE_DEFS.has(def.id)) continue;
    if (def.once && firedOnce.has(def.id)) continue;
    // Cooldowns are anti-repeat for the RANDOM pool. A chain beat is rationed
    // by its own chain, and a cooldown left over from the last time the story
    // ran would strand this one at a step nothing can serve.
    if (!def.chain) {
      const readyWeek = cooldowns[def.id];
      if (readyWeek != null && week < readyWeek) continue;
    }
    const person = personFor(def, chain);
    if (def.needsSubject && !person) continue;
    const defCtx = contextFor(def, ctx, chain, person);
    try {
      if (!def.condition(defCtx)) continue;
    } catch {
      // A definition that throws is a content bug, not a reason to break the
      // week. Drop it and carry on; the invariant test catches it in CI.
      continue;
    }
    eligible.push({ def, ctx: defCtx, person });
  }
  if (!eligible.length) return null;

  // Down-weighted, NOT removed. A bad month is allowed to be a bad month; what
  // the damper prevents is three pile-ons in a row reading as the game having
  // it in for you.
  const chosen = rng.weighted(eligible, e =>
    damped && !e.def.chain && e.def.tone === 'negative'
      ? e.def.weight * SUNDAY_EVENT_NEGATIVE_DAMPING
      : e.def.weight);
  if (!chosen) return null;
  return instantiate(chosen.def, chosen.person, chosen.ctx, input);
}

/**
 * Definitions that can cost the club a player.
 *
 * Derived from the catalogue rather than listed by hand, so a new event with a
 * `subjectLeaves` branch is spaced by the departure rule automatically instead
 * of quietly opting out of it.
 */
export const SUNDAY_DEPARTURE_DEFS: ReadonlySet<string> = new Set(
  SUNDAY_EVENTS
    .filter(d => d.choices.some(c =>
      c.effects.subjectLeaves || c.effects.subjectLeavesForRival
      || c.failEffects?.subjectLeaves || c.failEffects?.subjectLeavesForRival))
    .map(d => d.id),
);

/** The live chain a definition belongs to, when it is waiting for this beat. */
function chainFor(def: SundayEventDef, ctx: SundayEventContext): SundayChainState | null {
  if (!def.chain) return null;
  const chain = ctx.chains.find(c => c.id === def.chain!.id);
  return chain && chain.step === def.chain.step ? chain : null;
}

/** The context ONE definition is judged against: its own subject, and its own
 *  chain's memory of what has been decided so far. */
function contextFor(
  def: SundayEventDef,
  ctx: SundayEventContext,
  chain: SundayChainState | null,
  person: SundayEventPerson | null,
): SundayEventContext {
  if (!def.needsSubject && !chain) return ctx;
  return {
    ...ctx,
    ...(def.needsSubject ? { subject: person } : {}),
    ...(chain ? { chainData: chain.data ?? {} } : {}),
  };
}

/** What a forced pass produced: at most one beat, plus the chains that have
 *  run out of road and must be closed. */
export interface ForcedChainResult {
  event: SundayEventInstance | null;
  /** Chains past their deadline with no beat left that is true. Nothing more
   *  can be told about them, so the caller closes them WITH A LINE. */
  stranded: SundayChainId[];
}

/**
 * Serve an overdue chain's next beat directly, bypassing the weighted draw.
 *
 * THE GUARANTEE THIS EXISTS FOR. Under the old flag scheme a started story
 * only continued if its follow-up won a 0.55 weekly roll AND then the weighted
 * draw against the whole catalogue, inside a six-week flag life — which failed
 * about a third of the time, leaving the player with a set-up and no pay-off.
 * Here the deadline is a deadline: once `week >= dueWeek` the beat is returned
 * outright, with no roll and no competition.
 *
 * Two fallbacks keep it honest rather than forceful:
 *   - if the current step's beats cannot fire (their premise stopped being
 *     true), the chain's TERMINAL beats are tried, so the story still ends
 *   - if nothing at all can fire, the chain is reported `stranded` and the
 *     caller closes it with a factual line rather than leaving it to rot
 *
 * Draws nothing from the RNG: forcing must not shift the week's other draws.
 */
export function forceSundayChainStep(input: PickEventInput): ForcedChainResult {
  const { ctx, week, subjects } = input;
  const stranded: SundayChainId[] = [];
  let event: SundayEventInstance | null = null;

  for (const chain of ctx.chains) {
    if (week < chain.dueWeek) continue;
    const info = getSundayChain(chain.id);

    const attempt = (step: number): SundayEventInstance | null => {
      for (const def of SUNDAY_EVENTS) {
        if (def.chain?.id !== chain.id || def.chain.step !== step) continue;
        let person: SundayEventPerson | null = null;
        if (def.needsSubject) {
          const filter = def.subjectFilter ?? DEFAULT_SUBJECT_FILTER;
          person = def.subjectIsCaptain
            ? ctx.captain ?? null
            : chain.subjectId
              ? subjects.find(p => p.playerId === chain.subjectId && filter(p)) ?? null
              : subjects.find(filter) ?? null;
          if (!person) continue;
        }
        const defCtx = contextFor(def, ctx, chain, person);
        try {
          if (!def.condition(defCtx)) continue;
        } catch {
          continue;
        }
        return instantiate(def, person, defCtx, input);
      }
      return null;
    };

    const forced = attempt(chain.step)
      ?? (chain.step !== info.terminalStep ? attempt(info.terminalStep) : null);
    if (forced) {
      // One forced beat per week: the pending event is a single slot, and a
      // second chain's deadline can wait a week without breaking anything.
      if (!event) { event = forced; continue; }
      continue;
    }
    stranded.push(chain.id);
  }

  return { event, stranded };
}

function instantiate(
  def: SundayEventDef,
  person: SundayEventPerson | null,
  ctx: SundayEventContext,
  input: PickEventInput,
): SundayEventInstance {
  const { rivalName, clubName } = input;
  const vars = {
    name: person ? person.firstName : undefined,
    job: person?.job,
    rival: rivalName ?? undefined,
    club: clubName,
    balance: ctx.balance,
    subsOwed: ctx.subsOwed,
    squadSize: ctx.squadSize,
    apps: person?.clubApps,
    weeks: ctx.weeksInDebt,
    round: ctx.cupRoundName,
  };
  const choices: SundayEventChoiceState[] = def.choices
    .filter(c => !c.available || c.available(ctx))
    .map(c => ({ id: c.id, label: fillSundayEventText(c.label, vars), hint: fillSundayEventText(c.hint, vars) }));

  // Every choice being unavailable (all of them cost money the club has not
  // got) would leave a modal with no way out. Fall back to an acknowledgement
  // so the player is never stuck.
  if (!choices.length) {
    choices.push({ id: '__ack', label: 'Nothing you can do', hint: '' });
  }

  return {
    defId: def.id,
    season: ctx.season,
    week: ctx.week,
    title: fillSundayEventText(def.title, vars),
    body: fillSundayEventText(def.body, vars),
    // An event with no subject carries no player id. It used to inherit the
    // pre-picked one, which pointed the modal at somebody the text never
    // mentioned.
    playerId: person?.playerId ?? null,
    choices,
    category: def.category,
  };
}

/** True when a definition may fire only once per save. */
export function isOnceSundayEvent(defId: string): boolean {
  return SUNDAY_EVENTS.find(d => d.id === defId)?.once === true;
}

/** The chain a definition is a beat of, or null when it is a one-off. */
export function sundayEventChainId(defId: string): SundayChainId | null {
  return SUNDAY_EVENTS.find(d => d.id === defId)?.chain?.id ?? null;
}

/**
 * The player a chain flag is about, when its name embeds one.
 *
 * Flags are named `<chain>:<playerId>` — see `SundayState.flags`, and the
 * `{subject}` substitution in the event resolver. Returning the id lets both
 * the departure cleanup and the invariant check work generically instead of
 * string-matching `'wants-out:'` in three places.
 */
export function sundayFlagSubjectId(name: string): string | null {
  const idx = name.indexOf(':');
  if (idx < 0) return null;
  const tail = name.slice(idx + 1);
  return tail.startsWith('sun-') ? tail : null;
}

// ── Chain lifecycle ─────────────────────────────────────────────────────────

/**
 * When the next beat of a chain is due.
 *
 * CLAMPED TO THE SEASON. A deadline past the last Sunday could never be met —
 * no event fires on the advance that ends the season — so a story started in
 * the run-in would be quietly deleted by the rollover. Pulling the deadline
 * forward instead forces the remaining beats out while there is still a season
 * to tell them in. See `SUNDAY_CHAIN_SEASON_MARGIN`.
 */
export function sundayChainDeadline(
  id: SundayChainId,
  week: number,
  totalWeeks: number,
  durationWeeks?: number,
): number {
  const info = getSundayChain(id);
  const wanted = week + (durationWeeks ?? info.durationWeeks);
  const latest = Math.max(week, totalWeeks - SUNDAY_CHAIN_SEASON_MARGIN);
  return Math.min(wanted, latest);
}

export interface StartChainInput {
  chains: readonly SundayChainState[];
  id: SundayChainId;
  subjectId: string | null;
  /** First name of the subject, kept so a closing line can name him after his
   *  Player record has gone. */
  subjectName?: string | null;
  season: number;
  week: number;
  totalWeeks: number;
  durationWeeks?: number;
  data?: Record<string, string | number>;
}

/**
 * Open a chain, replacing any live chain of the same KIND.
 *
 * The cap (one player story, one club story) is enforced here rather than only
 * in the openers' conditions: an opener whose condition was written wrong would
 * otherwise leave two live player chains fighting over the subject slot, which
 * the invariants reject on the next load.
 */
export function startSundayChain(input: StartChainInput): SundayChainState[] {
  const info = getSundayChain(input.id);
  const kept = input.chains.filter(c => getSundayChain(c.id).kind !== info.kind);
  const data: Record<string, string | number> = { ...(input.data ?? {}) };
  if (input.subjectName) data.name = input.subjectName;
  return [...kept, {
    id: input.id,
    // Openers are unchained, so the first beat a chain waits for is step 2.
    step: 2,
    subjectId: info.kind === 'player' ? input.subjectId : null,
    startedWeek: input.week,
    startedSeason: input.season,
    dueWeek: sundayChainDeadline(input.id, input.week, input.totalWeeks, input.durationWeeks),
    data,
  }];
}

/** Move a chain to its next beat and reset the deadline. A chain that would
 *  advance past its terminal step is closed instead — a content bug must not
 *  leave a story waiting for a beat that does not exist. */
export function advanceSundayChain(
  chains: readonly SundayChainState[],
  id: SundayChainId,
  week: number,
  totalWeeks: number,
  data?: Record<string, string | number>,
): SundayChainState[] {
  const info = getSundayChain(id);
  const out: SundayChainState[] = [];
  for (const c of chains) {
    if (c.id !== id) { out.push(c); continue; }
    const step = c.step + 1;
    if (step > info.terminalStep) continue;
    out.push({
      ...c,
      step,
      dueWeek: sundayChainDeadline(id, week, totalWeeks),
      data: { ...(c.data ?? {}), ...(data ?? {}) },
    });
  }
  return out;
}

/** Record what a beat decided without moving the story on. */
export function writeSundayChainData(
  chains: readonly SundayChainState[],
  id: SundayChainId,
  data: Record<string, string | number>,
): SundayChainState[] {
  return chains.map(c => (c.id === id ? { ...c, data: { ...(c.data ?? {}), ...data } } : c));
}

export function endSundayChain(
  chains: readonly SundayChainState[],
  id: SundayChainId,
): SundayChainState[] {
  return chains.filter(c => c.id !== id);
}

/** Drop every chain about somebody who is no longer on the books, reporting
 *  what was dropped so the caller can SAY the story is over. A chain naming a
 *  departed player blocks its kind's slot and points the arc at a ghost. */
export function pruneSundayChains(
  chains: readonly SundayChainState[],
  squadIds: ReadonlySet<string>,
): { kept: SundayChainState[]; dropped: SundayChainState[] } {
  const kept: SundayChainState[] = [];
  const dropped: SundayChainState[] = [];
  for (const c of chains) {
    if (c.subjectId && !squadIds.has(c.subjectId)) dropped.push(c);
    else kept.push(c);
  }
  return { kept, dropped };
}

/** The name a chain remembered for its subject, for a closing line. */
export function sundayChainSubjectName(chain: SundayChainState): string | null {
  const name = chain.data?.name;
  return typeof name === 'string' && name ? name : null;
}

/** Drop every chain flag about somebody who is no longer on the books. A flag
 *  naming a departed player blocks his chain from ever restarting and points
 *  the story at a man who does not exist. */
export function pruneSundayFlags(
  flags: Readonly<Record<string, number>>,
  squadIds: ReadonlySet<string>,
): Record<string, number> {
  const kept = Object.entries(flags).filter(([name]) => {
    const subject = sundayFlagSubjectId(name);
    return subject === null || squadIds.has(subject);
  });
  return kept.length === Object.keys(flags).length ? { ...flags } : Object.fromEntries(kept);
}

/** The state changes a resolved choice implies. Nothing is applied here. */
export interface SundayEventResolution {
  /** English line describing what happened. */
  outcome: string;
  effects: SundayEventEffects;
  /** True when a `successChance` roll was taken and failed. */
  failed: boolean;
}

/**
 * Resolve a choice into its effects.
 *
 * Unknown ids resolve to a harmless no-op rather than throwing: the modal is
 * the only caller, but a stale `pendingEvent` restored from an older save could
 * name a choice that no longer exists, and losing a week is better than a
 * crash loop on load.
 */
export function resolveSundayChoice(
  rng: SundayRng,
  instance: SundayEventInstance,
  choiceId: string,
  ctx: SundayEventContext,
): SundayEventResolution {
  const def = SUNDAY_EVENTS.find(d => d.id === instance.defId);
  if (!def) return { outcome: 'Nothing came of it.', effects: {}, failed: false };
  const choice = def.choices.find(c => c.id === choiceId);
  if (!choice) return { outcome: 'Nothing came of it.', effects: {}, failed: false };

  if (choice.successChance) {
    let p = 0.5;
    try { p = choice.successChance(ctx); } catch { p = 0.5; }
    if (!rng.chance(Math.max(0, Math.min(1, p)))) {
      return {
        outcome: choice.failOutcome ?? 'It does not go the way you hoped.',
        effects: choice.failEffects ?? {},
        failed: true,
      };
    }
  }
  return { outcome: choice.outcome, effects: choice.effects, failed: false };
}

/** Cooldown week for a definition once it has fired. */
export function cooldownWeekFor(defId: string, week: number): number {
  const def = SUNDAY_EVENTS.find(d => d.id === defId);
  return week + (def?.cooldown ?? SUNDAY_EVENT_COOLDOWN);
}

/** Every definition id, for the content-integrity test. */
export function allSundayEventIds(): string[] {
  return SUNDAY_EVENTS.map(d => d.id);
}
