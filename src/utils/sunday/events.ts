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
  SundayEventInstance, SundayEventChoiceState, SundaySquadMember,
} from '@/types/game';
import type { SundayEventContext, SundayEventDef, SundayEventEffects, SundayEventPerson } from '@/data/sundayEvents';
import { SUNDAY_EVENTS, fillSundayEventText } from '@/data/sundayEvents';
import { SUNDAY_EVENT_COOLDOWN } from '@/config/sundayLeague';
import type { SundayRng } from './rng';

/** Build the read-only view of a squad member an event definition sees. */
export function toEventPerson(m: SundaySquadMember, firstName: string, lastName: string, overall: number): SundayEventPerson {
  return {
    playerId: m.playerId,
    firstName,
    lastName,
    job: m.job,
    archetype: m.archetype,
    happiness: m.happiness,
    ego: m.ego,
    commitment: m.commitment,
    temper: m.temper,
    influence: m.influence,
    overall,
    benchedStreak: m.benchedStreak,
  };
}

export interface PickEventInput {
  rng: SundayRng;
  ctx: SundayEventContext;
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
 * even considered, so no caller can accidentally re-fire one. A `needsSubject`
 * event with no subject is likewise dropped rather than fired with a blank name.
 */
export function pickSundayEvent(input: PickEventInput): SundayEventInstance | null {
  const { rng, ctx, cooldowns, firedOnce, week } = input;
  const eligible = SUNDAY_EVENTS.filter(def => {
    if (def.once && firedOnce.has(def.id)) return false;
    const readyWeek = cooldowns[def.id];
    if (readyWeek != null && week < readyWeek) return false;
    if (def.needsSubject && !ctx.subject && !ctx.captain) return false;
    try {
      return def.condition(ctx);
    } catch {
      // A definition that throws is a content bug, not a reason to break the
      // week. Drop it and carry on; the invariant test catches it in CI.
      return false;
    }
  });
  if (!eligible.length) return null;

  const def = rng.weighted(eligible, d => d.weight);
  if (!def) return null;
  return instantiate(def, input);
}

function instantiate(def: SundayEventDef, input: PickEventInput): SundayEventInstance {
  const { ctx, rivalName, clubName } = input;
  // `captain-furious` and its like are about the captain specifically; every
  // other subject-bearing event uses the pre-picked subject.
  const person = def.id === 'captain-furious' ? (ctx.captain ?? ctx.subject) : (ctx.subject ?? ctx.captain);
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
    playerId: person?.playerId ?? null,
    choices,
    category: def.category,
  };
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
