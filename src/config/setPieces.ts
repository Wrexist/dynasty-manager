import type { CornerRoutine, FreeKickRoutine, SetPieceRoutines } from '@/types/game';

export interface CornerRoutineDefinition {
  label: string;
  description: string;
  /** Multiplier on the corner goal chance (baseline 1.0) */
  goalChanceMult: number;
  /** Shifts header-candidate weighting toward physical (+) or shooting (-) */
  physicalBias: number;
  /** Flat additive bias applied to the header conversion chance */
  headerConversionBonus: number;
}

export interface FreeKickRoutineDefinition {
  label: string;
  description: string;
  /** Multiplier on the free-kick goal chance */
  goalChanceMult: number;
  /** Threshold shift for "good enough to score directly" (lower = easier) */
  thresholdShift: number;
  /** If true, prefer an assist by a teammate rather than direct goal */
  favourIndirect: boolean;
}

export const CORNER_ROUTINES: Record<CornerRoutine, CornerRoutineDefinition> = {
  'near-post-flick':   { label: 'Near Post Flick-On',  description: 'Whipped in to the near post for a flick-on header.',    goalChanceMult: 1.10, physicalBias: 0.20, headerConversionBonus: 0.02 },
  'far-post-delivery': { label: 'Far Post Delivery',   description: 'Classic high ball to the far post.',                    goalChanceMult: 1.00, physicalBias: 0.00, headerConversionBonus: 0.00 },
  'short-corner':      { label: 'Short Corner',        description: 'Short pass to keep possession, lower direct threat.',   goalChanceMult: 0.75, physicalBias: -0.15, headerConversionBonus: -0.02 },
  'driven-low':        { label: 'Driven Low',          description: 'Low driven ball across the six-yard box.',              goalChanceMult: 1.05, physicalBias: -0.10, headerConversionBonus: 0.01 },
};

export const FREE_KICK_ROUTINES: Record<FreeKickRoutine, FreeKickRoutineDefinition> = {
  'curled-direct': { label: 'Curled Direct',  description: 'Designated taker curls it over the wall.',               goalChanceMult: 1.10, thresholdShift: -3, favourIndirect: false },
  'driven-power':  { label: 'Driven Power',   description: 'Hammered at goal — power over placement.',               goalChanceMult: 1.00, thresholdShift: -1, favourIndirect: false },
  'short-pass':    { label: 'Short Pass',     description: 'Short pass to build through the midfield.',              goalChanceMult: 0.70, thresholdShift: 5,  favourIndirect: true  },
  'dummy-run':     { label: 'Dummy Run',      description: 'Decoy run opens space for a clever finish.',             goalChanceMult: 0.95, thresholdShift: 0,  favourIndirect: false },
};

export const DEFAULT_SET_PIECE_ROUTINES: SetPieceRoutines = {
  corner: 'far-post-delivery',
  freeKick: 'curled-direct',
};
