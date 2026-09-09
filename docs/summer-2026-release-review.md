# Summer 2026 roster update and release review

Reviewed 9 September 2026. Local branch: `codex/summer-2026-release-readiness`.

## Release decision

**Do not describe this build as a complete 2026/27 database refresh yet.** The reviewed changes are implemented, but all 45 leagues have not been audited. Native release verification also remains outstanding.

## Implemented

- Refreshed the complete public EA endpoint snapshot: 17,873 identities, including 16,228 male players. Preserved explicitly labelled older potential values; no new ratings were invented. The endpoint accepted the generic `ea-sports-fc` slug, so this is not proof that EA has published a separate FC27 ratings release.
- Applied 173 reviewed club moves and 17 verified free-agent records through `data/transfers/summer-2026.json`. Each record has a stable player identity, destination/status, source and verification date. The 51 reviewed loans now initialize active loan agreements and parent-club ownership.
- Loan details identify the parent club, temporary playing club and scheduled in-game return. Borrowing clubs cannot renew the parent contract. Parent clubs are initialized when necessary so return processing has a valid destination. Loan badges remain visible alongside injuries.
- Foreign living-world clubs now use the updated real-player templates when the community pack is enabled. Updated top-division membership in England, Spain, Germany and Italy; other countries and lower divisions still require review.
- Added a reproducible coverage inventory for all 756 clubs: [roster audit](roster-audit-2026.md). This inventories gaps; it does not certify every current squad. The supplied Kaggle dataset was checked and predates summer 2026, so it does not resolve the remaining current-squad gaps.
- Generated 13,668 players at 535 clubs. The 2,444 unresolved/external-club players remain a separate pool and are no longer treated as proof of real-world free-agent status at career creation.
- New real-player careers seed all 17 reviewed free agents into Market → Free Agents. They are absent from club squads and paid external listings. Existing signing bonuses, wage negotiations and reputation restrictions still apply. Existing careers retain their simulated history.
- Prevented transferred/free-agent identities from remaining in older fallback community squads.
- Fixed Windows script entry detection, executable-script line endings and the portable fast-test command.
- Added pending release notes; updated the counted test-file claims in CLAUDE.md.

## Source choice

For a readable summer transfer overview, use [Sky Sports' confirmed summer deals](https://www.skysports.com/football/news/11095/13546618/transfer-news-summer-transfer-window-2026-premier-league-deals-ins-and-outs) and [deadline-day deals](https://www.skysports.com/football/news/12691/13579708/transfer-deadline-day-deals-summer-2026-confirmed-moves-across-premier-league-championship-efl-europe-and-more). They are useful starting points, but do not cover every game league. Prefer club and league announcements when accounts disagree; the ledger also uses Bundesliga, Serie A, Ligue 1 and individual clubs.

For current unattached players, [Sky's 4 September list](https://www.skysports.com/transfer/news/11096/13580813/free-agents-jadon-sancho-paul-pogba-and-dele-alli-among-players-available-on-free-transfer-after-summer-window-shuts) and [Mundo Deportivo's 6 September list](https://www.mundodeportivo.com/futbol/fichajes/20260906/1004223700/jugadores-siguen-libres-vez-finalizado-mercado.html) provide dated evidence. Later confirmations override those lists: [Diogo Leite signed for Lazio on 8 September](https://www.abola.pt/noticias/mercado-oficial-diogo-leite-junta-se-a-nuno-tavares-na-lazio-2026090819381335057), so he is assigned to Lazio.

Transfermarkt has a broad free-agent overview, but access returned HTTP 403 during this review. No data was imported from the blocked page. No single checked source establishes complete coverage of all 756 game clubs.

## Remaining data work before a fully current release

| Priority | Finding | Required work |
|---|---|---|
| High | Only 535/756 clubs have current source coverage; only 11/45 leagues have every club covered | Audit the remaining rosters with dated squad lists. Fallback squads remain older data. Coverage is not a guarantee that every transfer at a covered club is correct. |
| High | Membership outside the four reviewed top divisions still needs review | Verify remaining promotions/relegations, including France and missing Le Mans, then lower divisions. Keep league sizes and fixtures consistent. |
| High | Missing reviewed identities | Resolve the ledger's `unresolved` entries. Six reported free agents are absent from the current EA snapshot: Neto, Sergio Ramos, Dele Alli, Philippe Coutinho, James Rodríguez and Jamie Vardy. Do not create invented attributes or match a different player with the same surname. |
| Medium | Some real loan terms are unpublished | Parent ownership and return behavior are implemented. Initial loans use one game season, 100% borrower wages and no recall as simulation defaults. Exact dates and purchase clauses are preserved in the evidence ledger where confirmed; commercial options/obligations are not automatically executed. Do not present these defaults as verified real contract terms. |
| Medium | 99 source players have no potential | They are excluded by the existing generator. Obtain a reviewed value/source before inclusion. 83 older potential values fall below current overall and are clamped by the game-data builder. |
| Medium | 77 generated names have identical first/last components | Review display-name formatting; avoid breaking mononyms or name-based identity matching. |
| Medium | Pending release notes are not sealed into version 1.6.0 | Choose the intended release version, synchronize versions and seal notes through the existing release workflow. No version number was guessed. |

Free-agent status can change after this review. The 17 imported records are a verified subset, not every unattached footballer worldwide. New-career data does not rewrite existing saves.

## App Store verification still required

- Run the full release preflight against the final release revision on CI. The existing macOS TestFlight workflow already checks production RevenueCat key format and release observability configuration. Remote secrets and App Store Connect settings were not inspected.
- Archive with Xcode 26 or later and the iOS 26 SDK or later, as required by [Apple's current submission requirements](https://developer.apple.com/news/upcoming-requirements/). Verify the updated age-rating questionnaire in App Store Connect as well.
- On a physical iPhone/TestFlight build: cold launch, enable real players, create a career, open Free Agents, sign a player, save/relaunch, and load an older save. Check purchase, cancellation, restoration, trial eligibility and unavailable products with the actual store configuration.
- Compare the submitted privacy answers with the shipping SDK configuration. The repository privacy manifest currently declares purchase history and crash data, with tracking disabled; this review did not validate the final archived SDK manifests or App Store Connect declarations.
- Confirm store screenshots and descriptions match the shipped features and the actual roster coverage. Keep the existing pack-odds disclosure visible before purchase; see [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

## Verification performed

Latest loan/membership pass: 62 tests passed across five focused suites. Lint has zero errors (16 existing warnings), type checking, documentation, localization and pack supply checks passed. Production build passed with 544.8 kB gzipped eager payload and a 1,294.4 kB main chunk, both within limits. The complete suite then passed 3,347 tests, with nine failures across two playoff test files that still assumed Coventry was a second-tier club. Those test fixtures now use Blackburn. The final pre-push preflight passed, including the corrected suites, lint, type checking, documentation, localization, pack supply, production build and bundle limits.

- Broad suite: 3,302 tests passed, five skipped; one pipeline suite failed on Windows script parsing before the portability fixes.
- After fixes: 79 tests passed across five focused suites, covering the data pipeline, reviewed roster destinations, duplicate prevention, new-career free-agent seeding and signing, community-pack refresh, integrity and free-agent balance.
- Launch crash safeguards: 18 additional tests passed (97 targeted tests in total).
- Lint: zero errors, 16 pre-existing warnings. Type check passed.
- Source validation completed with the potential warnings described above. Release version and release-note format checks passed.
- Production build passed. Bundle checks passed: 544.3 kB gzipped eager payload (560 kB limit), 1,293.2 kB main chunk (1,300 kB limit). This leaves little main-chunk headroom; keep new roster data lazy-loaded. Documentation, localization and pack-supply checks passed. No native archive, upload or App Store submission was performed.

## Updating this data again

Edit reviewed facts in `data/transfers/summer-2026.json`, then run `npm run fc27:rosters`. Never edit generated community-pack files manually. The builder rejects unknown identities, conflicting destinations and missing evidence.

For an already completed official EA extraction, `npm run fc27:refresh-snapshot -- --raw-dir <extraction-folder>` validates completeness and preserves labelled potential values. Then run `npm run fc27:reconcile`, `npm run fc27:rosters`, `npm run fc27:export-game`, `node scripts/buildNationalPool.mjs --csv data/fc27/FC27_community_pack_input.csv`, and `npm run fc27:validate`. The extraction cache is not committed; generated source snapshots and the reviewed ledger are committed artifacts once this branch is committed.
