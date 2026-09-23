# Premier League batch 02

25 more portraits generated with built-in image_gen and integrated by canonical FC ID. Full prompts and source provenance are in `manifest.json`; full-resolution transparent PNGs are in `sources/`.

Uses the checked-in game roster and its primary club colors. Runtime assets are 512 x 512 alpha WebP at quality 0.92 in `public/player-portraits/pl-02/`; total 1,291,766 bytes. All 25 source images passed transparency checks. Existing batches remain intact.

Run Vite on port 5180, then `node artifacts/player-portrait-rollout/pl-02/prepare.mjs` to encode and validate assets, followed by `node artifacts/player-portrait-rollout/pl-02/integrate.mjs` to merge by ID. Preview: `cards.html` and `cards-preview.png`. Browser checks: `check-cards.mjs` and `check-card-matrix.mjs`.

The complete card sheet was visually reviewed for framing and gray halos. Desktop/mobile loading, cycling and overflow checks passed. Likeness is generated and remains subject to visual review. No publication or deployment performed.

Coverage after this batch: 75 portraits overall, 60 of 531 Premier League players, 471 Premier League players remaining.
