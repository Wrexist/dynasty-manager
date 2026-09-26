/**
 * 44px tap targets (playthrough 2026-09, R4).
 *
 * Measured at 390x844 in real Chromium, these controls were under Apple's
 * 44pt minimum: the top-bar level chip (35x16), the Starter Kit dismiss
 * (30x30), the title screen's delete-slot button (32x32), the Club Selection
 * and Mode Select back buttons (32 and 36 tall), the paywall's Restore /
 * Terms / Privacy links (17 tall — Apple-required links), the match speed
 * chips (23), the key-moment "Customize tactics manually…" (23), "Make
 * Substitution" (32–40), "Continue Match" (36), the half-time plan chips (33),
 * "Fine-tune tactics" (27), the Match Review filters (18), the transfer filter
 * chips (19) and Make Offer (32), the Settings switches (44x24) and the Shop's
 * "View all N items" (15).
 *
 * jsdom has no layout, so this pins the sizing CLASSES: each control's own
 * className must carry a 44px minimum (min-h-11 / h-11 / w-11 …). The source
 * check finds the opening tag of the element that contains an anchor and reads
 * that element's className — a nested child's className does not count.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cleanup, render, screen } from '@testing-library/react';
import { MatchSpeedPicker } from '@/components/matchday/MatchSpeedPicker';
import { MATCH_SPEEDS } from '@/config/matchSpeed';

afterEach(cleanup);

const HEIGHT_44 = /(^|\s)(min-h-11|h-11|min-h-\[44px\]|h-\[44px\]|h-12|min-h-12)(\s|$)/;
const WIDTH_44 = /(^|\s)(min-w-11|w-11|min-w-\[44px\]|w-\[44px\]|w-full|flex-1)(\s|$)/;

function source(rel: string): string {
  return readFileSync(resolve(__dirname, '..', rel), 'utf8');
}

/** The className text of the element whose opening tag precedes `index`. */
function classNameOfTagBefore(src: string, index: number): string {
  const tagRe = /<(button|Button|motion\.button)\b/g;
  let start = -1;
  for (let m = tagRe.exec(src); m && m.index < index; m = tagRe.exec(src)) start = m.index;
  if (start < 0) throw new Error('no button before anchor');
  const at = src.indexOf('className=', start);
  if (at < 0) throw new Error('button has no className');
  let i = at + 'className='.length;
  if (src[i] === '"') return src.slice(i + 1, src.indexOf('"', i + 1));
  if (src[i] !== '{') throw new Error('unexpected className form');
  let depth = 0;
  const from = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return src.slice(from, i + 1).replace(/['"`,()]/g, ' ');
}

/** Every occurrence of `anchor` in `file` sits inside a 44px-tall control. */
function expect44(file: string, anchor: string, opts: { width?: boolean; count?: number } = {}) {
  const src = source(file);
  const hits: number[] = [];
  for (let at = src.indexOf(anchor); at >= 0; at = src.indexOf(anchor, at + 1)) hits.push(at);
  expect(hits.length, `${file}: anchor not found: ${anchor}`).toBeGreaterThan(0);
  if (opts.count != null) expect(hits.length, `${file}: ${anchor}`).toBe(opts.count);
  for (const at of hits) {
    const cls = classNameOfTagBefore(src, at);
    expect(cls, `${file} "${anchor}" is under 44px tall: ${cls}`).toMatch(HEIGHT_44);
    if (opts.width) expect(cls, `${file} "${anchor}" is under 44px wide: ${cls}`).toMatch(WIDTH_44);
  }
}

describe('44px tap targets — the controls the playthrough measured', () => {
  it('top bar: the level / reputation chip', () => {
    // Width too: at Lv.1 the chip measured 43px wide once it was 44 tall.
    expect44('components/game/TopBar.tsx', 'Lv.{managerProgression.level}', { width: true });
    expect44('components/game/TopBar.tsx', "onClick={() => setScreen('career-overview')}", { width: true });
  });

  it('dashboard banners: the Starter Kit and live-event dismiss buttons', () => {
    expect44('components/game/StarterKitBanner.tsx', 'aria-label="Dismiss starter kit offer"', { width: true });
    expect44('components/game/FestivalBanner.tsx', "aria-label={t('festivalBanner.dismissFestivalBanner')}", { width: true });
  });

  it('title, club selection and mode select: delete-slot and back buttons', () => {
    expect44('pages/TitleScreen.tsx', 'aria-label={`Delete save slot', { width: true });
    expect44('pages/ClubSelection.tsx', 'aria-label={backLabel}', { width: true });
    expect44('pages/ModeSelect.tsx', '<ArrowLeft className="w-4 h-4" /> Back');
  });

  it('paywall: Restore Purchases, Terms of Use and Privacy Policy (Apple-required links)', () => {
    expect44('pages/SubscribeOnboarding.tsx', "{restoring ? 'Restoring…' : 'Restore Purchases'}");
    expect44('pages/SubscribeOnboarding.tsx', 'Terms of Use\n          </button>');
    expect44('pages/SubscribeOnboarding.tsx', 'Privacy Policy\n          </button>');
  });

  it('match day: key moment, half-time plan chips, fine-tune, substitutions, continue', () => {
    expect44('pages/MatchDay.tsx', "'Customize tactics manually...'", { count: 1 });
    expect44('pages/MatchDay.tsx', "'Fine-tune tactics...'", { count: 2 });
    expect44('pages/MatchDay.tsx', '<RefreshCw className="w-3 h-3" /> Make Substitution');
    expect44('pages/MatchDay.tsx', '<RefreshCw className="w-4 h-4" /> Make Substitution', { count: 3 });
    expect44('pages/MatchDay.tsx', 'Continue Match', { count: 1 });
    // The half-time plan chips ("Protect the Lead", "Fresh Energy", …).
    expect44('pages/MatchDay.tsx', 'setSelectedHalftimePreset(choice.label);');
  });

  it('match day: every speed chip', () => {
    render(<MatchSpeedPicker speed={MATCH_SPEEDS[0].value} userIsPro={false} onSelect={() => {}} onLockedSelect={() => {}} />);
    const chips = screen.getAllByRole('button');
    expect(chips).toHaveLength(MATCH_SPEEDS.length);
    for (const chip of chips) {
      expect(chip.className).toMatch(HEIGHT_44);
      expect(chip.className).toMatch(/min-w-11/);
    }
  });

  it('match review: the highlight filters', () => {
    expect44('pages/MatchReview.tsx', 'aria-pressed={highlightFilter === f}');
  });

  it('transfers: position / division / price / sort chips and Make Offer', () => {
    expect44('pages/TransferPage.tsx', 'aria-label={`Filter by ${f.label');
    expect44('pages/TransferPage.tsx', 'aria-label={`Filter by ${d.label}`}');
    expect44('pages/TransferPage.tsx', "aria-label={hideUnaffordable ? 'Show all prices' : 'Hide unaffordable'}");
    expect44('pages/TransferPage.tsx', 'aria-label={`Sort by');
    expect44('pages/TransferPage.tsx', "{squadFull ? 'Squad Full' : 'Make Offer'}");
    expect44('pages/TransferPage.tsx', "aria-label={inShortlist ? 'Remove from shortlist' : 'Add to shortlist'}", { width: true });
  });

  it('settings: every switch is a 44x44 target, not the 44x24 track', () => {
    expect44('pages/SettingsPage.tsx', 'role="switch"', { width: true });
  });

  it('shop: "View all N items" and the legal links', () => {
    expect44('pages/ShopPage.tsx', '`View all ${packItems.length} items`');
    expect44('pages/ShopPage.tsx', 'Terms of Service\n          </button>');
    expect44('pages/ShopPage.tsx', 'Privacy Policy\n          </button>');
  });
});
