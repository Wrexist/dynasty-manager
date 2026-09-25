/**
 * Offline, signed redeem codes — grant in-game rewards (money / manager XP)
 * without any backend. A code embeds its reward and an HMAC signature, so the
 * app can verify it offline; only someone with the secret can mint a valid
 * code. Mint codes with `scripts/gen-redeem-code.mjs`.
 *
 * SECURITY NOTE: validation is client-side, so the secret is in the app bundle
 * and a determined user could extract it and forge codes. That's an accepted
 * trade-off for a no-backend comp/giveaway system, bounded two ways:
 *  - production builds redeem NOTHING unless `VITE_REDEEM_SECRET` was set at
 *    build time (see `getRedeemSecret`) — the old public default secret is
 *    rejected, and the Settings entry point is hidden;
 *  - every code is capped by `REDEEM_CODE_MAX_REWARD` (config/gameBalance.ts),
 *    so even a leaked secret mints only small rewards.
 * For globally single-use or revocable codes, move verification to a server
 * (the reward schema and call sites stay the same). Pro access is intentionally
 * NOT grantable here — comp Pro via RevenueCat promotional entitlements so
 * `isPro()` stays the one source of truth.
 *
 * Code shape (display, uppercased):  M500000.K3F1-1A2B3C4D5E
 *   M / X        reward type (money / xp)
 *   500000       amount
 *   .K3F1        nonce (uniqueness — makes each minted code distinct)
 *   -1A2B3C4D5E  first 10 hex chars of HMAC-SHA256(core, secret)
 */
import { REDEEM_CODE_MAX_REWARD } from '@/config/gameBalance';

/**
 * Signing secret for DEV builds and tests only.
 *
 * It used to be the production default too, and it is public (it is in the git
 * history and in every shipped bundle up to 1.6.x), so anyone could mint
 * in-game money with it. No production build accepts it: `getRedeemSecret`
 * returns it only when `import.meta.env.DEV` is true. No codes were ever handed
 * out, so nothing a player holds stops working.
 */
export const DEV_REDEEM_SECRET = 'dynasty-manager-redeem-v1';

/** Shortest build-time secret a production build will accept. */
export const MIN_REDEEM_SECRET_LENGTH = 16;

export type RedeemRewardType = 'money' | 'xp';

export interface RedeemReward {
  type: RedeemRewardType;
  amount: number;
}

/** Result of parsing/verifying a code. Flat (not a discriminated union) so it
 *  reads cleanly under the project's non-strict TS config, where control-flow
 *  narrowing on a boolean discriminant is unreliable. When `valid` is true,
 *  `codeId` and `reward` are set; otherwise `error` explains why. An amount
 *  outside what this build honours (zero, or above `REDEEM_CODE_MAX_REWARD`)
 *  is a `format` error; no configured secret is a `signature` error. */
export interface RedeemParseResult {
  valid: boolean;
  codeId?: string;
  reward?: RedeemReward;
  error?: 'format' | 'signature';
}

const TYPE_TO_CHAR: Record<RedeemRewardType, string> = { money: 'm', xp: 'x' };

/** May a code carry this reward? Positive, whole, and within the cap. */
export function isRedeemRewardAllowed(reward: RedeemReward): boolean {
  const cap = REDEEM_CODE_MAX_REWARD[reward.type];
  return Number.isInteger(reward.amount) && reward.amount > 0 && typeof cap === 'number' && reward.amount <= cap;
}

/** HMAC-SHA256(message, secret) as lowercase hex. Uses the platform WebCrypto
 *  (available in browsers and Node ≥ 20 / Vitest), so the same code path runs
 *  in the app and in tests. */
async function hmacHex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Mint a signed redeem code for a reward. Throws for a reward outside the cap
 *  — a code the app would reject must not be mintable. */
export async function generateRedeemCode(reward: RedeemReward, secret: string): Promise<string> {
  const amount = Math.round(reward.amount);
  if (!isRedeemRewardAllowed({ type: reward.type, amount })) {
    throw new Error(`Redeem reward ${reward.type} ${reward.amount} is outside the allowed range`);
  }
  const nonce = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  const core = `${TYPE_TO_CHAR[reward.type]}${amount}.${nonce}`;
  const sig = (await hmacHex(core, secret)).slice(0, 10);
  return `${core}-${sig}`.toUpperCase();
}

/** Verify a code's signature and decode its reward. Returns `{ valid: false }`
 *  with a reason on bad format, a failed signature check, a reward outside the
 *  cap, or no secret at all (redemption disabled in this build). Does NOT track
 *  prior redemptions — that's the caller's responsibility (device-global). */
export async function verifyRedeemCode(input: string, secret: string | null): Promise<RedeemParseResult> {
  const s = (input || '').trim().toLowerCase().replace(/\s+/g, '');
  const m = s.match(/^([mx])(\d{1,12})\.([a-z0-9]{2,8})-([a-f0-9]{10})$/);
  if (!m) return { valid: false, error: 'format' };
  if (!secret) return { valid: false, error: 'signature' };
  const core = `${m[1]}${m[2]}.${m[3]}`;
  const expected = (await hmacHex(core, secret)).slice(0, 10);
  if (expected !== m[4]) return { valid: false, error: 'signature' };
  const reward: RedeemReward = { type: m[1] === 'm' ? 'money' : 'xp', amount: parseInt(m[2], 10) };
  // Checked after the signature so a tampered amount still reads as tampered.
  // A correctly signed code above the cap can only come from a leaked secret
  // or a generator that skipped its own check — honour neither.
  if (!isRedeemRewardAllowed(reward)) return { valid: false, error: 'format' };
  return { valid: true, codeId: s, reward };
}

/**
 * The signing secret this build redeems against, or null when redemption is
 * disabled.
 *
 * Production: `VITE_REDEEM_SECRET` from the build environment, at least
 * `MIN_REDEEM_SECRET_LENGTH` characters and never the public dev secret —
 * otherwise null, and the Settings entry point is hidden. Dev builds and tests
 * fall back to `DEV_REDEEM_SECRET` so the flow stays exercisable.
 */
export function getRedeemSecret(): string | null {
  let configured: unknown;
  try { configured = import.meta.env.VITE_REDEEM_SECRET; } catch { configured = undefined; }
  if (
    typeof configured === 'string'
    && configured.length >= MIN_REDEEM_SECRET_LENGTH
    && configured !== DEV_REDEEM_SECRET
  ) {
    return configured;
  }
  return import.meta.env.DEV ? DEV_REDEEM_SECRET : null;
}

/** Can this build redeem codes at all? Drives the Settings entry point. */
export function isRedeemEnabled(): boolean {
  return getRedeemSecret() !== null;
}
