import fs from 'node:fs';
for(const name of ['prepare.mjs','integrate.mjs']){
 const s=fs.readFileSync('artifacts/player-portrait-rollout/pl-01/'+name,'utf8').replaceAll('pl-01','pl-02').replace('Premier League · Next 25','Premier League · Batch 02');
 fs.writeFileSync('artifacts/player-portrait-rollout/pl-02/'+name,s);
}
