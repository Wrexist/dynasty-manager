# Top clubs: full-squad portrait rollout

The user explicitly selected full squads, replacing the previous 80+ restriction for the six strongest clubs in each of the five leagues. Club selection uses checked-in squadQuality, then reputation and name; it is not live league standings. See ../top-clubs-selection.json and the policy snapshot in manifest.json.

586 missing players were queued. 577 portraits were generated with the built-in image_gen tool and integrated locally: Premier League 65, La Liga 105, Serie A 122, Bundesliga 145, Ligue 1 140. Ratings span 56–82. All 267 existing portraits remain; the catalog contains 844 entries.

The selected 30 squads contain 785 players: 770 now have portraits (98.1%), with 19 clubs fully covered. The 15 remaining players are recorded generation rejections: nine from this run and six from earlier runs. See [club-by-club coverage and deferred names](../TOP-CLUB-COVERAGE.md). Existing card fallback remains for these players. No blocked requests were retried.

## Deliverables and previews

- Runtime assets: public/player-portraits/top-clubs-full-05/ (577 active alpha WebP files, 512 square, 30,057,478 bytes).
- Original PNG sources: sources/.
- Exact prompts, player identities, tool and original paths: receipts/.
- Generation failures: generation-failures.json and per-player error receipts.
- Interactive real PlayerCard preview: cards.html served by Vite. Large batches default to 25 cards per page; navigation covers all 24 pages. An explicit All players link remains available.
- Saved review sheets: cards-1.png through cards-24.png.
- Source/output hashes and alpha checks: validation.json.
- Rendering checks: browser-validation.json (written after successful verification).

The long-running generator was interrupted after saving 333 portraits. The remaining 247 unfinished players were resumed, excluding completed files and six recorded rejections. Three source files had been copied before their receipts were written; their original generated paths were recovered by exact SHA-256 matching. All 577 final receipts were verified.

All 577 assets passed dimensions, alpha and hash checks. The 62 focused card tests, typecheck, production build and bundle-size checks passed. Initial simultaneous image decoding on the 577-card preview failed; all images decoded individually, and the verification now bounds image requests to pages of 25. The preview default was also paginated. This changes review tooling only.

All 24 sheets were visually reviewed. Full browser verification passed 10,963 combinations covering 14 frames and five sizes, plus cycling, mobile layout and all catalog paths. Three identity mismatches were corrected with official reference images: João Mário Neto Lopes (257290), Arthur Augusto de Matos Soares (275028), and Radoslaw Zelezny (80045). Their v2 prompts and reference URLs are in receipts; original variants are preserved outside public in sources and rejected-variants. The manifest selects versioned v2 assets, preventing stale caches. Corrections are checked across all 19 frame/size variations, with refreshed sheets 11, 18 and 22 and correction-browser-validation.json recording results.

Official identity references: [Juventus: João Mário](https://www.juventus.com/en/teams/first-team-men/squad/joao-mario-neto-lopes), [Bayer 04: Arthur](https://www.bayer04.de/es-es/player/werkself-1/bayer-04-leverkusen/arthur), [AS Roma: Zelezny](https://www.asroma.com/en/news/73543/radoslaw-zelezny-signs-for-roma).

These are generated likenesses; apart from the three corrections, they were not individually verified against reference photos. Visual review checks card composition and obvious asset defects, not perfect identity accuracy. No ratings, saves, production deployment or App Store release were changed.
