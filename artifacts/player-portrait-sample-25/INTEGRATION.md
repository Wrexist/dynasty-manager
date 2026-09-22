# Integrated player cards

The approved 25 portraits now render in the actual shared `src/components/game/PlayerCard.tsx`. Preview: run Vite and open `/artifacts/player-portrait-sample-25/cards.html`. Static captures: `cards-preview.png` and `cards-mobile.png`. The preview uses the checked-in community roster's actual ratings and the existing gold/Icon/frame selection rules, not the promotional image's ratings or all-gold styling.

Assets are local at `public/player-portraits/sample-v1/`; metadata is `src/data/playerPortraits.ts`. The resolver uses a stable FC ID, admits known FC-year prefixes, and conservatively validates the displayed name and source club. Unknown, fictionalized, generated, or transferred players fall back to the existing card. Unassigned pack players may show the source-club portrait. This deliberately limited sample does not claim universal identity migration or dynamic kit recoloring. No save schema or simulation data was changed.

Opaque portraits are feathered into the card and masked by its silhouette, below live text. Image failures restore the existing card, and a different portrait URL gets a fresh image-load state. Earned artwork and rarity rules remain authoritative. All card sizes use the same component; the preview includes actual-size examples.

Validation: 4 test files / 62 tests passed (portrait identity/error behavior, cards, lineup tiles, player hero); typecheck and production build passed. Browser capture decoded all 25 portraits with no page errors, checked card cycling, and reported no horizontal overflow at 375px. ESLint reported no errors and the existing PlayerCard fast-refresh export warning. Physical iOS verification and full release preflight were not run.

Production limitation: these approved PNG masters total 51,262,369 bytes, around 48.9 MiB. This is a functional sample integration, not the final optimized all-league asset pipeline. Before release, create small/large compressed runtime variants and benchmark native memory. Do not multiply master-sized assets across 2,500 players. Generated pixel content was not altered during integration; the existing club-color edits and their prompts are documented in `team-colors/manifest.json`.

## Transparent 25-player pilot (completed)

All 25 roster identities now resolve to transparent cutouts in `public/player-portraits/cutout-v1/`. The gray studio backgrounds were removed using built-in image_gen; approved shirt colors were retained. The runtime versions are 512 x 512 WebP with alpha, encoded at quality 0.92. Total: 1,204,602 bytes, compared with 51,262,369 bytes for the original 25 PNGs (97.7% smaller). Full-size source images are archived outside public in `source-assets/`.

Generation prompt and source provenance are in `cutouts-manifest.json`; the previously approved Van Dijk edit is documented in `van-dijk-cutout-notes.txt`. Regenerate runtime files using `node artifacts/player-portrait-sample-25/prepare-cutouts.mjs` with Vite running on port 5180, then run `integrate-assets.mjs`. The importer requires the transparent WebP files and cannot silently restore opaque portraits.

Validation: all 25 source cutouts have meaningful transparent regions and transparent top corners; 475 browser combinations loaded successfully (25 players across 14 front artworks, plus five card sizes). The 25-card desktop/mobile preview loaded without browser errors or mobile horizontal overflow; card cycling passed. Four related test suites passed (62 tests), and TypeScript passed. Visual review of the complete card sheet confirmed the gray circles are gone. This is local integration, not an App Store release or a physical-device test.

Preview: `cards-transparent-preview.png`; interactive: `cards.html`.
