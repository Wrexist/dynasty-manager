import type { PlayerTemplate } from '@/data/playerTemplates';

import { SQUADS as ENG_SQUADS } from './england';
import { SQUADS as ESP_SQUADS } from './spain';

/** All club squad templates, keyed by club ID */
export const ALL_SQUAD_TEMPLATES: Record<string, PlayerTemplate[]> = {
  ...ENG_SQUADS,
  ...ESP_SQUADS,
};
