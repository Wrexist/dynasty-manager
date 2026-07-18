/**
 * Opposition Game Plans (Match Prep pre-match lever).
 *
 * A game plan is the player's pre-match tactical response to the opponent
 * intel surfaced in Match Prep (key threats + formation counter hints). It
 * flows into the match sim through the SAME modifier path the team talk uses
 * (see `TeamTalkModifiers` in config/teamTalk.ts), so its effect is applied
 * identically to attack/defense strength in engine/match.ts.
 *
 * Semantics of the shared modifier (from engine/match.ts):
 *   - attackMod   → boosts the player's OWN strength (positive = own attack up)
 *   - defenseMod  → damps the OPPONENT's strength (positive = own solidity up)
 *   - foulMod     → adjusts the player's foul rate
 *   - fitnessDrainMult → post/in-match fitness drain (1 = neutral)
 *
 * Magnitudes are kept in the same small band as the team-talk mods (0.03–0.07)
 * so no single game plan swings a match on its own — each is a tradeoff.
 *
 * Balance constants live HERE, never hardcoded in components or the engine.
 */
import type { GamePlanId } from '@/types/game';
import type { TeamTalkModifiers } from '@/config/teamTalk';

// ── Shackle the Danger Man: clamp the opponent's threat, at a small cost up top
export const MAN_MARK_OPP_ATTACK_REDUCTION = 0.05; // damps opponent strength
export const MAN_MARK_OWN_ATTACK_PENALTY = 0.03;   // one man tied to marking duty

// ── Target the Weak Flank: press the advantage, leave a gap behind
export const TARGET_FLANK_OWN_ATTACK_BOOST = 0.05;
export const TARGET_FLANK_OWN_DEFENSE_PENALTY = 0.03;

// ── Sit Deep & Frustrate: defensive solidity bought with attacking threat
export const SIT_DEEP_OWN_DEFENSE_BOOST = 0.07;
export const SIT_DEEP_OWN_ATTACK_PENALTY = 0.05;

export interface GamePlanDefinition {
  id: GamePlanId;
  label: string;
  /** One short line describing the tradeoff, shown on the option chip. */
  tradeoff: string;
}

/** Player-facing catalogue (excludes 'none' — that's the implicit default). */
export const GAME_PLANS: GamePlanDefinition[] = [
  {
    id: 'man_mark',
    label: 'Shackle the Danger Man',
    tradeoff: 'Blunts their key threat — one of yours drops off the attack.',
  },
  {
    id: 'target_flank',
    label: 'Target the Weak Flank',
    tradeoff: 'Sharper going forward, but you leave space at the back.',
  },
  {
    id: 'sit_deep',
    label: 'Sit Deep & Frustrate',
    tradeoff: 'Hard to break down — you carry less threat up top.',
  },
];

/** Short human label for a plan id (used in post-match feedback). */
export function gamePlanLabel(plan: GamePlanId): string | undefined {
  return GAME_PLANS.find(p => p.id === plan)?.label;
}

/**
 * Match-engine modifiers for a game plan, in the shared `TeamTalkModifiers`
 * shape so it can be folded into the same mods the team talk / shouts produce.
 * `none` yields undefined so callers can skip it entirely.
 */
export function gamePlanModifiers(plan: GamePlanId): TeamTalkModifiers | undefined {
  if (plan === 'man_mark') return { attackMod: -MAN_MARK_OWN_ATTACK_PENALTY, defenseMod: MAN_MARK_OPP_ATTACK_REDUCTION, foulMod: 0, fitnessDrainMult: 1 };
  if (plan === 'target_flank') return { attackMod: TARGET_FLANK_OWN_ATTACK_BOOST, defenseMod: -TARGET_FLANK_OWN_DEFENSE_PENALTY, foulMod: 0, fitnessDrainMult: 1 };
  if (plan === 'sit_deep') return { attackMod: -SIT_DEEP_OWN_ATTACK_PENALTY, defenseMod: SIT_DEEP_OWN_DEFENSE_BOOST, foulMod: 0, fitnessDrainMult: 1 };
  return undefined;
}

/**
 * Fold a game plan's modifiers into an existing mods object (team talk +
 * shouts). attack/defense/foul are additive; the game plan is fitness-neutral
 * so `base`'s drain multiplier wins (game plans never touch fatigue).
 */
export function mergeGamePlanMods(base: TeamTalkModifiers | undefined, plan: GamePlanId): TeamTalkModifiers | undefined {
  const gp = gamePlanModifiers(plan);
  if (!gp) return base;
  if (!base) return gp;
  return {
    attackMod: base.attackMod + gp.attackMod,
    defenseMod: base.defenseMod + gp.defenseMod,
    foulMod: base.foulMod + gp.foulMod,
    fitnessDrainMult: base.fitnessDrainMult,
  };
}

/** One-line post-match debrief so the player can tell the plan mattered. */
export function gamePlanDebriefLine(plan: GamePlanId, goalsFor: number, goalsAgainst: number): string | undefined {
  const label = gamePlanLabel(plan);
  if (!label) return undefined;
  if (plan === 'target_flank') {
    return `Game plan: ${label} — scored ${goalsFor}.`;
  }
  // Defensive plans (man_mark, sit_deep) — report what you kept out.
  return `Game plan: ${label} — conceded ${goalsAgainst}.`;
}
