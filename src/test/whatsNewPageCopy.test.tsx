/**
 * What's New is reached by every store user (TitleScreen tile, Settings →
 * Help). Its footer told them to "restart to pull latest TestFlight build" —
 * a beta instruction that does nothing for an App Store or Play build and
 * names the wrong store on Android.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WhatsNewPage from '@/pages/WhatsNewPage';

afterEach(cleanup);

describe('What\'s New page copy', () => {
  it.each([true, false])('never shows TestFlight instructions (standalone=%s)', (standalone) => {
    const { container } = render(
      <MemoryRouter><WhatsNewPage standalone={standalone} /></MemoryRouter>,
    );
    expect(container.textContent).not.toMatch(/TestFlight/i);
  });
});
