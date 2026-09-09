import { readFileSync, writeFileSync } from 'node:fs';
import { ALL_CLUBS, LEAGUES } from '@/data/league';
import { byClub } from '@/data/communityPack/byClub';
import { cpLeagueSquads } from '@/data/communityPack/cpLeagueSquads';
import { freeAgents } from '@/data/communityPack/freeAgents';
import { confirmedFreeAgents } from '@/data/communityPack/confirmedFreeAgents';
import { mergeRosterTemplates } from '@/utils/mergeRosterTemplates';

const ledger = JSON.parse(readFileSync('data/transfers/summer-2026.json', 'utf8'));
const squads = mergeRosterTemplates(cpLeagueSquads, byClub, [...freeAgents, ...confirmedFreeAgents]);
const clubs = ALL_CLUBS.map(club => ({
  id: club.id, name: club.name, leagueId: club.divisionId,
  sourcePlayers: byClub[club.id]?.length ?? 0,
  communityFallbackPlayers: byClub[club.id] ? 0 : (squads[club.id]?.length ?? 0),
  reviewedArrivals: ledger.transfers.filter(t => t.toClubId === club.id).length,
  fullRosterVerified: false,
}));
const leagues = LEAGUES.map(league => {
  const members = clubs.filter(c => c.leagueId === league.id);
  return { id: league.id, name: league.name, country: league.country, clubs: members.length,
    sourceCovered: members.filter(c => c.sourcePlayers > 0).length,
    fullRostersVerified: members.filter(c => c.fullRosterVerified).length };
});
const report = { asOf: ledger.asOf,
  meaning: 'Source coverage is not a completed real-world squad audit. All club rosters still need reconciliation against an independent current squad list.',
  reviewedMoves: ledger.transfers.filter(t => t.kind !== 'free-agent').length,
  reviewedLoans: ledger.transfers.filter(t => t.kind === 'loan').length,
  confirmedFreeAgents: confirmedFreeAgents.length, unresolvedIdentities: ledger.unresolved,
  leagues, clubs };
writeFileSync('data/transfers/coverage-2026.json', JSON.stringify(report, null, 2) + '\n');
const lines = ['# Roster audit coverage — 9 September 2026', '', report.meaning, '',
  `Every one of the ${clubs.length} game clubs and ${leagues.length} leagues is inventoried in \`data/transfers/coverage-2026.json\`. ${report.reviewedMoves} reviewed moves include ${report.reviewedLoans} loans; ${report.confirmedFreeAgents} free agents are confirmed.`, '',
  '| Country | Division | Clubs with EA source / game clubs | Independently completed squad audits |',
  '|---|---|---:|---:|',
  ...leagues.map(l => `| ${l.country} | ${l.name} | ${l.sourceCovered}/${l.clubs} | ${l.fullRostersVerified} |`), '',
  '## Outstanding work', '',
  '- Obtain dated full squad lists for the remaining verification. An EA identity or one reviewed transfer does not validate the whole squad.',
  '- Four top-division memberships have been updated (England, Spain, Germany, Italy). Lower divisions and other countries still require membership review. France also needs new club records, including Le Mans.',
  '- Resolve missing identities using a documented supplemental source; do not manufacture football attributes.',
  '- Loan parent clubs are implemented. Undisclosed terms use one game season, 100% borrower wages and no recall/automatic purchase; these are simulation defaults. Reported options/obligations remain in the evidence ledger until exact fees and conditions are verified.',
  '- Current roster updates apply to new real-player careers, including the foreign game world. Existing careers retain their history.', '',
  'Regenerate with `npm run fc27:audit` after changing the ledger or generated squads.', ''];
writeFileSync('docs/roster-audit-2026.md', lines.join('\n'));
console.log(`Audited source coverage for ${clubs.length} clubs / ${leagues.length} leagues; ${report.reviewedLoans} reviewed loans.`);
