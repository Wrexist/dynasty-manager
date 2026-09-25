/**
 * Manager Pass + Legacy pages — the reward track renders its states, the free
 * row collects for everyone, the Pro row is gated on isPro() (with the upsell
 * naming what is already waiting), collected rewards land in the locker and
 * can be worn, and Legacy tiers show their unlocks and job-market standing.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ManagerPassPage from '@/pages/ManagerPassPage';
import DynastyLegacy from '@/pages/DynastyLegacy';
import { useGameStore } from '@/store/gameStore';
import { freshPassRecord, getManagerPassSeason, savePassRecord } from '@/utils/managerPass';
import { saveToHall, type HallEntry } from '@/utils/hallOfManagers';
import { MANAGER_PASS_XP, LEGACY_TIER_UNLOCKS } from '@/config/managerPass';
import { observeClock, reanchorClock } from '@/store/helpers/persistence';
import type { MonetizationState } from '@/types/game';

const NOT_PRO: MonetizationState = {
  entitlements: [], activeCosmetics: {}, adRewardsClaimed: {}, firstLaunchTimestamp: 0,
  starterKitDismissed: false, subscription: null,
  adEngagement: { dayKey: '', watchedToday: 0, promptsToday: 0, consecutiveDismissals: 0, lastPromptAt: 0, totalWatched: 0 },
};
const PRO: MonetizationState = { ...NOT_PRO, entitlements: ['com.dynastymanager.pro.lifetime'] };

function seedPass(xp: number) {
  savePassRecord({ ...freshPassRecord(getManagerPassSeason(new Date())), xp });
}

/** Render, then let ProUpsell's async store probe settle inside act(). */
async function renderPage(node: React.ReactNode) {
  const r = render(<MemoryRouter>{node}</MemoryRouter>);
  await act(async () => { await new Promise(res => setTimeout(res, 0)); });
  return r;
}

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(s => ({ monetization: { ...NOT_PRO }, settings: { ...s.settings, hidePageHints: true } }));
});
afterEach(cleanup);

describe('ManagerPassPage', () => {
  it('checks in once and shows the XP on the track', async () => {
    await renderPage(<ManagerPassPage />);
    const checkIn = screen.getByRole('button', { name: new RegExp(`Daily check-in · \\+${MANAGER_PASS_XP.dailyCheckIn} XP`) });
    fireEvent.click(checkIn);
    expect(useGameStore.getState().managerPass.xp).toBe(MANAGER_PASS_XP.dailyCheckIn);
    expect(screen.getByRole('button', { name: /Checked in today/ })).toBeDisabled();
  });

  it('judges the check-in on the same clock as the action (device clock behind its high-water mark)', async () => {
    // The device once saw tomorrow (clock set forward, then back). The action
    // stamps the check-in with that furthest-seen day; the button must agree
    // rather than offer a check-in whose tap does nothing.
    observeClock(Date.now() + 24 * 60 * 60 * 1000);
    try {
      expect(useGameStore.getState().checkInManagerPass()).toBe(MANAGER_PASS_XP.dailyCheckIn);
      await renderPage(<ManagerPassPage />);
      expect(screen.getByRole('button', { name: /Checked in today/ })).toBeDisabled();
    } finally {
      reanchorClock(Date.now());
    }
  });

  it('lets a free player collect the free row, gates the Pro row and names what is waiting', async () => {
    seedPass(300); // tiers 1–3
    await renderPage(<ManagerPassPage />);

    // Pro rewards on reached tiers are shown as needing Pro — not collectable.
    expect(screen.getByRole('group', { name: /Tier 1 Pro reward: The Tinkerman — Needs Pro/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tier 1 Pro reward/ })).toBeNull();
    expect(screen.getByText('Pro track: 3 rewards already earned')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tier 3 Free reward: Touchline — Collect/ }));
    expect(screen.getByRole('group', { name: /Tier 3 Free reward: Touchline — Collected/ })).toBeInTheDocument();

    // The collected banner is in the locker and can be worn.
    fireEvent.click(screen.getByRole('button', { name: 'Wear' }));
    expect(useGameStore.getState().monetization.activeCosmetics.profile_banner).toBe('banner-touchline');
    expect(screen.getByRole('button', { name: /Wearing/ })).toBeInTheDocument();
  });

  it('lets a Pro player collect every reached reward at once', async () => {
    useGameStore.setState({ monetization: { ...PRO } });
    seedPass(300);
    await renderPage(<ManagerPassPage />);
    expect(screen.queryByText(/Pro track: .* already earned/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Collect all (4)' }));
    const record = useGameStore.getState().managerPass;
    expect(record.claimedPro).toEqual([1, 2, 3]);
    expect(record.claimedFree).toEqual([3]);
    expect(screen.getByText('Pro track active')).toBeInTheDocument();
  });

  it('keeps every tap target at least 44px', async () => {
    seedPass(300);
    await renderPage(<ManagerPassPage />);
    for (const button of screen.getAllByRole('button')) {
      const cls = button.getAttribute('class') ?? '';
      expect(cls, button.textContent ?? '').toMatch(/min-h-\[44px\]|(^|\s)py-3(\s|$)/);
    }
  });
});

function hallEntry(id: string, titles: number): HallEntry {
  return {
    id, clubName: `Club ${id}`, seasons: 5, titles, cupWins: 0, bestPosition: 1, winRate: 60,
    totalWins: 100, totalMatches: 160, bestPoints: 90, prestigeLevel: 0, recordedAt: 1,
  };
}

describe('DynastyLegacy unlocks', () => {
  it('shows reached tiers as wearable and later tiers as locked, with the job-market bonus', async () => {
    saveToHall(hallEntry('a', 3)); // Established
    await renderPage(<DynastyLegacy />);

    expect(screen.getByText(new RegExp(`reputation were ${LEGACY_TIER_UNLOCKS.Established.jobReputationBonus} higher`))).toBeInTheDocument();
    const journeyman = screen.getByText('The Journeyman').closest('li')!;
    expect(within(journeyman).getAllByRole('button', { name: 'Wear' }).length).toBeGreaterThan(0);
    const elite = screen.getByText('Elite Manager').closest('li')!;
    expect(within(elite).queryByRole('button', { name: 'Wear' })).toBeNull();
    expect(within(elite).getAllByText('Reach Elite').length).toBeGreaterThan(0);

    fireEvent.click(within(journeyman).getAllByRole('button', { name: 'Wear' })[0]);
    expect(useGameStore.getState().monetization.activeCosmetics.title_badge).toBe('badge-the-journeyman');
  });

  it('links to the Manager Pass', async () => {
    await renderPage(<DynastyLegacy />);
    fireEvent.click(screen.getByRole('button', { name: /Manager Pass/ }));
    expect(useGameStore.getState().currentScreen).toBe('manager-pass');
  });
});
