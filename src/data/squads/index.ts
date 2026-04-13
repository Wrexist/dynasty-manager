import type { PlayerTemplate } from '@/data/playerTemplates';

import { SQUADS as AUSTRIA_SQUADS } from './austria';
import { SQUADS as BELGIUM_SQUADS } from './belgium';
import { SQUADS as BULGARIA_SQUADS } from './bulgaria';
import { SQUADS as CROATIA_SQUADS } from './croatia';
import { SQUADS as CYPRUS_SQUADS } from './cyprus';
import { SQUADS as CZECHIA_SQUADS } from './czechia';
import { SQUADS as DENMARK_SQUADS } from './denmark';
import { SQUADS as ENGLAND_SQUADS } from './england';
import { SQUADS as ENGLAND2_SQUADS } from './england2';
import { SQUADS as ENGLAND3_SQUADS } from './england3';
import { SQUADS as ENGLAND4_SQUADS } from './england4';
import { SQUADS as FINLAND_SQUADS } from './finland';
import { SQUADS as FRANCE_SQUADS } from './france';
import { SQUADS as FRANCE2_SQUADS } from './france2';
import { SQUADS as GERMANY_SQUADS } from './germany';
import { SQUADS as GERMANY2_SQUADS } from './germany2';
import { SQUADS as GERMANY3_SQUADS } from './germany3';
import { SQUADS as GREECE_SQUADS } from './greece';
import { SQUADS as HUNGARY_SQUADS } from './hungary';
import { SQUADS as ICELAND_SQUADS } from './iceland';
import { SQUADS as IRELAND_SQUADS } from './ireland';
import { SQUADS as ISRAEL_SQUADS } from './israel';
import { SQUADS as ITALY_SQUADS } from './italy';
import { SQUADS as ITALY2_SQUADS } from './italy2';
import { SQUADS as NETHERLANDS_SQUADS } from './netherlands';
import { SQUADS as NORWAY_SQUADS } from './norway';
import { SQUADS as POLAND_SQUADS } from './poland';
import { SQUADS as PORTUGAL_SQUADS } from './portugal';
import { SQUADS as ROMANIA_SQUADS } from './romania';
import { SQUADS as SCOTLAND_SQUADS } from './scotland';
import { SQUADS as SERBIA_SQUADS } from './serbia';
import { SQUADS as SLOVAKIA_SQUADS } from './slovakia';
import { SQUADS as SPAIN_SQUADS } from './spain';
import { SQUADS as SPAIN2_SQUADS } from './spain2';
import { SQUADS as SWEDEN_SQUADS } from './sweden';
import { SQUADS as SWITZERLAND_SQUADS } from './switzerland';
import { SQUADS as TURKEY_SQUADS } from './turkey';
import { SQUADS as UKRAINE_SQUADS } from './ukraine';

/** All club squad templates, keyed by club ID */
export const ALL_SQUAD_TEMPLATES: Record<string, PlayerTemplate[]> = {
  ...AUSTRIA_SQUADS,
  ...BELGIUM_SQUADS,
  ...BULGARIA_SQUADS,
  ...CROATIA_SQUADS,
  ...CYPRUS_SQUADS,
  ...CZECHIA_SQUADS,
  ...DENMARK_SQUADS,
  ...ENGLAND_SQUADS,
  ...ENGLAND2_SQUADS,
  ...ENGLAND3_SQUADS,
  ...ENGLAND4_SQUADS,
  ...FINLAND_SQUADS,
  ...FRANCE_SQUADS,
  ...FRANCE2_SQUADS,
  ...GERMANY_SQUADS,
  ...GERMANY2_SQUADS,
  ...GERMANY3_SQUADS,
  ...GREECE_SQUADS,
  ...HUNGARY_SQUADS,
  ...ICELAND_SQUADS,
  ...IRELAND_SQUADS,
  ...ISRAEL_SQUADS,
  ...ITALY_SQUADS,
  ...ITALY2_SQUADS,
  ...NETHERLANDS_SQUADS,
  ...NORWAY_SQUADS,
  ...POLAND_SQUADS,
  ...PORTUGAL_SQUADS,
  ...ROMANIA_SQUADS,
  ...SCOTLAND_SQUADS,
  ...SERBIA_SQUADS,
  ...SLOVAKIA_SQUADS,
  ...SPAIN_SQUADS,
  ...SPAIN2_SQUADS,
  ...SWEDEN_SQUADS,
  ...SWITZERLAND_SQUADS,
  ...TURKEY_SQUADS,
  ...UKRAINE_SQUADS,
};
