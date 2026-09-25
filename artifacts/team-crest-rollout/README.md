# Club vector crests

All 756 catalog clubs across 45 divisions use local SVG crests. Names, IDs and data colors are unchanged. The five approved vector examples remain exact overrides; other clubs use stable ID assignments across eight outlines and 30 original geometric motifs.

## Rebuild and verify

- `node scripts/build-vector-team-crests.mjs` rebuilds SVGs and the content-hashed exact-ID catalog.
- `node scripts/audit-team-crests.mjs --complete` verifies coverage and unchanged identity data.
- `node scripts/review-team-crests.mjs --screenshots` creates the searchable light/dark gallery and 32 contact sheets, browser-decoding all assets.
- With Vite on port 5180, `node scripts/check-team-crest-ui.mjs` checks the shared component and club selection at phone/tablet widths.

Runtime artwork totals 874,716 bytes. The manifest records shape, motif, colors, hash, size and runtime path. Integration status is technical coverage, not individual art approval or legal clearance.

Image-generation sources and the old manifest are preserved under sources/ and image-generation-manifest.json. Former runtime WebP exports are in archived-runtime-v1/, outside the game bundle. Raster workflow scripts reject the active vector manifest to prevent accidental replacement.

National teams retain flags; generated Sunday and unknown clubs retain existing identities/fallbacks. Failed image loads use the roundel fallback. No saved fields, save migration or external downloads are involved. Deployment is separate from this local integration.
