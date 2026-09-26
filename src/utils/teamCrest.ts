import { TEAM_CRESTS } from '@/data/teamCrests';

/** Exact catalog identity only: names and country IDs must never select a club crest. */
export function getTeamCrest(clubId?: string | null): string | null {
  return clubId && Object.prototype.hasOwnProperty.call(TEAM_CRESTS, clubId)
    ? TEAM_CRESTS[clubId] : null;
}
