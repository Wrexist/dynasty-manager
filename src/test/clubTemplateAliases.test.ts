import { describe, it, expect } from 'vitest';
import { CLUB_TEMPLATE_ALIASES, resolveSquadKey } from '@/data/clubTemplateAliases';
import { CLUB_TEMPLATES } from '@/data/playerTemplates';
import { ALL_CLUBS } from '@/data/league';

describe('clubTemplateAliases', () => {
  it('every alias target resolves to a real CLUB_TEMPLATES entry', () => {
    for (const [leagueId, squadKey] of Object.entries(CLUB_TEMPLATE_ALIASES)) {
      expect(CLUB_TEMPLATES[squadKey], `alias ${leagueId} → ${squadKey} has no matching CLUB_TEMPLATES entry`).toBeDefined();
    }
  });

  it('every alias key is a real league club id', () => {
    const validClubIds = new Set(ALL_CLUBS.map(c => c.id));
    for (const leagueId of Object.keys(CLUB_TEMPLATE_ALIASES)) {
      expect(validClubIds.has(leagueId), `alias key '${leagueId}' does not match any league club id`).toBe(true);
    }
  });

  it('resolveSquadKey returns the alias when present, else the id itself', () => {
    expect(resolveSquadKey('bodo-glimt')).toBe('fk-bodglimt');
    expect(resolveSquadKey('fredrikstad')).toBe('fredrikstad-fk');
    expect(resolveSquadKey('arsenal')).toBe('arsenal');
    expect(resolveSquadKey('club-without-template')).toBe('club-without-template');
  });
});
