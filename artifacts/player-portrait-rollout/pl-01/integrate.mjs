import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=p=>{const c={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,c);return c.exports;};
const {byClub}=read('src/data/communityPack/byClub.ts');
const {PLAYER_PORTRAITS:catalog}=read('src/data/playerPortraits.ts');
const {players}=JSON.parse(fs.readFileSync('artifacts/player-portrait-rollout/pl-01/manifest.json','utf8'));
const base=JSON.parse(fs.readFileSync('artifacts/player-portrait-sample-25/card-players.json','utf8'))[0];
const fixtures=[];
for(const p of players){
 const t=byClub[p.clubId].find(t=>t.fcId===p.fcId);
 if(!t)throw Error('Missing roster identity '+p.fcId);
 const src='/player-portraits/pl-01/'+p.fcId+'.webp';
 if(!fs.existsSync('public'+src))throw Error('Missing runtime asset '+src);
 catalog[p.fcId]={src,clubId:p.clubId,names:[...new Set([t.fn+' '+t.ln,p.name])]};
 fixtures.push({...base,id:'portrait-preview-'+p.fcId,fcId:p.fcId,firstName:t.fn===t.ln?'':t.fn,lastName:t.ln,clubId:p.clubId,nationality:t.nat,position:t.pos,overall:t.ovr,potential:t.pot,age:t.age,attributes:{pace:t.pace,shooting:t.shooting,passing:t.passing,mental:t.mental,defending:t.defending,physical:t.physical}});
}
fs.writeFileSync('src/data/playerPortraits.ts',"// Transparent portrait catalog. Importers merge batches by canonical player ID.\nimport type { PlayerPortraitAsset } from '@/types/game';\nexport const PLAYER_PORTRAITS: Record<string, PlayerPortraitAsset> = "+JSON.stringify(catalog,null,2)+';\n');
fs.writeFileSync('artifacts/player-portrait-rollout/pl-01/card-players.json',JSON.stringify(fixtures,null,2));
const from='artifacts/player-portrait-sample-25/';const to='artifacts/player-portrait-rollout/pl-01/';
fs.copyFileSync(from+'cards.html',to+'cards.html');
fs.writeFileSync(to+'cards.tsx',fs.readFileSync(from+'cards.tsx','utf8').replace('Your players, in their cards.','Premier League · Next 25').replace('25 approved portraits','25 new transparent portraits'));
fs.writeFileSync(to+'check-cards.mjs',fs.readFileSync(from+'check-cards.mjs','utf8').replaceAll('artifacts/player-portrait-sample-25/','artifacts/player-portrait-rollout/pl-01/'));
fs.writeFileSync(to+'check-card-matrix.mjs',fs.readFileSync(from+'check-card-matrix.mjs','utf8').replaceAll('artifacts/player-portrait-sample-25/','artifacts/player-portrait-rollout/pl-01/').replaceAll('cutout-v1','pl-01'));
console.log('Catalog entries: '+Object.keys(catalog).length);
