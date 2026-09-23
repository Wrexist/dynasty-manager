import fs from 'node:fs';
const p='artifacts/player-portrait-rollout/pl-01/prepare.mjs';
let s=fs.readFileSync(p,'utf8');
s=s.replace('artifacts/player-portrait-sample-25/team-colors/manifest.json','artifacts/player-portrait-rollout/pl-01/manifest.json').replaceAll('p.slug','p.fcId').replaceAll('public/player-portraits/cutout-v1','public/player-portraits/pl-01').replace('/artifacts/player-portrait-sample-25/source-assets/','/artifacts/player-portrait-rollout/pl-01/sources/').replace("+'-cutout.png'","+'.png'").replace('artifacts/player-portrait-sample-25/cutout-validation.json','artifacts/player-portrait-rollout/pl-01/validation.json');
fs.writeFileSync(p,s);
