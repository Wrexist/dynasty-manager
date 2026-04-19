# Branded game assets

Every file in this tree is consumed through `src/assets/manifest.ts`. The
consuming components (`AssetImage`, `CupIcon`, `DivisionCrest`,
`CosmeticAvatar`, `EmptyState.illustration`) gracefully fall back to a
Lucide icon when the asset file is missing, so you can add artwork one
piece at a time without breaking anything.

## How to activate an asset

1. Drop the file into the matching subfolder (see specs below).
2. Open `src/assets/manifest.ts` and uncomment / add the corresponding
   import + `url` assignment:
   ```ts
   import championsCupUrl from './trophies/champions-cup.svg';
   ...
   'champions-cup': { ...TROPHIES['champions-cup'], url: championsCupUrl }
   ```
3. Done. The component that consumes it starts rendering the art.

## Style anchor (apply to every generation prompt)

> Dark editorial premium sport-management aesthetic. Palette: deep navy
> background `#0D1219`, surface `#13181F`, trophy-gold primary
> `#E8A509`, royal-blue accent `#3379CC`, chrome silver `#C7CED6`.
> Matte surfaces, subtle rim-light, crisp vector edges. No saturated
> colour outside this palette. No photoreal faces. No text unless the
> spec explicitly calls for it. Think *Football Manager 2025 ×
> EA Sports FC × Apple sports*.

## Subfolder specs

| Folder | Count | Format | Size | Notes |
|--------|-------|--------|------|-------|
| `hero/` | 1 | WebP (+PNG fallback) | 2400×1600 @ Q82 | Title-screen backdrop. ~350 KB target. |
| `trophies/` | 8 | SVG | 100×140 viewBox | Gold silhouettes, must be distinguishable at 32px. |
| `crests/` | 5 | SVG | 256×256 viewBox | 4 division shields + `placeholder.svg`. |
| `empty-states/` | 5 | SVG | 240×180 viewBox | 2-colour gold+silver, 1.5px strokes. |
| `manager-avatars/` | 12 | PNG | 512×512 transparent | 480×480 circle inside, no photoreal faces. |
| `positions/` | 4 | SVG | 120×120 viewBox | 3px gold strokes, read at 24px. |
| `achievements/` | 10 | SVG | 160×160 viewBox | Gold circular frame + distinctive centre motif. |

Full per-asset prompts live in the chat log under "Asset generation
prompts". Keep generations consistent by running each set in a single
job (same seed / same model version).

## Optimization

- PNGs → `pngquant --quality=80-92 --strip` then `oxipng -o max`.
- SVGs → `svgo --multipass`.
- WebP generation → `cwebp -q 82`.

Target bundle impact: ≤400 KB total across all Tier 1–3 assets.
