# Roster audit coverage — 9 September 2026

Source coverage is not a completed real-world squad audit. All club rosters still need reconciliation against an independent current squad list.

Every one of the 756 game clubs and 45 leagues is inventoried in `data/transfers/coverage-2026.json`. 173 reviewed moves include 51 loans; 17 free agents are confirmed.

| Country | Division | Clubs with EA source / game clubs | Independently completed squad audits |
|---|---|---:|---:|
| England | Premier League | 20/20 | 0 |
| England | EFL Championship | 24/24 | 0 |
| England | EFL League One | 24/24 | 0 |
| England | EFL League Two | 22/24 | 0 |
| Spain | La Liga | 20/20 | 0 |
| Spain | La Liga 2 | 18/22 | 0 |
| Italy | Serie A | 20/20 | 0 |
| Italy | Serie B | 16/20 | 0 |
| Germany | Bundesliga | 18/18 | 0 |
| Germany | 2. Bundesliga | 17/18 | 0 |
| Germany | 3. Liga | 16/20 | 0 |
| France | Ligue 1 | 18/18 | 0 |
| France | Ligue 2 | 14/18 | 0 |
| Netherlands | Eredivisie | 15/18 | 0 |
| Portugal | Primeira Liga | 16/18 | 0 |
| Belgium | Pro League | 13/16 | 0 |
| Turkey | Süper Lig | 15/19 | 0 |
| Czechia | Czech First League | 1/16 | 0 |
| Greece | Super League Greece | 4/14 | 0 |
| Poland | Ekstraklasa | 13/18 | 0 |
| Denmark | Superliga | 9/12 | 0 |
| Norway | Eliteserien | 13/16 | 0 |
| Switzerland | Super League | 11/12 | 0 |
| Austria | Bundesliga | 10/12 | 0 |
| Scotland | Scottish Premiership | 10/12 | 0 |
| Sweden | Allsvenskan | 14/16 | 0 |
| Croatia | Hrvatska Nogometna Liga | 2/10 | 0 |
| Hungary | Nemzeti Bajnokság I | 1/12 | 0 |
| Serbia | SuperLiga | 0/16 | 0 |
| Romania | Liga 1 | 12/16 | 0 |
| Ukraine | Ukrainian Premier League | 2/16 | 0 |
| Bulgaria | First Professional Football League | 2/16 | 0 |
| Slovakia | Fortuna Liga | 1/12 | 0 |
| Finland | Veikkausliiga | 1/12 | 0 |
| Iceland | Úrvalsdeild | 0/12 | 0 |
| Ireland | League of Ireland Premier Division | 9/10 | 0 |
| Israel | Israeli Premier League | 0/14 | 0 |
| Cyprus | Cypriot First Division | 1/14 | 0 |
| Argentina | Liga Profesional | 30/30 | 0 |
| United States | Major League Soccer | 30/30 | 0 |
| Saudi Arabia | Saudi Pro League | 18/18 | 0 |
| South Korea | K League 1 | 12/12 | 0 |
| Brazil | Brasileirão Série A | 0/14 | 0 |
| Australia | A-League Men | 12/13 | 0 |
| India | Indian Super League | 11/14 | 0 |

## Outstanding work

- Obtain dated full squad lists for the remaining verification. An EA identity or one reviewed transfer does not validate the whole squad.
- Four top-division memberships have been updated (England, Spain, Germany, Italy). Lower divisions and other countries still require membership review. France also needs new club records, including Le Mans.
- Resolve missing identities using a documented supplemental source; do not manufacture football attributes.
- Loan parent clubs are implemented. Undisclosed terms use one game season, 100% borrower wages and no recall/automatic purchase; these are simulation defaults. Reported options/obligations remain in the evidence ledger until exact fees and conditions are verified.
- Current roster updates apply to new real-player careers, including the foreign game world. Existing careers retain their history.

Regenerate with `npm run fc27:audit` after changing the ledger or generated squads.
