#!/usr/bin/env node
/**
 * Apple Ads unit-economics model for Dynasty Manager.
 *
 *   node marketing/ads/unit-economics.mjs
 *   node marketing/ads/unit-economics.mjs --pro=0.02 --monthly=0.01 --cr=0.55 --cpt=1.20
 *   node marketing/ads/unit-economics.mjs --json
 *
 * WHY THIS EXISTS
 * ---------------
 * A bid cap is arithmetic, not taste. Apple Ads will happily spend at any CPT
 * you set; the only thing that decides whether that spend is an investment or
 * a donation is revenue per install versus cost per install. This script makes
 * that comparison explicit and refuses to let a campaign plan quote a bid that
 * the price ladder cannot pay back.
 *
 * Prices are parsed live out of src/config/monetization.ts so the model can
 * never drift from the shipped catalog.
 *
 * EVERY CONVERSION RATE BELOW IS AN ASSUMPTION, NOT A MEASUREMENT. Replace
 * them with App Analytics / RevenueCat numbers before you trust any output.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

// ── Live price catalog ───────────────────────────────────────────────────────

function loadPrices() {
  const src = readFileSync(join(REPO, 'src', 'config', 'monetization.ts'), 'utf8');
  const prices = {};
  const re = /id:\s*'(com\.dynastymanager\.[^']+)'[\s\S]*?priceUsd:\s*([0-9.]+)/g;
  let m;
  while ((m = re.exec(src)) !== null) prices[m[1]] = Number(m[2]);
  const required = [
    'com.dynastymanager.pro',
    'com.dynastymanager.pro.monthly',
    'com.dynastymanager.pro.annual',
    'com.dynastymanager.pro.lifetime',
    'com.dynastymanager.bundle.all',
  ];
  const missing = required.filter((id) => prices[id] == null);
  if (missing.length) {
    throw new Error(
      `Could not parse prices for ${missing.join(', ')} out of src/config/monetization.ts — ` +
        'the catalog shape changed, fix this parser before trusting the model.'
    );
  }
  return prices;
}

// ── Assumptions ──────────────────────────────────────────────────────────────
// Conversion rates are expressed as a fraction OF INSTALLS. They are the only
// numbers in this file that are guesses; the flag name to override each one is
// in the second column.

const DEFAULTS = {
  // --- funnel, per install ---
  proOneTime: 0.010, // --pro          install → buys Dynasty Pro $7.99 outright
  lifetime: 0.002, // --lifetime     install → buys Pro Lifetime $19.99
  bundle: 0.002, // --bundle       install → buys Dynasty Edition $14.99
  monthlyStart: 0.020, // --monthly      install → starts the 7-day trial on monthly
  annualStart: 0.004, // --annual       install → starts annual
  trialToPaid: 0.40, // --trial-to-paid  trial → first successful bill
  monthlyChurn: 0.25, // --churn        monthly subscriber churn per month
  consumableArpi: 0.05, // --consumables  player-pack IAP revenue per install, USD

  // --- ad mechanics ---
  cr: 0.55, // --cr           tap → install (Apple Ads search results run high)
  cpt: 1.20, // --cpt          cost per tap, USD

  // --- accounting ---
  commission: 0.15, // --commission   Apple's cut; 0.15 under the Small Business Program
  horizonMonths: 12, // --horizon      months of subscription revenue counted
  targetRoas: 1.0, // --roas         1.0 = break even at the horizon; 1.5 = 50% margin
};

function parseArgs(argv) {
  const alias = {
    pro: 'proOneTime',
    lifetime: 'lifetime',
    bundle: 'bundle',
    monthly: 'monthlyStart',
    annual: 'annualStart',
    'trial-to-paid': 'trialToPaid',
    churn: 'monthlyChurn',
    consumables: 'consumableArpi',
    cr: 'cr',
    cpt: 'cpt',
    commission: 'commission',
    horizon: 'horizonMonths',
    roas: 'targetRoas',
  };
  const out = { ...DEFAULTS };
  const overridden = new Set();
  for (const arg of argv) {
    const m = /^--([a-z-]+)=([0-9.]+)$/.exec(arg);
    if (!m) continue;
    const key = alias[m[1]];
    if (!key) {
      console.error(`Unknown flag --${m[1]}`);
      process.exit(2);
    }
    out[key] = Number(m[2]);
    overridden.add(key);
  }
  return { cfg: out, overridden };
}

/** Expected number of successful monthly bills inside the horizon. */
function expectedBills(churn, horizonMonths) {
  let sum = 0;
  for (let k = 0; k < horizonMonths; k++) sum += (1 - churn) ** k;
  return sum;
}

function model(cfg, prices) {
  const bills = expectedBills(cfg.monthlyChurn, cfg.horizonMonths);

  const lines = [
    {
      label: 'Dynasty Pro (one-time)',
      rate: cfg.proOneTime,
      unit: prices['com.dynastymanager.pro'],
      qty: 1,
    },
    {
      label: 'Dynasty Pro Lifetime',
      rate: cfg.lifetime,
      unit: prices['com.dynastymanager.pro.lifetime'],
      qty: 1,
    },
    {
      label: 'Dynasty Edition bundle',
      rate: cfg.bundle,
      unit: prices['com.dynastymanager.bundle.all'],
      qty: 1,
    },
    {
      label: `Pro Monthly (trial→paid ${(cfg.trialToPaid * 100).toFixed(0)}%, ${bills.toFixed(1)} bills)`,
      rate: cfg.monthlyStart * cfg.trialToPaid,
      unit: prices['com.dynastymanager.pro.monthly'],
      qty: bills,
    },
    {
      label: 'Pro Annual',
      rate: cfg.annualStart * cfg.trialToPaid,
      unit: prices['com.dynastymanager.pro.annual'],
      qty: 1,
    },
    { label: 'Consumable player packs', rate: 1, unit: cfg.consumableArpi, qty: 1 },
  ].map((l) => ({ ...l, gross: l.rate * l.unit * l.qty }));

  const grossPerInstall = lines.reduce((s, l) => s + l.gross, 0);
  const netPerInstall = grossPerInstall * (1 - cfg.commission);
  const maxCpi = netPerInstall / cfg.targetRoas;
  const maxCpt = maxCpi * cfg.cr;
  const actualCpi = cfg.cpt / cfg.cr;
  const roas = netPerInstall / actualCpi;

  return { lines, bills, grossPerInstall, netPerInstall, maxCpi, maxCpt, actualCpi, roas };
}

const usd = (n) => `$${n.toFixed(n < 1 ? 3 : 2)}`;
const pct = (n) => `${(n * 100).toFixed(1)}%`;

function main() {
  const { cfg, overridden } = parseArgs(process.argv.slice(2));
  const prices = loadPrices();
  const r = model(cfg, prices);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ cfg, prices, ...r }, null, 2));
    return;
  }

  const unmeasured = Object.keys(DEFAULTS).filter(
    (k) => !overridden.has(k) && !['commission', 'horizonMonths', 'targetRoas'].includes(k)
  );

  console.log('\n  APPLE ADS UNIT ECONOMICS — Dynasty Manager');
  console.log('  ' + '─'.repeat(66));
  console.log(`  Horizon ${cfg.horizonMonths} months · Apple cut ${pct(cfg.commission)} · target ROAS ${cfg.targetRoas.toFixed(2)}x\n`);

  console.log('  Revenue per install');
  for (const l of r.lines) {
    console.log(`    ${l.label.padEnd(46)} ${usd(l.gross).padStart(8)}`);
  }
  console.log('    ' + '─'.repeat(55));
  console.log(`    ${'Gross per install'.padEnd(46)} ${usd(r.grossPerInstall).padStart(8)}`);
  console.log(`    ${`Net per install (after Apple's cut)`.padEnd(46)} ${usd(r.netPerInstall).padStart(8)}`);

  console.log('\n  Bid ceilings implied by that revenue');
  console.log(`    Max CPI at ${cfg.targetRoas.toFixed(2)}x ROAS                     ${usd(r.maxCpi).padStart(8)}`);
  console.log(`    Max CPT at ${pct(cfg.cr)} tap→install CR             ${usd(r.maxCpt).padStart(8)}`);

  console.log('\n  Against the CPT you are planning to pay');
  console.log(`    Planned CPT                                    ${usd(cfg.cpt).padStart(8)}`);
  console.log(`    → effective CPI at ${pct(cfg.cr)} CR                ${usd(r.actualCpi).padStart(8)}`);
  console.log(`    → ROAS at horizon                              ${(r.roas).toFixed(2).padStart(7)}x`);
  const verdict =
    r.roas >= cfg.targetRoas
      ? 'PAYS BACK — scale within the kill criteria.'
      : `LOSES MONEY — ${(cfg.cpt / r.maxCpt).toFixed(1)}x over the affordable bid.`;
  console.log(`    → verdict                                      ${verdict}`);

  console.log('\n  Sensitivity: max CPT by tap→install CR');
  const crs = [0.35, 0.45, 0.55, 0.65, 0.75];
  console.log('    CR      ' + crs.map((c) => pct(c).padStart(8)).join(''));
  console.log('    maxCPT  ' + crs.map((c) => usd(r.maxCpi * c).padStart(8)).join(''));

  console.log('\n  What has to be true to afford your planned CPT');
  const needed = cfg.cpt / cfg.cr / (1 - cfg.commission) / cfg.targetRoas;
  console.log(`    Gross revenue per install must reach           ${usd(needed).padStart(8)}`);
  console.log(`    That is ${(needed / r.grossPerInstall).toFixed(1)}x the modelled ${usd(r.grossPerInstall)}.`);

  if (unmeasured.length) {
    console.log('\n  ⚠ ASSUMED, NOT MEASURED — override before trusting this:');
    console.log('    ' + unmeasured.join(', '));
    console.log('    Source them from App Analytics (installs) + RevenueCat (conversions).');
  }
  console.log('');
}

main();
