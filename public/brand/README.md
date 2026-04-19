# Public brand assets

Long-lived branded assets served directly from `/` (cacheable forever).
Currently referenced by:

- `index.html` — `/apple-touch-icon.png`, `/og-image.png`
- Social share previews (Twitter/X, Facebook, iMessage, Slack)

## Expected files

| File | Size | Format | Notes |
|------|------|--------|-------|
| `apple-touch-icon.png` | 180×180 | PNG, opaque | iOS home-screen icon. Auto-fallback to `/icon.png` until present. |
| `og-image.png` (mirror to `/og-image.png`) | 1200×630 | PNG | Social share card. Designed lockup (wordmark + trophy). |
| `wordmark-600.png` | 600×200 | PNG transparent | 1x wordmark. |
| `wordmark-1200.png` | 1200×400 | PNG transparent | 2x wordmark. |
| `wordmark-1800.png` | 1800×600 | PNG transparent | 3x wordmark. |
| `dynasty-manager-wordmark.svg` | — | SVG | Vector master. |

## Once populated

Move `og-image.png` to the root `public/` (it needs to live at `/og-image.png`
to match the `<meta property="og:image">` tag in `index.html`).
