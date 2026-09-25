/**
 * Quick Start + device-locale nationality.
 *
 * The cold open was Title → slot → paywall → Mode → Nation (67 rows, nothing
 * chosen) → League (45) → Club (756, no recommendation) before a single match.
 * Two changes, both pinned here:
 *
 *   1. The nationality step defaults from the device locale (`sv-SE` → Sweden)
 *      and heads the list with it. A default only: unmappable locales open the
 *      list unselected, exactly as before.
 *   2. A Quick Start card offers one strong, recognisable club for that nation
 *      and starts the career in ONE tap — through the same setup/save/navigate
 *      path as the three-step flow, which stays on the screen underneath.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { STORAGE_KEYS, readSessionJson, writeSessionJson } from '@/store/helpers/persistence';
import { CLUBS_DATA, LEAGUES } from '@/data/league';
import { SELECTABLE_NATIONS } from '@/data/nations';
import {
  REGION_TO_NATION,
  detectLocaleNation,
  nationFromLocaleTag,
  parseLocaleTag,
} from '@/utils/localeNation';
import { pickQuickStartClub } from '@/utils/quickStart';
import {
  QUICK_START_CLUB_BY_NATION,
  QUICK_START_DEFAULT_CLUB_ID,
  QUICK_START_FALLBACK_NATION,
} from '@/config/quickStart';

vi.mock('@/utils/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
  hapticSuccess: vi.fn(), hapticError: vi.fn(), hapticWarning: vi.fn(),
}));

import ClubSelection from '@/pages/ClubSelection';

const SELECTABLE = new Set(SELECTABLE_NATIONS.map(n => n.name));

describe('localeNation — device locale → default nationality', () => {
  it('maps only to nations the player can actually select', () => {
    for (const [region, nation] of Object.entries(REGION_TO_NATION)) {
      expect(SELECTABLE.has(nation), `${region} → ${nation}`).toBe(true);
    }
  });

  it('reads the region, not the language', () => {
    expect(nationFromLocaleTag('sv-SE')).toBe('Sweden');
    expect(nationFromLocaleTag('en-GB')).toBe('England');
    expect(nationFromLocaleTag('en_US')).toBe('USA');
    expect(nationFromLocaleTag('en-AU')).toBe('Australia');
    expect(nationFromLocaleTag('pt-BR')).toBe('Brazil');
    expect(nationFromLocaleTag('es-MX')).toBe('Mexico');
    expect(nationFromLocaleTag('de-AT')).toBe('Austria');
    expect(nationFromLocaleTag('fr-SN')).toBe('Senegal');
  });

  it('skips a script subtag and refuses a multi-country area', () => {
    expect(parseLocaleTag('zh-Hant-TW')).toEqual({ language: 'zh', region: 'TW' });
    expect(parseLocaleTag('es-419')).toEqual({ language: 'es', region: null });
    expect(nationFromLocaleTag('es-419')).toBeNull();
  });

  it('an explicit unmapped region is authoritative — sv-FI is not a Swede', () => {
    expect(nationFromLocaleTag('sv-FI')).toBeNull();
    expect(nationFromLocaleTag('fi-FI')).toBeNull();
  });

  it('guesses from a bare language only where one nation speaks it', () => {
    expect(nationFromLocaleTag('sv')).toBe('Sweden');
    expect(nationFromLocaleTag('ja')).toBe('Japan');
    // English, Spanish, French, Portuguese, Arabic: no honest single guess.
    for (const lang of ['en', 'es', 'fr', 'pt', 'ar']) {
      expect(nationFromLocaleTag(lang), lang).toBeNull();
    }
  });

  it('Welsh and Scottish Gaelic devices are not English', () => {
    expect(nationFromLocaleTag('cy-GB')).toBe('Wales');
    expect(nationFromLocaleTag('gd-GB')).toBe('Scotland');
  });

  it('degrades to null on garbage, and walks the preference list in order', () => {
    expect(nationFromLocaleTag('')).toBeNull();
    expect(nationFromLocaleTag(undefined)).toBeNull();
    expect(nationFromLocaleTag('!!')).toBeNull();
    expect(detectLocaleNation(null)).toBeNull();
    expect(detectLocaleNation({ languages: ['fi-FI', 'en-GB'], language: 'fi-FI' })).toBe('England');
    expect(detectLocaleNation({ language: 'de-DE' })).toBe('Germany');
    expect(detectLocaleNation({ languages: [], language: 'en' })).toBeNull();
  });
});

describe('pickQuickStartClub', () => {
  it('every configured club exists, in a top flight', () => {
    const ids = [QUICK_START_DEFAULT_CLUB_ID, ...Object.values(QUICK_START_CLUB_BY_NATION)];
    for (const id of ids) {
      const club = CLUBS_DATA.find(c => c.id === id);
      expect(club, id).toBeTruthy();
      expect(LEAGUES.find(l => l.id === club!.divisionId)?.tier, id).toBe(1);
    }
    for (const nation of Object.keys(QUICK_START_CLUB_BY_NATION)) {
      expect(SELECTABLE.has(nation), nation).toBe(true);
    }
    expect(SELECTABLE.has(QUICK_START_FALLBACK_NATION)).toBe(true);
  });

  it('offers the nation’s own giant where config names one', () => {
    expect(pickQuickStartClub('Spain')?.club.id).toBe('real-madrid');
    expect(pickQuickStartClub('Germany')?.club.id).toBe('bayern-munich');
  });

  it('falls back to the default club, keeping the player’s nationality', () => {
    const pick = pickQuickStartClub('Sweden');
    expect(pick?.club.id).toBe(QUICK_START_DEFAULT_CLUB_ID);
    expect(pick?.nation).toBe('Sweden');
  });

  it('with no nationality at all, uses the fallback nation', () => {
    const pick = pickQuickStartClub(null);
    expect(pick?.club.id).toBe(QUICK_START_DEFAULT_CLUB_ID);
    expect(pick?.nation).toBe(QUICK_START_FALLBACK_NATION);
  });

  it('never offers a club from a league the player cannot see', () => {
    const packOff = (leagueId: string) => leagueId !== 'bra';
    expect(pickQuickStartClub('Brazil', packOff)?.club.id).toBe(QUICK_START_DEFAULT_CLUB_ID);
    expect(pickQuickStartClub('Brazil')?.club.id).toBe('flamengo');
  });
});

// ── The screen ──

function setDeviceLocale(language: string, languages: string[] = [language]) {
  Object.defineProperty(window.navigator, 'language', { value: language, configurable: true });
  Object.defineProperty(window.navigator, 'languages', { value: languages, configurable: true });
}

function renderClubSelection() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/select-club', state: { slot: 2 } }]}>
      <ClubSelection />
    </MemoryRouter>,
  );
}

describe('ClubSelection — Quick Start + locale default', () => {
  const original = { language: navigator.language, languages: navigator.languages };
  let initGame: ReturnType<typeof vi.fn>;
  let initNationalTeam: ReturnType<typeof vi.fn>;
  let saveGame: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    initGame = vi.fn(async () => {});
    initNationalTeam = vi.fn();
    saveGame = vi.fn();
    useGameStore.setState({ initGame, initNationalTeam, saveGame } as never);
  });

  afterEach(() => {
    setDeviceLocale(original.language, [...original.languages]);
  });

  it('defaults the nationality from the device and heads the list with it', () => {
    setDeviceLocale('sv-SE');
    renderClubSelection();
    expect(screen.getByText('From your device')).toBeTruthy();
    const swedenRows = screen.getAllByText('Sweden');
    expect(swedenRows.length).toBeGreaterThanOrEqual(2); // suggested + its confederation
    expect(screen.getByText(/Nationality: Sweden/)).toBeTruthy();
    // It is the selection, not just a label: the in-flight draft carries it.
    expect(readSessionJson<{ nation: string }>(STORAGE_KEYS.ONBOARDING_DRAFT)?.nation).toBe('Sweden');
  });

  it('a nationality the player already chose beats the device default', () => {
    setDeviceLocale('sv-SE');
    writeSessionJson(STORAGE_KEYS.ONBOARDING_DRAFT, { step: 'nationality', nation: 'Spain', league: null });
    renderClubSelection();
    expect(screen.getByText(/Nationality: Spain/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manage Real Madrid' })).toBeTruthy();
  });

  it('an unmappable locale opens the list with nothing suggested', () => {
    setDeviceLocale('fi-FI');
    renderClubSelection();
    expect(screen.queryByText('From your device')).toBeNull();
    // Quick Start still works — it names the fallback nationality it will use.
    expect(screen.getByText(new RegExp(`Nationality: ${QUICK_START_FALLBACK_NATION}`))).toBeTruthy();
  });

  it('recommends the nation’s own giant', () => {
    setDeviceLocale('es-ES');
    renderClubSelection();
    expect(screen.getByRole('button', { name: 'Manage Real Madrid' })).toBeTruthy();
  });

  it('one tap starts the career with the recommended club and the device nationality', async () => {
    setDeviceLocale('sv-SE');
    renderClubSelection();
    fireEvent.click(screen.getByRole('button', { name: 'Manage Liverpool' }));
    await waitFor(() => expect(initGame).toHaveBeenCalled());
    expect(initGame.mock.calls[0][0]).toBe('liverpool');
    await waitFor(() => expect(initNationalTeam).toHaveBeenCalledWith('Sweden'));
    // Same persistence as the three-step path: the slot it was navigated with.
    await waitFor(() => expect(saveGame).toHaveBeenCalledWith(2));
    expect(useGameStore.getState().activeSlot).toBe(2);
  });

  it('hides Quick Start while the player is searching for a nation by hand', () => {
    setDeviceLocale('sv-SE');
    renderClubSelection();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Jap' } });
    expect(screen.queryByText('Quick start')).toBeNull();
    expect(screen.queryByText('From your device')).toBeNull();
  });
});
