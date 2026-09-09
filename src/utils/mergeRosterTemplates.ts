import type { PlayerTemplate } from '@/data/playerTemplates';

/** Newer identities must not survive at an old club in a fallback league. */
export function mergeRosterTemplates(
  fallback: Record<string, PlayerTemplate[]>,
  current: Record<string, PlayerTemplate[]>,
  freeAgents: PlayerTemplate[],
): Record<string, PlayerTemplate[]> {
  const currentIds = new Set([
    ...Object.values(current).flat(), ...freeAgents,
  ].map(player => player.fcId).filter(Boolean));
  const result: Record<string, PlayerTemplate[]> = {};
  for (const [clubId, players] of Object.entries(fallback)) {
    result[clubId] = players.filter(player => !player.fcId || !currentIds.has(player.fcId));
  }
  return { ...result, ...current };
}
