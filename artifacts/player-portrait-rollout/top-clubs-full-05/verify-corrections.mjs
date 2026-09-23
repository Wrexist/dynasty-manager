import fs from 'node:fs';
import {chromium} from 'playwright';
const dir='artifacts/player-portrait-rollout/top-clubs-full-05';
const m=JSON.parse(fs.readFileSync(dir+'/manifest.json','utf8'));
const corrected=m.players.filter(p=>p.assetVersion==='v2');
const frames=['bronze','silver','gold','icon','premium','rise-to-glory','champions','elite','world-class','legends','dynasty','golden-era','royal-reserve','ballondor'];
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1380,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
let checks=0;
try{
for(const player of corrected){
 const part=Math.floor(m.players.indexOf(player)/25)+1;
 const url='http://127.0.0.1:5180/'+dir+'/cards.html?';
 for(const params of [...frames.map(frame=>({frame})),...['xs','sm','md','lg','xl'].map(size=>({size}))]){
  await p.goto(url+new URLSearchParams({...params,page:String(part)}));
  const portrait=p.locator('.portrait-preview-grid img[src$="/'+player.fcId+'-v2.webp"]');
  await portrait.waitFor();await portrait.evaluate(async i=>{i.loading='eager';await i.decode();if(i.naturalWidth!==512||i.naturalHeight!==512)throw Error('Wrong dimensions');});checks++;
 }
 await p.goto(url+'page='+part);
 await p.locator('.portrait-preview-grid img').first().waitFor();
 await p.locator('img').evaluateAll(images=>{for(const i of images)i.loading='eager';return Promise.all(images.map(i=>i.decode()));});
 await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(150);
 await p.screenshot({path:dir+'/cards-'+part+'.png',fullPage:true});
}
if(errors.length)throw Error(errors.join('\n'));
fs.writeFileSync(dir+'/correction-browser-validation.json',JSON.stringify({checks,errors,ids:corrected.map(p=>p.fcId)},null,2));
console.log(JSON.stringify({checks,errors}));
}finally{await b.close();}
