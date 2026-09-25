import { describe, it, expect, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  generateRedeemCode, verifyRedeemCode, getRedeemSecret, isRedeemEnabled,
  DEV_REDEEM_SECRET, MIN_REDEEM_SECRET_LENGTH,
} from '@/utils/redeemCodes';
import { REDEEM_CODE_MAX_REWARD } from '@/config/gameBalance';
import { useGameStore } from '@/store/gameStore';

const SECRET = DEV_REDEEM_SECRET;
const PROD_SECRET = 'k9f2-prod-signing-secret-7731';

/** Sign a code exactly as scripts/gen-redeem-code.mjs does (node:crypto). */
function nodeSigned(core: string, secret = SECRET): string {
  const sig = crypto.createHmac('sha256', secret).update(core).digest('hex').slice(0, 10);
  return `${core}-${sig}`.toUpperCase();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('redeemCodes', () => {
  it('round-trips a money code', async () => {
    const code = await generateRedeemCode({ type: 'money', amount: 500_000 }, SECRET);
    const r = await verifyRedeemCode(code, SECRET);
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.reward).toEqual({ type: 'money', amount: 500_000 });
    }
  });

  it('round-trips an xp code', async () => {
    const code = await generateRedeemCode({ type: 'xp', amount: 250 }, SECRET);
    const r = await verifyRedeemCode(code, SECRET);
    expect(r.valid && r.reward.type).toBe('xp');
    expect(r.valid && r.reward.amount).toBe(250);
  });

  it('accepts lowercase / whitespace input', async () => {
    const code = await generateRedeemCode({ type: 'money', amount: 100 }, SECRET);
    const r = await verifyRedeemCode(`  ${code.toLowerCase()}  `, SECRET);
    expect(r.valid).toBe(true);
  });

  it('rejects a tampered amount (signature mismatch)', async () => {
    const code = await generateRedeemCode({ type: 'money', amount: 1000 }, SECRET);
    // Bump the amount but keep the original signature.
    const tampered = code.replace(/^M1000\./, 'M9999999.');
    const r = await verifyRedeemCode(tampered, SECRET);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('signature');
  });

  it('rejects a code signed with a different secret', async () => {
    const code = await generateRedeemCode({ type: 'xp', amount: 250 }, 'some-other-secret');
    const r = await verifyRedeemCode(code, SECRET);
    expect(r.valid).toBe(false);
  });

  it('rejects garbage / malformed input', async () => {
    for (const bad of ['', 'NOPE', 'M100', 'M100.ab', 'M100.ab-xyz']) {
      const r = await verifyRedeemCode(bad, SECRET);
      expect(r.valid).toBe(false);
    }
  });

  it('matches the generator scheme (node HMAC == app WebCrypto)', async () => {
    // Mirrors scripts/gen-redeem-code.mjs exactly. If the app's WebCrypto HMAC
    // ever diverges from the generator's node:crypto HMAC, this code won't
    // verify and the test fails — guarding client/generator parity.
    const r = await verifyRedeemCode(nodeSigned('m500000.k3f1'), SECRET);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.reward).toEqual({ type: 'money', amount: 500_000 });
  });
});

describe('per-code reward caps', () => {
  it('honours a correctly signed code at the cap and rejects one above it', async () => {
    const atCap = await verifyRedeemCode(nodeSigned(`m${REDEEM_CODE_MAX_REWARD.money}.aaaa`), SECRET);
    expect(atCap.valid).toBe(true);

    // Validly signed, so only the cap stands between a leaked secret and £5M.
    const money = await verifyRedeemCode(nodeSigned(`m${REDEEM_CODE_MAX_REWARD.money + 1}.aaaa`), SECRET);
    expect(money).toEqual({ valid: false, error: 'format' });
    const xp = await verifyRedeemCode(nodeSigned(`x${REDEEM_CODE_MAX_REWARD.xp + 1}.aaaa`), SECRET);
    expect(xp).toEqual({ valid: false, error: 'format' });
    const zero = await verifyRedeemCode(nodeSigned('m0.aaaa'), SECRET);
    expect(zero.valid).toBe(false);
  });

  it('will not mint a code the app would reject', async () => {
    await expect(generateRedeemCode({ type: 'money', amount: REDEEM_CODE_MAX_REWARD.money + 1 }, SECRET)).rejects.toThrow();
    await expect(generateRedeemCode({ type: 'xp', amount: 0 }, SECRET)).rejects.toThrow();
  });
});

describe('production builds redeem nothing without a build-time secret', () => {
  it('no VITE_REDEEM_SECRET in a production build disables redemption', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_REDEEM_SECRET', '');

    expect(getRedeemSecret()).toBeNull();
    expect(isRedeemEnabled()).toBe(false);
    // A code signed with the old public default is worthless.
    const r = await verifyRedeemCode(nodeSigned('m500000.k3f1'), getRedeemSecret());
    expect(r.valid).toBe(false);
  });

  it('the public dev secret is refused even when configured explicitly', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_REDEEM_SECRET', DEV_REDEEM_SECRET);
    expect(getRedeemSecret()).toBeNull();
  });

  it('a short secret is refused', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_REDEEM_SECRET', 'x'.repeat(MIN_REDEEM_SECRET_LENGTH - 1));
    expect(getRedeemSecret()).toBeNull();
  });

  it('a real build secret enables it, and only codes signed with that secret verify', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_REDEEM_SECRET', PROD_SECRET);
    expect(getRedeemSecret()).toBe(PROD_SECRET);
    expect(isRedeemEnabled()).toBe(true);
    expect((await verifyRedeemCode(nodeSigned('x250.abcd', PROD_SECRET), getRedeemSecret())).valid).toBe(true);
    expect((await verifyRedeemCode(nodeSigned('x250.abcd', DEV_REDEEM_SECRET), getRedeemSecret())).valid).toBe(false);
  });

  it('dev builds and tests keep working with the dev secret', () => {
    vi.stubEnv('VITE_REDEEM_SECRET', '');
    expect(import.meta.env.DEV).toBe(true);
    expect(getRedeemSecret()).toBe(DEV_REDEEM_SECRET);
  });

  it('the store action grants nothing in a production build without a secret', async () => {
    useGameStore.getState().initGame('manchester-city');
    const state = useGameStore.getState();
    const budgetBefore = state.clubs[state.playerClubId].budget;
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_REDEEM_SECRET', '');

    const r = await useGameStore.getState().redeemCode(nodeSigned('m500000.zzzz'));

    expect(r.ok).toBe(false);
    const after = useGameStore.getState();
    expect(after.clubs[after.playerClubId].budget).toBe(budgetBefore);
  });
});

describe('scripts/gen-redeem-code.mjs', () => {
  const SCRIPT = resolve(__dirname, '../../scripts/gen-redeem-code.mjs');
  const run = (args: string[], env: Record<string, string | undefined> = {}) => {
    const childEnv = { ...process.env, ...env };
    if (env.REDEEM_SECRET === undefined) delete childEnv.REDEEM_SECRET;
    return spawnSync(process.execPath, [SCRIPT, ...args], { env: childEnv, encoding: 'utf8' });
  };

  it('refuses to run without an explicit secret', () => {
    const r = run(['xp', '100']);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe('');
  });

  it('refuses the public dev secret and short secrets', () => {
    expect(run(['xp', '100'], { REDEEM_SECRET: DEV_REDEEM_SECRET }).status).toBe(1);
    expect(run(['xp', '100'], { REDEEM_SECRET: 'short' }).status).toBe(1);
  });

  it('mints codes the app verifies with the same secret', async () => {
    const r = run(['money', '250000', '2'], { REDEEM_SECRET: PROD_SECRET });
    expect(r.status).toBe(0);
    const codes = r.stdout.trim().split('\n');
    expect(codes).toHaveLength(2);
    expect(codes[0]).not.toBe(codes[1]);
    for (const code of codes) {
      const v = await verifyRedeemCode(code, PROD_SECRET);
      expect(v.valid).toBe(true);
      if (v.valid) expect(v.reward).toEqual({ type: 'money', amount: 250_000 });
    }
  });

  it('enforces the same caps as the app (parity with REDEEM_CODE_MAX_REWARD)', () => {
    const env = { REDEEM_SECRET: PROD_SECRET };
    expect(run(['money', String(REDEEM_CODE_MAX_REWARD.money)], env).status).toBe(0);
    expect(run(['money', String(REDEEM_CODE_MAX_REWARD.money + 1)], env).status).toBe(1);
    expect(run(['xp', String(REDEEM_CODE_MAX_REWARD.xp)], env).status).toBe(0);
    expect(run(['xp', String(REDEEM_CODE_MAX_REWARD.xp + 1)], env).status).toBe(1);
  });

  it('--dev mints dev-only codes signed with the public dev secret', async () => {
    const r = run(['--dev', 'xp', '100']);
    expect(r.status).toBe(0);
    expect((await verifyRedeemCode(r.stdout.trim(), DEV_REDEEM_SECRET)).valid).toBe(true);
  });
});
