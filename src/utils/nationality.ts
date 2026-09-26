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

  // Additional nations from squad data
  'Andorra': { flag: '🇦🇩', code: 'AND', iso: 'ad' },
  'Antigua and Barbuda': { flag: '🇦🇬', code: 'ATG', iso: 'ag' },
  'Armenia': { flag: '🇦🇲', code: 'ARM', iso: 'am' },
  'Azerbaijan': { flag: '🇦🇿', code: 'AZE', iso: 'az' },
  'Barbados': { flag: '🇧🇧', code: 'BRB', iso: 'bb' },
  'Belarus': { flag: '🇧🇾', code: 'BLR', iso: 'by' },
  'Benin': { flag: '🇧🇯', code: 'BEN', iso: 'bj' },
  'Bermuda': { flag: '🇧🇲', code: 'BER', iso: 'bm' },
  'Burkina Faso': { flag: '🇧🇫', code: 'BFA', iso: 'bf' },
  'Burundi': { flag: '🇧🇮', code: 'BDI', iso: 'bi' },
  'Central African Republic': { flag: '🇨🇫', code: 'CAF', iso: 'cf' },
  'Chad': { flag: '🇹🇩', code: 'CHA', iso: 'td' },
  'Congo': { flag: '🇨🇬', code: 'CGO', iso: 'cg' },
  'Cuba': { flag: '🇨🇺', code: 'CUB', iso: 'cu' },
  'Curaçao': { flag: '🇨🇼', code: 'CUW', iso: 'cw' },
  'Dominican Republic': { flag: '🇩🇴', code: 'DOM', iso: 'do' },
  'El Salvador': { flag: '🇸🇻', code: 'SLV', iso: 'sv' },
  'Equatorial Guinea': { flag: '🇬🇶', code: 'EQG', iso: 'gq' },
  'Faroe Islands': { flag: '🇫🇴', code: 'FRO', iso: 'fo' },
  'Grenada': { flag: '🇬🇩', code: 'GRN', iso: 'gd' },
  'Guatemala': { flag: '🇬🇹', code: 'GUA', iso: 'gt' },
  'Guyana': { flag: '🇬🇾', code: 'GUY', iso: 'gy' },
  'Haiti': { flag: '🇭🇹', code: 'HAI', iso: 'ht' },
  'Honduras': { flag: '🇭🇳', code: 'HON', iso: 'hn' },
  'Indonesia': { flag: '🇮🇩', code: 'IDN', iso: 'id' },
  'Iraq': { flag: '🇮🇶', code: 'IRQ', iso: 'iq' },
  'Qatar': { flag: '🇶🇦', code: 'QAT', iso: 'qa' },
  'Türkiye': { flag: '🇹🇷', code: 'TUR', iso: 'tr' },
  'Cabo Verde': { flag: '🇨🇻', code: 'CPV', iso: 'cv' },
  'Jordan': { flag: '🇯🇴', code: 'JOR', iso: 'jo' },
  'Kazakhstan': { flag: '🇰🇿', code: 'KAZ', iso: 'kz' },
  'Kenya': { flag: '🇰🇪', code: 'KEN', iso: 'ke' },
  'Korea DPR': { flag: '🇰🇵', code: 'PRK', iso: 'kp' },
  'Latvia': { flag: '🇱🇻', code: 'LVA', iso: 'lv' },
  'Lebanon': { flag: '🇱🇧', code: 'LBN', iso: 'lb' },
  'Liberia': { flag: '🇱🇷', code: 'LBR', iso: 'lr' },
  'Libya': { flag: '🇱🇾', code: 'LBA', iso: 'ly' },
  'Liechtenstein': { flag: '🇱🇮', code: 'LIE', iso: 'li' },
  'Lithuania': { flag: '🇱🇹', code: 'LTU', iso: 'lt' },
  'Luxembourg': { flag: '🇱🇺', code: 'LUX', iso: 'lu' },
  'Madagascar': { flag: '🇲🇬', code: 'MDG', iso: 'mg' },
  'Malawi': { flag: '🇲🇼', code: 'MWI', iso: 'mw' },
  'Malta': { flag: '🇲🇹', code: 'MLT', iso: 'mt' },
  'Mauritania': { flag: '🇲🇷', code: 'MTN', iso: 'mr' },
  'Moldova': { flag: '🇲🇩', code: 'MDA', iso: 'md' },
  'Montserrat': { flag: '🇲🇸', code: 'MSR', iso: 'ms' },
  'Namibia': { flag: '🇳🇦', code: 'NAM', iso: 'na' },
  'New Zealand': { flag: '🇳🇿', code: 'NZL', iso: 'nz' },
  'Palestine': { flag: '🇵🇸', code: 'PLE', iso: 'ps' },
  'Panama': { flag: '🇵🇦', code: 'PAN', iso: 'pa' },
  'Philippines': { flag: '🇵🇭', code: 'PHI', iso: 'ph' },
  'Russia': { flag: '🇷🇺', code: 'RUS', iso: 'ru' },
  'Rwanda': { flag: '🇷🇼', code: 'RWA', iso: 'rw' },
  'Sierra Leone': { flag: '🇸🇱', code: 'SLE', iso: 'sl' },
  'Somalia': { flag: '🇸🇴', code: 'SOM', iso: 'so' },
  'South Africa': { flag: '🇿🇦', code: 'RSA', iso: 'za' },
  'Sri Lanka': { flag: '🇱🇰', code: 'SRI', iso: 'lk' },
  'St. Kitts and Nevis': { flag: '🇰🇳', code: 'SKN', iso: 'kn' },
  'St. Lucia': { flag: '🇱🇨', code: 'LCA', iso: 'lc' },
  'Syria': { flag: '🇸🇾', code: 'SYR', iso: 'sy' },
  'Tanzania': { flag: '🇹🇿', code: 'TAN', iso: 'tz' },
  'Thailand': { flag: '🇹🇭', code: 'THA', iso: 'th' },
  'Togo': { flag: '🇹🇬', code: 'TOG', iso: 'tg' },
  'Trinidad and Tobago': { flag: '🇹🇹', code: 'TRI', iso: 'tt' },
  'Uganda': { flag: '🇺🇬', code: 'UGA', iso: 'ug' },
  'Uzbekistan': { flag: '🇺🇿', code: 'UZB', iso: 'uz' },
  'Venezuela': { flag: '🇻🇪', code: 'VEN', iso: 've' },
  'Zambia': { flag: '🇿🇲', code: 'ZMB', iso: 'zm' },
  'Zimbabwe': { flag: '🇿🇼', code: 'ZIM', iso: 'zw' },

  // Aliases — alternate strings used in squad/league data for the same nation
  'Holland': { flag: '🇳🇱', code: 'NED', iso: 'nl' },
  'United States': { flag: '🇺🇸', code: 'USA', iso: 'us' },
  'Republic of Ireland': { flag: '🇮🇪', code: 'IRL', iso: 'ie' },
  'Côte d\'Ivoire': { flag: '🇨🇮', code: 'CIV', iso: 'ci' },
  'Bosnia and Herzegovina': { flag: '🇧🇦', code: 'BIH', iso: 'ba' },
  'Cape Verde Islands': { flag: '🇨🇻', code: 'CPV', iso: 'cv' },
  'Korea Republic': { flag: '🇰🇷', code: 'KOR', iso: 'kr' },
  'Congo DR': { flag: '🇨🇩', code: 'COD', iso: 'cd' },
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

// ── Offline / no-emoji flag fallback ──
//
// Flags load from flagcdn.com. Offline, the <img> errors and FlagIcon falls
// back to the emoji flag — which renders as an empty box on any platform whose
// fonts have no flag glyphs (Windows, most Linux/Chromium; the 2026-09
// playthrough saw a blank square on every non-England nation: England's
// fallback is a black-flag tag sequence that does render). iOS and Android
// have flag glyphs, so the emoji stays the fallback there; elsewhere the
// nation's three-letter code is shown instead. Never a blank square.

let flagEmojiSupport: boolean | null = null;

/** Whether this platform draws a regional-indicator pair as a flag (colour
 *  pixels), not as two letters or an empty box. Measured once, on first need,
 *  on a scratch canvas; false wherever it cannot be measured. */
export function supportsFlagEmoji(): boolean {
  if (flagEmojiSupport !== null) return flagEmojiSupport;
  flagEmojiSupport = measureFlagEmojiSupport();
  return flagEmojiSupport;
}

function measureFlagEmojiSupport(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    if (!ctx) return false;
    ctx.textBaseline = 'top';
    ctx.font = '16px sans-serif';
    ctx.fillText('\u{1F1EB}\u{1F1F7}', 0, 0); // 🇫🇷 — blue, white, red when drawn as a flag
    const { data } = ctx.getImageData(0, 0, 20, 20);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0 && (Math.abs(data[i] - data[i + 1]) > 16 || Math.abs(data[i + 1] - data[i + 2]) > 16)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Test hook: pin the measured answer (jsdom has no canvas). `null` re-measures. */
export function __setFlagEmojiSupportForTests(value: boolean | null): void {
  flagEmojiSupport = value;
}

/** The short text shown when neither the image nor an emoji flag can be drawn:
 *  the nation's code ("FRA"), or the first letters of an unknown nationality. */
export function getFlagFallbackCode(nationality: string): string {
  return NATIONALITY_DATA[nationality]?.code
    || nationality.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
    || '?';
}

/** Flag image URLs that have already failed this session. Offline, every row
 *  of a nation list would otherwise request (and flash) the same dead image. */
const failedFlagUrls = new Set<string>();

export function hasFlagUrlFailed(url: string): boolean {
  return failedFlagUrls.has(url);
}

export function markFlagUrlFailed(url: string): void {
  failedFlagUrls.add(url);
}

/** Test hook: forget remembered failures. */
export function __resetFlagFailuresForTests(): void {
  failedFlagUrls.clear();
}
