import { describe, it, expect } from 'vitest';
import { selectResumeItem, type ResumeSignals } from '@/utils/resumeCard';

const none: ResumeSignals = {
  lineupIncomplete: false,
  incomingOffers: 0,
  unplayedMatchThisWeek: false,
  expiringStarContract: false,
};

describe('selectResumeItem', () => {
  it('returns null when nothing is pending', () => {
    expect(selectResumeItem(none)).toBeNull();
  });

  it('prioritises an incomplete lineup above everything', () => {
    const item = selectResumeItem({ ...none, lineupIncomplete: true, incomingOffers: 3, unplayedMatchThisWeek: true, expiringStarContract: true });
    expect(item?.reason).toBe('lineup');
    expect(item?.screen).toBe('tactics');
  });

  it('picks a pending transfer offer when the lineup is set', () => {
    const item = selectResumeItem({ ...none, incomingOffers: 2, unplayedMatchThisWeek: true, expiringStarContract: true });
    expect(item?.reason).toBe('offer');
    expect(item?.screen).toBe('transfers');
    expect(item?.description).toContain('2 offers');
  });

  it('routes an unplayed match to match prep', () => {
    const item = selectResumeItem({ ...none, unplayedMatchThisWeek: true, expiringStarContract: true });
    expect(item?.reason).toBe('match');
    expect(item?.screen).toBe('match-prep');
  });

  it('falls back to an expiring star contract → squad', () => {
    const item = selectResumeItem({ ...none, expiringStarContract: true });
    expect(item?.reason).toBe('contract');
    expect(item?.screen).toBe('squad');
  });

  it('singularises the offer copy for exactly one offer', () => {
    const item = selectResumeItem({ ...none, incomingOffers: 1 });
    expect(item?.description).toContain('1 offer');
    expect(item?.description).not.toContain('offers');
  });
});
