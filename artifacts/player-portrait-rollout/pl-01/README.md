# Premier League batch 01

25 additional player portraits generated using built-in image_gen and integrated by canonical FC ID. The source roster is the checked-in game data, not a live real-world squad verification. Full prompts, colors and generation provenance are in `manifest.json`; original transparent PNGs are in `sources/`.

Runtime assets: `public/player-portraits/pl-01/`, 25 transparent 512 x 512 WebP files, quality 0.92, 1,202,024 bytes total. The existing 25-player pilot is preserved. The combined catalog has 50 entries, including 35 of the Premier League's 531 players; 496 Premier League portraits remain.

Preparation: run Vite on port 5180, then `node artifacts/player-portrait-rollout/pl-01/prepare.mjs` and `node artifacts/player-portrait-rollout/pl-01/integrate.mjs`. Importers merge by ID rather than overwriting other batches.

Validation: all 25 source images have meaningful alpha transparency and transparent top corners. All 25 render on 14 backgrounds and five sizes (475 combinations), with no browser errors. Desktop/mobile preview, card cycling and mobile overflow checks passed. Card-sheet visual review completed; final likeness approval remains subjective.

Preview: `cards-preview.png`, interactive `cards.html`. Nothing published or deployed.
