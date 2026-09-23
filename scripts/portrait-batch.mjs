// Reusable local portrait pipeline. Generation stays in the built-in image tool.
// Usage: node scripts/portrait-batch.mjs <batch-id> status|seal|prepare|integrate|verify
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { chromium } from 'playwright';

const [batch, command] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(batch || '') || !['status','seal','prepare','integrate','verify'].includes(command)) {
  throw Error('Usage: node scripts/portrait-batch.mjs <batch-id> status|seal|prepare|integrate|verify');
}
const dir = `artifacts/player-portrait-rollout/${batch}`;
const runtime = `public/player-portraits/${batch}`;
const origin = process.env.PORTRAIT_PREVIEW_ORIGIN || 'http://127.0.0.1:5180';
const manifest = JSON.parse(fs.readFileSync(`${dir}/manifest.json`, 'utf8'));
const { players } = manifest;
if(manifest.policy && players.some(p=>p.overall<manifest.policy.minimumOverall||!manifest.policy.leagues.includes(p.league)||(manifest.policy.clubIds&&!manifest.policy.clubIds.includes(p.clubId))))throw Error('Batch violates generation policy');
if (!players.length || new Set(players.map(p=>p.fcId)).size !== players.length || players.some(p=>!/^\d+$/.test(p.fcId))) throw Error('Invalid batch IDs');
if(players.some(p=>p.assetVersion&&!/^v\d+$/.test(p.assetVersion)))throw Error('Invalid asset version');
const assetName = p => p.fcId+(p.assetVersion?'-'+p.assetVersion:'');
const source = p => `${dir}/sources/${assetName(p)}.png`;
const output = p => `${runtime}/${assetName(p)}.webp`;
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (file, value) => { fs.writeFileSync(file+'.tmp', value); fs.renameSync(file+'.tmp', file); };
const json = (file, value) => write(file, JSON.stringify(value,null,2)+'\n');
function readTS(file) {
  const context = {exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
  return context.exports;
}
let validation = fs.existsSync(`${dir}/validation.json`) ? JSON.parse(fs.readFileSync(`${dir}/validation.json`,'utf8')) : [];

if (command === 'status') {
  console.log(JSON.stringify({requested:players.length,generated:players.filter(p=>fs.existsSync(source(p))).length,prepared:players.filter(p=>fs.existsSync(output(p))).length,missing:players.filter(p=>!fs.existsSync(source(p))).map(p=>({id:p.fcId,name:p.name}))},null,2));
}

if (command === 'seal') {
  const failures=fs.existsSync(`${dir}/generation-failures.json`) ? JSON.parse(fs.readFileSync(`${dir}/generation-failures.json`,'utf8')) : [];
  const missing=players.filter(p=>!fs.existsSync(source(p)));
  if(missing.some(p=>!failures.some(f=>f.id===p.fcId)))throw Error('Generation still incomplete: an unaccounted source is missing');
  const ready=players.filter(p=>fs.existsSync(source(p)));
  if(!ready.length)throw Error('No generated portraits');
  json(`${dir}/manifest.json`,{...manifest,requestedCount:manifest.requestedCount||players.length,players:ready,deferred:[...(manifest.deferred||[]),...missing.map(p=>({...p,reason:failures.find(f=>f.id===p.fcId).error}))]});
  console.log(JSON.stringify({ready:ready.length,newlyDeferred:missing.length}));
}

if (command === 'prepare') {
  fs.mkdirSync(runtime,{recursive:true});
  const browser = await chromium.launch({headless:true});
  const failures=[]; let reused=0;
  try {
    const page=await browser.newPage(); await page.goto(origin);
    // Sequential decode keeps peak memory bounded; successful work is cached.
    for (const p of players) {
      if (!fs.existsSync(source(p))) { failures.push({id:p.fcId,error:'Missing source'}); continue; }
      const sourceHash=hash(source(p));
      const cached=validation.find(v=>v.id===p.fcId);
      if (cached?.sourceHash===sourceHash && cached.transparent>=0.15 && cached.transparent<=0.85 && fs.existsSync(output(p)) && cached.outputHash===hash(output(p))) {reused++;continue;}
      try {
        const result=await page.evaluate(async url=>{
          const image=new Image();image.src=url;await image.decode();
          const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
          const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,512,512);
          const data=ctx.getImageData(0,0,512,512).data;
          let clear=0; for(let i=3;i<data.length;i+=4) if(data[i]===0) clear++;
          return {url:canvas.toDataURL('image/webp',0.92),transparent:clear/(512*512),topLeft:data[3],topRight:data[511*4+3],width:image.naturalWidth,height:image.naturalHeight};
        },'/'+source(p)+'?v='+sourceHash);
        if(result.transparent<0.15 || result.transparent>0.85 || result.topLeft!==0 || result.topRight!==0 || result.width!==result.height || !result.url.startsWith('data:image/webp;')) throw Error('Invalid transparency, dimensions or format');
        const bytes=Buffer.from(result.url.split(',')[1],'base64');fs.writeFileSync(output(p),bytes);
        validation=validation.filter(v=>v.id!==p.fcId);
        validation.push({id:p.fcId,name:p.name,sourceHash,outputHash:hash(output(p)),bytes:bytes.length,transparent:result.transparent,width:512,height:512});
        json(`${dir}/validation.json`,validation);
      } catch(error) { failures.push({id:p.fcId,error:String(error)}); }
    }
  } finally {await browser.close();}
  json(`${dir}/preparation-failures.json`,failures);
  console.log(JSON.stringify({validated:validation.length,reused,bytes:validation.reduce((n,p)=>n+p.bytes,0),failures}));
  if(failures.length) process.exitCode=1;
}

if (command === 'integrate') {
  const {byClub}=readTS('src/data/communityPack/byClub.ts');
  const {PLAYER_PORTRAITS:catalog}=readTS('src/data/playerPortraits.ts');
  const base=JSON.parse(fs.readFileSync('artifacts/player-portrait-sample-25/card-players.json','utf8'))[0];
  const fixtures=[];
  // Validate every row before changing the catalog.
  for(const p of players) {
    const check=validation.find(v=>v.id===p.fcId);
    if(!check || !fs.existsSync(output(p)) || check.sourceHash!==hash(source(p)) || check.outputHash!==hash(output(p))) throw Error('Unvalidated asset: '+p.fcId);
    const matches=(byClub[p.clubId]||[]).filter(t=>t.fcId.replace(/^fc\d{2}-/,'')===p.fcId);
    if(matches.length!==1)throw Error('Ambiguous roster identity: '+p.fcId);
    const t=matches[0];
    catalog[p.fcId]={src:`/player-portraits/${batch}/${assetName(p)}.webp`,clubId:p.clubId,names:[...new Set([t.fn+' '+t.ln,p.name,...(t.fn===t.ln?[t.ln]:[])])]};
    fixtures.push({...base,id:'portrait-preview-'+p.fcId,fcId:p.fcId,firstName:t.fn===t.ln?'':t.fn,lastName:t.ln,clubId:p.clubId,nationality:t.nat,position:t.pos,overall:t.ovr,potential:t.pot,age:t.age,attributes:{pace:t.pace,shooting:t.shooting,passing:t.passing,mental:t.mental,defending:t.defending,physical:t.physical}});
  }
  write('src/data/playerPortraits.ts',"// Transparent portrait catalog. Importers merge by canonical player ID.\nimport type { PlayerPortraitAsset } from '@/types/game';\nexport const PLAYER_PORTRAITS: Record<string, PlayerPortraitAsset> = "+JSON.stringify(catalog,null,2)+';\n');
  json(`${dir}/card-players.json`,fixtures);
  fs.copyFileSync('artifacts/player-portrait-sample-25/cards.html',`${dir}/cards.html`);
  let view=fs.readFileSync('artifacts/player-portrait-sample-25/cards.tsx','utf8');
  view=view.replace('Your players, in their cards.',`${manifest.policy?.title || 'Premier League'} · ${players.length} new portraits`).replace('25 approved portraits',`${players.length} transparent portraits`);
  view=view.replace('const players = data as Player[];',"const allPlayers = data as Player[];\nconst pageNumber = Number(new URLSearchParams(location.search).get('page') ?? (allPlayers.length > 100 ? '1' : '0'));\nconst players = pageNumber > 0 ? allPlayers.slice((pageNumber-1)*25,pageNumber*25) : allPlayers;");
  view=view.replace('<section className="portrait-preview-grid">', '<nav aria-label="Preview pages" style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}><a href="?page=0">All players</a>{Array.from({length:Math.ceil(allPlayers.length/25)},(_,i)=><a key={i} href={"?page="+(i+1)}>Page {i+1}</a>)}</nav><section className="portrait-preview-grid">');
  write(`${dir}/cards.tsx`,view);
  console.log(JSON.stringify({integrated:fixtures.length,catalog:Object.keys(catalog).length}));
}

if (command === 'verify') {
  const {PLAYER_PORTRAITS:catalog}=readTS('src/data/playerPortraits.ts');
  for(const [id,p] of Object.entries(catalog))if(!/^\d+$/.test(id)||!p.names.length||!p.clubId||!fs.existsSync('public'+p.src))throw Error('Invalid catalog entry: '+id);
  const browser=await chromium.launch({headless:true});const errors=[];const checks=[];
  try {
    const page=await browser.newPage({viewport:{width:1380,height:1000}});page.on('pageerror',e=>errors.push(e.message));
    const fronts=['bronze','silver','gold','icon','premium','rise-to-glory','champions','elite','world-class','legends','dynasty','golden-era','royal-reserve','ballondor'];
    for(const params of [...fronts.map(frame=>({frame})),...['xs','sm','md','lg','xl'].map(size=>({size}))]) {
      // Bound simultaneous image requests for full-squad batches.
      let total=0;
      for(let part=1;part<=Math.ceil(players.length/25);part++) {
      const expected=Math.min(25,players.length-(part-1)*25);
      await page.goto(`${origin}/${dir}/cards.html?`+new URLSearchParams({...params,page:String(part)}));
      await page.waitForSelector('.portrait-preview-grid img[src*="player-portraits"]');
      await page.locator('img').evaluateAll(images=>{for(const i of images)i.loading='eager';return Promise.all(images.map(i=>i.decode()));});
      const count=await page.locator(`.portrait-preview-grid img[src*="/player-portraits/${batch}/"]`).count();
      if(count!==expected)throw Error('Missing portraits '+JSON.stringify({...params,page:part}));
      if(params.frame && await page.locator(`.portrait-preview-grid img[src="/player-cards/${params.frame}.webp"]`).count()!==expected)throw Error('Wrong frame');
      total+=count;
      }
      checks.push({...params,count:total});
    }
    for(let part=1;part<=Math.ceil(players.length/25);part++) {
      await page.goto(`${origin}/${dir}/cards.html?page=${part}`);
      await page.locator('.portrait-preview-grid img').first().waitFor();
      await page.locator('img').evaluateAll(images=>{for(const i of images)i.loading='eager';return Promise.all(images.map(i=>i.decode()));});
      await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(150);
      await page.screenshot({path:`${dir}/cards-${part}.png`,fullPage:true});
    }
    await page.getByRole('button').first().click();
    await page.waitForFunction(()=>document.querySelector('[role="button"]').getAttribute('aria-label').includes('profile'));
    await page.setViewportSize({width:375,height:812});
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
    if(errors.length)throw Error(errors.join('\n'));
  } finally {await browser.close();}
  json(`${dir}/browser-validation.json`,{checks,errors,cycle:'passed',mobileOverflow:false,catalog:Object.keys(catalog).length});
  console.log(JSON.stringify({combinations:checks.reduce((n,c)=>n+c.count,0),errors,catalog:Object.keys(catalog).length}));
}
