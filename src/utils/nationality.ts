/**
 * Nationality Utilities
 * Flag images and codes for all nationalities in the game.
 * Uses flagcdn.com for real flag images instead of emoji.
 */

export const NATIONALITY_DATA: Record<string, { flag: string; code: string; iso: string }> = {
  'England': { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', code: 'ENG', iso: 'gb-eng' },
  'Spain': { flag: '🇪🇸', code: 'ESP', iso: 'es' },
  'France': { flag: '🇫🇷', code: 'FRA', iso: 'fr' },
  'Germany': { flag: '🇩🇪', code: 'GER', iso: 'de' },
  'Italy': { flag: '🇮🇹', code: 'ITA', iso: 'it' },
  'Brazil': { flag: '🇧🇷', code: 'BRA', iso: 'br' },
  'Argentina': { flag: '🇦🇷', code: 'ARG', iso: 'ar' },
  'Portugal': { flag: '🇵🇹', code: 'POR', iso: 'pt' },
  'Netherlands': { flag: '🇳🇱', code: 'NED', iso: 'nl' },
  'Belgium': { flag: '🇧🇪', code: 'BEL', iso: 'be' },
  'Colombia': { flag: '🇨🇴', code: 'COL', iso: 'co' },
  'Uruguay': { flag: '🇺🇾', code: 'URU', iso: 'uy' },
  'Croatia': { flag: '🇭🇷', code: 'CRO', iso: 'hr' },
  'Denmark': { flag: '🇩🇰', code: 'DEN', iso: 'dk' },
  'Norway': { flag: '🇳🇴', code: 'NOR', iso: 'no' },
  'Sweden': { flag: '🇸🇪', code: 'SWE', iso: 'se' },
  'Switzerland': { flag: '🇨🇭', code: 'SUI', iso: 'ch' },
  'Nigeria': { flag: '🇳🇬', code: 'NGA', iso: 'ng' },
  'Senegal': { flag: '🇸🇳', code: 'SEN', iso: 'sn' },
  'Morocco': { flag: '🇲🇦', code: 'MAR', iso: 'ma' },
  'Japan': { flag: '🇯🇵', code: 'JPN', iso: 'jp' },
  'South Korea': { flag: '🇰🇷', code: 'KOR', iso: 'kr' },
  'Scotland': { flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', code: 'SCO', iso: 'gb-sct' },
  'Wales': { flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', code: 'WAL', iso: 'gb-wls' },
  'Ireland': { flag: '🇮🇪', code: 'IRL', iso: 'ie' },
  'Ghana': { flag: '🇬🇭', code: 'GHA', iso: 'gh' },
  'Ivory Coast': { flag: '🇨🇮', code: 'CIV', iso: 'ci' },
  'Cameroon': { flag: '🇨🇲', code: 'CMR', iso: 'cm' },
  'Poland': { flag: '🇵🇱', code: 'POL', iso: 'pl' },
  'Turkey': { flag: '🇹🇷', code: 'TUR', iso: 'tr' },
  'Serbia': { flag: '🇷🇸', code: 'SRB', iso: 'rs' },
  'Czech Republic': { flag: '🇨🇿', code: 'CZE', iso: 'cz' },
  'Austria': { flag: '🇦🇹', code: 'AUT', iso: 'at' },
  'USA': { flag: '🇺🇸', code: 'USA', iso: 'us' },
  'Egypt': { flag: '🇪🇬', code: 'EGY', iso: 'eg' },
  'Ukraine': { flag: '🇺🇦', code: 'UKR', iso: 'ua' },
  'Jamaica': { flag: '🇯🇲', code: 'JAM', iso: 'jm' },
  'Hungary': { flag: '🇭🇺', code: 'HUN', iso: 'hu' },
  'Ecuador': { flag: '🇪🇨', code: 'ECU', iso: 'ec' },
  'Mexico': { flag: '🇲🇽', code: 'MEX', iso: 'mx' },
  'Mali': { flag: '🇲🇱', code: 'MLI', iso: 'ml' },
  'Paraguay': { flag: '🇵🇾', code: 'PAR', iso: 'py' },
  'Algeria': { flag: '🇩🇿', code: 'ALG', iso: 'dz' },
  'Gabon': { flag: '🇬🇦', code: 'GAB', iso: 'ga' },
  'Saudi Arabia': { flag: '🇸🇦', code: 'KSA', iso: 'sa' },
  'Australia': { flag: '🇦🇺', code: 'AUS', iso: 'au' },
  'Canada': { flag: '🇨🇦', code: 'CAN', iso: 'ca' },
  'Costa Rica': { flag: '🇨🇷', code: 'CRC', iso: 'cr' },
  'Chile': { flag: '🇨🇱', code: 'CHI', iso: 'cl' },
  'Peru': { flag: '🇵🇪', code: 'PER', iso: 'pe' },
  'Greece': { flag: '🇬🇷', code: 'GRE', iso: 'gr' },
  'Albania': { flag: '🇦🇱', code: 'ALB', iso: 'al' },
  'Angola': { flag: '🇦🇴', code: 'ANG', iso: 'ao' },
  'Bosnia': { flag: '🇧🇦', code: 'BIH', iso: 'ba' },
  'Bulgaria': { flag: '🇧🇬', code: 'BUL', iso: 'bg' },
  'Cape Verde': { flag: '🇨🇻', code: 'CPV', iso: 'cv' },
  'Cyprus': { flag: '🇨🇾', code: 'CYP', iso: 'cy' },
  'DR Congo': { flag: '🇨🇩', code: 'COD', iso: 'cd' },
  'Estonia': { flag: '🇪🇪', code: 'EST', iso: 'ee' },
  'Gambia': { flag: '🇬🇲', code: 'GAM', iso: 'gm' },
  'Georgia': { flag: '🇬🇪', code: 'GEO', iso: 'ge' },
  'Guinea': { flag: '🇬🇳', code: 'GUI', iso: 'gn' },
  'Guinea-Bissau': { flag: '🇬🇼', code: 'GNB', iso: 'gw' },
  'Iceland': { flag: '🇮🇸', code: 'ISL', iso: 'is' },
  'Iran': { flag: '🇮🇷', code: 'IRN', iso: 'ir' },
  'Israel': { flag: '🇮🇱', code: 'ISR', iso: 'il' },
  'Kosovo': { flag: '🇽🇰', code: 'KOS', iso: 'xk' },
  'Montenegro': { flag: '🇲🇪', code: 'MNE', iso: 'me' },
  'Mozambique': { flag: '🇲🇿', code: 'MOZ', iso: 'mz' },
  'North Macedonia': { flag: '🇲🇰', code: 'MKD', iso: 'mk' },
  'Northern Ireland': { flag: '🏴󠁧󠁢󠁮󠁩󠁲󠁿', code: 'NIR', iso: 'gb-nir' },
  'Romania': { flag: '🇷🇴', code: 'ROU', iso: 'ro' },
  'Slovakia': { flag: '🇸🇰', code: 'SVK', iso: 'sk' },
  'Slovenia': { flag: '🇸🇮', code: 'SVN', iso: 'si' },
  'Suriname': { flag: '🇸🇷', code: 'SUR', iso: 'sr' },
  'Tunisia': { flag: '🇹🇳', code: 'TUN', iso: 'tn' },
  'Finland': { flag: '🇫🇮', code: 'FIN', iso: 'fi' },
  'Czechia': { flag: '🇨🇿', code: 'CZE', iso: 'cz' },
};

/** Get emoji flag for a nationality string (legacy fallback) */
export function getFlag(nationality: string): string {
  return NATIONALITY_DATA[nationality]?.flag || '🏳️';
}

/** Get ISO code for flagcdn.com URL */
export function getFlagIso(nationality: string): string {
  return NATIONALITY_DATA[nationality]?.iso || '';
}

/** Build flagcdn.com URL for a nationality. Width in pixels (20, 40, 80, 160). */
export function getFlagUrl(nationality: string, width: number = 40): string {
  const iso = getFlagIso(nationality);
  if (!iso) return '';
  return `https://flagcdn.com/w${width}/${iso}.png`;
}
