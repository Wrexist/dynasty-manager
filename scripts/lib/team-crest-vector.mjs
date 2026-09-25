// Original geometric motifs in a shared, editable football-crest design system.
// Stable club IDs determine the design; league position and roster order do not.
export const escapeXml = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' })[c]);
export function hashId(value) {
  let hash = 2166136261;
  for (const c of value) hash = Math.imul(hash ^ c.codePointAt(0), 16777619);
  return hash >>> 0;
}
const path = d => `<path d="${d}"/>`;
const stroke = d => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="square" stroke-linejoin="round"/>`;
const rotate = (art, n) => Array.from({length:n}, (_,i)=>`<g transform="rotate(${i*360/n})">${art}</g>`).join('');
export const MOTIFS = [
  ['rising-beams', path('M-63 16L-32-1V57L-63 38Z M-15-14L16-31V70H-15Z M33-45L64-62V39L33 59Z')],
  ['compass', path('M0-73L16-16L73 0L16 16L0 73L-16 16L-73 0L-16-16Z')+stroke('M-58-38H-28 M28-38H58 M-58 38H-28 M28 38H58')],
  ['river-bands', stroke('M-59-62C7-31-70 14-5 63 M-21-62C45-31-32 14 33 63 M17-62C83-31 6 14 71 63')],
  ['sunrise', path('M-36-10A36 36 0 0 1 36-10Z M-51 3H-25V45L-51 31Z M-13 3H13V64H-13Z M25 3H51V31L25 45Z')+stroke('M0-71V-58 M-46-57L-36-47 M46-57L36-47 M-68-25L-55-21 M68-25L55-21')],
  ['woven-star', rotate(path('M0-73L43 0H19L-10-49H-48L-62-73Z'),3)],
  ['bridge', path('M-69-9Q0-79 69-9V12H47V-3Q0-41-47-3V12H-69Z M-50 8H-34V45H-50Z M-8-1H8V45H-8Z M34 8H50V45H34Z')+stroke('M-67 57Q-34 43 0 57T67 57')],
  ['mountain', path('M0-72L73 34H-73Z M-56 48L0 68L56 48V62L0 81L-56 62Z')],
  ['wheel', '<circle r="56" fill="none" stroke="currentColor" stroke-width="8"/>'+rotate(path('M-5-60H5V-14H-5Z'),8)+'<circle r="13"/>'],
  ['diamond-links', stroke('M0-71L29-42L0-13L-29-42Z M0-28L29 1L0 30L-29 1Z M0 15L29 44L0 73L-29 44Z')],
  ['oak', path('M0-74L18-53L13-30L39-48L55-27L32-5L61-13L68 12L16 35L7 71H-7L-16 35L-68 12L-61-13L-32-5L-55-27L-39-48L-13-30L-18-53Z')],
  ['beacon', path('M-13-39H13L24 64H-24Z M-23-56H23V-44H-23Z M-7-72H7V-61H-7Z M-32-28L-74-7V-31L-32-41Z M32-28L74-7V-31L32-41Z')],
  ['fronds', stroke('M-12 64Q-63 26-48-43 M12 64Q63 26 48-43')+rotate(path('M-45-34L-65-52L-67-26L-47-10Z M-49-7L-72-23L-70 5L-46 18Z M-38 21L-64 9L-55 37L-26 46Z'),2)+path('M0-30L22 0L0 30L-22 0Z')],
  ['star-steps', path('M0-72L15-39L51-35L25-11L32 25L0 8L-32 25L-25-11L-51-35L-15-39Z M-29 37H29V47H-29Z M-45 53H45V64H-45Z')],
  ['three-petals', rotate(path('M0-67C42-66 43-18 0-8C-43-18-42-66 0-67Z'),3)],
  ['rising-wings', path('M-11-20L-69-63V-42L-11 0Z M-11 11L-59-20V0L-11 32Z M-11 43L-40 25V46L-11 67Z M11-20L69-63V-42L11 0Z M11 11L59-20V0L11 32Z M11 43L40 25V46L11 67Z')+'<circle cy="-37" r="12"/>'],
  ['square-knot', rotate(stroke('M-15-63H48V0H20V-35H-15Z'),4)],
  ['arch-pillars', stroke('M-61 54V-13A61 61 0 0 1 61-13V54 M-31 54V-19 M0 54V-36 M31 54V-19 M-70 66H70')],
  ['three-peaks', path('M-76 23L-37-42L-14-8L17-65L74 23Z M-72 36H72L39 49H-39Z M-35 59H35L0 73Z')],
  ['crescents', rotate(path('M-9-71C48-74 66-32 45 4C43-28 15-41-9-23Z'),3)],
  ['gemstone', path('M-40-56H40L66-20L0 39L-66-20Z')+stroke('M-62 50Q-30 36 0 50T62 50 M-45 69Q-20 59 0 69T45 69')],
  ['branching-tree', path('M-8-67H8V-35L38-58L52-45L8-11V10L52-17L65-2L8 35V70H-8V35L-65-2L-52-17L-8 10V-11L-52-45L-38-58L-8-35Z')],
  ['hourglass', stroke('M-32-64H32V-43Q32-24 0 0Q32 24 32 43V64H-32V43Q-32 24 0 0Q-32-24-32-43Z M-56-53V53 M56-53V53')],
  ['four-chevrons', rotate(path('M-24-63L0-39L24-63L35-52L0-17L-35-52Z'),4)],
  ['radiant-arch', stroke('M-65 52V-6A65 65 0 0 1 65-6V52 M-36 52V-5 M0 52V-17 M36 52V-5')+path('M0-47L7-33L23-31L11-20L14-5L0-12L-14-5L-11-20L-23-31L-7-33Z')],
  ['crystal', rotate(stroke('M0 0V-69 M0-34L-22-52 M0-34L22-52'),6)],
  ['nested-arches', stroke('M-69 55V-4A69 69 0 0 1 69-4V55 M-45 55V-1A45 45 0 0 1 45-1V55 M-21 55V1A21 21 0 0 1 21 1V55 M-74 69H74')],
  ['four-petals', rotate(path('M0-7C-43-25-35-64 0-70C35-64 43-25 0-7Z'),4)],
  ['torch', path('M0-76L25-44L0-13L-25-44Z M-28-1H28L19 18H-19Z M-9 29H9L16 71H-16Z')+stroke('M-42-44L-54-57 M42-44L54-57')],
  ['kite', path('M0-76L-64-10L-10-19Z M0-76L10-19L64-10Z M-64 2L-10-8L-1 64Z M10-8L64 2L1 64Z')],
  ['harbor', stroke('M0-49V47 M-34-29H34 M-59 6Q-58 46 0 58Q58 46 59 6')+'<circle cy="-64" r="9" fill="none" stroke="currentColor" stroke-width="7"/>'],
];
const SHAPES = [
  ['shield','M160 18Q104 43 39 43V158Q39 242 160 302Q281 242 281 158V43Q216 43 160 18Z'],
  ['scalloped','M160 18Q107 50 47 34L39 155Q39 246 160 302Q281 246 281 155L273 34Q213 50 160 18Z'],
  ['round',''], ['round-shield',''],
  ['oval','M160 18C248 18 280 79 280 157C280 230 228 279 160 302C92 279 40 230 40 157C40 79 72 18 160 18Z'],
  ['clipped','M75 28H245L284 67V194L245 244L160 303L75 244L36 194V67Z'],
  ['banner','M160 20L186 39H278V106H262V205Q262 232 241 250L262 261V279Q160 318 58 279V261L79 250Q58 232 58 205V106H42V39H134Z'],
  ['arched','M42 72Q160-30 278 72V207Q232 266 160 301Q88 266 42 207Z'],
];
function splitName(name, limit = 17) {
  if (name.length <= limit) return [name];
  const words = name.split(' ');
  if (words.length < 2) return [name];
  let best = 1;
  for (let i=2;i<words.length;i++) if (Math.abs(words.slice(0,i).join(' ').length-words.slice(i).join(' ').length)<Math.abs(words.slice(0,best).join(' ').length-words.slice(best).join(' ').length)) best=i;
  return [words.slice(0,best).join(' '),words.slice(best).join(' ')];
}
function fittedText(value, y, maxWidth, fill, size=28) {
  const estimate = [...value].reduce((n,c)=>n+(/[MW@]/.test(c)?0.9:/[Iil1 .']/ .test(c)?0.3:0.67),0)*size;
  const fit = estimate > maxWidth ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : '';
  return `<text x="160" y="${y}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="800" fill="${fill}"${fit}>${escapeXml(value)}</text>`;
}
export function createVectorCrest(club) {
  const hash = hashId(club.id);
  const shapeIndex = hash % SHAPES.length;
  const [shape, outline] = SHAPES[shapeIndex];
  const [motif, art] = MOTIFS[(hash >>> 5) % MOTIFS.length];
  const primary = club.color, secondary = club.secondaryColor;
  const name = club.name.toLocaleUpperCase('en');
  const lines = splitName(name);
  let body;
  if (shape.startsWith('round')) {
    const arcTop = lines[0], arcBottom = lines[1] || club.shortName;
    const arcText = (value,id,size) => `<text font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="800" fill="${secondary}" ${value.length>19?'textLength="260" lengthAdjust="spacingAndGlyphs"':''}><textPath href="#${id}" startOffset="50%" text-anchor="middle">${escapeXml(value)}</textPath></text>`;
    body = `<defs><path id="top" d="M51 160A109 109 0 0 1 269 160"/><path id="bottom" d="M43 174A117 117 0 0 0 277 174"/></defs><circle cx="160" cy="160" r="143" fill="${primary}"/><circle cx="160" cy="160" r="136" fill="none" stroke="${secondary}" stroke-width="4"/><circle cx="160" cy="160" r="99" fill="none" stroke="${secondary}" stroke-width="3"/>${arcText(arcTop,'top',arcTop.length>14?22:27)}${arcText(arcBottom,'bottom',arcBottom.length>14?21:25)}<circle cx="35" cy="162" r="4" fill="${secondary}"/><circle cx="285" cy="162" r="4" fill="${secondary}"/>`;
    if (shape==='round-shield') body+=`<path d="M91 94H229V180Q229 224 160 253Q91 224 91 180Z" fill="none" stroke="${secondary}" stroke-width="3"/>`;
    body+=`<g transform="translate(160 164) scale(${shape==='round-shield'?0.77:0.95})" fill="${secondary}" color="${secondary}">${art}</g>`;
  } else {
    body=`<path d="${outline}" fill="${primary}"/><path d="${outline}" transform="translate(160 160) scale(.925) translate(-160 -160)" fill="none" stroke="${secondary}" stroke-width="4.5"/>`;
    const top = shape==='arched'?83:76;
    body+= lines.length===1 ? fittedText(lines[0],top+14,205,secondary,29) : fittedText(lines[0],top,205,secondary,25)+fittedText(lines[1],top+29,205,secondary,25);
    body+=`<path d="M57 120Q160 108 263 120" fill="none" stroke="${secondary}" stroke-width="3"/><g transform="translate(160 190) scale(.82)" fill="${secondary}" color="${secondary}">${art}</g>`;
    if (shape==='banner') body+=fittedText(club.shortName,285,152,secondary,22);
    else if ((hash>>>12)%2===0) body+=`<path d="M147 273L160 280L173 273" fill="none" stroke="${secondary}" stroke-width="4"/>`;
  }
  return { shape, motif, svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="${escapeXml(club.name)}"><title>${escapeXml(club.name)}</title>${body}</svg>` };
}
