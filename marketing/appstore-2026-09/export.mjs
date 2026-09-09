/** Re-export the recovered campaign masters and render the precise Liverpool XI.
 * Sharp is an external authoring tool; it is not added to the application bundle.
 */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,unlinkSync,copyFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const sharp=createRequire(import.meta.url)('sharp');
const root=dirname(fileURLToPath(import.meta.url));
const repo=join(root,'../..');
const formats={'iphone-6.5':[1242,2688],'iphone-6.9':[1320,2868],'ipad-13':[2064,2752]};
const names=['01-dream-team','02-starting-eleven','03-match-day','04-transfer-market','05-development','06-club-management','07-your-career','08-national-team'];
// [roster surname, display name, natural position, OVR, diagram x, diagram y]
const xi=[
 ['Gakpo','Gakpo','LM',84,180,110],
 ['Isak','Isak','ST',88,500,90],
 ['Salah','Salah','RM',91,820,110],
 ['Mac Allister','Mac Allister','CM',87,180,390],
 ['Gravenberch','Gravenberch','CDM',85,500,370],
 ['Wirtz','Wirtz','CAM',89,820,390],
 ['Kerkez','Kerkez','LB',82,110,670],
 ['van Dijk','van Dijk','CB',90,370,650],
 ['Konaté','Konaté','CB',86,630,650],
 ['Frimpong','Frimpong','RB',83,890,670],
 ['Becker','Alisson','GK',89,500,940],
];
const roster=readFileSync(join(repo,'src/data/squads/england.ts'),'utf8').split('\n');
if(xi.length!==11||new Set(xi.map(p=>p[0])).size!==11)throw Error('The XI needs eleven different players');
for(const[name,,pos,rating]of xi){
 if(!roster.some(l=>l.includes("ln: '"+name+"'")&&l.includes('ovr: '+rating+',')&&l.includes("pos: '"+pos+"'")))throw Error('Roster mismatch: '+name);
}
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const txt=(x,y,s,size,color,weight=700,extra='')=>`<text x="${x}" y="${y}" font-family="DejaVu Sans" font-size="${size}" font-weight="${weight}" fill="${color}" ${extra}>${esc(s)}</text>`;
const cardImages=Object.fromEntries(await Promise.all(['world-class','gold'].map(async n=>[n,'data:image/png;base64,'+(await sharp(join(repo,'public/player-cards',n+'.webp')).png().toBuffer()).toString('base64')])));
function lineup(){
 let s='<rect width="1000" height="1250" rx="28" fill="#0c382b" stroke="#416d50" stroke-width="2"/>';
 s+='<g fill="none" stroke="#8da88b" stroke-opacity=".35" stroke-width="3"><rect x="36" y="40" width="928" height="1160"/><path d="M36 590h928"/><circle cx="500" cy="590" r="122"/><rect x="264" y="40" width="472" height="175"/><rect x="264" y="1025" width="472" height="175"/></g>';
 s+=txt(500,65,'LIVERPOOL • 4–3–3',25,'#f3ddb0',700,'text-anchor="middle" letter-spacing="3"');
 for(const[,name,pos,rating,cx,cy]of xi){
  const art=rating>=85?'world-class':'gold';
  s+=`<image x="${cx-100}" y="${cy-20}" width="200" height="270" href="${cardImages[art]}" preserveAspectRatio="xMidYMid meet"/><rect x="${cx-76}" y="${cy+53}" width="152" height="121" rx="8" fill="#08151dea"/>`;
  s+=txt(cx-57,cy+97,rating,42,'#f6ddb0')+txt(cx+21,cy+94,pos,19,'#e8d5ae')+txt(cx,cy+136,name,name.length>10?16:18,'#fff6e6',700,'text-anchor="middle"')+txt(cx,cy+160,'OVR • '+pos,13,'#b7caba',400,'text-anchor="middle"');
 }
 return s;
}
const manifest=[];
for(const[folder,[width,height]]of Object.entries(formats)){
 const dir=join(root,folder);mkdirSync(dir,{recursive:true});
 const expected=new Set(names.map(n=>n+'.jpg'));
 for(const file of readdirSync(dir))if(file.endsWith('.jpg')&&!expected.has(file))unlinkSync(join(dir,file));
 for(const name of names){
  const file=name+'.jpg',source=join(root,'masters',folder,file),target=join(dir,file);
  if(name==='02-starting-eleven'){
   const tablet=folder==='ipad-13',W=tablet?1500:1000,H=tablet?2000:height/width*1000;
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${W} ${H}"><g transform="translate(${tablet?55:80} ${tablet?485:450}) scale(.84)">${lineup()}</g></svg>`;
   await sharp(source).composite([{input:Buffer.from(svg)}]).flatten({background:'#0c382b'}).jpeg({quality:94,chromaSubsampling:'4:4:4'}).toFile(target);
  }else copyFileSync(source,target);
  const m=await sharp(target).metadata();
  if(m.width!==width||m.height!==height||m.hasAlpha||m.space!=='srgb')throw Error('Invalid export: '+target);
  manifest.push({file:folder+'/'+file,width,height,format:'JPEG',alpha:false});
 }
 if(readdirSync(dir).filter(f=>f.endsWith('.jpg')).length!==8)throw Error('Unexpected export files: '+folder);
}
writeFileSync(join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const[folder,file,w,h,gap]of [['iphone-6.9','preview.jpg',280,608,15],['ipad-13','preview-ipad.jpg',300,400,15]]){
 const thumbs=await Promise.all(names.map(async n=>await sharp(join(root,folder,n+'.jpg')).resize(w,h).toBuffer()));
 await sharp({create:{width:4*(w+gap),height:2*(h+2*gap),channels:3,background:'#111917'}}).composite(thumbs.map((input,i)=>({input,left:gap+(i%4)*(w+gap),top:gap+Math.floor(i/4)*(h+2*gap)}))).jpeg({quality:92}).toFile(join(root,file));
}
console.log('Verified 24 exports, eight distinct themes and eleven Liverpool roster players.');
