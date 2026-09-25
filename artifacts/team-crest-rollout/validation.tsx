import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import '@/index.css';
import ClubSelection from '@/pages/ClubSelection';
import { ClubCrest } from '@/components/game/ClubCrest';
import { CLUBS } from '@/data/leagues/england';
import { STORAGE_KEYS } from '@/store/helpers/persistence';

sessionStorage.setItem(STORAGE_KEYS.ONBOARDING_DRAFT, JSON.stringify({ step: 'club', nation: 'England', league: 'eng' }));
const selection = new URLSearchParams(location.search).has('selection');
createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="always">
    {selection ? <MemoryRouter initialEntries={[{ pathname: '/select-club', state: { slot: 3 } }]}><ClubSelection /></MemoryRouter> :
      <main className="max-w-lg mx-auto p-4 space-y-4">
        <h1 className="text-xl font-bold">Premier League crest integration</h1>
        {CLUBS.map(club => <section key={club.id} className="rounded-xl bg-card border border-border p-3">
          <h2 className="text-sm mb-2">{club.name}</h2>
          <div className="flex gap-3 items-center">{(['xs','sm','md','lg','xl'] as const).map(size => <ClubCrest key={size} club={club} size={size} />)}</div>
        </section>)}
        <section className="flex gap-4"><ClubCrest club={{ id: 'unknown', shortName: 'NEW', color: '#123456' }} /><ClubCrest club={null} /></section>
      </main>}
  </MotionConfig>,
);
