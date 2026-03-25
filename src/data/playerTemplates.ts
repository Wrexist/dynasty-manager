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

/**
 * Club-specific player templates for squad generation.
 * Players are procedurally generated, but templates allow seeding
 * recognizable archetypes at specific clubs.
 *
 * Currently empty — all squads are fully procedurally generated
 * with nationality-appropriate names from the name pool system.
 */
export const CLUB_TEMPLATES: Record<string, PlayerTemplate[]> = {};
