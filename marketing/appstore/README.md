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

---

# Hero-cluster set (`build-hero.mjs`) — all three display sizes

The second, more immersive screenshot system: a bold two-line headline with a
gradient accent word, a centre hero device flanked by two cropped
perspective-tilted devices, floating gold/glass callout pills, and emoji
stickers orbiting the cluster — the layered poster style the top-grossing
life/management sims use. Same rule as above: **on-device pixels are the
verbatim real game**, cropped out of `docs/ingame/*.png` with the same `CROP`
rect.

Unlike `build.mjs` (one canvas), this one renders every size the App Store
listing needs:

| Target | Canvas | Slot |
|---|---|---|
| `iphone-6.9` | 1284 × 2778 | 6.7" canvas — ASC takes it in the 6.5" slot |
| `iphone-6.5` | 1242 × 2688 | iPhone 6.5" |
| `ipad-13` | 2064 × 2752 | iPad 13" |

Layout is expressed as **fractions of the canvas** (`PROPS.phone` /
`PROPS.tablet`), so the composition holds across the ≈1:2.17 phone and ≈1:1.33
tablet aspect ratios instead of being letterboxed.

## The 5 panels

| # | Headline | Hero screen | Gold pill |
|---|----------|-------------|-----------|
| 01 | Manage any **club.** | Dashboard | 756 REAL CLUBS |
| 02 | Feel every **minute.** | Live match | 83' — 4-0 UP |
| 03 | Collect gold **legends.** | Squad — player cards | 91 OVR WALKOUT |
| 04 | Own the **market.** | Transfer market | £81.8M BID |
| 05 | Lead your **nation.** | National team | WORLD CUP CALL-UP |

## Render

```bash
node marketing/appstore/build-hero.mjs             # all three targets
node marketing/appstore/build-hero.mjs ipad-13     # one target
```

Output: `marketing/appstore/hero/<target>/01..05.png` — upload order is the
filename order. A full run takes ~4 min (the iPad canvas is the slow one).

Montserrat comes from Google Fonts at render time; **DM Sans is inlined from
the project's own `@fontsource` copy**, because a network miss on the Google
stylesheet silently drops the body font to a serif — invisible in the console,
obvious in the PNG. Emoji stickers need `Noto Color Emoji` installed on the
render host (it is, in CI and in the dev container).

## Editing

- **Copy** — `PANELS` (kicker / white line / accent line / sub / pill text).
- **Which screens appear** — `hero`, `left`, `right` per panel, keyed off `SRC`.
- **Composition** — `PROPS`; every value is a fraction of width (`px`) or
  height (`py`), so nudging one number moves that element on all three sizes.
- **Stickers** — `[emoji, x%, y%, size-multiplier, rotation]`.

## Files

- `build.mjs` — the single-device 3D generator (brand system, panel defs).
- `build-hero.mjs` — the hero-cluster generator, all three display sizes.
- `detect-glass.mjs` — one-off util that measured the device-glass crop rect.
- `captions.mjs` — parses `../aso/locales/*.md` (App Name + ASO metadata).
- `out/` — rendered PNGs from `build.mjs` (git-ignored).
- `hero/` — rendered PNGs from `build-hero.mjs` (committed — these are the
  ready-to-upload set).
