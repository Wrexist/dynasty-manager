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
  });

  describe('getCardNameFontSizeClass', () => {
    it('uses 9px for names up to 4 chars', () => {
      expect(getCardNameFontSizeClass('Dias')).toBe('text-[9px]');
      expect(getCardNameFontSizeClass('Kane')).toBe('text-[9px]');
    });

    it('uses 8px for 5-6 char names', () => {
      expect(getCardNameFontSizeClass('Silva')).toBe('text-[8px]');
      expect(getCardNameFontSizeClass('Bruyne')).toBe('text-[8px]');
    });

    it('uses 7px for 7-8 char names', () => {
      expect(getCardNameFontSizeClass('Haaland')).toBe('text-[7px]');
      expect(getCardNameFontSizeClass('Alvarez8')).toBe('text-[7px]');
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
