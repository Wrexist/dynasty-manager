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
  Player, SundayEventInstance, SundayEventChoiceState, SundaySquadMember,
} from '@/types/game';
import type { SundayEventContext, SundayEventDef, SundayEventEffects, SundayEventPerson } from '@/data/sundayEvents';
import { SUNDAY_EVENTS, fillSundayEventText } from '@/data/sundayEvents';
import { SUNDAY_EVENT_COOLDOWN } from '@/config/sundayLeague';
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
    available: m.availability.status !== 'out',
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

  const personFor = (def: SundayEventDef): SundayEventPerson | null => {
    if (!def.needsSubject) return null;
    // `captain-furious` and its like are about the captain specifically.
    if (def.id === 'captain-furious') return ctx.captain ?? null;
    const filter = def.subjectFilter ?? DEFAULT_SUBJECT_FILTER;
    // A live chain flag points its step at ONE player, and the story stays
    // about him.
    if (ctx.flagged && filter(ctx.flagged)) return ctx.flagged;
    return order.find(filter) ?? null;
  };

  const eligible: { def: SundayEventDef; ctx: SundayEventContext; person: SundayEventPerson | null }[] = [];
  for (const def of SUNDAY_EVENTS) {
    if (def.once && firedOnce.has(def.id)) continue;
    const readyWeek = cooldowns[def.id];
    if (readyWeek != null && week < readyWeek) continue;
    const person = personFor(def);
    if (def.needsSubject && !person) continue;
    const defCtx = def.needsSubject ? { ...ctx, subject: person } : ctx;
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

  const chosen = rng.weighted(eligible, e => e.def.weight);
  if (!chosen) return null;
  return instantiate(chosen.def, chosen.person, chosen.ctx, input);
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
