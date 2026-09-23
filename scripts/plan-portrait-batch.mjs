// Creates a fresh, resumable generation queue under the current rollout policy.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const [batch,countArg='100']=process.argv.slice(2);
const count=Number(countArg);
if(!/^[a-z0-9-]+$/.test(batch||'')||!Number.isInteger(count)||count<1||count>1000)throw Error('Usage: node scripts/plan-portrait-batch.mjs <new-batch-id> [1..1000]');
const dir='artifacts/player-portrait-rollout/'+batch;
if(fs.existsSync(dir))throw Error('Batch already exists; resume it with portrait-batch.mjs instead');
const refresh=spawnSync(process.execPath,['scripts/prepare-portrait-rollout.mjs'],{encoding:'utf8'});
if(refresh.status!==0)throw Error(refresh.stderr||refresh.stdout);
const report=JSON.parse(fs.readFileSync('artifacts/player-portrait-rollout/coverage.json','utf8'));
const policy=JSON.parse(fs.readFileSync('artifacts/player-portrait-rollout/policy.json','utf8'));
if(!Number.isFinite(policy.minimumOverall)||policy.minimumOverall<0||!Array.isArray(policy.leagues)||!policy.leagues.length)throw Error('Invalid rollout policy');
const players=report.players.filter(p=>policy.leagues.includes(p.league)&&(!policy.clubIds||policy.clubIds.includes(p.clubId))&&p.overall>=policy.minimumOverall&&!p.completed&&!p.deferred).slice(0,count);
if(!players.length)throw Error('No eligible players remain');
fs.mkdirSync(dir+'/sources',{recursive:true});fs.mkdirSync(dir+'/receipts',{recursive:true});
fs.writeFileSync(dir+'/manifest.json',JSON.stringify({tool:'built-in image_gen',source:report.source,policy,requestedCount:players.length,players},null,2)+'\n');
console.log(JSON.stringify({batch,queued:players.length,first:players[0].name,last:players.at(-1).name}));
