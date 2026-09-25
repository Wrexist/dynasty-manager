/**
 * Pack best-pull share card (growth playbook P1).
 *
 * The card leaves the app, and the pulls are real footballers, so the rights
 * constraint is the thing worth pinning: the card data and the drawn image
 * carry the card face (art, OVR, position), the pack name, the tagline and the
 * App Store link — and never the player's name. Canvas can't render under
 * jsdom, so drawing is smoke-tested against a stub context.
 */
import { describe, it, expect } from 'vitest';
import {
  APP_STORE_LINK_TEXT,
  CARD_HEIGHT,
  CARD_WIDTH,
  buildMomentFilename,
  buildPackPullCardData,
  drawPackPullCard,
} from '@/utils/shareCard';
import { getPlayerCardArt } from '@/utils/uiHelpers';
import type { Player } from '@/types/game';

const player = {
  id: 'p1',
  firstName: 'Erling',
  lastName: 'Haaland',
  overall: 91,
  position: 'ST',
  packFrame: undefined,
  ballonDOrTop10HoldSeason: undefined,
} as unknown as Player;

const labels = {
  packLabel: 'World Class Pack',
  pulledLabel: 'Pulled in Dynasty Manager',
  shareMessage: 'Pulled from a World Class Pack in Dynasty Manager: Football.',
};

function makeStubCtx() {
  const fillTexts: string[] = [];
  const images: unknown[] = [];
  const grad = { addColorStop: () => {} };
  const ctx = {
    font: '', fillStyle: '' as unknown, strokeStyle: '' as unknown, lineWidth: 0,
    textAlign: 'center' as CanvasTextAlign, textBaseline: 'middle' as CanvasTextBaseline,
    filter: 'none',
    fillRect: () => {},
    strokeRect: () => {},
    fillText: (t: string) => { fillTexts.push(t); },
    measureText: (t: string) => ({ width: t.length * 20 } as TextMetrics),
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    drawImage: (img: unknown) => { images.push(img); },
  };
  return { ctx, fillTexts, images };
}

describe('buildPackPullCardData', () => {
  it('uses the same card art resolver as the in-app PlayerCard', () => {
    const data = buildPackPullCardData(player, labels);
    expect(data.artSrc).toBe(getPlayerCardArt(91).src);
    expect(data).toMatchObject({ type: 'pack_pull', ovr: 91, position: 'ST', packLabel: 'World Class Pack' });
  });

  it('keeps the pack frame the pull earned', () => {
    const framed = { ...player, packFrame: 'world-class' } as Player;
    const data = buildPackPullCardData(framed, labels);
    expect(data.artSrc).toBe('/player-cards/world-class.webp');
  });

  it('never carries the player name anywhere in the payload', () => {
    const json = JSON.stringify(buildPackPullCardData(player, labels));
    expect(json).not.toMatch(/Erling|Haaland/);
  });
});

describe('drawPackPullCard', () => {
  it('draws the card art, OVR, position, pack name, tagline and App Store link', () => {
    const { ctx, fillTexts, images } = makeStubCtx();
    const art = { tag: 'card-art' };
    const data = buildPackPullCardData(player, labels);
    expect(() => drawPackPullCard(ctx, CARD_WIDTH, CARD_HEIGHT, data, art as unknown as CanvasImageSource)).not.toThrow();
    expect(images).toEqual([art]);
    expect(fillTexts).toContain('91');
    expect(fillTexts).toContain('ST');
    expect(fillTexts).toContain('WORLD CLASS PACK');
    expect(fillTexts).toContain('Pulled in Dynasty Manager');
    expect(fillTexts).toContain(APP_STORE_LINK_TEXT);
    expect(APP_STORE_LINK_TEXT).toBe('apps.apple.com/app/id6760918006');
  });

  it('never draws the player name', () => {
    const { ctx, fillTexts } = makeStubCtx();
    drawPackPullCard(ctx, CARD_WIDTH, CARD_HEIGHT, buildPackPullCardData(player, labels), null);
    expect(fillTexts.join(' ')).not.toMatch(/Erling|Haaland/);
  });

  it('still produces a card when the art fails to load', () => {
    const { ctx, fillTexts, images } = makeStubCtx();
    expect(() => drawPackPullCard(ctx, CARD_WIDTH, CARD_HEIGHT, buildPackPullCardData(player, labels), null)).not.toThrow();
    expect(images).toEqual([]);
    expect(fillTexts).toContain('91');
  });

  it('restores the context filter after drawing filtered (sub-60) art', () => {
    const { ctx } = makeStubCtx();
    const low = buildPackPullCardData({ ...player, overall: 55 } as Player, labels);
    expect(low.artFilter).toBeTruthy();
    drawPackPullCard(ctx, CARD_WIDTH, CARD_HEIGHT, low, {} as CanvasImageSource);
    expect(ctx.filter).toBe('none');
  });
});

describe('pack share card format', () => {
  it('is a 9:16 story image', () => {
    expect(CARD_WIDTH / CARD_HEIGHT).toBeCloseTo(9 / 16, 5);
  });

  it('names the file as a pack pull', () => {
    expect(buildMomentFilename('pack_pull', new Date(2026, 8, 25))).toBe('dynasty-pack-pull-2026-09-25.png');
  });
});
