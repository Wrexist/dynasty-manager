/**
 * Manager Pass surfacing — the Pass had no home-screen entry (one row deep in
 * the More drawer) and was absent from every list of Pro benefits, so earned
 * rewards sat uncollected and the paywall never mentioned the Pro row.
 *
 *  - Dashboard: a one-line entry below Continue / "Needs your attention" /
 *    the next match, with a count badge when rewards are collectable;
 *  - More drawer: the same count on the Manager Pass row;
 *  - paywall + Shop: the Pro track is a listed (cosmetic) Pro benefit.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import SubscribeOnboarding from '@/pages/SubscribeOnboarding';
import { MoreDrawer } from '@/components/game/MoreDrawer';
import { useGameStore } from '@/store/gameStore';
import { removeFlag, setFlag, STORAGE_KEYS } from '@/store/helpers/persistence';
import { resetPresentationLedger } from '@/hooks/usePresentationQueue';
import {
  freshPassRecord,
  getManagerPassSeason,
  passSeasonFromOrdinal,
  passHomeSummary,
  savePassRecord,
} from '@/utils/managerPass';
import { MANAGER_PASS_TRACK, MANAGER_PASS_XP_PER_TIER } from '@/config/managerPass';
import { DEFAULT_MONETIZATION_STATE, PRO_FEATURES, PRO_FEATURE_LABELS } from '@/config/monetization';
import type { ManagerPassRecord, MonetizationState } from '@/types/game';

const NOT_PRO: MonetizationState = { ...DEFAULT_MONETIZATION_STATE, entitlements: [], activeCosmetics: {}, subscription: null };
const PRO: MonetizationState = { ...NOT_PRO, entitlements: ['com.dynastymanager.pro.lifetime'] };
const CURRENT = getManagerPassSeason(new Date());
const passAt = (tiers: number, season = CURRENT): ManagerPassRecord =>
  ({ ...freshPassRecord(season), xp: tiers * MANAGER_PASS_XP_PER_TIER });

/** The Dashboard's Manager Pass entry. */
const passRow = () => screen.getByRole('button', { name: /^Manager Pass/ });

beforeEach(() => {
  localStorage.clear();
  resetPresentationLedger();
  removeFlag(STORAGE_KEYS.DASHBOARD_MORE_EXPANDED);
  setFlag(STORAGE_KEYS.WELCOME_SHOWN);
  sessionStorage.clear();
  useGameStore.getState().initGame('celtic');
  const s = useGameStore.getState();
  useGameStore.setState({
    week: 5, currentScreen: 'dashboard', weeklyDigest: null, pendingPressConference: null,
    pendingStoryline: null, pendingTransferTalk: null, pendingGemReveal: null, pendingFarewell: [],
    pendingAchievementIds: [], settings: { ...s.settings, hideOnboarding: true, hidePageHints: true },
    monetization: NOT_PRO, managerPass: freshPassRecord(CURRENT),
  });
});
afterEach(cleanup);

describe('passHomeSummary', () => {
  it('counts both rows while Pro, only the free row otherwise', () => {
    expect(passHomeSummary(passAt(3), false)).toEqual({ tier: 3, claimable: 1 });
    expect(passHomeSummary(passAt(3), true)).toEqual({ tier: 3, claimable: 4 });
  });

  it('judges a record from last season on this season, without writing it', () => {
    const last = passAt(6, passSeasonFromOrdinal(CURRENT.ordinal - 1));
    // Last season's free rewards are collected by the roll, not offered again…
    expect(passHomeSummary(last, false)).toEqual({ tier: 0, claimable: 0 });
    // …and its reached Pro rewards wait behind Pro as a carry.
    expect(passHomeSummary(last, true)).toEqual({ tier: 0, claimable: 0 });
    const rolledWhileFree = { ...freshPassRecord(CURRENT), proCarry: { seasonId: 'x', seasonOrdinal: CURRENT.ordinal - 1, rewardIds: [MANAGER_PASS_TRACK[0].pro] } };
    expect(passHomeSummary(rolledWhileFree, true).claimable).toBe(1);
    expect(localStorage.getItem(STORAGE_KEYS.MANAGER_PASS)).toBeNull();
  });
});

describe('Dashboard — Manager Pass entry', () => {
  it('sits below the Continue button and the next match, above More, and opens the Pass', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    const row = passRow();
    expect(row).toHaveTextContent('Tier 0/30');
    expect(row).not.toHaveTextContent(/to collect/);
    const cta = screen.getAllByRole('button').find(b => /^(Match Prep vs|Advance to Week|View Season Summary)/.test(b.textContent?.trim() ?? ''))!;
    const more = document.querySelector('[aria-controls="dashboard-more"]')!;
    expect(cta.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    act(() => { fireEvent.click(row); });
    expect(useGameStore.getState().currentScreen).toBe('manager-pass');
  });

  it('shows a badge when rewards are collectable', () => {
    useGameStore.setState({ managerPass: passAt(3), monetization: PRO });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(passRow()).toHaveTextContent('Tier 3/30');
    expect(passRow()).toHaveTextContent('4 to collect');
  });
});

describe('More drawer — Manager Pass badge', () => {
  it('carries the collectable count on the Manager Pass row', () => {
    useGameStore.setState({ managerPass: passAt(6) });
    render(<MoreDrawer open onOpenChange={() => {}} />);
    const row = within(screen.getByRole('dialog')).getByText('Manager Pass').closest('button')!;
    expect(row).toHaveTextContent(/Manager Pass\s*2/);
  });

  it('shows no badge with nothing to collect', () => {
    savePassRecord(freshPassRecord(CURRENT));
    render(<MoreDrawer open onOpenChange={() => {}} />);
    const row = within(screen.getByRole('dialog')).getByText('Manager Pass').closest('button')!;
    expect(row.textContent).toBe('Manager PassSeason rewards: free + Pro track');
  });
});

describe('Pro benefits list the Pass Pro track (cosmetic wording only)', () => {
  it('is a Pro feature with a label, and the Shop list reads it', () => {
    expect(PRO_FEATURES).toContain('manager_pass_pro');
    expect(PRO_FEATURE_LABELS.manager_pass_pro).toBe('Manager Pass Pro Track');
  });

  it('is on the paywall, with a count that matches the track and no gameplay claim', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/subscribe', state: { returnTo: '/game' } }]}>
        <SubscribeOnboarding />
      </MemoryRouter>,
    );
    // Let the paywall's store probes settle inside act().
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    const title = screen.getByText('Manager Pass Pro Track');
    const bullet = title.closest('li')!;
    const proRewards = MANAGER_PASS_TRACK.filter(t => t.pro).length;
    expect(bullet).toHaveTextContent(`${proRewards} Pro-only rewards: titles, celebrations and banners.`);
    expect(bullet.textContent).not.toMatch(/xp|boost|faster|stronger|better|bonus|advantage/i);
  });
});
