/**
 * The name splitter every FC27 generator shares (`scripts/lib/playerName.mjs`).
 *
 * EA prints two names and they disagree on purpose: `short_name` is the label
 * on the card, `long_name` the full name. The old splitter read "EA labels him
 * with one word AND long_name starts with it" as proof of a mononym and emitted
 * `fn === ln` — right for Endrick, wrong for Alisson Becker and Gabriel
 * Magalhães, which are structurally identical. Each case below is a name that
 * shipped wrong, or that a fix for one of them would have broken.
 */
import { describe, it, expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain .mjs build script, no types
import { extractName } from '../../scripts/lib/playerName.mjs';

const render = (long: string, short: string, nat = '') => {
  const { fn, ln } = extractName(long, short, nat) as { fn: string; ln: string };
  return fn.toLowerCase() === ln.toLowerCase() ? fn : `${fn} ${ln}`;
};

describe('extractName', () => {
  it('recovers the family name EA does not print', () => {
    expect(render('Alisson Ramses Becker', 'Alisson', 'Brazil')).toBe('Alisson Becker');
    expect(render('Gabriel dos S. Magalhães', 'Gabriel', 'Brazil')).toBe('Gabriel Magalhães');
    expect(render('Rodrygo Silva de Goes', 'Rodrygo', 'Brazil')).toBe('Rodrygo Goes');
    expect(render('Brahim Díaz', 'Brahim', 'Morocco')).toBe('Brahim Díaz');
    expect(render('Kepa Arrizabalaga Revuelta', 'Kepa', 'Spain')).toBe('Kepa Arrizabalaga');
  });

  it('keeps the one name a player is actually known by', () => {
    // Structurally identical to the cases above — the difference is editorial
    // and lives in KEEP_MONONYM.
    for (const [long, short, nat] of [
      ['Rodrigo Hernández Cascante', 'Rodri', 'Spain'],
      ['Pedro González López', 'Pedri', 'Spain'],
      ['Raphael Dias Belloli', 'Raphinha', 'Brazil'],
      ['Sávio Moreira de Oliveira', 'Savinho', 'Brazil'],
      ['Endrick Felipe Moreira de Sousa', 'Endrick', 'Brazil'],
      ['Francisco Román Alarcón Suárez', 'Isco', 'Spain'],
    ] as const) {
      expect(render(long, short, nat), `${short} should stay a single name`).toBe(short);
    }
  });

  it('uses the paternal surname for Spanish-convention names', () => {
    // "Ayoze Pérez Gutiérrez" is Ayoze Pérez. Taking the last token — correct
    // for Portuguese and Brazilian names — gets the maternal surname instead.
    expect(render('Ayoze Pérez Gutiérrez', 'Ayoze', 'Spain')).toBe('Ayoze Pérez');
    expect(render('Alisson Ramses Becker', 'Alisson', 'Brazil')).toBe('Alisson Becker');
  });

  it('turns a bare generational suffix back into a name', () => {
    // EA labels him "Vini Jr."; the raw surname ("José de Oliveira Júnior") is
    // nobody's name, so the given name plus the suffix is the readable answer.
    expect(render('Vinícius José de Oliveira Júnior', 'Vini Jr.', 'Brazil')).toBe('Vinícius Júnior');
  });

  it('leaves the ordinary cases alone', () => {
    expect(render('Jude Victor William Bellingham', 'J. Bellingham', 'England')).toBe('Jude Bellingham');
    expect(render('Daniel Carvajal Ramos', 'Carvajal', 'Spain')).toBe('Daniel Carvajal');
    expect(render('Lautaro Javier Martínez', 'Lautaro Martínez', 'Argentina')).toBe('Lautaro Martínez');
    // "Senior" is this player's actual surname, not a generational suffix.
    expect(render('Joel Senior', 'Joel Senior', 'England')).toBe('Joel Senior');
  });
});
