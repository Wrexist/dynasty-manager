/** Export approved artwork. Sharp is an external authoring prerequisite. */
import {createRequire} from 'node:module';
import {writeFileSync,readdirSync,mkdirSync,unlinkSync,copyFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const sharp=createRequire(import.meta.url)('sharp');
const root=dirname(fileURLToPath(import.meta.url));
const formats={'iphone-6.5':[1242,2688],'iphone-6.9':[1320,2868],'ipad-13':[2064,2752]};
const names=['01-dream-team','02-starting-eleven','03-match-day','04-transfer-market','05-development','06-club-management','07-pack-opening','08-ballon-dor'];
const preserved=new Set(['01-dream-team','03-match-day']);
const manifest=[];
for(const[folder,[width,height]]of Object.entries(formats)){
 const dir=join(root,folder);mkdirSync(dir,{recursive:true});
 const expected=new Set(names.map(n=>n+'.jpg'));
 for(const file of readdirSync(dir))if(file.endsWith('.jpg')&&!expected.has(file))unlinkSync(join(dir,file));
 for(const name of names){
  const file=name+'.jpg',target=join(dir,file);
  if(preserved.has(name))copyFileSync(join(root,'masters',folder,file),target);
  else await sharp(join(root,'masters','approved',file)).resize(width,height,{fit:'contain',background:'#0c1017'}).flatten({background:'#0c1017'}).toColourspace('srgb').jpeg({quality:94,chromaSubsampling:'4:4:4'}).toFile(target);
  const m=await sharp(target).metadata();
  if(m.width!==width||m.height!==height||m.hasAlpha||m.space!=='srgb')throw Error('Invalid export: '+target);
  manifest.push({file:folder+'/'+file,width,height,format:'JPEG',alpha:false,source:preserved.has(name)?'preserved-device-master':'approved-promotional-concept',layout:preserved.has(name)?'original':'proportionally-contained'});
 }
 if(readdirSync(dir).filter(f=>f.endsWith('.jpg')).length!==names.length)throw Error('Unexpected export files: '+folder);
}
writeFileSync(join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const[folder,file,w,h,gap]of [['iphone-6.9','preview.jpg',280,608,15],['ipad-13','preview-ipad.jpg',300,400,15]]){
 const thumbs=await Promise.all(names.map(n=>sharp(join(root,folder,n+'.jpg')).resize(w,h,{fit:'contain',background:'#0c1017'}).toBuffer()));
 await sharp({create:{width:4*(w+gap),height:2*(h+2*gap),channels:3,background:'#0c1017'}}).composite(thumbs.map((input,i)=>({input,left:gap+(i%4)*(w+gap),top:gap+Math.floor(i/4)*(h+2*gap)}))).jpeg({quality:92}).toFile(join(root,file));
}
console.log('Verified 24 opaque sRGB exports across all three device sizes.');
