/**
 * Integrity of the generated community pack (src/data/communityPack/byClub.ts).
 *
 * Every assertion here corresponds to a defect that actually reached the
 * generated data at some point while building it from FC27, and that no
 * existing test caught:
 *
 *  - Whole clubs vanished because EA names them differently (Bayern Munich
 *    ships as "FC Bayern München") or not at all (Inter Milan is "Lombardia
 *    FC", an unlicensed placeholder). Losing Bayern loses Kane and Musiala.
 *  - Two EA clubs collided onto one game club, giving Tigre a 60-man squad
 *    built from itself plus Atlético Nacional.
 *  - `pot` arrived below `ovr` from a carried-over potential, which is
 *    meaningless to a development model driven by the ovr->pot gap.
 *  - Mononyms rendered doubled ("Rodri Rodri") from a naive name split.
 */
import { describe, it, expect } from 'vitest';
import { byClub } from '@/data/communityPack/byClub';
import { ALL_CLUBS } from '@/data/league';
import { NATIONS } from '@/data/nations';

const clubIds = new Set(ALL_CLUBS.map((c) => c.id));
const squads = Object.entries(byClub);
const players = squads.flatMap(([, s]) => s);

describe('community pack integrity', () => {
  it('routes every squad to a club the game actually ships', () => {
    const unknown = squads.map(([id]) => id).filter((id) => !clubIds.has(id));
    expect(unknown, `unknown club ids: ${unknown.join(', ')}`).toEqual([]);
  });

  it('gives no club an impossible squad — the signature of two clubs colliding', () => {
    // A real squad is ~14-38. Anything near double that means two EA clubs
    // resolved to the same game club and were silently merged.
    const oversized = squads.filter(([, s]) => s.length > 45).map(([id, s]) => `${id}=${s.length}`);
    expect(oversized, `oversized squads: ${oversized.join(', ')}`).toEqual([]);
  });

  it('gives every covered club enough players to field a team', () => {
    const thin = squads.filter(([, s]) => s.length < 11).map(([id, s]) => `${id}=${s.length}`);
    expect(thin, `squads under 11: ${thin.join(', ')}`).toEqual([]);
  });

  it('keeps the marquee clubs — losing one loses its stars', () => {
    // Each of these went missing at least once while the club matching was
    // being built, and each takes a household name down with it.
    const required = [
      'bayern-munich', 'inter-milan', 'real-madrid', 'barcelona', 'liverpool',
      'manchester-city', 'arsenal', 'paris-saint-germain', 'tottenham-hotspur',
    ];
    const missing = required.filter((id) => !byClub[id]?.length);
    expect(missing, `marquee clubs with no players: ${missing.join(', ')}`).toEqual([]);
  });

  it('never lets a player appear at two clubs', () => {
    const ids = players.map((p) => p.fcId).filter(Boolean);
    expect(ids.length - new Set(ids).size).toBe(0);
  });

  it('emits usable ratings on every player', () => {
    const bad = players.filter(
      (p) => !Number.isFinite(p.ovr) || !Number.isFinite(p.pot) || p.ovr < 1 || p.ovr > 99,
    );
    expect(bad.map((p) => `${p.fn} ${p.ln}`)).toEqual([]);
  });

  it('never gives a player a ceiling below their current ability', () => {
    const bad = players.filter((p) => Number.isFinite(p.pot) && p.pot < p.ovr);
    expect(bad.map((p) => `${p.fn} ${p.ln} ${p.ovr}/${p.pot}`)).toEqual([]);
  });

  it('fills the fields squad generation reads', () => {
    const bad = players.filter((p) => !p.nat || !p.pos || !Number.isFinite(p.age));
    expect(bad.map((p) => `${p.fn} ${p.ln}`)).toEqual([]);
  });

  it('keeps doubled mononym names rare rather than routine', () => {
    // fn === ln is the intended shape for a true mononym (Rodrygo, Alisson),
    // but a naive last-space split produced 427 of them — every player EA
    // labels with a single common name. The correct splitter recovers the real
    // given name from the long name, leaving only genuine mononyms.
    const doubled = players.filter((p) => p.fn === p.ln);
    expect(doubled.length / players.length).toBeLessThan(0.02);
  });

  it('uses the nation names the game selects national squads by', () => {
    // international.ts filters with `nats.has(p.nationality)` — an exact match.
    // EA writes "Holland", "Korea Republic", "United States"; the game's
    // nations are "Netherlands", "South Korea", "USA". Importing EA's labels
    // verbatim makes those players unpickable for their own country.
    const gameNations = new Set(NATIONS.map((n) => n.name));
    // "Turkey" and "Czech Republic" are deliberately absent from this list:
    // nations.ts carries BOTH spellings of each as separate nations, and the
    // in-game label is EA's spelling, so mapping them would move players to
    // the wrong one of the two duplicate entries. See lib/nationality.mjs.
    const broken = ['Holland', 'Korea Republic', 'United States',
      'Republic of Ireland', "Côte d'Ivoire", 'Congo DR'];
    const present = broken.filter((label) => players.some((p) => p.nat === label));
    expect(present, `un-canonicalised nationality labels in the pack: ${present.join(', ')}`).toEqual([]);

    // And the big footballing nations must actually resolve.
    for (const nation of ['Netherlands', 'South Korea', 'USA', 'Ireland', 'Ivory Coast']) {
      expect(gameNations.has(nation), `${nation} missing from NATIONS`).toBe(true);
      expect(players.filter((p) => p.nat === nation).length,
        `no players carry nationality "${nation}"`).toBeGreaterThan(0);
    }
  });
});
