# Player portrait and card system audit

Date: 2026-09-21. Repository baseline: `49790ca2`. Scope: feasibility and implementation design, not a completed portrait feature or full game/security audit.

## Decision

Yes: the current game can support recognizable player portraits on cards similar to IMG_3185. Extend the existing shared card with separately authored portraits and live game text. Do not generate thousands of complete card images containing ratings, names, flags or club shirts that become stale.

Interpret “top leagues” initially as the Premier League, La Liga, Serie A, Bundesliga and Ligue 1. Coverage means every player in the selected roster snapshot, including reserves and goalkeepers, not only stars. Expand to other leagues using the same identity system. A player retains their portrait after transferring out of the covered leagues.

The user reports that the promotional images were accepted for the App Store page. That is accepted as session context; App Store Connect was not inspected. The checked-in marketing README predates that information and describes these as generated promotional concepts. Acceptance does not establish that this repository build contains the depicted portrait feature.

## Evidence and verified scope

Read the player model, roster sources, template construction, identity selection, community-pack initialization, card and avatar rendering, tactics/chemistry integration, asset selection, save migration, service worker, and marketing provenance. Ran the six focused existing suites listed below. No iPhone, iPad, browser visual run, production build, entire simulation audit, or image-quality benchmark was performed.

The reproducible inventory is `node scripts/audit-portrait-readiness.mjs`; output is saved in `docs/portrait-readiness-inventory.json`. It reads local TypeScript data, follows community roster precedence for these leagues, and canonicalizes the existing FC year prefix for duplicate counting. It excludes runtime squad fillers, transfers, free agents, national-team-only players and old-save populations. It is not an external verification of current real-world squads or image rights.

| League | Clubs | Base roster entries | Community roster entries used | Missing IDs |
| --- | ---: | ---: | ---: | ---: |
| Premier League | 20 | 453 | 531 | 0 |
| La Liga | 20 | 465 | 491 | 0 |
| Serie A | 20 | 475 | 515 | 0 |
| Bundesliga | 18 | 463 | 515 | 0 |
| Ligue 1 | 18 | 407 | 448 | 0 |
| Total | 96 | 2,263 | 2,500 | 0 |

All 96 have community roster entries. The 2,500 selected entries have 2,500 distinct normalized IDs and no cross-club duplicates within this selection. Their IDs are unprefixed strings; older base data uses IDs such as `fc26-246669`. This is a mapping foundation, not proof that all identities match external image-provider IDs.

## Findings, ordered by implementation risk

### 1. There is no main-game player portrait layer yet — release blocker for this visual promise

`src/components/game/PlayerCard.tsx` renders card artwork and live text but has no individual face asset lookup. `PlayerAvatar.tsx` draws a jersey, despite its name. `SundayFace.tsx` is a separate stylized portrait implementation for Sunday mode, not a catalog of recognizable professional players.

Use a new reusable `PlayerPortrait` inside `PlayerCard`. Squad, transfer cards, player hero and tactics already reuse `PlayerCard`, reducing the integration surface. Keep live match pitch markers lightweight; changing every jersey marker into a photograph is a separate decision.

### 2. Identity keys have multiple formats — blocker before bulk asset production

`Player` and `PlayerTemplate` already retain `fcId` and `source`. `realPlayerPicker.ts` normalizes `fcNN-` prefixes for claiming, but its template-key path and `communityPackPool.ts` also contain raw-ID comparisons. A portrait resolver that only accepts one spelling will fail for other paths and old saves.

Create one explicit canonical-person resolver and a tested crosswalk. Use names only for human review, never runtime matching. Names can be abbreviated, localized, duplicated or changed; nationality aliases also exist. Normalize only known FC ID formats; do not blindly strip arbitrary prefixes from unrelated providers. Unknown or ambiguous mappings receive a fallback. Reconcile mixed-source duplicate behavior separately from portrait lookup; zero duplicates in the inventory does not certify every save or pool.

### 3. Fictional names retain real IDs — blocker before enabling automatic faces

`buildPlayerFromTemplate` replaces names when `useRealNames` is false, then still copies `source` and `fcId`. A simple `fcId -> portrait` lookup would put a recognizable real face on a fictional player. The pack generation path calls this builder with default naming behavior, so a single global community-pack toggle alone should not be assumed to describe every player's identity.

Add an explicit per-player identity presentation policy, such as real versus fictional, with migration rules. Resolve unknown legacy cases conservatively to a generic portrait; do not guess from surname alone. Gate portraits and names consistently across career, packs, national teams, legends and previews. A new persisted field requires a save-version bump and migration; the baseline schema is v92.

### 4. The displayed DRI stat is not a real dribbling attribute — confirmed data/UI mismatch

`PlayerAttributes` has pace, shooting, passing, defending, physical and mental. `PlayerCard.tsx` displays `mental` as DRI in both top-three and six-stat presentations; `uiHelpers.ts` displays it as MEN. The base roster builder derives mental from composure, vision and reactions. The community processor uses another blend that also includes dribbling.

For the first portrait release, label the existing value consistently and honestly. A genuine DRI stat needs an explicit data/model/engine decision and migration; relabeling mental does not implement dribbling. Keep portrait delivery separate from balance changes.

### 5. Goalkeeper card numbers are misleading under outfield labels — confirmed

The base builder maps goalkeeper kicking into shooting/passing, speed into pace, and blends positioning/diving and reflexes/composure into other axes. The community processor uses a different mapping. Displaying those as SHO/DEF/DRI is unsuitable for a polished goalkeeper card. Nor can all original goalkeeper attributes be recovered from the blended saved values.

Use an honest reduced goalkeeper view initially, or retain distinct source GK metrics with a documented development model. Do not simply relabel blended values DIV/REF and claim exact goalkeeper stats. Audit both ingestion pipelines together.

### 6. The screenshot's all-gold treatment differs from current card rules — confirmed

`getPlayerCardArt` prioritizes Ballon d'Or, then pack frame, then overall tier. Overall 90+ currently selects Icon art, including active players; small pitch chips omit pack frames. The marketing README explicitly says its active players do not use Icon artwork.

Decide the intended rules before visual rollout: use gold for active elite players and reserve historical Icon treatment for actual legends, or retain current tiers and align marketing. Preserve earned pack/award distinctions. Do not change economic rarity or player abilities merely to change a frame.

### 7. Portraits containing a fixed shirt will become wrong after transfers — design risk

The concept shows one saved-game XI wearing red, not a claim about the current real-world Liverpool roster. Shipping full busts in original-club shirts would break after transfers, loans, national call-ups and pack acquisition.

Recommended art contract: consistent head/neck cutout plus a separate generic kit/shoulder layer driven by the current context. Masking and neckline alignment need visual QA. An alternative is a neutral headshot crop; it is simpler but less faithful to the image. Do not try to recolor arbitrary photographic shirts with a CSS filter. Free agents and unrecruited pack players need a neutral kit; historical cards need an explicit historical/current-kit policy.

### 8. The pitch cannot carry the poster's information density — confirmed size constraint

Card widths are 52/64/110/150/220 CSS pixels. Tactics uses the 52px compact card, omitting the full stat panel. Small chips are 3:4 while full cards are 2:3. Empty formation slots depend on the chip ratio.

Use face + OVR + position + readable abbreviated name on pitch; expose full stats in the selected-player panel. Keep flags/status badges from covering faces. Preserve 44px touch targets and all formation spacing. Enlarging pitch cards requires changing slot geometry and empty placeholders, not just the image width. Validate 320/375/390/430px phone layouts, landscape and iPad; 375px is the repository's minimum required mobile check.

### 9. Static chemistry artwork would misrepresent the simulation — confirmed existing support

The game already computes chemistry in `utils/chemistry.ts`; `config/chemistry.ts` caps its bonus at 0.12. Tactics and match helpers use chemistry calculations. Therefore the concept's +12% is possible, but must be derived from the actual lineup rather than painted into the art. The match helper comment still says 0–8%; the config is authoritative.

Preserve lineup holes and slot indices, out-of-position indicators, injuries, suspensions and substitution updates. Portrait success/failure must never alter chemistry, lineup selection, RNG or match strength.

### 10. Lazy roster loading can produce procedural fallback squads — confirmed code path

`initGame.ts` starts base roster/national pool loads without awaiting them; synchronous accessors return empty data before loading. The code explicitly permits procedural fallback. Community roster modules are awaited, but base-template fallback availability should not be assumed.

If a product mode promises a named real roster, make its required roster readiness explicit at the start-game boundary with retry/error handling. Do not silently create a permanent fictional roster while loading. Preserve the intentionally synchronous non-community flow unless its contract and tests are deliberately changed. Portrait downloads must remain optional and never block career creation.

### 11. Native offline delivery needs its own solution — confirmed platform distinction

The service worker registers only outside native Capacitor. `public/sw.js` uses broad network-first caching with no portrait byte budget or targeted revision policy. It cannot be treated as native portrait storage.

For an initial complete top-five release, bundling optimized local portraits is the simplest reliable native option. Benchmark size before committing. If optional remote packs are needed, implement separate native and web caches, atomic manifest activation, checksum/length validation, bounded eviction and an offline fallback. Never put binary/base64 images into game saves. Use content-hashed filenames and a versioned manifest. Cache failure must not affect save persistence.

### 12. Retirement can lose real-person portrait identity — confirmed model gap

`RetiredLegend` retains `appearance` but does not declare `fcId`. A future real portrait derived only from active-player identity cannot be assumed to survive archival. Preserve a stable portrait/person reference when creating the archive, with backward-compatible migration/fallback. Regens should not inherit the retired player's real likeness automatically.

### 13. Appearance generation cannot identify a real player — confirmed

`generatePlayerAppearance` chooses skin/hair and other features randomly, partly using nationality-weighted distributions. That can generate fictional characters; it cannot establish what a named real person looks like. Never regenerate a real player's appearance from nationality when an asset is missing. Use a neutral fallback for missing real portraits, and a stable seeded fictional identity for generated players. Persisted appearance should remain stable after reload.

### 14. Asset permission and App Store fidelity remain separate checks

Apple's current guidelines require accurate metadata/screenshots (2.3/2.3.3), rights to screenshot materials (2.3.9), and appropriate rights to included third-party material (5.2/5.2.1). The user's reported acceptance is not evidence of a player-likeness license. Generated artwork also should not be assumed to settle likeness, kit/logo, reference-photo, or source-data permissions. This audit does not determine rights ownership.

Keep provenance and permission evidence with the asset pipeline; have the appropriate rights holder/adviser confirm the intended commercial use. Do not treat a community pack, AI generation, a concept label or previous screenshot acceptance as a substitute. This is a production asset question, not a reason to stop building the technical renderer.

Source checked 2026-09-21: https://developer.apple.com/app-store/review/guidelines/

## Proposed implementation contract

1. Resolve saved player instance to explicit identity policy, then canonical person ID. Instance ID identifies a particular game object; person ID identifies the portrait. Pack copies can share a face without becoming the same instance.
2. Resolve canonical person ID through a lazy manifest to an approved asset version. Keep authoring provenance outside the boot bundle. Runtime metadata includes asset key, small/large paths, dimensions and crop anchor; retired or revoked assets fall back safely.
3. Render layers in order: existing frame/background, kit shoulders, portrait, text-legibility gradient, live rating/name/flag/stats, interactive/status overlays. Scope grayscale/tier filters to the frame so they do not unintentionally recolor skin. Keep image alpha within card bounds.
4. Use fixed dimensions, asynchronous decoding and appropriate image variants; load above-fold XI predictably, defer offscreen lists. Reset load-error state when the player/asset changes. A missing asset should fail once into a stable fallback, not an onError request loop.
5. Show all names, numbers and flags from game state. Assets contain no baked text, ratings, sponsorship or mutable club badge. Portraits remain cosmetic; no portrait field participates in economics, rarity, pack odds, scouting knowledge or simulation.
6. Keep display access explicit: a portrait must not reveal a hidden scouting identity before the UI permits the identity to be known. Audit this against each scout/recruit screen during implementation.

Recommended initial export targets: transparent WebP, approximately 192px small and 512px hero variants, standardized head size, gaze, lighting and neutral expression. These are starting targets for measurement, not measured final requirements. Keep larger source masters outside the shipped app.

At 2,500 players, a combined 50–100 KB per player's shipped variants means roughly 125–250 MB of portrait files, before packaging effects. Eleven decoded 256×256 RGBA images alone occupy about 2.75 MiB; 1024×1536 decodes would be about 66 MiB for eleven, before extra surfaces. Do not use full promotional-resolution art for every small card. Actual compressed size and device memory must be measured with the pilot.

## Asset production and rollout

**Phase 1 — definition and representative pilot.** Lock roster snapshot and identity rules; build a 24-player asset review set spanning all five leagues, keepers/outfielders, hair styles, skin tones, beards, long names and small crops. Verify recognizability, consistent lighting and clean cutouts. Agree rights/provenance requirements before bulk production. No need to generate 2,500 images to validate the renderer.

**Phase 2 — renderer and identity.** Implement resolver, identity migration and `PlayerPortrait`; integrate shared cards, neutral fallback and kit context. Resolve misleading stat labels and the active-player/Icon visual rule explicitly. Confirm old saves, fictional mode and pack variants before bulk assets.

**Phase 3 — complete data and assets.** Generate/import approved portraits outside the app, review contact sheets, reject wrong/duplicate faces, export variants, build versioned manifests and coverage reports. Every snapshot ID needs an approved portrait before claiming complete coverage. Missing new signings retain a fallback and remain visible in the coverage report. Generation cost is attempts × provider unit cost, plus QA/rework; no provider price or production time has been measured here.

**Phase 4 — lifecycle and device verification.** Test all surfaces, save migration, transfers, loans, national kits, packs, retirement, reloads, offline launch, corrupt/missing images and asset updates. Benchmark scrolling, memory and cold start on the oldest supported physical iPhone and a representative iPad. Run the repository release checks before shipping.

**Phase 5 — controlled release.** Ship a reviewed complete roster snapshot; publish actual in-game captures for the updated listing. Expand league manifests without changing canonical identities. Keep previous asset versions available for rollback; removing art must never delete a player or invalidate a save.

## Acceptance matrix

| Area | Required evidence |
| --- | --- |
| Coverage | 100% of the agreed snapshot has a reviewed asset; duplicate, unresolved and missing IDs reported separately |
| Identity | Legacy prefix and unprefixed IDs resolve to the same verified person; unrelated providers do not collide; fictional mode never leaks real faces |
| Lifecycle | Same face after save/load, transfer, loan return and national selection; documented archive/regen behavior |
| Packs | Repeated person can share portrait across distinct instances; no changes to ownership, odds, rarity or rewards |
| Data | Live ratings/names reflect current save; honest mental/GK labels; portraits do not overwrite player state |
| Visuals | All card sizes, frame variants and formations reviewed; no obscured ratings, clipped heads or unreadable critical text |
| Interaction | Selection, swap, detail, dismiss and keyboard actions still work; no nested controls; 44px targets retained |
| Accessibility | Card name/role announced once; decorative image has empty alt; errors do not produce noisy broken-image labels; reduced motion respected |
| Resilience | Offline first launch and cache eviction remain playable; 404, timeout and corrupt image yield stable fallback; wrong-face mappings can be revoked |
| Performance | Establish baseline and compare frame times/memory/startup on supported devices; no portrait catalog in eager JS; pass size budget |
| Save safety | Migrations cover all supported old saves; save size contains metadata only; damaged/unknown portrait metadata never blocks loading |
| Simulation | Identical seeded game actions with portraits on/off produce identical gameplay state and results |
| Marketing | Listing shows the shipped renderer and real feature behavior; custom XI and sample pack contents do not imply a current roster or guaranteed drop |

## Validation completed for this audit

`npx vitest run src/test/playerCard.test.tsx src/test/lineupPlayerTile.test.tsx src/test/playerGen.test.ts src/test/playerNameResolution.test.ts src/test/playerAvatar.test.tsx src/test/chemistry.test.ts`

Result: 6 files passed, 122 tests passed. These establish a baseline for existing behavior; they do not validate an unimplemented portrait feature.

The inventory script also ran successfully. No gameplay code, assets, saves, App Store metadata or deployments were changed. Added the audit, inventory and rerunnable inventory script. Full preflight and device verification remain implementation/release work. No audit can guarantee that all possible defects have been found; the matrix above makes the remaining proof obligations explicit.
