import React from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/oswald/700.css';
import '@fontsource/dm-sans/400.css';
import '@/index.css';
import {PlayerCard} from '@/components/game/PlayerCard';
import {PACK_CARD_FRAMES} from '@/config/packs';
import type {Player} from '@/types/game';
import data from './card-players.json';
const backgrounds=['bronze','silver','gold','icon','premium','rise-to-glory','champions','elite','world-class','legends','dynasty','golden-era','royal-reserve','ballondor'];
// Preview-only aliases allow every existing artwork to use the same real card
// and the same player rating. No save or gameplay configuration is changed.
for(const name of backgrounds) PACK_CARD_FRAMES[`preview-${name}`]=`/player-cards/${name}.webp`;
const player={...data[3],firstName:'Virgil',lastName:'van Dijk'} as Player;
createRoot(document.getElementById('root')!).render(<main>
  <p className="eyebrow">DYNASTY MANAGER / PORTRAIT STUDY</p>
  <h1>Van Dijk. Every card background.</h1>
  <p className="intro">14 front artworks · Liverpool red · Lighter shading beneath the portrait</p>
  <section>{backgrounds.map((name,i)=><article key={name}>
    <PlayerCard player={{...player,packFrame:`preview-${name}`}} size="xl" interactive="cycle"/>
    <h2><span>{String(i+1).padStart(2,'0')}</span> {name==='ballondor'?"Ballon d’Or":name.replaceAll('-',' ')}</h2>
  </article>)}</section>
  <p className="foot">Actual game card component · Identical player and stats throughout · Tap any card to inspect its other views</p>
  <style>{`body{background:#08110f}main{max-width:1160px;margin:auto;padding:36px 32px 24px}.eyebrow{font-size:11px;letter-spacing:3px;color:#50d8ad}h1{font-size:34px;font-weight:800;margin:10px 0}.intro,.foot{color:#a5bbb0;font-size:13px}.intro{margin-bottom:24px}section{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px 20px}article{display:flex;align-items:center;flex-direction:column}h2{text-transform:capitalize;font-size:14px;margin-top:8px}h2 span{color:#55cca4;font-size:11px;margin-right:7px}.foot{margin-top:30px}@media(max-width:850px){section{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:510px){main{padding:24px 12px}h1{font-size:26px}section{gap:20px 8px}article>div{max-width:100%}h2{font-size:12px}}`}</style>
</main>);
