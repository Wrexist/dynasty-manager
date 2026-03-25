import type { PlayerTemplate } from '@/data/playerTemplates';

import { SQUADS as ENG_SQUADS } from './england';

/** All club squad templates, keyed by club ID */
export const ALL_SQUAD_TEMPLATES: Record<string, PlayerTemplate[]> = {
  ...ENG_SQUADS,
};
