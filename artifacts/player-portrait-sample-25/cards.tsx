import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/oswald/700.css';
import '@fontsource/dm-sans/400.css';
import '@/index.css';
import { PlayerCard } from '@/components/game/PlayerCard';
import type { PlayerCardSize } from '@/components/game/PlayerCard';
import { PACK_CARD_FRAMES } from '@/config/packs';
import type { Player } from '@/types/game';
import data from './card-players.json';

const players = data as Player[];
const query = new URLSearchParams(location.search);
const previewFrame = query.get('frame');
const fronts = ['bronze','silver','gold','icon','premium','rise-to-glory','champions','elite','world-class','legends','dynasty','golden-era','royal-reserve','ballondor'];
if (previewFrame && fronts.includes(previewFrame)) PACK_CARD_FRAMES['preview-art'] = `/player-cards/${previewFrame}.webp`;
const previewSize = (['xs','sm','md','lg','xl'].includes(query.get('size') || '') ? query.get('size') : 'xl') as PlayerCardSize;
createRoot(document.getElementById('root')!).render(<main style={{padding:32,maxWidth:1400,margin:'auto'}}>
  <p style={{color:'#39d5a1',fontSize:12,letterSpacing:4}}>DYNASTY MANAGER / IN-GAME PLAYER CARDS</p>
  <h1 style={{fontSize:40,fontWeight:800,margin:'12px 0'}}>Your players, in their cards.</h1>
  <p style={{color:'#adbdb6',marginBottom:24}}>25 approved portraits · Actual PlayerCard component · Ratings from the checked-in game roster · Tap a card to cycle its views.</p>
  <section className="portrait-preview-grid">{players.map(p=><div key={p.id} style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
    <PlayerCard player={previewFrame && fronts.includes(previewFrame) ? {...p,packFrame:'preview-art'} : p} size={previewSize} />
    <p style={{fontSize:12,color:'#a2b9ae',marginTop:6}}>{p.clubId.replaceAll('-',' ')}</p>
  </div>)}</section>
  <h2 style={{fontSize:24,marginTop:32}}>Actual card sizes</h2>
  <section style={{display:'flex',gap:24,alignItems:'center',flexWrap:'wrap'}}>{(['xs','sm','md','lg','xl'] as const).map(size=><div key={size}>
    <PlayerCard player={players[0]} size={size} compact={size==='xs'||size==='sm'} interactive="none" />
    <p style={{textAlign:'center'}}>{size}</p>
  </div>)}</section>
  <style>{`.portrait-preview-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:22px 10px}@media(max-width:1150px){.portrait-preview-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:740px){.portrait-preview-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.portrait-preview-grid>div>div{max-width:100%}}`}</style>
</main>);
