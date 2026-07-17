import { Position } from '@/types/game';

/**
 * Squad-number assignment config. Balance/identity constants live here (never
 * hardcoded in logic). Per-position preference lists express the classic
 * football shirt conventions — GKs take 1/13, centre-backs the low defensive
 * numbers, strikers the 9/10, wingers 7/11, etc. Assignment walks the list in
 * order and takes the lowest free preferred number, falling back to the lowest
 * free number in 1–99 when every preferred shirt is taken.
 */
export const POSITION_SQUAD_NUMBERS: Record<Position, number[]> = {
  GK: [1, 13, 25, 12, 31],
  CB: [4, 5, 6, 2, 3, 15, 23, 26],
  LB: [3, 5, 15, 33, 27],
  RB: [2, 12, 22, 24, 28],
  CDM: [6, 4, 16, 8, 14],
  CM: [8, 10, 14, 16, 18, 20, 6],
  CAM: [10, 11, 21, 23, 18],
  LM: [11, 7, 17, 19, 25],
  RM: [7, 11, 17, 19, 26],
  LW: [11, 7, 17, 19, 22],
  RW: [7, 11, 17, 19, 24],
  ST: [9, 10, 19, 20, 29, 7],
};

/** Highest shirt number that can be assigned. */
export const MAX_SQUAD_NUMBER = 99;

/**
 * Career-appearance threshold at which a retiring player's shirt is retired by
 * the user's club (a hall-of-fame membership also qualifies). Total career
 * appearances is used as a proxy for club service — most players spend their
 * career at a handful of clubs, so a 300+ total retiring while at your club is
 * a fitting one-club-legend heuristic.
 */
export const RETIRED_SHIRT_MIN_CAREER_APPEARANCES = 300;
