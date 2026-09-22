import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { Player } from '@/types/game';
import { getPlayerPortrait } from '@/utils/playerPortrait';
import { PlayerCard } from '@/components/game/PlayerCard';

const salah = { id:'sample', fcId:'209331', source:'real', firstName:'Mohamed',lastName:'Salah',clubId:'liverpool',nationality:'Egypt',position:'RW',overall:90,potential:90,fitness:100,morale:80,form:75,attributes:{pace:90,shooting:90,passing:80,mental:80,physical:75,defending:40} } as Player;
describe('approved portrait identity and fallback',()=>{
  it('resolves both current and legacy ID formats',()=>{
    expect(getPlayerPortrait(salah)?.src).toContain('mohamed-salah');
    expect(getPlayerPortrait({...salah,fcId:'fc26-209331'})).toEqual(getPlayerPortrait(salah));
  });
  it('does not leak a face through retained IDs on anonymized players',()=>{
    expect(getPlayerPortrait({...salah,firstName:'Ahmed',lastName:'Example'})).toBeNull();
    expect(getPlayerPortrait({...salah,source:'generated'})).toBeNull();
  });
  it('falls back for unknown IDs, providers, and a transfer to another club',()=>{
    for(const fcId of ['unknown','other-209331','__proto__']) expect(getPlayerPortrait({...salah,fcId})).toBeNull();
    expect(getPlayerPortrait({...salah,clubId:'chelsea'})).toBeNull();
    expect(getPlayerPortrait({...salah,clubId:''})).not.toBeNull();
  });
  it('keeps live card data and recovers when an errored portrait is replaced',()=>{
    const {container,rerender}=render(<PlayerCard player={salah} interactive="none" />);
    const portrait=container.querySelector('img[src*="player-portraits"]')!;
    expect(portrait.getAttribute('alt')).toBe('');
    fireEvent.error(portrait);
    expect(container.querySelector('img[src*="player-portraits"]')).toBeNull();
    expect(container.textContent).toContain('90');
    rerender(<PlayerCard player={{...salah,fcId:'239085',firstName:'Erling',lastName:'Haaland',clubId:'manchester-city',overall:94}} interactive="none" />);
    expect(container.querySelector('img[src*="erling-haaland"]')).not.toBeNull();
    expect(container.textContent).toContain('94');
  });
});
