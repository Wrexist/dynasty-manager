import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PackDealUpsell } from '@/components/game/pack/PackDealUpsell';
import { PackDealCard } from '@/components/game/pack/PackDealCard';
import type { ActivePackDeal } from '@/utils/packDeals';

const deal: ActivePackDeal = { slotId: 'flash', tierKey: 'gold', bonusCards: 3, endsAt: 3600_000, remainingMs: 3600_000 };
afterEach(cleanup);

it('shows the actual contents, localized price, and odds link', () => {
  const odds = vi.fn();
  const select = vi.fn();
  const { container } = render(<PackDealCard deal={deal} price="29 kr" available onSelect={select} onOdds={odds} />);
  expect(container.querySelector('img')).toHaveAttribute('src', '/packs/gold.webp');
  expect(screen.getByText('8 players')).toBeInTheDocument();
  expect(screen.getByText('Includes 3 bonus')).toBeInTheDocument();
  expect(screen.getByText('4 × 78+ OVR')).toBeInTheDocument();
  const buy = screen.getByRole('button', { name: 'Buy 29 kr — Gold Pack' });
  expect(buy).toBeEnabled();
  fireEvent.click(buy);
  expect(select).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Contents and odds for Gold Pack' }));
  expect(odds).toHaveBeenCalledOnce();
});

it('contains keyboard focus, locks scroll, and supports Escape and explicit dismissal', () => {
  const close = vi.fn();
  const { unmount } = render(<PackDealUpsell deals={[deal]} onClose={close} onView={vi.fn()} />);
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(document.body.style.overflow).toBe('hidden');
  const later = screen.getByRole('button', { name: 'Maybe later' });
  later.focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(screen.getByRole('button', { name: 'Close pack offers' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).toHaveBeenCalledOnce();
  fireEvent.click(later);
  expect(close).toHaveBeenCalledTimes(2);
  unmount();
  expect(document.body.style.overflow).not.toBe('hidden');
});
