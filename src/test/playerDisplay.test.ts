import { describe, it, expect } from 'vitest';
import { getPlayerDisplayName, getCardNameFontSizeClass } from '@/utils/playerDisplay';

describe('playerDisplay', () => {
  describe('getPlayerDisplayName', () => {
    it('returns the full single-word surname', () => {
      expect(getPlayerDisplayName({ firstName: 'Erling', lastName: 'Haaland' })).toBe('Haaland');
      expect(getPlayerDisplayName({ firstName: 'Kyle', lastName: 'Walker' })).toBe('Walker');
      expect(getPlayerDisplayName({ firstName: 'Phil', lastName: 'Foden' })).toBe('Foden');
    });

    it('returns the last word of multi-word surnames', () => {
      expect(getPlayerDisplayName({ firstName: 'Kevin', lastName: 'De Bruyne' })).toBe('Bruyne');
      expect(getPlayerDisplayName({ firstName: 'Virgil', lastName: 'Van Dijk' })).toBe('Dijk');
      expect(getPlayerDisplayName({ firstName: 'Alessandro', lastName: 'Del Piero' })).toBe('Piero');
    });

    it('collapses internal whitespace', () => {
      expect(getPlayerDisplayName({ firstName: 'Kevin', lastName: '  De   Bruyne  ' })).toBe('Bruyne');
    });

    it('falls back to firstName when lastName is empty', () => {
      expect(getPlayerDisplayName({ firstName: 'Ronaldinho', lastName: '' })).toBe('Ronaldinho');
      expect(getPlayerDisplayName({ firstName: 'Pelé', lastName: '   ' })).toBe('Pelé');
    });

    it('filters suffix-only lastNames and falls back to firstName', () => {
      // Matches the real data pattern for Vini Jr. (fn: 'Vini', ln: 'Jr.')
      expect(getPlayerDisplayName({ firstName: 'Vini', lastName: 'Jr.' })).toBe('Vini');
      expect(getPlayerDisplayName({ firstName: 'Vini', lastName: 'Jr' })).toBe('Vini');
      expect(getPlayerDisplayName({ firstName: 'Rafael', lastName: 'II' })).toBe('Rafael');
      expect(getPlayerDisplayName({ firstName: 'Henry', lastName: 'III' })).toBe('Henry');
    });

    it('strips suffix tokens from compound surnames', () => {
      expect(getPlayerDisplayName({ firstName: 'John', lastName: 'Smith Jr.' })).toBe('Smith');
      expect(getPlayerDisplayName({ firstName: 'Rafael', lastName: 'dos Santos Jr.' })).toBe('Santos');
    });

    it('preserves unicode and accent marks', () => {
      expect(getPlayerDisplayName({ firstName: 'José', lastName: 'Martínez' })).toBe('Martínez');
      expect(getPlayerDisplayName({ firstName: 'Zoë', lastName: 'Søren' })).toBe('Søren');
    });

    it('returns last word of particle-prefixed surnames', () => {
      expect(getPlayerDisplayName({ firstName: 'Virgil', lastName: 'van der Berg' })).toBe('Berg');
      expect(getPlayerDisplayName({ firstName: 'Rogério', lastName: 'dos Santos' })).toBe('Santos');
    });
  });

  describe('getCardNameFontSizeClass', () => {
    it('uses 8px for names up to 4 chars', () => {
      expect(getCardNameFontSizeClass('Dias')).toBe('text-[8px]');
      expect(getCardNameFontSizeClass('Kane')).toBe('text-[8px]');
    });

    it('uses 7px for 5-6 char names', () => {
      expect(getCardNameFontSizeClass('Silva')).toBe('text-[7px]');
      expect(getCardNameFontSizeClass('Bruyne')).toBe('text-[7px]');
    });

    it('uses 6.5px for 7-8 char names', () => {
      expect(getCardNameFontSizeClass('Haaland')).toBe('text-[6.5px]');
      expect(getCardNameFontSizeClass('Alvarez8')).toBe('text-[6.5px]');
    });

    it('uses 6px for 9-10 char names', () => {
      expect(getCardNameFontSizeClass('Oyarzabal')).toBe('text-[6px]');
      expect(getCardNameFontSizeClass('Guardiola0')).toBe('text-[6px]');
    });

    it('uses 5.5px for very long names', () => {
      expect(getCardNameFontSizeClass('Guardiolaaa')).toBe('text-[5.5px]');
    });
  });
});
