import type { PlayerTemplate } from '@/data/playerTemplates';

import { SQUADS as ARG_SQUADS } from '@/data/squads/arg';
import { SQUADS as AUS_SQUADS } from '@/data/squads/aus';
import { SQUADS as BRA_SQUADS } from '@/data/squads/bra';
import { SQUADS as IND_SQUADS } from '@/data/squads/ind';
import { SQUADS as KOR_SQUADS } from '@/data/squads/kor';
import { SQUADS as MLS_SQUADS } from '@/data/squads/mls';
import { SQUADS as SAU_SQUADS } from '@/data/squads/sau';

/**
 * Squad templates for the 7 community-pack-only leagues (arg, mls, sau, kor,
 * bra, aus, ind). Kept out of the eager `ALL_SQUAD_TEMPLATES` map so that
 * ~500 KB of per-club roster data only ships to users who opt in to the
 * community pack. Dynamic-imported from initGame alongside byClub/freeAgents.
 */
export const cpLeagueSquads: Record<string, PlayerTemplate[]> = {
  ...ARG_SQUADS,
  ...AUS_SQUADS,
  ...BRA_SQUADS,
  ...IND_SQUADS,
  ...KOR_SQUADS,
  ...MLS_SQUADS,
  ...SAU_SQUADS,
};
