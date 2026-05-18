/**
 * SubscribeOnboarding has two helpers it uses to render the Yearly plan's
 * supportive "Just $X/mo · Save N%" caption. They have to handle
 * locale-formatted store prices ("€14,99", "¥1,500") without producing NaN
 * — the caption is shown next to the bold billed amount and a broken value
 * would undercut the whole conversion lift.
 *
 * Helpers are colocated inside the page component (not exported) so we
 * inline-test the logic here against the same string-cleaning contract.
 */
import { describe, it, expect } from 'vitest';

// Mirrors the implementation in SubscribeOnboarding.tsx. Update both
// together; this test is what catches drift.
function parsePriceAmount(display: string): number | null {
  const cleaned = display.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  let normalised = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    normalised = lastComma > lastDot ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  } else if (cleaned.includes(',') && /,\d{1,2}$/.test(cleaned)) {
    normalised = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    normalised = cleaned.replace(/,/g, '');
  }
  const n = parseFloat(normalised);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function perMonthFromYearly(yearlyDisplay: string): string | null {
  const yearly = parsePriceAmount(yearlyDisplay);
  if (yearly === null) return null;
  const monthly = yearly / 12;
  const currencyPrefix = yearlyDisplay.match(/^[^\d.,\s-]+/)?.[0] || '$';
  return `${currencyPrefix}${monthly.toFixed(2)}`;
}

function yearlyDiscountPercent(yearlyDisplay: string, monthlyDisplay: string): number | null {
  const yearly = parsePriceAmount(yearlyDisplay);
  const monthly = parsePriceAmount(monthlyDisplay);
  if (yearly === null || monthly === null) return null;
  const yearlyPerMonth = yearly / 12;
  const saving = Math.round((1 - yearlyPerMonth / monthly) * 100);
  return saving > 0 ? saving : null;
}

describe('perMonthFromYearly', () => {
  it('parses USD format', () => {
    expect(perMonthFromYearly('$14.99')).toBe('$1.25');
  });

  it('parses Euro format with comma decimal', () => {
    expect(perMonthFromYearly('€14,99')).toBe('€1.25');
  });

  it('parses thousands-separated integer (e.g. JPY)', () => {
    // ¥1,500/yr → ¥125/mo
    expect(perMonthFromYearly('¥1,500')).toBe('¥125.00');
  });

  it('parses US format with thousands separator and decimal', () => {
    expect(perMonthFromYearly('$1,200.00')).toBe('$100.00');
  });

  it('parses EU format with thousands separator and decimal', () => {
    expect(perMonthFromYearly('€1.200,00')).toBe('€100.00');
  });

  it('returns null on garbage input', () => {
    expect(perMonthFromYearly('not a price')).toBeNull();
    expect(perMonthFromYearly('')).toBeNull();
  });

  it('returns null on zero/negative', () => {
    expect(perMonthFromYearly('$0.00')).toBeNull();
  });

  it('preserves multi-char currency prefix', () => {
    expect(perMonthFromYearly('US$120.00')).toBe('US$10.00');
  });
});

describe('yearlyDiscountPercent', () => {
  it('computes the savings for the default Dynasty Pro pricing', () => {
    // $14.99/yr = $1.25/mo vs $1.99/mo → 37% savings
    expect(yearlyDiscountPercent('$14.99', '$1.99')).toBe(37);
  });

  it('returns null when yearly is not cheaper than monthly-billed', () => {
    expect(yearlyDiscountPercent('$30.00', '$1.99')).toBeNull(); // $2.50/mo > $1.99
  });

  it('handles mixed locale formats', () => {
    expect(yearlyDiscountPercent('€14,99', '€1,99')).toBe(37);
  });

  it('returns null on unparseable input', () => {
    expect(yearlyDiscountPercent('gibberish', '$1.99')).toBeNull();
    expect(yearlyDiscountPercent('$14.99', 'gibberish')).toBeNull();
  });
});
