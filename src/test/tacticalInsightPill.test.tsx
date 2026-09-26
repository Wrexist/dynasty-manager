/**
 * The in-match tactical insight pill used `text-[9px]`, under the 11px type
 * floor (playthrough 2026-09, R20). It is the `text-micro` token now, and wraps
 * rather than overflowing at 375px.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cleanup, render, screen } from '@testing-library/react';
import { TacticalInsightPill } from '@/components/matchday/TacticalInsightPill';

afterEach(cleanup);

describe('TacticalInsightPill', () => {
  it('is 11px (text-micro) and wraps a long insight instead of overflowing', () => {
    render(<TacticalInsightPill text="Wide play exploiting Southampton's narrow shape (+10%)" />);
    const pill = screen.getByTestId('tactical-insight-pill');
    expect(pill.className).toContain('text-micro');
    expect(pill.className).not.toMatch(/text-\[(8|9|10)px\]/);
    expect(pill.className).toContain('max-w-full');
    expect(pill.innerHTML).not.toMatch(/truncate|whitespace-nowrap/);
    expect(pill.textContent).toContain('(+10%)');
  });

  it('is what MatchDay renders for the live insight', () => {
    const src = readFileSync(resolve(__dirname, '../pages/MatchDay.tsx'), 'utf8');
    expect(src).toContain('<TacticalInsightPill text={tacticalInsights[0]} />');
    // The 9px pill markup is gone.
    expect(src).not.toMatch(/text-\[9px\] font-medium bg-primary\/15 text-primary/);
  });
});
