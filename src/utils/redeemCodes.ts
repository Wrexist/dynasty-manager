/**
 * Offline, signed redeem codes — grant in-game rewards (money / manager XP)
 * without any backend. A code embeds its reward and an HMAC signature, so the
 * app can verify it offline; only someone with the secret can mint a valid
 * code. Mint codes with `scripts/gen-redeem-code.mjs`.
 *
 * SECURITY NOTE: validation is client-side, so the secret is in the app bundle
 * and a determined user could extract it and forge codes. That's an accepted
 * trade-off for a no-backend comp/giveaway system. For globally single-use or
 * revocable codes, move verification to a server (the reward schema and call
 * sites stay the same). Pro access is intentionally NOT grantable here — comp
 * Pro via RevenueCat promotional entitlements so `isPro()` stays the one
 * source of truth.
 *
 * Code shape (display, uppercased):  M5000000.K3F1-1A2B3C4D5E
 *   M / X        reward type (money / xp)
 *   5000000      amount
 *   .K3F1        nonce (uniqueness — makes each minted code distinct)
 *   -1A2B3C4D5E  first 10 hex chars of HMAC-SHA256(core, secret)
 */

/** Default signing secret. Override at build time with VITE_REDEEM_SECRET (app)
 *  and REDEEM_SECRET (generator) to harden against forgery. The generator
 *  defaults to this same value so codes work out of the box. */
export const DEFAULT_REDEEM_SECRET = 'dynasty-manager-redeem-v1';

export type RedeemRewardType = 'money' | 'xp';

export interface RedeemReward {
  type: RedeemRewardType;
  amount: number;
}

/** Result of parsing/verifying a code. Flat (not a discriminated union) so it
 *  reads cleanly under the project's non-strict TS config, where control-flow
 *  narrowing on a boolean discriminant is unreliable. When `valid` is true,
 *  `codeId` and `reward` are set; otherwise `error` explains why. */
export interface RedeemParseResult {
  valid: boolean;
  codeId?: string;
  reward?: RedeemReward;
  error?: 'format' | 'signature';
}

const TYPE_TO_CHAR: Record<RedeemRewardType, string> = { money: 'm', xp: 'x' };

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

/** Mint a signed redeem code for a reward. */
export async function generateRedeemCode(reward: RedeemReward, secret = DEFAULT_REDEEM_SECRET): Promise<string> {
  const amount = Math.max(0, Math.round(reward.amount));
  const nonce = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  const core = `${TYPE_TO_CHAR[reward.type]}${amount}.${nonce}`;
  const sig = (await hmacHex(core, secret)).slice(0, 10);
  return `${core}-${sig}`.toUpperCase();
}

/** Verify a code's signature and decode its reward. Returns `{ valid: false }`
 *  with a reason on bad format or a failed signature check. Does NOT track
 *  prior redemptions — that's the caller's responsibility (device-global). */
export async function verifyRedeemCode(input: string, secret = DEFAULT_REDEEM_SECRET): Promise<RedeemParseResult> {
  const s = (input || '').trim().toLowerCase().replace(/\s+/g, '');
  const m = s.match(/^([mx])(\d+)\.([a-z0-9]{2,8})-([a-f0-9]{10})$/);
  if (!m) return { valid: false, error: 'format' };
  const core = `${m[1]}${m[2]}.${m[3]}`;
  const expected = (await hmacHex(core, secret)).slice(0, 10);
  if (expected !== m[4]) return { valid: false, error: 'signature' };
  return {
    valid: true,
    codeId: s,
    reward: { type: m[1] === 'm' ? 'money' : 'xp', amount: parseInt(m[2], 10) },
  };
}

/** Resolve the active signing secret for the app (build-time override or default). */
export function getRedeemSecret(): string {
  try {
    return (import.meta.env.VITE_REDEEM_SECRET as string) || DEFAULT_REDEEM_SECRET;
  } catch {
    return DEFAULT_REDEEM_SECRET;
  }
}
