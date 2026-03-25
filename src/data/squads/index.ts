import type { PlayerTemplate } from '@/data/playerTemplates';

import { SQUADS as ENG_SQUADS } from './england';
import { SQUADS as ESP_SQUADS } from './spain';
import { SQUADS as ITA_SQUADS } from './italy';
import { SQUADS as GER_SQUADS } from './germany';
import { SQUADS as FRA_SQUADS } from './france';

/** All club squad templates, keyed by club ID */
export const ALL_SQUAD_TEMPLATES: Record<string, PlayerTemplate[]> = {
  ...ENG_SQUADS,
  ...ESP_SQUADS,
  ...ITA_SQUADS,
  ...GER_SQUADS,
  ...FRA_SQUADS,
};
