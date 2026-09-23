import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const read=p=>{const c={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,c);return c.exports;};
const {byClub}=read('src/data/communityPack/byClub.ts');
const {PLAYER_PORTRAITS}=read('src/data/playerPortraits.ts');
const rolloutDir='artifacts/player-portrait-rollout';
const deferredIds=new Map();
if(fs.existsSync(rolloutDir))for(const entry of fs.readdirSync(rolloutDir,{withFileTypes:true})){
 const file=rolloutDir+'/'+entry.name+'/manifest.json';
 if(entry.isDirectory()&&fs.existsSync(file))for(const p of JSON.parse(fs.readFileSync(file,'utf8')).deferred||[])deferredIds.set(p.fcId,entry.name);
}
const rows=[];const leagues=[];
for(const league of ['england','spain','italy','germany','france']){
 const {CLUBS,LEAGUE_INFO}=read(`src/data/leagues/${league}.ts`);
 const players=CLUBS.flatMap(c=>(byClub[c.id]||[]).map(p=>({fcId:p.fcId.replace(/^fc\d{2}-/,''),name:p.fn===p.ln?p.ln:p.fn+' '+p.ln,clubId:c.id,club:c.name,color:c.color,league:LEAGUE_INFO.id,overall:p.ovr,position:p.pos,age:p.age,completed:Boolean(PLAYER_PORTRAITS[p.fcId.replace(/^fc\d{2}-/,'')])})));
 rows.push(...players);leagues.push({league:LEAGUE_INFO.name,total:players.length,completed:players.filter(p=>p.completed).length,remaining:players.filter(p=>!p.completed).length});
}
for(const p of rows)if(!p.completed&&deferredIds.has(p.fcId)){p.deferred=true;p.deferredBatch=deferredIds.get(p.fcId);}
rows.sort((a,b)=>b.overall-a.overall||a.name.localeCompare(b.name));
const dir='artifacts/player-portrait-rollout';fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(dir+'/coverage.json',JSON.stringify({source:'Checked-in game roster; not live squads',leagues,players:rows},null,2));
const policy=JSON.parse(fs.readFileSync(dir+'/policy.json','utf8'));
const next=rows.filter(p=>p.league==='eng'&&p.overall>=policy.minimumOverall&&!p.completed&&!p.deferred).slice(0,25);
fs.writeFileSync(dir+'/next-premier-league-batch.json',JSON.stringify(next,null,2));
fs.writeFileSync(dir+'/next-batch.json',JSON.stringify(rows.filter(p=>policy.leagues.includes(p.league)&&(!policy.clubIds||policy.clubIds.includes(p.clubId))&&p.overall>=policy.minimumOverall&&!p.completed&&!p.deferred).slice(0,100),null,2));
fs.writeFileSync(dir+'/deferred-portraits.json',JSON.stringify(rows.filter(p=>p.deferred),null,2));
console.log(JSON.stringify({leagues,deferred:rows.filter(p=>p.deferred).length,next:next.map(p=>p.name)}));
