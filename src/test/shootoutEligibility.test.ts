/**
 * Only players on the pitch at the final whistle take part in a shootout.
 * The taker pools read `club.lineup`, which keeps a sent-off player (the engine
 * never edits it on a red card) — so he could step up and take a kick.
 */
import { describe, it, expect } from 'vitest';
import { onPitchAtFinalWhistle } from '@/utils/penaltyShootout';
import type { MatchEvent } from '@/types/game';

const ev = (type: MatchEvent['type'], clubId: string, playerId: string, assistPlayerId?: string): MatchEvent =>
  ({ minute: 50, type, clubId, playerId, assistPlayerId, description: '' });

describe('onPitchAtFinalWhistle', () => {
  const xi = ['gk', 'a', 'b', 'c'];

  it('drops the sent off and the injured, applies substitutions in order', () => {
    const events = [
      ev('red_card', 'home', 'a'),
      ev('injury', 'home', 'b'),
      ev('substitution', 'home', 'b2', 'b'), // injured b replaced
      ev('substitution', 'home', 'c2', 'c'),
      ev('substitution', 'home', 'c3', 'c2'), // the sub himself subbed later
    ];
    expect(onPitchAtFinalWhistle(xi, events, 'home').sort()).toEqual(['b2', 'c3', 'gk']);
  });

  it('ignores the other side\'s events', () => {
    expect(onPitchAtFinalWhistle(xi, [ev('red_card', 'away', 'a')], 'home')).toEqual(xi);
  });

  it('is idempotent for a lineup live substitutions already rewrote', () => {
    const rewritten = ['gk', 'a', 'in', 'c'];
    expect(onPitchAtFinalWhistle(rewritten, [ev('substitution', 'home', 'in', 'b')], 'home').sort()).toEqual(['a', 'c', 'gk', 'in']);
  });
});
