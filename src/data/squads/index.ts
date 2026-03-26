import type { PlayerTemplate } from '@/data/playerTemplates';

// Top 5 leagues
import { SQUADS as ENG_SQUADS } from './england';
import { SQUADS as ESP_SQUADS } from './spain';
import { SQUADS as ITA_SQUADS } from './italy';
import { SQUADS as GER_SQUADS } from './germany';
import { SQUADS as FRA_SQUADS } from './france';
import { SQUADS as NED_SQUADS } from './netherlands';

// Remaining European leagues
import { SQUADS as CRO_SQUADS } from './croatia';
import { SQUADS as IRL_SQUADS } from './ireland';

/** All club squad templates, keyed by club ID */
export const ALL_SQUAD_TEMPLATES: Record<string, PlayerTemplate[]> = {
  ...ENG_SQUADS,
  ...ESP_SQUADS,
  ...ITA_SQUADS,
  ...GER_SQUADS,
  ...FRA_SQUADS,
  ...NED_SQUADS,
  ...CRO_SQUADS,
  ...IRL_SQUADS,
};
