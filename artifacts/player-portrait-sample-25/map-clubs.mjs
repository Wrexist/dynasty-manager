import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read = p => { const c={exports:{}}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,c); return c.exports; };
const {byClub}=read('src/data/communityPack/byClub.ts');
const clubs=['england','spain','italy','germany','france'].flatMap(n=>read('src/data/leagues/'+n+'.ts').CLUBS);
const manifest=JSON.parse(fs.readFileSync('artifacts/player-portrait-sample-25/manifest.json','utf8'));
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
for(const p of manifest.players){
 const tokens=norm(p.name).split(' ');
 const matches=Object.entries(byClub).flatMap(([id,ps])=>ps.filter(t=>tokens.some(k=>k.length>3 && norm(t.ln).includes(k))).map(t=>({name:t.fn+' '+t.ln,id,fcId:t.fcId,color:clubs.find(c=>c.id===id)?.color,club:clubs.find(c=>c.id===id)?.name})));
 console.log(JSON.stringify({sample:p.name,matches}));
}
