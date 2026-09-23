import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const here=fileURLToPath(new URL('.',import.meta.url));
const {players}=JSON.parse(fs.readFileSync(new URL('./manifest.json',import.meta.url),'utf8'));
fs.mkdirSync(here+'portraits',{recursive:true});
for(const p of players) fs.copyFileSync(p.source,here+p.file);
let html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
html=html.replace('PORTRAIT STUDY 01','PORTRAIT STUDY 02 / CLUB COLORS')
  .replace('25 players. Every face matters.','25 players. Their club colors.')
  .replace('Consistent red shirts and charcoal backgrounds let you compare the faces.','Shirts use the main color of each player’s club in the game roster. Goalkeepers use the club’s primary color too. Plain colors, without badges or sponsors.')
  .replace('Created with built-in image generation · 21 September 2026 · Raphinha replaces the unavailable Yamal generation. Review likeness, hair, skin texture and face proportions before game integration.','Club mapping: checked-in game roster. 13 shirt edits made with built-in image generation; 12 red-club portraits retained. Original all-red sample preserved in the parent folder.');
for(const p of players) html=html.replace('<strong>'+p.name+'</strong><small>Open full size ↗</small>','<strong>'+p.name+'</strong><small>'+p.club+' · Open full size ↗</small>');
fs.writeFileSync(here+'index.html',html);
fs.copyFileSync(new URL('../check-gallery.mjs',import.meta.url),here+'check-gallery.mjs');
fs.writeFileSync(here+'README.md','# Club-color sample revision\n\nAll 25 portraits are available in index.html. 13 were edited using built-in image_gen; the 12 whose clubs already use red retain their original portraits. The original all-red set remains in the parent directory.\n\nClub identities and primary color targets come from the checked-in game roster, not a live-season verification. Barcelona uses the configured garnet primary. Goalkeepers also use club primary colors as requested, not season-specific goalkeeper kits. Plain-color samples do not reproduce full official kits.\n\nExact edit prompts, source images, club mappings and target hex colors are in manifest.json. Generative edits preserve recognizability but can alter fine skin/fabric texture; pixel-identical face preservation is not claimed. No gameplay code was changed.\n');
console.log('Saved 25 club-color portraits and gallery.');
