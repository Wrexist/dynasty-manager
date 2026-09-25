/**
 * Manager Career creation defaults the manager's nationality from the device
 * locale, with the same rules as the Sandbox flow (ClubSelection): the mapped
 * nation is pre-selected and heads the list under "From your device"; a
 * locale that maps to no selectable nation opens the list unselected; a
 * search hides the suggestion. The Career flow used to open on 67 rows with
 * nothing chosen.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ManagerCreation from '@/pages/ManagerCreation';

const original = { language: navigator.language, languages: navigator.languages };

function setDeviceLocale(language: string, languages: string[] = [language]) {
  Object.defineProperty(window.navigator, 'language', { value: language, configurable: true });
  Object.defineProperty(window.navigator, 'languages', { value: languages, configurable: true });
}

/** Render and step past the name (the step change waits for the exit animation). */
async function openNationalityStep() {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/create-manager', state: { slot: 2 } }]}>
      <ManagerCreation />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ann Manager' } });
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
  await screen.findByPlaceholderText(/search/i, undefined, { timeout: 3000 });
}

const rowFor = (nation: string) => screen.getAllByText(nation).map(el => el.closest('button')!);

afterEach(() => {
  cleanup();
  setDeviceLocale(original.language, [...original.languages]);
});

describe('ManagerCreation — nationality from the device locale', () => {
  it('pre-selects the device nation and heads the list with it', async () => {
    setDeviceLocale('sv-SE');
    await openNationalityStep();
    expect(screen.getByText('From your device')).toBeTruthy();
    const rows = rowFor('Sweden');
    expect(rows.length).toBe(2); // the suggestion + its confederation row
    for (const row of rows) expect(row.className).toMatch(/ring-2/);
    // Selected, so the step can be left at once.
    expect(screen.getAllByRole('button', { name: /Continue/ }).length).toBeGreaterThan(0);
  });

  it('walks the preference list like ClubSelection (first mappable tag wins)', async () => {
    setDeviceLocale('fi-FI', ['fi-FI', 'en-GB']);
    await openNationalityStep();
    expect(rowFor('England')[0].className).toMatch(/ring-2/);
  });

  it('an unmappable locale opens the list with nothing suggested or selected', async () => {
    setDeviceLocale('fi-FI');
    await openNationalityStep();
    expect(screen.queryByText('From your device')).toBeNull();
    expect(document.querySelector('button.ring-2')).toBeNull();
    expect(screen.queryByRole('button', { name: /Continue/ })).toBeNull();
  });

  it('a search hides the suggestion but keeps the selection', async () => {
    setDeviceLocale('sv-SE');
    await openNationalityStep();
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'swe' } });
    expect(screen.queryByText('From your device')).toBeNull();
    expect(rowFor('Sweden')).toHaveLength(1);
    expect(rowFor('Sweden')[0].className).toMatch(/ring-2/);
  });
});
