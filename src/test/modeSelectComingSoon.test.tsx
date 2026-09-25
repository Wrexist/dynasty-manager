import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ModeSelect from '@/pages/ModeSelect';
import { SHOW_COMING_SOON_MODES } from '@/config/ui';

// The "Online – coming soon" tile only toasted: App Review 2.1 completeness
// risk and first-session noise (audit 2026-09-25 #18). Hidden behind a flag.

afterEach(cleanup);

function renderPicker() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/mode-select', state: { slot: 1 } }]}>
      <ModeSelect />
    </MemoryRouter>,
  );
}

describe('ModeSelect coming-soon tiles', () => {
  it('ships with coming-soon tiles switched off', () => {
    expect(SHOW_COMING_SOON_MODES).toBe(false);
  });

  it('does not render the Online tile, but still renders the playable modes', () => {
    renderPicker();
    expect(screen.queryByText('Online')).toBeNull();
    expect(screen.queryByText(/Multiplayer is on the way/)).toBeNull();
    expect(screen.getByText('World Cup')).toBeTruthy();
  });
});
