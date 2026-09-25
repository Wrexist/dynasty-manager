#!/usr/bin/env node
/**
 * Mint signed redeem codes for Dynasty Manager.
 *
 * Codes are verified offline by the app (src/utils/redeemCodes.ts) — the scheme
 * here MUST stay in sync with that file: core = `<typeChar><amount>.<nonce>`,
 * signature = first 10 hex chars of HMAC-SHA256(core, secret), display in
 * uppercase. A parity test (src/test/redeemCodes.test.ts) guards against drift,
 * including the reward caps below.
 *
 * Usage:
 *   REDEEM_SECRET=... node scripts/gen-redeem-code.mjs <money|xp> <amount> [count]
 *   REDEEM_SECRET=... npm run redeem-code -- money 500000   # one code for £500,000
 *   REDEEM_SECRET=... npm run redeem-code -- xp 250 10      # ten codes for 250 XP
 *   npm run redeem-code -- --dev xp 100                     # DEV-BUILD-ONLY code
 *
 * Secret: REQUIRED. There is no default — the old one was public, so a code
 * signed with it proves nothing. Production builds redeem only against the
 * VITE_REDEEM_SECRET they were built with, so REDEEM_SECRET here must be that
 * same value (16+ characters). `--dev` signs with the public dev secret instead;
 * those codes work in `npm run dev` and tests, never in a production build.
 */
import crypto from 'node:crypto';

/** Public dev/test secret — mirrors DEV_REDEEM_SECRET in src/utils/redeemCodes.ts. */
const DEV_REDEEM_SECRET = 'dynasty-manager-redeem-v1';
/** Mirrors MIN_REDEEM_SECRET_LENGTH in src/utils/redeemCodes.ts. */
const MIN_SECRET_LENGTH = 16;
/** Mirrors REDEEM_CODE_MAX_REWARD in src/config/gameBalance.ts. The app rejects
 *  any code above these even with a valid signature, so never mint one. */
const MAX_REWARD = { money: 1_000_000, xp: 500 };
/** One run mints at most this many codes — a typo in `count` should not
 *  print a million valid codes into a terminal scrollback. */
const MAX_COUNT = 500;

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const args = process.argv.slice(2);
const dev = args.includes('--dev');
const [typeArg, amountArg, countArg] = args.filter(a => a !== '--dev');

if (!typeArg || !amountArg || !['money', 'xp'].includes(typeArg)) {
  fail('Usage: REDEEM_SECRET=<secret> node scripts/gen-redeem-code.mjs [--dev] <money|xp> <amount> [count]');
}

let secret;
if (dev) {
  secret = DEV_REDEEM_SECRET;
  console.error('--dev: signing with the PUBLIC dev secret. These codes work in dev builds and tests only.');
} else {
  secret = process.env.REDEEM_SECRET;
  if (!secret) {
    fail('REDEEM_SECRET is not set. Refusing to mint: set it to the VITE_REDEEM_SECRET the production build uses (or pass --dev for a dev-only code).');
  }
  if (secret === DEV_REDEEM_SECRET) {
    fail('REDEEM_SECRET is the public dev secret. Production builds reject it; use the real build secret (or --dev).');
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    fail(`REDEEM_SECRET must be at least ${MIN_SECRET_LENGTH} characters — production builds reject shorter secrets.`);
  }
}

const amount = Math.round(Number(amountArg));
if (!Number.isFinite(amount) || amount <= 0) {
  fail('Amount must be a positive number.');
}
if (amount > MAX_REWARD[typeArg]) {
  fail(`Amount ${amount} is above the ${typeArg} cap of ${MAX_REWARD[typeArg]} (REDEEM_CODE_MAX_REWARD). The app would reject this code.`);
}
const count = parseInt(countArg || '1', 10);
if (!Number.isFinite(count) || count < 1 || count > MAX_COUNT) {
  fail(`Count must be between 1 and ${MAX_COUNT}.`);
}
const typeChar = typeArg === 'money' ? 'm' : 'x';

const sign = (msg) => crypto.createHmac('sha256', secret).update(msg).digest('hex').slice(0, 10);

for (let i = 0; i < count; i++) {
  // 6 base-36 chars from the CSPRNG (the app accepts 2–8): distinct codes for
  // the same reward, with no realistic chance of a repeat within one batch.
  const nonce = Array.from(crypto.randomBytes(6), b => (b % 36).toString(36)).join('');
  const core = `${typeChar}${amount}.${nonce}`;
  console.log(`${core}-${sign(core)}`.toUpperCase());
}
