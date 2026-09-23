import {chromium} from 'playwright';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true});
const frames=['bronze','silver','gold','icon','premium','rise-to-glory','champions','elite','world-class','legends','dynasty','golden-era','royal-reserve','ballondor'];
const results=[];const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1380,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 for(const params of [...frames.map(frame=>({frame})),...['xs','sm','md','lg','xl'].map(size=>({size}))]){
  await page.goto('http://127.0.0.1:5180/artifacts/player-portrait-sample-25/cards.html?'+new URLSearchParams(params));
  await page.waitForSelector('.portrait-preview-grid img[src*="cutout-v1"]');
  await page.locator('img').evaluateAll(imgs=>{for(const i of imgs)i.loading='eager';return Promise.all(imgs.map(i=>i.decode()));});
  const count=await page.locator('.portrait-preview-grid img[src*="cutout-v1"]').count();
  if(count!==25)throw Error('Missing portraits '+JSON.stringify(params));
  if(params.frame){const n=await page.locator(`.portrait-preview-grid img[src="/player-cards/${params.frame}.webp"]`).count();if(n!==25)throw Error('Wrong frame');}
  results.push({...params,portraits:count});
 }
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync('artifacts/player-portrait-sample-25/card-matrix-validation.json',JSON.stringify({results,errors},null,2));
 console.log(JSON.stringify({combinations:results.length*25,errors}));
}finally{await browser.close();}
