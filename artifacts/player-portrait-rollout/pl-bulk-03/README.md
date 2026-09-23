# Premier League bulk batch 03

Requested: 100. Generated, validated and integrated: 95. Total catalog: 170 portraits. Premier League coverage: 155/531, with 376 remaining (371 eligible for automatic generation and 5 deferred).

Deferred after image-service rejections: Chris Wood (192123), Joelinton (223334), Sven Botman (251809), Dominic Solanke (225539), Kieran Trippier (186345). Full errors are in `generation-failures.json`, and the manifest retains their identities under `deferred`. Their existing fallback cards remain unchanged. No rejected request was silently counted as complete.

The built-in image_gen tool produced all 95 sources. Exact prompts and output provenance are in `receipts/`. The full-resolution PNGs are in `sources/`. Runtime assets are `public/player-portraits/pl-bulk-03/`: 95 alpha WebP images at 512 x 512, quality 0.92, 4,831,442 bytes total.

The reusable workflow is documented in `../BULK-WORKFLOW.md`. Preparation is cached using source and output hashes; the repeat run reused all 95 conversions. Integration validates every row before merging by canonical ID, preserving all 75 existing entries. The new planner excludes completed/deferred players and refuses to overwrite existing batches.

Validation: all images passed alpha and dimension checks; 1,805 browser combinations passed across 14 front backgrounds and five sizes. All four card preview pages were visually inspected for framing and gray halos. Card cycling, mobile overflow and all 170 catalog asset paths passed. Four focused suites passed (62 tests); typecheck, production build, bundle-size checks and targeted script lint passed. Existing Vite mixed static/dynamic import warnings remain. No physical-device verification or deployment was performed. Generated likeness still requires human visual judgment.

Open `cards.html` for the interactive gallery; `cards-1.png` through `cards-4.png` contain all 95 new cards.
