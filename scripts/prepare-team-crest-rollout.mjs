import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const root = 'artifacts/team-crest-rollout';
if (fs.existsSync(`${root}/manifest.json`) && JSON.parse(fs.readFileSync(`${root}/manifest.json`, 'utf8')).generator === 'authored-vector-system') throw Error('Raster workflow archived. Use scripts/build-vector-team-crests.mjs.');
fs.mkdirSync(`${root}/sources`, { recursive: true });
const read = path => {
  const context = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return context.exports;
};
const leagueIndex = fs.readFileSync('src/data/leagues/index.ts', 'utf8');
const files = [...leagueIndex.matchAll(/from '\.\/([^']+)'/g)].map(m => m[1]);
const motifs = [
  'three ascending beams with diagonal tops', 'a four-point compass spark above two horizontal bars',
  'three sweeping interwoven river bands', 'a rising sun above three strong pillars',
  'an interlocking six-point geometric star', 'a stylized arched bridge over two ripples',
  'a faceted mountain peak above a broad chevron', 'an abstract eight-spoke wheel with a diamond hub',
  'three interlocking diamond links in a vertical stack', 'a bold branching oak leaf with angular veins',
  'an abstract lighthouse beam made of a vertical bar and three rays', 'a symmetric pair of curved fronds enclosing a diamond',
  'a bold five-point star above three horizontal steps', 'three geometric petals around a central triangle',
  'two angular rising wings made of parallel bars around a small circle', 'a woven square knot made of four broad bands',
  'a stylized portcullis made of three pillars and a strong arch', 'three staggered peaks reflected over a single horizontal line',
  'an abstract spiral made of three smooth separated crescents', 'a faceted gemstone over two sweeping bands',
  'an original angular tree with three branches and a broad trunk', 'a bold hourglass shape framed by two vertical pillars',
  'four outward-pointing chevrons around a small central diamond', 'an arch enclosing three vertical rays and a small star',
  'a geometric snow crystal with six strong branches', 'three nested curved arches above a broad base',
  'a broad diagonal sash behind an original four-petal flower', 'a geometric torch with a single diamond-shaped flame',
  'a stylized soaring kite made from four separated facets', 'a broad anchor-like abstract T intersecting two waves',
];
const shapes = [
  'a traditional broad shield with curved shoulders and a pointed base, with the name in an upper panel',
  'a circular football crest with a broad outer name ring, the name on the top arc and the short code on the bottom arc',
  'a tall shield with a scalloped top and tapered base, with a clean top nameplate',
  'a roundel with a small central shield and a generous outer ring for the name',
  'a compact broad shield with integrated top and bottom nameplates',
  'an oval football badge with a double outline and a curved name header',
  'a clipped-corner shield with straight shoulders and a rounded point, with a wide name header',
];
const pilotIds = ['arsenal', 'chelsea', 'liverpool', 'manchester-city', 'manchester-united'];
const previous = fs.existsSync(`${root}/manifest.json`) ? JSON.parse(fs.readFileSync(`${root}/manifest.json`, 'utf8')) : { clubs: [] };
const saved = new Map(previous.clubs.map(c => [c.id, c]));
let ordinal = 0;
const clubs = files.flatMap(file => {
  const { CLUBS, LEAGUE_INFO } = read(`src/data/leagues/${file}.ts`);
  return CLUBS.map(c => {
    const n = ordinal++;
    const source = `${root}/sources/${c.id}.png`;
    if (!/^[a-z0-9-]+$/.test(c.id)) throw Error(`Unexpected club ID: ${c.id}`);
    if (pilotIds.includes(c.id) && !fs.existsSync(source)) fs.copyFileSync(`artifacts/team-crest-pilot-5/v2/${c.id}.png`, source);
    const prompt = `Use case: logo-brand. Create ONE original traditional football crest for the team named exactly ${JSON.stringify(c.name)}. Keep the name unchanged; use the original name, not a translation. Short code if needed: ${JSON.stringify(c.shortName)}. Strict two-color palette: primary ${c.color}, secondary ${c.secondaryColor}. Shape: ${shapes[n % shapes.length]}. Invented central motif: ${motifs[n % motifs.length]}. Original bold lettering and confident flat vector-like geometry, strong readable silhouette, thick clean borders, balanced negative space. Name is part of the badge, carefully spelled. Fit long names on two balanced lines if needed. Classic professional football badge, not an app icon. No copied official club symbol, mascot, wordmark, sponsor, manufacturer logo, founding dates or slogans. Do not recreate the official team crest. Solid colors, no gradient, bevel, texture, shadows or distressed edges. One emblem centered with 10 percent clear padding on a genuinely transparent square background. No mockup or extra text. Visually match a polished collection of traditional shields and circular football badges.`;
    return { ...saved.get(c.id), id: c.id, name: c.name, shortName: c.shortName, league: LEAGUE_INFO.id,
      color: c.color, secondaryColor: c.secondaryColor, source, prompt,
      status: fs.existsSync(source) ? (saved.get(c.id)?.status || (pilotIds.includes(c.id) ? 'user-approved-pilot' : 'generated')) : 'pending',
    };
  });
});
if (new Set(clubs.map(c => c.id)).size !== clubs.length) throw Error('Duplicate club IDs');
fs.writeFileSync(`${root}/manifest.json`, JSON.stringify({ version: 1, generator: 'built-in image_gen', rightsStatus: 'No legal clearance claimed', clubs }, null, 2));
console.log(JSON.stringify({ total: clubs.length, sourced: clubs.filter(c => fs.existsSync(c.source)).length, pending: clubs.filter(c => !fs.existsSync(c.source)).length }));
