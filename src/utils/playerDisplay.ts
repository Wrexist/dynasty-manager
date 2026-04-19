/**
 * Player display helpers for on-card rendering.
 * Centralizes how a player's "recognizable short name" and its font size
 * are derived, so every card surface (PlayerCard, YouthAcademy, etc.) stays
 * in sync.
 */

interface PlayerNameFields {
  firstName: string;
  lastName: string;
}

// Suffix tokens that are not a player's recognizable name on their own.
// Covers the "Vini Jr." data pattern (lastName="Jr.") as well as common
// generational markers that can show up alongside a real surname.
const SUFFIX_TOKEN_PATTERN = /^(Jr\.?|Sr\.?|I{2,3}|IV|V)$/i;

/**
 * Returns the most recognizable short name for on-card display.
 * For multi-word surnames ("De Bruyne", "Van Dijk", "Del Piero") the final
 * word is the recognizable one, so callers display that. Pure suffix tokens
 * (Jr., Sr., II, III, IV, V) are filtered out; if the lastName is only a
 * suffix we fall back to firstName (so "Vini Jr." → "Vini").
 */
export function getPlayerDisplayName(player: PlayerNameFields): string {
  const parts = player.lastName.trim().split(/\s+/).filter(Boolean);
  const meaningful = parts.filter((p) => !SUFFIX_TOKEN_PATTERN.test(p));
  if (meaningful.length > 0) return meaningful[meaningful.length - 1];
  return player.firstName;
}

/**
 * Font-size Tailwind class tuned to fit within the ~58px starter card /
 * ~44px bench card widths. Shrinks in readable steps as names get longer.
 */
export function getCardNameFontSizeClass(name: string): string {
  const len = name.length;
  if (len <= 4) return 'text-[9px]';
  if (len <= 6) return 'text-[8px]';
  if (len <= 8) return 'text-[7px]';
  if (len <= 10) return 'text-[6.5px]';
  return 'text-[5.5px]';
}
