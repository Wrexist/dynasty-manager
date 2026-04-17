import type { Player, Position, PlayerRole } from '@/types/game';
import { PLAYER_ROLE_DEFINITIONS, NEUTRAL_ROLE_WEIGHTS } from '@/config/playerRoles';

/** Returns every role that is valid for the given position. */
export function getValidRolesForPosition(position: Position): PlayerRole[] {
  const roles: PlayerRole[] = [];
  for (const [role, def] of Object.entries(PLAYER_ROLE_DEFINITIONS)) {
    if (def.validPositions.includes(position)) roles.push(role as PlayerRole);
  }
  return roles;
}

/**
 * Pick the most appropriate role for a player based on position + attributes.
 * Returns undefined for positions with no natural specialist archetype.
 */
export function inferDefaultRole(player: Player): PlayerRole | undefined {
  const { position, attributes: a } = player;
  const { pace, shooting, passing, defending, physical, mental } = a;

  switch (position) {
    case 'ST': {
      if (shooting >= 78 && physical < 75) return 'poacher';
      if (physical >= 78 && shooting >= 65) return 'target-man';
      return 'complete-forward';
    }
    case 'CAM': return 'trequartista';
    case 'LW':
    case 'RW':
    case 'LM':
    case 'RM':
      return 'inverted-winger';
    case 'CM': {
      if (passing >= 78 && defending < 70) return 'deep-lying-playmaker';
      if (defending >= 75 && physical >= 70) return 'ball-winning-mid';
      return 'mezzala';
    }
    case 'CDM': {
      if (passing >= 76) return 'deep-lying-playmaker';
      return 'ball-winning-mid';
    }
    case 'LB':
    case 'RB':
      return pace >= 70 ? 'wing-back' : undefined;
    case 'CB': {
      if (passing >= 72) return 'ball-playing-def';
      if (defending >= 78) return 'sweeper';
      return undefined;
    }
    case 'GK':
      return (mental >= 70 && pace >= 55) ? 'sweeper-keeper' : undefined;
    default:
      return undefined;
  }
}

/** Returns the attack/assist/foul weights for a player's role (neutral if none). */
export function getRoleWeights(player: Player): { attackWeight: number; assistWeight: number; foulWeight: number } {
  if (!player.role) return { ...NEUTRAL_ROLE_WEIGHTS };
  const def = PLAYER_ROLE_DEFINITIONS[player.role];
  if (!def) return { ...NEUTRAL_ROLE_WEIGHTS };
  return {
    attackWeight: def.attackWeight,
    assistWeight: def.assistWeight,
    foulWeight: def.foulWeight,
  };
}
