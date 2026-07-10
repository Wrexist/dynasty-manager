/**
 * Share-card util (G7 — one-tap shareable moment card).
 *
 * Canvas drawing can't run under jsdom (no real 2D context), so we test the
 * pure layout math (fit/truncate), the platform capability detection with a
 * mocked navigator, the filename builder, and smoke-test the draw sequence
 * against a stub context (it must not throw and must emit the key strings).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  fitFontPx,
  truncateToWidth,
  detectShareCapability,
  buildMomentFilename,
  drawMomentCard,
  type MomentCardData,
} from '@/utils/shareCard';

// A deterministic measurer: width scales with characters × font px.
const measure = (t: string, px: number): number => t.length * px * 0.5;

describe('fitFontPx', () => {
  it('returns the start size when the text already fits', () => {
    expect(fitFontPx('WIN', 10_000, 100, 40, measure)).toBe(100);
  });

  it('steps the font down until the text fits', () => {
    // 'WORLD CHAMPIONS' = 15 chars. width(px) = 15 * px * 0.5 = 7.5px.
    // maxWidth 600 → px must be <= 80. Starts at 148, steps by 2 → 80.
    const px = fitFontPx('WORLD CHAMPIONS', 600, 148, 40, measure);
    expect(px).toBeLessThanOrEqual(80);
    expect(measure('WORLD CHAMPIONS', px)).toBeLessThanOrEqual(600);
  });

  it('never returns below the floor even if nothing fits', () => {
    expect(fitFontPx('A very very long string', 1, 148, 60, measure)).toBe(60);
  });
});

describe('truncateToWidth', () => {
  it('returns the text unchanged when it fits', () => {
    expect(truncateToWidth('Brazil', 10_000, 40, measure)).toBe('Brazil');
  });

  it('ellipsizes long text to fit the width', () => {
    const out = truncateToWidth('Manchester United Football Club', 200, 40, measure);
    expect(out.endsWith('…')).toBe(true);
    expect(measure(out, 40)).toBeLessThanOrEqual(200);
    expect(out.length).toBeLessThan('Manchester United Football Club'.length);
  });
});

describe('buildMomentFilename', () => {
  it('names WC and shootout files with the local calendar day', () => {
    const d = new Date(2026, 6, 10); // month is 0-based → July
    expect(buildMomentFilename('world_cup', d)).toBe('dynasty-world-champions-2026-07-10.png');
    expect(buildMomentFilename('shootout', d)).toBe('dynasty-shootout-win-2026-07-10.png');
  });
});

describe('detectShareCapability', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns "share" when navigator.share + canShare + File exist', () => {
    vi.stubGlobal('navigator', { share: () => {}, canShare: () => true });
    // File is provided by jsdom; document too.
    expect(detectShareCapability()).toBe('share');
  });

  it('falls back to "download" when share is unavailable but URL.createObjectURL exists', () => {
    vi.stubGlobal('navigator', { userAgent: 'test' }); // no share/canShare
    // jsdom doesn't implement URL.createObjectURL — provide it (as a browser does).
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x' });
    expect(detectShareCapability()).toBe('download');
  });

  it('returns "none" when there is no document to draw a canvas', () => {
    vi.stubGlobal('document', undefined);
    expect(detectShareCapability()).toBe('none');
  });
});

// ── Draw-sequence smoke test against a stub 2D context ──
function makeStubCtx() {
  const fillTexts: string[] = [];
  const grad = { addColorStop: () => {} };
  const ctx = {
    font: '', fillStyle: '' as unknown, strokeStyle: '' as unknown, lineWidth: 0,
    textAlign: 'center' as CanvasTextAlign, textBaseline: 'middle' as CanvasTextBaseline,
    fillRect: () => {},
    strokeRect: () => {},
    fillText: (t: string) => { fillTexts.push(t); },
    measureText: (t: string) => ({ width: t.length * 20 } as TextMetrics),
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
  };
  return { ctx, fillTexts };
}

describe('drawMomentCard', () => {
  const wcData: MomentCardData = {
    type: 'world_cup',
    emoji: '🏆',
    headline: 'WORLD CHAMPIONS',
    tagline: 'Champions of the world',
    subject: '🇧🇷 Brazil',
    detail: '7W · 0D · 0L · 18 goals scored',
  };

  it('draws without throwing and emits the brand + headline + subject', () => {
    const { ctx, fillTexts } = makeStubCtx();
    expect(() => drawMomentCard(ctx, 1080, 1920, wcData)).not.toThrow();
    expect(fillTexts).toContain('DYNASTY MANAGER');
    expect(fillTexts).toContain('WORLD CHAMPIONS');
    expect(fillTexts.some(t => t.includes('Brazil'))).toBe(true);
    expect(fillTexts.some(t => t.includes('App Store'))).toBe(true);
  });

  it('handles a shootout card with no tagline', () => {
    const { ctx, fillTexts } = makeStubCtx();
    const data: MomentCardData = {
      type: 'shootout',
      emoji: '⚽',
      headline: 'SHOOTOUT DRAMA',
      subject: 'Arsenal',
      detail: 'ARS 5–4 CHE on penalties',
    };
    expect(() => drawMomentCard(ctx, 1080, 1920, data)).not.toThrow();
    expect(fillTexts).toContain('SHOOTOUT DRAMA');
  });
});
