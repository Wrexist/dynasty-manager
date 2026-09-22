import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=p=>{const c={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,c);return c.exports;};
const {byClub}=read('src/data/communityPack/byClub.ts');
const {players}=JSON.parse(fs.readFileSync('artifacts/player-portrait-sample-25/team-colors/manifest.json','utf8'));
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const entries=[]; const fixtures=[];
for(const p of players){
 const matches=Object.entries(byClub).flatMap(([clubId,ps])=>ps.filter(t=>norm(t.fn+' '+t.ln)===norm(p.name)||(norm(t.fn)===norm(t.ln)&&norm(t.ln)===norm(p.name))).map(t=>({clubId,t})));
 if(matches.length!==1)throw Error('Ambiguous mapping: '+p.name);
 const {clubId,t}=matches[0];
 const file='/player-portraits/cutout-v1/'+p.slug+'.webp';
 if(!fs.existsSync('public'+file))throw Error('Missing prepared cutout: '+file);
 const names=[t.fn+' '+t.ln,p.name];
 if(t.fn===t.ln)names.push(t.ln);
 entries.push([t.fcId,{src:file,clubId,names:[...new Set(names)]}]);
 fixtures.push({id:'portrait-preview-'+t.fcId,firstName:t.fn===t.ln?'':t.fn,lastName:t.ln,position:t.pos,overall:t.ovr,potential:t.pot,age:t.age,nationality:t.nat,clubId,source:'real',fcId:t.fcId,attributes:{pace:t.pace,shooting:t.shooting,passing:t.passing,mental:t.mental,defending:t.defending,physical:t.physical},fitness:100,morale:80,form:75,wage:0,value:0,contractEnd:3,injured:false,injuryWeeks:0,goals:0,assists:0,appearances:0,careerGoals:0,careerAssists:0,careerAppearances:0,yellowCards:0,redCards:0});
}
fs.writeFileSync('src/data/playerPortraits.ts',"// Approved 25-player sample. Regenerate using artifacts/player-portrait-sample-25/integrate-assets.mjs.\nimport type { PlayerPortraitAsset } from '@/types/game';\n\nexport const PLAYER_PORTRAITS: Record<string, PlayerPortraitAsset> = "+JSON.stringify(Object.fromEntries(entries),null,2)+';\n');
fs.writeFileSync('artifacts/player-portrait-sample-25/card-players.json',JSON.stringify(fixtures,null,2)+'\n');
console.log('Mapped '+entries.length+' transparent portraits using verified roster identities.');
