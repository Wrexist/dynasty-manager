/**
 * Page hints must name controls that exist on that page (playthrough 2026-09).
 * The Match Prep guide told players to tap "Edit Lineup" — a Squad-screen
 * button; Match Prep edits the XI by tapping players on its own pitch.
 */
import { describe, it, expect } from 'vitest';
import { PAGE_HINTS } from '@/config/ui';

describe('PAGE_HINTS copy', () => {
  it('the Match Prep guide describes the pitch swap, not a Squad-screen button', () => {
    expect(PAGE_HINTS.matchPrep.body).not.toMatch(/Edit Lineup/);
    expect(PAGE_HINTS.matchPrep.body).toMatch(/tap a player on the pitch/i);
  });
});
