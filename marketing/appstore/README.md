# App Store Screenshots — real-game, 3D

Premium iPhone App Store screenshots for **Dynasty Manager: Football**. Takes
the real in-game screens from the current live listing (`docs/ingame/*.png` —
real clubs, real players, evergreen) and re-composites their device content
into an immersive, perspective-tilted **3D device** (depth shadow, screen
glare, rim light) on the green Dynasty Manager brand system.

- **Canvas:** 1284 × 2778 (iPhone 6.7"), matching the source `docs/ingame`
  assets exactly. Accepted for the 6.5"/6.7" App Store screenshot slot.
- **Set:** 5 panels, in App Store display order.
- **On-device pixels are the verbatim real game** — we crop just the device
  glass out of the source shots (`CROP` in `build.mjs`, measured once with
  `detect-glass.mjs`) and re-frame it in 3D. No mockups, no World Cup.
- **Final files** land directly in `/marketing` as
  `appstore-screenshot-01.png` … `05.png` — ready to upload to App Store
  Connect, no digging through `out/`.

## The 5 panels

| # | Headline | Source screen |
|---|----------|---------------|
| 01 | COLLECT & **UPGRADE** | Squad — real player cards |
| 02 | SET YOUR **LINEUP**   | Match prep — formation + chemistry |
| 03 | FEEL EVERY **MINUTE** | Live match — commentary + tactics |
| 04 | EVERY DETAIL **MATTERS** | Tactics — advanced instructions |
| 05 | TRAIN YOUR **STARS**  | Training ground |

(Green word = the accent second line, matching the current listing.)

## Render

```bash
node marketing/appstore/build.mjs        # English → /marketing/appstore-screenshot-01..05.png
node marketing/appstore/build.mjs de     # a locale (once captions are localized) → out/de/
```

Only the `en` run copies its output up to `/marketing` (the final, ready-to-upload
set); other locales stay under `out/<locale>/` until the localization pass is
signed off.

Requires Playwright + the bundled Chromium at `/opt/pw-browsers/chromium-1194`
(falls back to the default install). Fonts (Montserrat, DM Sans) load from
Google Fonts at render time — the build explicitly awaits them, so it needs
network.

## Localization (next step)

Captions are currently English in `PANELS`. The localization pass translates
the 5 headlines + subtitles per storefront and renders `out/<locale>/`. App
Store Connect takes one folder per storefront, filenames `01→05` in order.
`captions.mjs` parses the authored ASO copy in `../aso/locales/*.md` (App Name +
metadata) for reuse.

## Files

- `build.mjs` — the generator (3D device, brand system, panel/caption defs).
- `detect-glass.mjs` — one-off util that measured the device-glass crop rect.
- `captions.mjs` — parses `../aso/locales/*.md` (App Name + ASO metadata).
- `out/` — rendered PNGs (git-ignored; regenerate or grab the delivered zip).
