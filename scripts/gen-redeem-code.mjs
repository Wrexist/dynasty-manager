#!/usr/bin/env node
/**
 * Mint signed redeem codes for Dynasty Manager.
 *
 * Codes are verified offline by the app (src/utils/redeemCodes.ts) — the scheme
 * here MUST stay in sync with that file: core = `<typeChar><amount>.<nonce>`,
 * signature = first 10 hex chars of HMAC-SHA256(core, secret), display in
 * uppercase. A parity test (src/test/redeemCodes.test.ts) guards against drift.
 *
 * Usage:
 *   node scripts/gen-redeem-code.mjs <money|xp> <amount> [count]
 *   npm run redeem-code -- money 5000000        # one code for £5,000,000
 *   npm run redeem-code -- xp 500 10            # ten codes for 500 manager XP
 *
 * Secret: defaults to the same value the app ships with. Set REDEEM_SECRET
 * (and the app's VITE_REDEEM_SECRET to match) to harden against forgery.
 */
import crypto from 'node:crypto';

const DEFAULT_REDEEM_SECRET = 'dynasty-manager-redeem-v1';
const secret = process.env.REDEEM_SECRET || DEFAULT_REDEEM_SECRET;

const [, , typeArg, amountArg, countArg] = process.argv;

if (!typeArg || !amountArg || !['money', 'xp'].includes(typeArg)) {
  console.error('Usage: node scripts/gen-redeem-code.mjs <money|xp> <amount> [count]');
  process.exit(1);
}

const amount = Math.max(0, Math.round(Number(amountArg)));
if (!Number.isFinite(amount) || amount <= 0) {
  console.error('Amount must be a positive number.');
  process.exit(1);
}
const count = Math.max(1, parseInt(countArg || '1', 10));
const typeChar = typeArg === 'money' ? 'm' : 'x';

const sign = (msg) => crypto.createHmac('sha256', secret).update(msg).digest('hex').slice(0, 10);

for (let i = 0; i < count; i++) {
  const nonce = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  const core = `${typeChar}${amount}.${nonce}`;
  console.log(`${core}-${sign(core)}`.toUpperCase());
}
