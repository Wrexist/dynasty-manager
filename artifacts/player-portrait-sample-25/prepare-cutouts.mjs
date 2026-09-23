import fs from 'node:fs';
import {chromium} from 'playwright';
const {players}=JSON.parse(fs.readFileSync('artifacts/player-portrait-sample-25/team-colors/manifest.json','utf8'));
const out='public/player-portraits/cutout-v1';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const report=[];
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5180');
 for(const p of players){
 const r=await page.evaluate(async slug=>{
  const img=new Image();img.src='/artifacts/player-portrait-sample-25/source-assets/'+slug+'-cutout.png';await img.decode();
  const c=document.createElement('canvas');c.width=512;c.height=512;
  const ctx=c.getContext('2d');ctx.drawImage(img,0,0,512,512);
  const data=ctx.getImageData(0,0,512,512).data;
  let transparent=0;for(let i=3;i<data.length;i+=4)if(data[i]===0)transparent++;
  return {url:c.toDataURL('image/webp',0.92),transparent:transparent/(512*512),topLeftAlpha:data[3],topRightAlpha:data[511*4+3]};
 },p.slug);
 if(r.transparent<0.15||r.topLeftAlpha!==0||r.topRightAlpha!==0)throw Error('Transparency failure: '+p.slug+' '+JSON.stringify({...r,url:undefined}));
 const bytes=Buffer.from(r.url.split(',')[1],'base64');fs.writeFileSync(out+'/'+p.slug+'.webp',bytes);
 report.push({slug:p.slug,bytes:bytes.length,transparent:r.transparent});
 }
 fs.writeFileSync('artifacts/player-portrait-sample-25/cutout-validation.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({count:report.length,bytes:report.reduce((n,p)=>n+p.bytes,0),alpha:'all passed'}));
}finally{await browser.close();}
