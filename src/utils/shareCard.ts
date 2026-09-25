// One-tap shareable "moment card" for the game's biggest emotional beats:
// a World Cup final win, a penalty-shootout win, and a pack's best pull.
// Renders a branded 1080×1920 story image with the 2D canvas API — NO new
// deps. The pack card draws the same card art + portrait the app shows (both
// bundled, same-origin files, so the canvas is never tainted); every other
// card uses no external assets. Then hands it to the platform share flow.
//
// Degradation mirrors `saveBackup.ts` (exportSlotJson): Web Share API with a
// File (routes to the iOS share sheet) on native first, an anchor download on
// web first, and nothing if neither is possible (the button hides itself via
// `detectShareCapability`). There is no clipboard tier — you can't reliably put
// a PNG on the clipboard inside WKWebView.
import { Capacitor } from '@capacitor/core';
import { APP_STORE_URL } from '@/config/legal';

// Story format — matches the marketing kit's poster format (1080×1920).
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

export type MomentType = 'world_cup' | 'shootout' | 'pack';

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
  /** Pack pulls only: the card itself replaces the emoji centrepiece. */
  card?: MomentCardArt;
}

/** The player card drawn as a pack-pull centrepiece — the same art sources
 *  `PlayerCard` renders, resolved by the caller (`getPlayerCardArt`,
 *  `getPlayerPortrait`) so this module stays free of game data. */
export interface MomentCardArt {
  artSrc: string;
  /** CSS filter string the card art carries (sub-60 tier greys it out). */
  artFilter?: string;
  portraitSrc?: string;
  overall: number;
  position: string;
}

/** Card box inside the 1080×1920 story, 2:3 like every player-card file. */
export const PACK_CARD_BOX = { x: 260, y: 290, w: 560, h: 840 } as const;

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
  shadowColor?: string; shadowBlur?: number;
};

/** Draw the moment card onto a 2D context sized `w`×`h`. Pure drawing, never
 *  throws on a well-formed context; the offscreen-canvas plumbing lives in
 *  `renderMomentCanvas`. Exported for smoke-testing against a stub context. */
export function drawMomentCard(
  ctx: Ctx2D,
  w: number,
  h: number,
  data: MomentCardData,
  drawCentrepiece?: (ctx: Ctx2D) => void,
): void {
  const measure = (t: string, px: number): number => {
    ctx.font = `700 ${px}px ${HEAD_FONT}`;
    return ctx.measureText(t).width;
  };
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

  // Centrepiece: the pulled card when its art loaded, else the emoji.
  if (drawCentrepiece) {
    drawCentrepiece(ctx);
    if (data.card) drawCardRating(ctx, data.card);
  } else {
    ctx.fillStyle = TEXT;
    ctx.font = `400 340px ${BODY_FONT}`;
    ctx.fillText(data.emoji, cx, h * 0.40);
  }

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

/** OVR + position in the card's top-left corner, where `PlayerCard` puts them
 *  (its scrim is centred at 18% / 17% of the card for exactly this text). */
function drawCardRating(ctx: Ctx2D, card: MomentCardArt): void {
  const { x, y, w, h } = PACK_CARD_BOX;
  ctx.textAlign = 'center';
  // Bright pack frames sit behind this corner; the in-app card uses a scrim
  // plus text shadows for the same reason.
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = TEXT;
  ctx.font = `700 ${Math.round(w * 0.15)}px ${HEAD_FONT}`;
  ctx.fillText(String(card.overall), x + w * 0.2, y + h * 0.17);
  ctx.font = `600 ${Math.round(w * 0.062)}px ${HEAD_FONT}`;
  ctx.fillText(card.position, x + w * 0.2, y + h * 0.245);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

/** Card art with the portrait composited the way `PlayerPortrait` does it:
 *  a box at 25%/9%, 70%×49% of the card, image cover-fit and top-aligned,
 *  feathered by an ellipse (65%×80% at 52%/35%, solid to 48%, clear by 85%),
 *  then clipped to the art's own alpha so the face never leaves the shield. */
function drawCardWithPortrait(
  ctx: CanvasRenderingContext2D,
  art: HTMLImageElement,
  portrait: HTMLImageElement | null,
  artFilter?: string,
): void {
  const { x, y, w, h } = PACK_CARD_BOX;
  ctx.save();
  if (artFilter) ctx.filter = artFilter;
  ctx.drawImage(art, x, y, w, h);
  ctx.restore();
  if (!portrait || !portrait.naturalWidth) return;

  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const o = off.getContext('2d');
  if (!o) return;
  const bx = w * 0.25, by = h * 0.09, bw = w * 0.7, bh = h * 0.49;
  const scale = Math.max(bw / portrait.naturalWidth, bh / portrait.naturalHeight);
  const dw = portrait.naturalWidth * scale;
  const dh = portrait.naturalHeight * scale;
  o.save();
  o.beginPath();
  o.rect(bx, by, bw, bh);
  o.clip();
  o.drawImage(portrait, bx + (bw - dw) / 2, by, dw, dh);
  o.restore();

  o.globalCompositeOperation = 'destination-in';
  const ex = bx + bw * 0.52, ey = by + bh * 0.35;
  o.save();
  o.translate(ex, ey);
  o.scale(bw * 0.65, bh * 0.8);
  const feather = o.createRadialGradient(0, 0, 0, 0, 0, 1);
  feather.addColorStop(0.48, 'rgba(0,0,0,1)');
  feather.addColorStop(0.85, 'rgba(0,0,0,0)');
  o.fillStyle = feather;
  o.fillRect(-4, -4, 8, 8);
  o.restore();
  o.drawImage(art, 0, 0, w, h);

  ctx.drawImage(off, x, y);
}

/** Same-origin image load with a timeout; resolves null instead of throwing. */
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

/** Story-card content for a pack's best pull. Pure. */
export function buildPackPullMoment(input: {
  name: string;
  overall: number;
  position: string;
  packLabel: string;
  legend: boolean;
  card: Omit<MomentCardArt, 'overall' | 'position'>;
}): MomentCardData {
  return {
    type: 'pack',
    emoji: input.legend ? '👑' : '⭐',
    headline: input.legend ? 'HALL OF LEGENDS' : 'BEST PULL',
    // Tier labels already end in "Pack" ("Gold Pack"); weekly skins do not.
    tagline: /\bpack$/i.test(input.packLabel.trim()) ? input.packLabel.trim() : `${input.packLabel.trim()} Pack`,
    subject: input.name,
    detail: `${input.overall} OVR · ${input.position}`,
    shareMessage: `Just pulled ${input.name} (${input.overall}) in Dynasty Manager: Football.`,
    card: { ...input.card, overall: input.overall, position: input.position },
  };
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
export function buildMomentFilename(type: MomentType, date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const slug = type === 'world_cup' ? 'world-champions' : type === 'pack' ? 'pack-pull' : 'shootout-win';
  return `dynasty-${slug}-${y}-${m}-${d}.png`;
}

export async function renderMomentCanvas(data: MomentCardData): Promise<HTMLCanvasElement | null> {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let centrepiece: ((c: Ctx2D) => void) | undefined;
  if (data.card) {
    const [art, portrait] = await Promise.all([
      loadImage(data.card.artSrc),
      data.card.portraitSrc ? loadImage(data.card.portraitSrc) : Promise.resolve(null),
    ]);
    // No art → fall back to the emoji card rather than a card-less rating.
    if (art) centrepiece = () => drawCardWithPortrait(ctx, art, portrait, data.card.artFilter);
  }
  drawMomentCard(ctx as unknown as Ctx2D, CARD_WIDTH, CARD_HEIGHT, data, centrepiece);
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
export async function shareMomentCard(data: MomentCardData): Promise<ShareCardResult> {
  const canvas = await renderMomentCanvas(data);
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
