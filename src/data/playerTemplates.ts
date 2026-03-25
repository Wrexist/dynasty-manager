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

import { ALL_SQUAD_TEMPLATES } from '@/data/squads';

/**
 * Club-specific player templates for squad generation.
 * Players are procedurally generated, but templates allow seeding
 * recognizable players at specific clubs from real-life 2024-25 rosters.
 */
export const CLUB_TEMPLATES: Record<string, PlayerTemplate[]> = ALL_SQUAD_TEMPLATES;
