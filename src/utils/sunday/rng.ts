/**
 * Seeded randomness for Sunday League.
 *
 * WHY THIS EXISTS. Every other mode leans on `Math.random()`, which is fine for
 * a league of 756 clubs where nobody can tell one coin flip from another. This
 * mode is built out of small, legible, personal draws — did Kev turn up, did
 * the raffle make anything, who walked past and got handed a shirt — and those
 * have to survive a reload. With `Math.random()`, backgrounding the app on the
 * teamsheet screen and coming back would re-roll the week and hand the player a
 * different squad; a save/scum loop would be one home-button press long.
 *
 * So: one seed, two kinds of stream, both persisted or derivable:
 *
 *   PERSISTENT CURSOR (`seed` + `rngCursor`). Player-initiated actions —
 *   fundraisers, ring-rounds, event resolutions, the season rollover — draw
 *   here and write the advanced cursor back, so replaying the action replays
 *   the outcome.
 *
 *   WEEK-KEYED STREAMS (`subSeed(seed, 'avail:S:W')`, `'match:S:W'`,
 *   `'advance:S:W'`). The weekly loop draws here, positioned from zero each
 *   week. This is not a convenience: the number of draws a match consumes
 *   depends on the UNSEEDED shared engine (narrative lines per event, subs
 *   used, players who took the field), so routing the loop through the
 *   persistent cursor made the cursor's position — and every draw after it —
 *   differ between a reloaded and an unreloaded save. Keyed to the week, the
 *   weather, the doubts, the ringers, the event and the recruit all resolve
 *   identically however many times the same Sunday is replayed.
 *
 * WHAT IS *NOT* SEEDED. The match engine itself. It is shared with every other
 * mode and reaches for `Math.random()` in a hundred places; forking it for one
 * mode would be a far bigger and more dangerous change than this feature
 * justifies. The consequence is honest and worth stating: replaying a match
 * from a reloaded save can produce a different scoreline, exactly as it can in
 * Sandbox, Career and World Cup. Everything the Sunday layer owns — availability,
 * events, money, recruitment, generation — is deterministic.
 *
 * mulberry32: 32-bit, 2^32 period, one multiply and a couple of shifts per
 * draw. Not cryptographic, not trying to be; it is uniform, fast and, above
 * all, reproducible from two persisted numbers.
 */

/** An advanceable RNG. Callers take one, draw from it, then write the cursor
 *  back to state via `cursorOf`. */
export interface SundayRng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] inclusive. Returns `min` if max < min. */
  int(min: number, max: number): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  /** True with probability `p`. `p <= 0` is never, `p >= 1` is always. */
  chance(p: number): boolean;
  /** A random element. Throws nothing on an empty array — returns undefined. */
  pick<T>(arr: readonly T[]): T | undefined;
  /** A random element weighted by `weight`. Non-positive weights are ignored. */
  weighted<T>(arr: readonly T[], weight: (item: T) => number): T | undefined;
  /** A shuffled copy (Fisher-Yates). Never mutates the input. */
  shuffle<T>(arr: readonly T[]): T[];
  /** `count` distinct elements, or all of them when count >= length. */
  sample<T>(arr: readonly T[], count: number): T[];
  /** Roughly-normal draw around `mean`, clamped to ±`spread`. Sum of three
   *  uniforms — cheap, and it stops generated squads looking like noise. */
  around(mean: number, spread: number): number;
}

/** How many draws have been taken. Persist this alongside the seed. */
export function cursorOf(rng: SundayRng): number {
  return (rng as unknown as { __cursor: number }).__cursor;
}

/**
 * Build an RNG positioned at `cursor` draws into the stream for `seed`.
 *
 * Restoring is O(1): mulberry32's state is a single 32-bit accumulator that
 * advances by a fixed constant per draw, so `seed + cursor * GOLDEN` lands
 * exactly where the stream had reached without replaying it.
 */
export function createSundayRng(seed: number, cursor = 0): SundayRng {
  // The constant mulberry32 adds per draw. Positioning by multiplication is
  // only valid because the increment is unconditional.
  const GOLDEN = 0x6d2b79f5;
  let a = (Math.imul(seed | 0, 1) + Math.imul(cursor | 0, GOLDEN)) | 0;
  let count = cursor | 0;

  const next = (): number => {
    count++;
    a = (a + GOLDEN) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: SundayRng = {
    next,
    int: (min, max) => {
      if (max < min) return min;
      return min + Math.floor(next() * (max - min + 1));
    },
    float: (min, max) => min + next() * (max - min),
    chance: (p) => {
      if (p <= 0) return false;
      if (p >= 1) return true;
      return next() < p;
    },
    pick: <T,>(arr: readonly T[]): T | undefined => {
      if (!arr.length) return undefined;
      return arr[Math.floor(next() * arr.length)];
    },
    weighted: <T,>(arr: readonly T[], weight: (item: T) => number): T | undefined => {
      let total = 0;
      for (const item of arr) {
        const w = weight(item);
        if (Number.isFinite(w) && w > 0) total += w;
      }
      if (total <= 0) return rng.pick(arr);
      let roll = next() * total;
      for (const item of arr) {
        const w = weight(item);
        if (!Number.isFinite(w) || w <= 0) continue;
        roll -= w;
        if (roll <= 0) return item;
      }
      return arr[arr.length - 1];
    },
    shuffle: <T,>(arr: readonly T[]): T[] => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    sample: <T,>(arr: readonly T[], countWanted: number): T[] =>
      rng.shuffle(arr).slice(0, Math.max(0, Math.min(countWanted, arr.length))),
    around: (mean, spread) => {
      const u = (next() + next() + next()) / 3; // ~normal, mean 0.5
      return mean + (u - 0.5) * 2 * spread;
    },
  };

  Object.defineProperty(rng, '__cursor', { get: () => count });
  return rng;
}

/**
 * Derive a stable sub-seed from a base seed and a label.
 *
 * Used where a draw must depend on WHAT it is for rather than on when it
 * happened — e.g. the opposition squads for a division are generated from
 * `subSeed(seed, 'div:sun-3')`, so they are identical whichever order the
 * clubs were created in and stay identical across a rebuild.
 */
export function subSeed(seed: number, label: string): number {
  let h = seed | 0;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x01000193) | 0;
  }
  return h >>> 0;
}

/** A fresh, non-reproducible seed for a brand-new save. */
export function newSundaySeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}
