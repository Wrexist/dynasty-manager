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

/**
 * Returns the most recognizable short name for on-card display.
 * For multi-word surnames ("De Bruyne", "Van Dijk", "Del Piero") the final
 * word is the recognizable one, so callers display that.
 */
export function getPlayerDisplayName(player: PlayerNameFields): string {
  const parts = player.lastName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return player.firstName;
  return parts[parts.length - 1];
}

/**
 * Font-size Tailwind class tuned to fit within the ~40-44px card width.
 * Shrinks in readable steps as names get longer.
 */
export function getCardNameFontSizeClass(name: string): string {
  const len = name.length;
  if (len <= 4) return 'text-[9px]';
  if (len <= 6) return 'text-[8px]';
  if (len <= 8) return 'text-[7px]';
  if (len <= 10) return 'text-[6px]';
  return 'text-[5.5px]';
}
