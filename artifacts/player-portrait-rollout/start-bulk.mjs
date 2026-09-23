import fs from 'node:fs';
const report=JSON.parse(fs.readFileSync('artifacts/player-portrait-rollout/coverage.json','utf8'));
const players=report.players.filter(p=>p.league==='eng'&&!p.completed).slice(0,100);
const dir='artifacts/player-portrait-rollout/pl-bulk-03';
fs.mkdirSync(dir+'/sources',{recursive:true});fs.mkdirSync(dir+'/receipts',{recursive:true});
fs.writeFileSync(dir+'/manifest.json',JSON.stringify({tool:'built-in image_gen',players},null,2));
console.log(JSON.stringify(players));
