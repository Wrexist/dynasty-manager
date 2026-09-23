import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const refresh=spawnSync(process.execPath,['scripts/prepare-portrait-rollout.mjs'],{encoding:'utf8'});
if(refresh.status!==0)throw Error(refresh.stderr||refresh.stdout);
const report=JSON.parse(fs.readFileSync('artifacts/player-portrait-rollout/coverage.json','utf8'));
const clubs=JSON.parse(fs.readFileSync('artifacts/player-portrait-rollout/top-clubs-selection.json','utf8'));
const rows=clubs.map(c=>{
  const players=report.players.filter(p=>p.clubId===c.id);
  return {...c,total:players.length,portraits:players.filter(p=>p.completed).length,missing:players.filter(p=>!p.completed).map(p=>({id:p.fcId,name:p.name,overall:p.overall,deferred:!!p.deferred}))};
});
const result={source:report.source,scope:'Six strongest clubs per league; full squads',total:rows.reduce((n,c)=>n+c.total,0),portraits:rows.reduce((n,c)=>n+c.portraits,0),clubs:rows};
fs.writeFileSync('artifacts/player-portrait-rollout/top-club-coverage.json',JSON.stringify(result,null,2)+'\n');
const lines=['# Top-club portrait coverage','',result.source+'. Full squads explicitly authorized, including ratings below 80.','',`${result.portraits} of ${result.total} players have portraits. ${rows.filter(c=>!c.missing.length).length} of ${rows.length} clubs have complete coverage.`,'','| League | Club | Portraits | Squad |','| --- | --- | ---: | ---: |',...rows.map(c=>`| ${c.league} | ${c.name} | ${c.portraits} | ${c.total} |`),'','## Deferred generation requests','',...rows.flatMap(c=>c.missing.map(p=>`- ${p.name} — ${c.name}, ${p.overall} OVR${p.deferred?' (generation service rejected request)':''}.`)),''];
fs.writeFileSync('artifacts/player-portrait-rollout/TOP-CLUB-COVERAGE.md',lines.join('\n'));
console.log(JSON.stringify({total:result.total,portraits:result.portraits,missing:result.total-result.portraits,clubs:rows.map(c=>({name:c.name,total:c.total,portraits:c.portraits,missing:c.missing.length}))}));
