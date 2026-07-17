/**
 * Opposition Dossier — tuning constants for pre-match scout intel.
 *
 * STRICTLY informational. Nothing here feeds the match engine, training,
 * transfers, or any other sim parameter — the dossier only shapes how much
 * text the player sees, never how the game plays out.
 */

/** Minimum strength/weakness bullets shown, even with no scouts on staff. */
export const DOSSIER_MIN_BULLETS = 1;

/** Maximum strength/weakness bullets a fully-staffed scouting dept unlocks. */
export const DOSSIER_MAX_BULLETS = 3;

/** How many recent results the form strip shows. */
export const DOSSIER_FORM_LENGTH = 5;

/**
 * Line-average gap (out of 99) above which a unit reads as a clear
 * strength/weakness rather than "balanced".
 */
export const DOSSIER_LINE_GAP = 3;

/** Injury count on the opponent at/above which their depth reads as thin. */
export const DOSSIER_INJURY_CONCERN = 2;
