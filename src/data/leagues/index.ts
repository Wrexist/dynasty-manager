import type { ClubData, LeagueInfo } from '@/types/game';

import { LEAGUE_INFO as ENG_LEAGUE, CLUBS as ENG_CLUBS } from './england';
import { LEAGUE_INFO as ESP_LEAGUE, CLUBS as ESP_CLUBS } from './spain';
import { LEAGUE_INFO as ITA_LEAGUE, CLUBS as ITA_CLUBS } from './italy';
import { LEAGUE_INFO as GER_LEAGUE, CLUBS as GER_CLUBS } from './germany';
import { LEAGUE_INFO as FRA_LEAGUE, CLUBS as FRA_CLUBS } from './france';
import { LEAGUE_INFO as NED_LEAGUE, CLUBS as NED_CLUBS } from './netherlands';
import { LEAGUE_INFO as POR_LEAGUE, CLUBS as POR_CLUBS } from './portugal';
import { LEAGUE_INFO as BEL_LEAGUE, CLUBS as BEL_CLUBS } from './belgium';
import { LEAGUE_INFO as TUR_LEAGUE, CLUBS as TUR_CLUBS } from './turkey';
import { LEAGUE_INFO as CZE_LEAGUE, CLUBS as CZE_CLUBS } from './czechia';
import { LEAGUE_INFO as GRE_LEAGUE, CLUBS as GRE_CLUBS } from './greece';
import { LEAGUE_INFO as POL_LEAGUE, CLUBS as POL_CLUBS } from './poland';
import { LEAGUE_INFO as DEN_LEAGUE, CLUBS as DEN_CLUBS } from './denmark';
import { LEAGUE_INFO as NOR_LEAGUE, CLUBS as NOR_CLUBS } from './norway';
import { LEAGUE_INFO as SUI_LEAGUE, CLUBS as SUI_CLUBS } from './switzerland';
import { LEAGUE_INFO as AUT_LEAGUE, CLUBS as AUT_CLUBS } from './austria';
import { LEAGUE_INFO as SCO_LEAGUE, CLUBS as SCO_CLUBS } from './scotland';
import { LEAGUE_INFO as SWE_LEAGUE, CLUBS as SWE_CLUBS } from './sweden';
import { LEAGUE_INFO as CRO_LEAGUE, CLUBS as CRO_CLUBS } from './croatia';
import { LEAGUE_INFO as HUN_LEAGUE, CLUBS as HUN_CLUBS } from './hungary';
import { LEAGUE_INFO as SRB_LEAGUE, CLUBS as SRB_CLUBS } from './serbia';
import { LEAGUE_INFO as ROU_LEAGUE, CLUBS as ROU_CLUBS } from './romania';
import { LEAGUE_INFO as UKR_LEAGUE, CLUBS as UKR_CLUBS } from './ukraine';
import { LEAGUE_INFO as BUL_LEAGUE, CLUBS as BUL_CLUBS } from './bulgaria';
import { LEAGUE_INFO as SVK_LEAGUE, CLUBS as SVK_CLUBS } from './slovakia';
import { LEAGUE_INFO as FIN_LEAGUE, CLUBS as FIN_CLUBS } from './finland';
import { LEAGUE_INFO as ISL_LEAGUE, CLUBS as ISL_CLUBS } from './iceland';
import { LEAGUE_INFO as IRL_LEAGUE, CLUBS as IRL_CLUBS } from './ireland';
import { LEAGUE_INFO as ISR_LEAGUE, CLUBS as ISR_CLUBS } from './israel';
import { LEAGUE_INFO as CYP_LEAGUE, CLUBS as CYP_CLUBS } from './cyprus';

/** All 30 European league definitions */
export const ALL_LEAGUES: LeagueInfo[] = [
  ENG_LEAGUE, ESP_LEAGUE, ITA_LEAGUE, GER_LEAGUE, FRA_LEAGUE,
  NED_LEAGUE, POR_LEAGUE, BEL_LEAGUE, TUR_LEAGUE, CZE_LEAGUE,
  GRE_LEAGUE, POL_LEAGUE, DEN_LEAGUE, NOR_LEAGUE, SUI_LEAGUE,
  AUT_LEAGUE, SCO_LEAGUE, SWE_LEAGUE, CRO_LEAGUE, HUN_LEAGUE,
  SRB_LEAGUE, ROU_LEAGUE, UKR_LEAGUE, BUL_LEAGUE, SVK_LEAGUE,
  FIN_LEAGUE, ISL_LEAGUE, IRL_LEAGUE, ISR_LEAGUE, CYP_LEAGUE,
];

/** All ~467 clubs across all 30 leagues */
export const ALL_CLUBS_DATA: ClubData[] = [
  ...ENG_CLUBS, ...ESP_CLUBS, ...ITA_CLUBS, ...GER_CLUBS, ...FRA_CLUBS,
  ...NED_CLUBS, ...POR_CLUBS, ...BEL_CLUBS, ...TUR_CLUBS, ...CZE_CLUBS,
  ...GRE_CLUBS, ...POL_CLUBS, ...DEN_CLUBS, ...NOR_CLUBS, ...SUI_CLUBS,
  ...AUT_CLUBS, ...SCO_CLUBS, ...SWE_CLUBS, ...CRO_CLUBS, ...HUN_CLUBS,
  ...SRB_CLUBS, ...ROU_CLUBS, ...UKR_CLUBS, ...BUL_CLUBS, ...SVK_CLUBS,
  ...FIN_CLUBS, ...ISL_CLUBS, ...IRL_CLUBS, ...ISR_CLUBS, ...CYP_CLUBS,
];

/** Clubs indexed by league ID for quick lookup */
export const CLUBS_BY_LEAGUE: Record<string, ClubData[]> = {};
for (const club of ALL_CLUBS_DATA) {
  if (!CLUBS_BY_LEAGUE[club.divisionId]) CLUBS_BY_LEAGUE[club.divisionId] = [];
  CLUBS_BY_LEAGUE[club.divisionId].push(club);
}
