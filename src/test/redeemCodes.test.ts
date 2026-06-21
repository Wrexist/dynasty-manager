import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { generateRedeemCode, verifyRedeemCode, DEFAULT_REDEEM_SECRET } from '@/utils/redeemCodes';

describe('redeemCodes', () => {
  it('round-trips a money code', async () => {
    const code = await generateRedeemCode({ type: 'money', amount: 5_000_000 });
    const r = await verifyRedeemCode(code);
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.reward).toEqual({ type: 'money', amount: 5_000_000 });
    }
  });

  it('round-trips an xp code', async () => {
    const code = await generateRedeemCode({ type: 'xp', amount: 500 });
    const r = await verifyRedeemCode(code);
    expect(r.valid && r.reward.type).toBe('xp');
    expect(r.valid && r.reward.amount).toBe(500);
  });

  it('accepts lowercase / whitespace input', async () => {
    const code = await generateRedeemCode({ type: 'money', amount: 100 });
    const r = await verifyRedeemCode(`  ${code.toLowerCase()}  `);
    expect(r.valid).toBe(true);
  });

  it('rejects a tampered amount (signature mismatch)', async () => {
    const code = await generateRedeemCode({ type: 'money', amount: 1000 });
    // Bump the amount but keep the original signature.
    const tampered = code.replace(/^M1000\./, 'M9999999.');
    const r = await verifyRedeemCode(tampered);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('signature');
  });

  it('rejects a code signed with a different secret', async () => {
    const code = await generateRedeemCode({ type: 'xp', amount: 250 }, 'some-other-secret');
    const r = await verifyRedeemCode(code, DEFAULT_REDEEM_SECRET);
    expect(r.valid).toBe(false);
  });

  it('rejects garbage / malformed input', async () => {
    for (const bad of ['', 'NOPE', 'M100', 'M100.ab', 'M100.ab-xyz']) {
      const r = await verifyRedeemCode(bad);
      expect(r.valid).toBe(false);
    }
  });

  it('matches the generator scheme (node HMAC == app WebCrypto)', async () => {
    // Mirrors scripts/gen-redeem-code.mjs exactly. If the app's WebCrypto HMAC
    // ever diverges from the generator's node:crypto HMAC, this code won't
    // verify and the test fails — guarding client/generator parity.
    const core = 'm5000000.k3f1';
    const sig = crypto.createHmac('sha256', DEFAULT_REDEEM_SECRET).update(core).digest('hex').slice(0, 10);
    const code = `${core}-${sig}`.toUpperCase();
    const r = await verifyRedeemCode(code);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.reward).toEqual({ type: 'money', amount: 5_000_000 });
  });
});
