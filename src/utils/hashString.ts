/** FNV-1a 32-bit hash. Fast, non-cryptographic, used for change detection on
 *  large serialized payloads. Collisions are fine — at worst we skip a save
 *  that would have been identical to the previous one. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded PRNG, uniform in [0, 1). */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Point `Math.random` at a seeded PRNG until the returned function is called.
 * For synchronous work only (the match engine), and every install must be
 * paired with the restore in a `finally`, so nothing outside the scope ever
 * sees the seeded stream.
 */
export function installSeededRandom(seed: number): () => void {
  const previous = Math.random;
  Math.random = seededRandom(seed);
  return () => { Math.random = previous; };
}
