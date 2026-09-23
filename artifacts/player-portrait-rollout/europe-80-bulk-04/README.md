# European leagues: 80+ rollout, batch 04

Generated with the built-in image_gen tool from the checked-in game roster. Requested 100 portraits, integrated 97: La Liga 38, Serie A 32, Bundesliga 17, Ligue 1 10. Ratings range from 82 to 89. The new-generation floor is 80 OVR; all 170 previous portraits, including lower-rated players, remain in the catalog (267 total).

Lamine Yamal, Nicolò Barella and Willi Orban were rejected by the generation service. Their full errors are recorded in generation-failures.json and manifest.deferred. They retain existing card appearance; no substitute identity or retry was used.

## Saved deliverables

- Runtime alpha WebP: public/player-portraits/europe-80-bulk-04 (97 assets, 4,986,278 bytes, 512 square).
- Original generated PNGs: sources/.
- Exact per-player prompts, identities and original source paths: receipts/.
- Real PlayerCard preview: cards.html, with page=1 through page=4.
- Review images: cards-1.png through cards-4.png.
- Machine validation: validation.json and browser-validation.json.

## Validation

All 97 assets passed source/output hash, alpha and dimensions validation. Browser verification passed 1,843 combinations covering 14 card fronts and five sizes, card cycling, mobile overflow and all 267 catalog asset paths. All four preview sheets were visually inspected. The 62 focused card tests passed. Automated checks do not establish perfect real-person likeness. No ratings, saved games, or production deployment were changed.

After this batch, the four selected leagues have 142 eligible uncovered players rated 80+ plus three deferred requests.
