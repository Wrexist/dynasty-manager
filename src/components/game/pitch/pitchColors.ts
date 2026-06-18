// Small colour helpers for the pitch renderers — lighten/darken a kit colour for
// lit chip gradients, specular and the distinct keeper kit. Returns `rgb(...)`
// strings, which both the Canvas context and PixiJS `.fill()` accept.

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [136, 136, 136];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** amt > 0 lightens toward white, amt < 0 darkens toward black (−1..1). */
export function shade(color: string, amt: number): string {
  let [r, g, b] = color && color[0] === '#' ? parseHex(color) : [136, 136, 136];
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    const k = 1 + amt;
    r *= k; g *= k; b *= k;
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/** The keeper's kit: a dark, desaturated take on the team colour — clearly a
 *  goalkeeper, still recognisably that team. */
export function keeperKit(teamColor: string): string {
  return shade(teamColor, -0.55);
}
