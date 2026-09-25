/**
 * Flags offline (playthrough 2026-09, R12).
 *
 * Flags load from flagcdn.com. With no network, England fell back to an emoji
 * and every other nation showed a blank square: the fallback emoji is drawn
 * from font glyphs, and a platform without flag glyphs draws a regional-
 * indicator pair as an empty box. The fallback is now the emoji only where the
 * platform can draw it, and the nation's code otherwise — never a blank
 * square. Offline, no request is made.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FlagIcon } from '@/components/game/FlagIcon';
import {
  __setFlagEmojiSupportForTests, __resetFlagFailuresForTests, supportsFlagEmoji, getFlagFallbackCode, getFlag,
} from '@/utils/nationality';

const onLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')
  ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window.navigator), 'onLine');

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
}

beforeEach(() => {
  __resetFlagFailuresForTests();
  __setFlagEmojiSupportForTests(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (onLine) Object.defineProperty(window.navigator, 'onLine', onLine);
  __setFlagEmojiSupportForTests(null);
});

describe('FlagIcon fallback', () => {
  it('a failed image on a platform without flag glyphs shows the nation code, not an empty box', () => {
    __setFlagEmojiSupportForTests(false);
    const { container } = render(<FlagIcon nationality="France" size={28} />);
    fireEvent.error(container.querySelector('img')!);
    const fallback = screen.getByRole('img', { name: 'France' });
    expect(fallback.tagName).toBe('SPAN');
    expect(fallback.textContent).toBe('FRA');
    expect(container.querySelector('img')).toBeNull();
  });

  it('where flag glyphs exist (iOS, Android) the fallback stays the emoji flag', () => {
    __setFlagEmojiSupportForTests(true);
    const { container } = render(<FlagIcon nationality="France" size={28} />);
    fireEvent.error(container.querySelector('img')!);
    expect(screen.getByRole('img', { name: 'France' }).textContent).toBe(getFlag('France'));
  });

  it('while the image is still loading the box shows the fallback, then the flag once it loads', () => {
    // A request that is slow to fail (no network behind a proxy) left an
    // empty, transparent <img> — the blank square the playthrough saw.
    __setFlagEmojiSupportForTests(false);
    const { container } = render(<FlagIcon nationality="Germany" size={28} />);
    const flag = screen.getByRole('img', { name: 'Germany' });
    const img = container.querySelector('img')!;
    expect(flag.textContent).toBe('GER');
    expect(img.className).toContain('opacity-0');
    fireEvent.load(img);
    expect(flag.textContent).toBe('');
    expect(container.querySelector('img')!.className).not.toContain('opacity-0');
  });

  it('offline: no request at all, straight to the fallback', () => {
    __setFlagEmojiSupportForTests(false);
    setOnline(false);
    const { container } = render(<FlagIcon nationality="Brazil" size={16} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Brazil' }).textContent).toBe('BRA');
  });

  it('a flag that failed once is not requested again (no per-row flash offline)', () => {
    __setFlagEmojiSupportForTests(false);
    const first = render(<FlagIcon nationality="Spain" size={20} />);
    fireEvent.error(first.container.querySelector('img')!);
    first.unmount();
    const second = render(<FlagIcon nationality="Spain" size={20} />);
    expect(second.container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Spain' }).textContent).toBe('ESP');
  });

  it('fill mode falls back to a filled code tile', () => {
    __setFlagEmojiSupportForTests(false);
    const { container } = render(<FlagIcon nationality="Japan" fill />);
    fireEvent.error(container.querySelector('img')!);
    expect(screen.getByRole('img', { name: /Japan/ }).textContent).toBe('JPN');
  });

  it('an unknown nationality is never blank either', () => {
    __setFlagEmojiSupportForTests(false);
    render(<FlagIcon nationality="Atlantis" size={20} />);
    expect(screen.getByRole('img', { name: 'Atlantis' }).textContent).toBe('ATL');
    expect(getFlagFallbackCode('')).toBe('?');
  });
});

describe('supportsFlagEmoji', () => {
  it('is false where a canvas cannot be measured', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(supportsFlagEmoji()).toBe(false);
  });

  it('is true when the flag draws in colour, false when it draws grey (letters or an empty box)', () => {
    const fake = (rgba: [number, number, number, number]) => ({
      textBaseline: '', font: '', fillText: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(Array.from({ length: 20 * 20 }, () => rgba).flat()) }),
    }) as unknown as CanvasRenderingContext2D;
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    spy.mockReturnValue(fake([0, 85, 164, 255]) as never);
    expect(supportsFlagEmoji()).toBe(true);
    __setFlagEmojiSupportForTests(null);
    spy.mockReturnValue(fake([120, 120, 120, 255]) as never);
    expect(supportsFlagEmoji()).toBe(false);
  });
});
