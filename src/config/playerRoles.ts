import type { Position, PlayerRole } from '@/types/game';

export interface PlayerRoleDefinition {
  label: string;
  description: string;
  validPositions: Position[];
  /** Multiplier applied to shot-selection weight (1.0 = baseline) */
  attackWeight: number;
  /** Multiplier applied to assist-selection weight (1.0 = baseline) */
  assistWeight: number;
  /** Multiplier applied to fouler-selection weight (1.0 = baseline) */
  foulWeight: number;
}

// Role weights are intentionally kept within ±25% of neutral (0.75-1.25) so
// they add flavour without dominating the existing position-based selection.
export const PLAYER_ROLE_DEFINITIONS: Record<PlayerRole, PlayerRoleDefinition> = {
  'poacher':              { label: 'Poacher',                 description: 'Pure finisher. Lives in the box.',               validPositions: ['ST'],                   attackWeight: 1.25, assistWeight: 0.80, foulWeight: 0.75 },
  'target-man':           { label: 'Target Man',              description: 'Aerial threat and hold-up play.',                 validPositions: ['ST'],                   attackWeight: 1.15, assistWeight: 1.00, foulWeight: 1.05 },
  'complete-forward':     { label: 'Complete Forward',        description: 'Balanced modern striker.',                        validPositions: ['ST'],                   attackWeight: 1.20, assistWeight: 1.10, foulWeight: 0.90 },
  'trequartista':         { label: 'Trequartista',            description: 'Creative free role between lines.',               validPositions: ['CAM', 'CM'],            attackWeight: 1.05, assistWeight: 1.25, foulWeight: 0.80 },
  'inverted-winger':      { label: 'Inverted Winger',         description: 'Cuts inside onto stronger foot.',                 validPositions: ['LW', 'RW', 'LM', 'RM'], attackWeight: 1.15, assistWeight: 1.15, foulWeight: 0.90 },
  'mezzala':              { label: 'Mezzala',                 description: 'Box-to-box creator with shooting licence.',       validPositions: ['CM'],                   attackWeight: 1.10, assistWeight: 1.15, foulWeight: 1.00 },
  'ball-winning-mid':     { label: 'Ball-Winning Midfielder', description: 'Aggressive presser and tackler.',                 validPositions: ['CM', 'CDM'],            attackWeight: 0.85, assistWeight: 0.90, foulWeight: 1.25 },
  'deep-lying-playmaker': { label: 'Deep-Lying Playmaker',    description: 'Metronome dictating tempo from deep.',            validPositions: ['CDM', 'CM'],            attackWeight: 0.90, assistWeight: 1.25, foulWeight: 0.80 },
  'wing-back':            { label: 'Wing-Back',               description: 'Overlapping full-back supplying crosses.',        validPositions: ['LB', 'RB'],             attackWeight: 0.95, assistWeight: 1.15, foulWeight: 0.95 },
  'ball-playing-def':     { label: 'Ball-Playing Defender',   description: 'Composed CB who starts attacks from the back.',   validPositions: ['CB'],                   attackWeight: 0.90, assistWeight: 1.05, foulWeight: 0.85 },
  'sweeper':              { label: 'Sweeper',                 description: 'Covering CB reading danger before it arrives.',   validPositions: ['CB'],                   attackWeight: 0.80, assistWeight: 0.90, foulWeight: 0.90 },
  'sweeper-keeper':       { label: 'Sweeper-Keeper',          description: 'Goalkeeper who plays high off the line.',         validPositions: ['GK'],                   attackWeight: 0.60, assistWeight: 1.00, foulWeight: 0.90 },
};

/** Default weights used when a player has no specialist role assigned */
export const NEUTRAL_ROLE_WEIGHTS = {
  attackWeight: 1.0,
  assistWeight: 1.0,
  foulWeight: 1.0,
} as const;
