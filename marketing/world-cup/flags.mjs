/**
 * Country ribbon — the major footballing nations, as flag emoji.
 * Shared by the App Store and standalone-ribbon generators.
 */

// The important nations (World Cup heavyweights + key qualifiers), in a
// broadcast-friendly order. England uses the regional tag-sequence emoji; the
// rest are ISO-3166 alpha-2 regional-indicator pairs.
export const NATIONS = [
  ['Brazil', 'BR'], ['Argentina', 'AR'], ['France', 'FR'], ['Germany', 'DE'],
  ['Spain', 'ES'], ['England', 'ENG'], ['Italy', 'IT'], ['Portugal', 'PT'],
  ['Netherlands', 'NL'], ['Belgium', 'BE'], ['Croatia', 'HR'], ['Uruguay', 'UY'],
  ['USA', 'US'], ['Mexico', 'MX'], ['Japan', 'JP'], ['Morocco', 'MA'],
  ['Colombia', 'CO'], ['South Korea', 'KR'], ['Senegal', 'SN'], ['Switzerland', 'CH'],
];

const ENGLAND = String.fromCodePoint(0x1F3F4, 0xE0067, 0xE0062, 0xE0065, 0xE006E, 0xE0067, 0xE007F);

/** Flag emoji for an ISO alpha-2 code (or 'ENG' for England). */
export function flag(code) {
  if (code === 'ENG') return ENGLAND;
  return String.fromCodePoint(...[...code].map((ch) => 0x1F1E6 + ch.charCodeAt(0) - 65));
}

/** A top "country ribbon" band of flags for the App Store panels. Gold hairline
 *  edges, dark translucent band, flags evenly spread. */
export function flagRibbon({ width = 1290, count = 16, size = 60, top = 0, height = 116 } = {}) {
  const flags = NATIONS.slice(0, count).map(([, c]) => flag(c));
  // Force the color-emoji font: on headless Linux Chromium the default emoji
  // font renders regional-indicator pairs as plain code boxes ("BR", "AR"),
  // so the caller must load 'Noto Color Emoji' (Google Fonts) for real flags.
  const items = flags.map((f) => `<span style="font-family:'Noto Color Emoji',sans-serif;font-size:${size}px;line-height:1">${f}</span>`).join('');
  return `<div style="position:absolute;top:${top}px;left:0;right:0;height:${height}px;display:flex;
     align-items:center;justify-content:space-around;padding:0 30px;
     background:linear-gradient(180deg,rgba(7,11,18,.9),rgba(12,21,38,.62));
     border-top:3px solid rgba(242,181,12,.7);border-bottom:3px solid rgba(242,181,12,.45);
     box-shadow:0 10px 30px -12px rgba(0,0,0,.7)">${items}</div>`;
}
