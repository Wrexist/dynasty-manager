// One-tap shareable "moment card" for the game's two biggest emotional beats:
// a World Cup final win and a penalty-shootout win. Renders a branded 1080×1920
// story image entirely with the 2D canvas API — NO external assets, NO new deps
// — then hands it to the platform share flow.
//
// Degradation mirrors `saveBackup.ts` (exportSlotJson): Web Share API with a
// File (routes to the iOS share sheet) on native first, an anchor download on
// web first, and nothing if neither is possible (the button hides itself via
// `detectShareCapability`). There is no clipboard tier — you can't reliably put
// a PNG on the clipboard inside WKWebView.
import { Capacitor } from '@capacitor/core';
import { APP_STORE_URL } from '@/config/legal';
import { getPlayerCardArt } from '@/utils/uiHelpers';
import type { Player } from '@/types/game';

// Story format — matches the marketing kit's poster format (1080×1920).
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

export type MomentType = 'world_cup' | 'shootout';
/** Every card this module can render — moments plus the pack best-pull card. */
export type ShareCardType = MomentType | 'pack_pull';

/** The state-derived content of one moment card. `subject`/`detail` are the
 *  long, user-controlled strings (nation / club names) and are truncated to
 *  fit; everything else is a short fixed label. */
export interface MomentCardData {
  type: MomentType;
  /** Large centrepiece glyph, e.g. '🏆' or '⚽'. */
  emoji: string;
  /** Big gold banner: 'WORLD CHAMPIONS' / 'SHOOTOUT DRAMA'. */
  headline: string;
  /** Small line under the headline, e.g. 'Champions of the world'. */
  tagline?: string;
  /** The team/nation — may be long, fitted/truncated. */
  subject: string;
  /** Score / opponent / record line — may be long, truncated. */
  detail: string;
  /** Optional caption attached to the native share sheet alongside the image. */
  shareMessage?: string;
}

/** The pack best-pull card (growth playbook P1). Rights constraint: it carries
 *  ONLY what the player already sees on the in-app card — the game's own card
 *  art, OVR and position — plus the pack's name. No player name, no portrait:
 *  the pulls are real footballers and this image leaves the app. */
export interface PackPullCardData {
  type: 'pack_pull';
  ovr: number;
  position: string;
  /** Card frame / tier shield artwork (same resolver as `PlayerCard`). */
  artSrc: string;
  /** CSS filter the in-app card applies to this art (sub-60 tier), if any. */
  artFilter?: string;
  /** The pack's display name as the overlay shows it, e.g. 'World Class Pack'. */
  packLabel: string;
  /** Localised 'Pulled in Dynasty Manager'. */
  pulledLabel: string;
  /** Optional caption attached to the native share sheet alongside the image. */
  shareMessage?: string;
}

export type ShareableCardData = MomentCardData | PackPullCardData;

export type ShareCardMethod = 'share' | 'download';

/** Flat optional result shape, matching `saveBackup.ts`'s convention (the repo
 *  runs `strictNullChecks: false`, which doesn't narrow discriminated unions
 *  reliably). */
export interface ShareCardResult {
  ok: boolean;
  method?: ShareCardMethod;
  error?: 'cancelled' | 'unsupported';
}

export type ShareCapability = 'share' | 'download' | 'none';

// ── Palette (game HSL tokens, see src/index.css) ──
const BG_TOP = 'hsl(222, 30%, 10%)';
const BG_BOTTOM = 'hsl(222, 34%, 5%)';
const GOLD = 'hsl(43, 96%, 52%)';
const GOLD_DIM = 'hsl(43, 90%, 44%)';
const TEXT = 'hsl(210, 40%, 96%)';
const MUTED = 'hsl(215, 20%, 62%)';
const HEAD_FONT = "'Oswald', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";
const BODY_FONT = "'DM Sans', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

/** Largest font px (stepping down by 2 from `startPx`, floored at `minPx`) at
 *  which `text` fits `maxWidth`. Pure — `measure(text, px)` is injected so it's
 *  unit-testable without a real canvas. */
export function fitFontPx(
  text: string,
  maxWidth: number,
  startPx: number,
  minPx: number,
  measure: (t: string, px: number) => number,
): number {
  let px = startPx;
  while (px > minPx && measure(text, px) > maxWidth) px -= 2;
  return Math.max(minPx, px);
}

/** Truncate `text` with an ellipsis so it fits `maxWidth` at `px`. Pure. */
export function truncateToWidth(
  text: string,
  maxWidth: number,
  px: number,
  measure: (t: string, px: number) => number,
): string {
  if (measure(text, px) <= maxWidth) return text;
  const ell = '…';
  let t = text;
  while (t.length > 1 && measure(t + ell, px) > maxWidth) t = t.slice(0, -1);
  return t.replace(/\s+$/, '') + ell;
}

/** Minimal 2D-context surface the drawing uses — lets tests pass a stub. */
type Ctx2D = Pick<
  CanvasRenderingContext2D,
  'fillRect' | 'strokeRect' | 'fillText' | 'measureText' | 'createLinearGradient' | 'createRadialGradient'
> & {
  font: string; fillStyle: unknown; strokeStyle: unknown; lineWidth: number;
  textAlign: CanvasTextAlign; textBaseline: CanvasTextBaseline;
};

/** Shared chrome of every card: gradient, gold glow, frame and brand lockup.
 *  Leaves `textAlign`/`textBaseline` at center/middle. */
function drawBackdrop(ctx: Ctx2D, w: number, h: number): void {
  const cx = w / 2;

  // Background gradient.
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, BG_TOP);
  bg.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Gold glow behind the centrepiece.
  const glow = ctx.createRadialGradient(cx, h * 0.34, 0, cx, h * 0.34, w * 0.95);
  glow.addColorStop(0, 'hsla(43, 96%, 52%, 0.24)');
  glow.addColorStop(0.5, 'hsla(43, 96%, 52%, 0.05)');
  glow.addColorStop(1, 'hsla(43, 96%, 52%, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Gold border frame.
  ctx.strokeStyle = 'hsla(43, 96%, 52%, 0.55)';
  ctx.lineWidth = 6;
  ctx.strokeRect(44, 44, w - 88, h - 88);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Brand lockup (top).
  ctx.fillStyle = GOLD;
  ctx.font = `700 62px ${HEAD_FONT}`;
  ctx.fillText('DYNASTY MANAGER', cx, 180);
  ctx.fillStyle = MUTED;
  ctx.font = `600 34px ${BODY_FONT}`;
  ctx.fillText('FOOTBALL', cx, 236);
}

/** Draw the moment card onto a 2D context sized `w`×`h`. Pure drawing, never
 *  throws on a well-formed context; the offscreen-canvas plumbing lives in
 *  `renderCardCanvas`. Exported for smoke-testing against a stub context. */
export function drawMomentCard(ctx: Ctx2D, w: number, h: number, data: MomentCardData): void {
  const measure = (t: string, px: number): number => {
    ctx.font = `700 ${px}px ${HEAD_FONT}`;
    return ctx.measureText(t).width;
  };
  const cx = w / 2;
  drawBackdrop(ctx, w, h);

  // Centrepiece emoji.
  ctx.fillStyle = TEXT;
  ctx.font = `400 340px ${BODY_FONT}`;
  ctx.fillText(data.emoji, cx, h * 0.40);

  // Headline (gold, fitted to width).
  const maxTextW = w - 200;
  const headPx = fitFontPx(data.headline, maxTextW, 148, 64, measure);
  ctx.fillStyle = GOLD;
  ctx.font = `700 ${headPx}px ${HEAD_FONT}`;
  ctx.fillText(data.headline, cx, h * 0.64);

  // Tagline.
  if (data.tagline) {
    ctx.fillStyle = GOLD_DIM;
    ctx.font = `500 40px ${BODY_FONT}`;
    ctx.fillText(truncateToWidth(data.tagline, maxTextW, 40, (t, px) => {
      ctx.font = `500 ${px}px ${BODY_FONT}`; return ctx.measureText(t).width;
    }), cx, h * 0.64 + headPx * 0.7 + 24);
  }

  // Subject (team / nation).
  ctx.fillStyle = TEXT;
  ctx.font = `700 56px ${BODY_FONT}`;
  const subject = truncateToWidth(data.subject, maxTextW, 56, (t, px) => {
    ctx.font = `700 ${px}px ${BODY_FONT}`; return ctx.measureText(t).width;
  });
  ctx.fillText(subject, cx, h * 0.76);

  // Detail (score / record).
  ctx.fillStyle = MUTED;
  ctx.font = `500 40px ${BODY_FONT}`;
  const detail = truncateToWidth(data.detail, maxTextW, 40, (t, px) => {
    ctx.font = `500 ${px}px ${BODY_FONT}`; return ctx.measureText(t).width;
  });
  ctx.fillText(detail, cx, h * 0.81);

  // Footer.
  ctx.fillStyle = MUTED;
  ctx.font = `600 34px ${BODY_FONT}`;
  ctx.fillText('Dynasty Manager: Football — on the App Store', cx, h - 120);
}

/** Drawing surface for the pack card — the moment surface plus images. */
type PackCtx2D = Ctx2D & Pick<CanvasRenderingContext2D, 'drawImage'> & { filter?: string };

// Card geometry on the 1080×1920 story. 2:3 like every `public/player-cards/`
// file (1024×1536), so the art is drawn unscaled in aspect — its alpha is the
// card's edge, exactly as in-app.
const PACK_CARD_W = 640;
const PACK_CARD_H = 960;
const PACK_CARD_TOP = 320;

/** `apps.apple.com/app/id…` — the link printed on the card (the share sheet
 *  also carries the full URL). */
export const APP_STORE_LINK_TEXT = APP_STORE_URL.replace(/^https?:\/\//, '');

/** Build the pack best-pull card from a pulled player. Pure. Reads only the
 *  fields the in-app card face shows up top (OVR, position, card art) — the
 *  player's name and portrait are deliberately NOT read, so they cannot leak
 *  onto an image that leaves the app. */
export function buildPackPullCardData(
  player: Pick<Player, 'overall' | 'position' | 'packFrame' | 'ballonDOrTop10HoldSeason'>,
  labels: { packLabel: string; pulledLabel: string; shareMessage?: string },
): PackPullCardData {
  const art = getPlayerCardArt(player.overall, {
    ballonDorTop10: typeof player.ballonDOrTop10HoldSeason === 'number',
    packFrame: player.packFrame,
  });
  return {
    type: 'pack_pull',
    ovr: player.overall,
    position: player.position,
    artSrc: art.src,
    artFilter: art.filter,
    packLabel: labels.packLabel,
    pulledLabel: labels.pulledLabel,
    shareMessage: labels.shareMessage,
  };
}

/** Draw the pack best-pull card. `art` is the loaded card image, or null if it
 *  failed to load — then a tier-coloured panel stands in so the share still
 *  works. Exported for smoke-testing against a stub context. */
export function drawPackPullCard(ctx: PackCtx2D, w: number, h: number, data: PackPullCardData, art: CanvasImageSource | null): void {
  drawBackdrop(ctx, w, h);
  const cx = w / 2;
  const x = (w - PACK_CARD_W) / 2;
  const y = PACK_CARD_TOP;

  if (art) {
    const prevFilter = ctx.filter;
    if (data.artFilter && typeof prevFilter === 'string') ctx.filter = data.artFilter;
    ctx.drawImage(art, x, y, PACK_CARD_W, PACK_CARD_H);
    if (typeof prevFilter === 'string') ctx.filter = prevFilter;
  } else {
    const panel = ctx.createLinearGradient(x, y, x + PACK_CARD_W, y + PACK_CARD_H);
    panel.addColorStop(0, GOLD);
    panel.addColorStop(1, 'hsl(222, 30%, 14%)');
    ctx.fillStyle = panel;
    ctx.fillRect(x, y, PACK_CARD_W, PACK_CARD_H);
  }

  // OVR + position, top-left of the card face — same proportions as
  // `PlayerCard`'s sizeTokens (ovr 0.24w, top 0.093w, left 0.12w, pos 0.067w),
  // over the same dark radial scrim the in-app card uses behind them.
  // Filled over the gradient's own bounding square so it fades to zero before
  // any edge — a rect cut through the glow would read as a box the card does
  // not have (the art's alpha is the card's edge).
  const sx = x + PACK_CARD_W * 0.18;
  const sy = y + PACK_CARD_H * 0.17;
  const sr = PACK_CARD_W * 0.34;
  const scrim = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
  scrim.addColorStop(0, 'rgba(0,0,0,0.7)');
  scrim.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);

  const ovrPx = Math.round(PACK_CARD_W * 0.24);
  const posPx = Math.round(PACK_CARD_W * 0.067);
  const left = x + PACK_CARD_W * 0.12;
  const top = y + PACK_CARD_W * 0.093;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = TEXT;
  ctx.font = `900 ${ovrPx}px ${HEAD_FONT}`;
  ctx.fillText(String(data.ovr), left, top);
  ctx.font = `700 ${posPx}px ${HEAD_FONT}`;
  ctx.fillText(data.position, left + 4, top + ovrPx * 0.98);

  // Pack name (gold, fitted) + tagline + link.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxTextW = w - 200;
  const label = data.packLabel.toUpperCase();
  const labelPx = fitFontPx(label, maxTextW, 96, 48, (t, px) => {
    ctx.font = `700 ${px}px ${HEAD_FONT}`; return ctx.measureText(t).width;
  });
  ctx.fillStyle = GOLD;
  ctx.font = `700 ${labelPx}px ${HEAD_FONT}`;
  ctx.fillText(label, cx, y + PACK_CARD_H + 130);

  ctx.fillStyle = TEXT;
  ctx.font = `600 48px ${BODY_FONT}`;
  ctx.fillText(truncateToWidth(data.pulledLabel, maxTextW, 48, (t, px) => {
    ctx.font = `600 ${px}px ${BODY_FONT}`; return ctx.measureText(t).width;
  }), cx, y + PACK_CARD_H + 230);

  ctx.fillStyle = MUTED;
  ctx.font = `600 34px ${BODY_FONT}`;
  ctx.fillText(APP_STORE_LINK_TEXT, cx, h - 120);
}

/** Best-effort pre-check for whether a share/download path exists at all, so
 *  the button can hide when it can't do anything. The runtime share still
 *  degrades independently (a `canShare({files})` false at call time falls back
 *  to download). */
export function detectShareCapability(): ShareCapability {
  const canvasOk = typeof document !== 'undefined'
    && typeof document.createElement === 'function';
  if (!canvasOk) return 'none';
  const canShareFiles = typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && typeof File !== 'undefined';
  if (canShareFiles) return 'share';
  const canDownload = typeof URL !== 'undefined'
    && typeof URL.createObjectURL === 'function';
  if (canDownload) return 'download';
  return 'none';
}

/** `dynasty-world-champions-2026-07-10.png`. */
export function buildMomentFilename(type: ShareCardType, date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const slug = type === 'world_cup' ? 'world-champions' : type === 'pack_pull' ? 'pack-pull' : 'shootout-win';
  return `dynasty-${slug}-${y}-${m}-${d}.png`;
}

/** Load a same-origin image for canvas drawing. Resolves null on error or
 *  after `timeoutMs` — a missing cover must degrade the card, never hang it. */
function loadImage(src: string, timeoutMs = 4000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(null); return; }
    const img = new Image();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.decoding = 'async';
    img.src = src;
  });
}

async function renderCardCanvas(data: ShareableCardData): Promise<HTMLCanvasElement | null> {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (data.type === 'pack_pull') {
    const art = await loadImage(data.artSrc);
    drawPackPullCard(ctx as unknown as PackCtx2D, CARD_WIDTH, CARD_HEIGHT, data, art);
  } else {
    drawMomentCard(ctx as unknown as Ctx2D, CARD_WIDTH, CARD_HEIGHT, data);
  }
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      if (typeof canvas.toBlob !== 'function') { resolve(null); return; }
      canvas.toBlob((b) => resolve(b), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

async function tryShareFile(blob: Blob, filename: string, message: string): Promise<ShareCardResult | null> {
  try {
    if (typeof navigator === 'undefined' || typeof File === 'undefined') return null;
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return null;
    const file = new File([blob], filename, { type: 'image/png' });
    if (!navigator.canShare({ files: [file] })) return null;
    await navigator.share({ files: [file], text: message, url: APP_STORE_URL, title: 'Dynasty Manager' });
    return { ok: true, method: 'share' };
  } catch (err) {
    // User dismissed the sheet — a deliberate cancel, not a fall-through.
    if (err instanceof DOMException && err.name === 'AbortError') return { ok: false, error: 'cancelled' };
    if (err instanceof Error && err.name === 'AbortError') return { ok: false, error: 'cancelled' };
    return null;
  }
}

function tryDownloadBlob(blob: Blob, filename: string): ShareCardResult | null {
  try {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* noop */ } }, 1000);
    return { ok: true, method: 'download' };
  } catch {
    return null;
  }
}

/** Render the card and share it. Degrades share → download → unsupported,
 *  ordered by platform (native prefers the share sheet; web prefers a
 *  download). Never throws. */
export async function shareMomentCard(data: ShareableCardData): Promise<ShareCardResult> {
  const canvas = await renderCardCanvas(data);
  if (!canvas) return { ok: false, error: 'unsupported' };
  const blob = await canvasToBlob(canvas);
  if (!blob) return { ok: false, error: 'unsupported' };

  const filename = buildMomentFilename(data.type);
  const message = data.shareMessage ?? 'I built this in Dynasty Manager: Football.';

  const shareFirst = Capacitor.isNativePlatform();
  const share = () => tryShareFile(blob, filename, message);
  const download = async () => tryDownloadBlob(blob, filename);
  const order = shareFirst ? [share, download] : [download, share];
  for (const attempt of order) {
    const res = await attempt();
    if (res) return res; // includes the explicit 'cancelled' from the share sheet
  }
  return { ok: false, error: 'unsupported' };
}
