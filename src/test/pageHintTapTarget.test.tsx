/**
 * The guide card's dismiss button is a 44px target (playthrough 2026-09:
 * it measured 14x14 at 390x844 on Dashboard, Match Prep, Squad, Transfers,
 * Inbox, Packs and Manager Pass).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PageHint } from '@/components/game/PageHint';

afterEach(() => { cleanup(); localStorage.clear(); });

describe('PageHint dismiss button', () => {
  it('has a 44px minimum hit area', () => {
    render(<PageHint screen="tap-target-test" title="Guide" body="Body" />);
    const btn = screen.getByRole('button', { name: 'Dismiss hint' });
    expect(btn.className).toContain('min-w-[44px]');
    expect(btn.className).toContain('min-h-[44px]');
  });
});
