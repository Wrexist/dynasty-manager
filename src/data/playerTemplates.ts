import type { Position } from '@/types/game';

export interface PlayerTemplate {
  fn: string;
  ln: string;
  pos: Position;
  age: number;
  nat: string;
  ovr: number;
  pot?: number;
}

import { ALL_TEMPLATES } from './templates';

/**
 * Club-specific player templates for squad generation.
 * Templates seed recognizable real-world players at specific clubs.
 * Remaining squad slots are filled with procedurally generated players.
 */
export const CLUB_TEMPLATES: Record<string, PlayerTemplate[]> = ALL_TEMPLATES;
