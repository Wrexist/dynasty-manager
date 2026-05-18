/**
 * externalUrl helper — verifies `mailto:` and other custom URL schemes
 * route via `window.location.href` so iOS SFSafariViewController doesn't
 * silently swallow them.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openExternalUrl } from '@/utils/externalUrl';

// jsdom locks down `window.location` setters, so we replace the entire
// `location` object with a writable stub for the duration of each test.
const originalLocation = window.location;
let hrefSetter: ReturnType<typeof vi.fn>;

beforeEach(() => {
  hrefSetter = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      ...originalLocation,
      get href() { return 'about:blank'; },
      set href(v: string) { hrefSetter(v); },
    },
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
  vi.restoreAllMocks();
});

describe('openExternalUrl', () => {
  it('routes mailto: through window.location.href instead of window.open', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    await openExternalUrl('mailto:hello@example.com?subject=Test');
    expect(hrefSetter).toHaveBeenCalledWith('mailto:hello@example.com?subject=Test');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('routes tel: through window.location.href', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    await openExternalUrl('tel:+15551234567');
    expect(hrefSetter).toHaveBeenCalledWith('tel:+15551234567');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('routes https: through window.open on web (no Capacitor)', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    await openExternalUrl('https://example.com/terms');
    expect(openSpy).toHaveBeenCalledWith('https://example.com/terms', '_blank', 'noopener,noreferrer');
    expect(hrefSetter).not.toHaveBeenCalled();
  });

  it('is case-insensitive on the scheme prefix', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    await openExternalUrl('MAILTO:upper@example.com');
    expect(hrefSetter).toHaveBeenCalledWith('MAILTO:upper@example.com');
    expect(openSpy).not.toHaveBeenCalled();
  });
});
