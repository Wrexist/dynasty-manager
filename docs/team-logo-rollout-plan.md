# Completed vector implementation

The user selected vector crests for every team, superseding the individual-image production plan below. All 756 clubs across all 45 divisions now have content-hashed local SVG assets and shared in-game rendering. Names, IDs and data colors are unchanged. The five approved vector examples are retained; remaining designs use eight outlines and 30 original geometric motifs assigned by stable club ID. Runtime artwork totals 874,716 bytes.

The current workflow is in `artifacts/team-crest-rollout/README.md`. Individually generated sources and old WebP exports are archived outside the runtime bundle. National flags and generated-club fallbacks remain intact. No legal clearance or deployment is implied.

The following is the historical planning record; its raster production steps and incomplete status are superseded.

---
# Original team crest rollout

Date: 2026-09-25. Status: implementation in progress. The user approved the five v2 examples and authorized generation and game integration for all catalog clubs. See artifacts/team-crest-rollout/coverage.json for current coverage.

## Recommendation

Use the player-portrait production pattern: a small visual pilot, individual source images, reviewed batches, stable-ID catalog, optimized bundled assets, and a coverage report. Create original fictional crests from written design briefs. Do not feed official badges into generation and ask for small changes.

The goal is attractive, distinct football identities, not near-copies that remain recognizable as official club marks. This process reduces copying risk; it does not certify legal clearance. Existing real club names, abbreviations, kit treatments and other branding remain a separate rights question.

### Recognition requirement clarified

The user wants players to recognize teams while minimizing trademark exposure. There is no design-change threshold that guarantees no claims, and this plan must not promise one. Recognition should come from the surrounding team label, league placement and roster context rather than resemblance to an official badge. Those contextual elements, especially real names, have their own rights considerations; moving recognition outside the crest does not eliminate them.

For each crest, start with an unrelated original symbol and composition. Do not use a familiar official mascot, silhouette, monogram or emblem as a recognition shortcut. User constraint: retain existing team names and team colors exactly; change only crest artwork. If a candidate feels too close to an official mark, replace its symbol and composition rather than its palette or team name. Do not require an anonymous viewer to identify the real club from the crest alone.

Pilot acceptance therefore asks two separate questions: can players identify the team in the complete game UI, and does the artwork stand as an independent fictional design? Neither answer is a legal clearance result. If retaining real-world recognition is essential, investigate licensing and qualified review of the complete presentation. If minimizing association is the priority, use fictional names, palettes and identities as well as fictional crests. Neither route can guarantee that nobody will make a claim.

## Verified repository baseline

- `src/data/leagues/index.ts` imports 45 divisions. Evaluating those league modules produced **756 clubs and 756 unique club IDs**.
- The top five first divisions contain **96 clubs**: England 20, Spain 20, Italy 20, Germany 18, France 18. These are checked-in game data, not a live football census.
- `src/components/game/ClubCrest.tsx` currently generates a colored roundel with initials. Its `CrestClub` interface does not include an ID or image lookup. Sizes are 24, 36, 40, 48 and 64 CSS pixels.
- Shared crest consumers already include ClubPage, MatchPrep, MatchReview, PostMatchPopup, ScoreHeader, CupPage and LeagueCupPage. Other identity renderers remain, including PitchView and PenaltyShootout; a complete integration must audit all surfaces.
- CupPage and LeagueCupPage supply explicit Shield children; simply adding image lookup will not settle their intended precedence. CupPage's narrowed club type also omits ID. Pass the fixture's known club ID explicitly where needed.
- World Cup ScoreHeader deliberately renders flags. Sunday mode has its own generated identity system. Neither should accidentally pick up a professional club asset.
- Portrait precedent: `src/data/playerPortraits.ts`, `scripts/prepare-portrait-rollout.mjs`, and batch manifests under `artifacts/player-portrait-rollout/`. The `pl-01` batch records individually generated transparent sources and 512px WebP exports, merged by canonical ID.

## Scope

1. All 756 catalog clubs receive individually reviewed original crests, across every division, including lower leagues.
2. National teams retain flags, rather than federation logos. If original national-team emblems are wanted later, treat them as a separately inventoried design project.
3. Generated Sunday/custom/unknown clubs keep stable procedural or neutral fallbacks. They are not a finite set for individual asset generation.
4. Stable club IDs stay unchanged. Promotion, relegation and transfers must not change a club's crest identity.

## Design and rights approach

Copyright and trademark are separate concerns: a logo may qualify for copyright protection, while trademark assessment considers the overall impression and possible confusion. Changing a few details is not a clearance method. See [WIPO copyright protection](https://www.wipo.int/en/web/copyright/protection), [WIPO trademarks](https://www.wipo.int/en/web/trademarks), and [EUIPO similarity guidance](https://guidelines.euipo.europa.eu/2058843/1981542/trade-mark-guidelines/3-5-conclusion-on-similarity).

Production rules:

- Write each brief independently. Generation receives a fictional internal design code, an original symbol and composition, and a palette; omit real club names and official crest reference images.
- Use original silhouettes, internal layouts, line work and central symbols. Do not retain a distinctive official motif in a slightly redrawn form.
- The approved v2 direction includes existing team names in original lettering. Do not copy official wordmarks, founding years, slogans, sponsor marks, manufacturer marks, federation symbols or civic arms.
- Preserve the existing club color values and names, as explicitly requested. Retaining them is not a legal safe harbor; reject overly similar artwork and redesign its shapes and composition within the fixed palette.
- Use bold team lettering as approved in v2, with no fine ornamental text. Adjacent live UI names remain readable when badge lettering becomes too small.
- Review generated candidates against the relevant official mark and other recognizable marks separately from generation. Record the reference source/date, decision and reason. Also check for accidental similarities among our own 756 assets.
- Reject close candidates and rewrite the concept; do not repeatedly make tiny alterations to an official-looking candidate.
- AI generation, an originality prompt, and a disclaimer do not establish clearance. For a commercial release seeking legal assurance, obtain qualified IP review of the actual assets and their use with existing team names in the intended markets.

Suggested art direction: bold flat emblems, two or three colors, strong negative space, controlled outlines, transparent background, balanced visual weight and one dominant symbol. A consistent collection should allow several silhouettes rather than repeating one template 756 times. Fine ornamentation must not disappear at 24px.

Example generation brief:

> Create one original fictional football crest, design code DM-001. Use an angular six-sided outline enclosing three offset rising beams with a clear central gap. Deep burgundy, warm ivory and a small copper accent. Bold flat vector-like artwork, consistent thick strokes, no gradients, front-facing and centered, transparent square canvas with 8 percent padding. No text, letters, numbers, crowns, mascots, sponsor marks or existing sports branding. The emblem must remain clear at 24 pixels. Deliver only the individual emblem, not a mockup or contact sheet.

This illustrates prompt structure, not a cleared design or a final assignment to a real club. Keep a separate club-ID-to-design-code mapping in the production manifest.

## Production sequence

### 1. Inventory and briefs

Create `scripts/prepare-team-crest-rollout.mjs` using the portrait inventory pattern. Read the league index and its actual exports, assert unique IDs, and output league/club coverage. Do not derive identity from display names or array position.

Proposed artifacts:

- `artifacts/team-crest-rollout/inventory.json`: every club ID, division, display name, colors, design code and production status.
- `artifacts/team-crest-rollout/policy.json`: art direction, exclusions, export settings and revision.
- Per-batch `manifest.json`: club ID, design brief, exact generation prompt, source/provider, generation date, source hash, revision, status, review notes, output paths and byte sizes.

Use statuses `briefed`, `generated`, `needs-revision`, `art-reviewed`, and `integrated`. Track legal review separately so visual acceptance is never mislabeled as legal clearance.

### 2. Twelve-club pilot

Select 12 clubs spanning the top five divisions and at least two other divisions, varied palettes, and well-known identities where similarity review matters most. Generate one individual candidate per club; revise failures independently. Avoid generating a sheet and cutting it into assets.

Produce a review gallery with 24/36/48/64/128px previews on light and dark surfaces, plus full sources. Include both named and anonymous views: the latter tests whether the artwork depends on the name to work. Inspect transparency, clipping, visual weight, duplicate concepts and similarity to official marks. Finalize style after this pilot before bulk work.

### 3. Runtime integration of reviewed pilot

Proposed files:

| File | Responsibility |
| --- | --- |
| `src/data/teamCrests.ts` | Small approved catalog keyed by stable club ID, with versioned image URLs |
| `src/utils/teamCrest.ts` | Exact-ID resolution and safe missing-ID behavior |
| `src/components/game/ClubCrest.tsx` | Image rendering, existing size contract and roundel fallback |
| `public/team-crests/v1/` | Optimized transparent runtime files |
| `scripts/integrate-team-crest-batch.mjs` | Validate reviewed assets and merge entries without overwriting unrelated batches |
| `scripts/audit-team-crest-coverage.mjs` | Missing/duplicate/orphan IDs, file existence, dimensions and bytes |

Extend `CrestClub` with optional `id`, and provide an explicit `clubId` override for narrowed/virtual objects whose identity is known by the caller. Resolve by ID only. Preserve meaningful explicit children; remove generic Shield placeholders at callers that should show a crest. Define this behavior with tests.

Use `object-fit: contain`, fixed dimensions and transparent padding. Do not clip a shield into the old circular badge or put the roundel's sphere gradient behind every image. Existing shape styling applies to fallback presentation. Keep club names accessible; decorative images next to names use empty alt text, while standalone identities need a label.

Missing entries and failed loads return to the existing roundel without retry loops. Reset load-error state when the resolved source changes. Ship files locally for native offline use; use versioned or content-hashed URLs for web cache replacement. Do not store binary assets in saves or preload every image.

No save migration should be necessary when existing club IDs resolve externally. Confirm old-save and custom-club behavior before making that claim final; do not introduce persisted fields merely to select a bundled image.

Audit club selection, dashboard, tables, fixtures, cup brackets, club details, match preparation, live scoreboards, pitch score bug, penalties and post-match screens. Migrate competing renderers where appropriate, without changing national flags or Sunday identities.

### 4. Full coverage

After the pilot, finish the remaining top-five clubs, then every other division. Use review batches of approximately 25. Across the full catalog, 756 assets correspond to about 31 such batch-equivalents; actual grouping includes the separate pilot and division boundaries. Unlike the portrait rollout, there is no rating/popularity cutoff for teams.

Generation volume starts at 756 accepted outputs, plus rejected attempts. Estimate actual expense and throughput from the 12-club pilot; provider pricing and retry rates have not been measured here.

Keep 1024px transparent masters outside the runtime bundle. Start with a 256px WebP runtime export, sufficient for the current 64px crest at 3x density. Add a separate 512px variant only if a larger inspected surface needs it. Compare lossless and lossy exports on thin strokes and transparency before choosing settings.

Planning budget: average 10â€“30KB per 256px crest would mean about 7.6â€“22.7MB for 756 files, excluding masters and any larger variants. These are targets, not measured results. Bundle only approved runtime files, not galleries or source masters.

## Acceptance and release checks

- Coverage reports 756/756 current catalog IDs with accepted, existing assets; no unknown IDs or accidentally overwritten batches.
- Every candidate has visual and similarity-review notes, and any unresolved rights concern stays visible in the manifest.
- Test correct lookup, missing/null/custom clubs, failed loads, source changes, children precedence and national-team separation.
- Inspect actual screens at 375px phone width and tablet width, on both relevant backgrounds; inspect every crest in the small-size gallery.
- Verify old saves, promotion/relegation, offline native use and updated web-cache URLs. Artwork must not change game state or simulation.
- Run targeted crest tests, typecheck and build during integration, then repository-required release checks. Compare package size and dense table scrolling against the baseline.
- Preserve the fallback and a simple way to disable the catalog if a batch needs removal. Rollback must not require save repair.

## Authorized implementation

The user approved the five revised Premier League examples, then requested all teams and explicitly requested integration. The five approved sources are preserved. Generation is tracked in artifacts/team-crest-rollout/manifest.json, with local bundled WebP exports and shared ClubCrest integration. The earlier twelve-club pilot proposal is superseded by this approval. No deployment or trademark clearance is implied.
