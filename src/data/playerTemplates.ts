import type { Position } from '@/types/game';

export interface PlayerTemplate {
  fn: string;
  ln: string;
  pos: Position;
  age: number;
  nat: string;
  ovr: number;
  pot?: number;
  // FC26 attribute overrides — when present, used instead of random generation
  pace?: number;
  shooting?: number;
  passing?: number;
  defending?: number;
  physical?: number;
  mental?: number;
  // FC26 metadata
  altPos?: Position[];   // alternate positions the player can fill naturally
  skillMoves?: number;   // 1-5 star skill moves rating
  source?: 'generated' | 'real';
  fcId?: string;
  heightCm?: number;
  weightKg?: number;
}

/**
 * Club-specific player templates seed recognizable real-life players at
 * specific clubs during squad generation.
 *
 * The squad data (~2.1MB) is intentionally NOT exported here as a static
 * value — that would pull it onto the boot path. Access it lazily via
 * `@/data/playerTemplatesAccess` (`getClubTemplatesSync()` / `loadClubTemplates()`).
 */
