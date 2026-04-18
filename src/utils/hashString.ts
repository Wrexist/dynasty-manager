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
