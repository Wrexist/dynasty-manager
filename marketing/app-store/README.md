# App Store Screenshots

Marketing-style App Store screenshots for Dynasty Manager — bold headline +
accent word, a device mockup of the app, and glass chips / stat callouts in
the margins. Brand is the app's dark-glass + gold aesthetic (tokens lifted
from `src/index.css`), not a raw screen capture.

## What's here

| File | Role |
|------|------|
| `_appstore.css` | Single design system. Drives **both** device canvases from identical markup via `.shot` (iPhone) / `.shot.ipad`. |
| `gen.mjs` | Generator. One spec per screenshot → emits an iPhone **and** an iPad HTML file. Edit the `SHOTS` array here to change copy/content. |
| `shot-NN-*.iphone.html` | Generated — **do not hand-edit.** 1290×2796 (Apple 6.9"). |
| `shot-NN-*.ipad.html` | Generated — **do not hand-edit.** 2048×2732 (Apple 12.9" iPad Pro). |
| `render-all.sh` | Rasterises every `*.html` → `dist/*.png` at exact 1x pixel size. |
| `dist/` | Rendered PNGs. **Gitignored** (same as `posters/dist`) — regenerate on demand. |

## The 10 screenshots

1. **Built to win every season** — dashboard + 5★ award badge
2. **Manage the clubs you love** — club picker + league pills
3. **Live every minute** — live match + possession / clock / xG callouts
4. **Chase the icons** — pack walkout + OVR / rarity callouts
5. **Master your tactics** — formation pitch + formation pills
6. **Win the transfer window** — signing sheet + fee / rating / boost callouts
7. **Build a dynasty** — trophy cabinet + honours badge
8. **Conquer Europe** — continental bracket + titles callouts
9. **Develop wonderkids** — youth prospect growth + potential callouts
10. **Lead your nation** — national-team squad + tournament callouts

## Regenerate

```bash
node marketing/app-store/gen.mjs        # rebuild HTML from specs
bash marketing/app-store/render-all.sh  # rasterise HTML → dist/*.png
```

`render-all.sh` uses the Chromium that ships in the dev container (falls back
to a `google-chrome`/`chromium` on `PATH`). No `playwright install` needed.

## Apple sizing notes

- **6.9" iPhone** (1290×2796) and **12.9" iPad Pro** (2048×2732) are the only
  two sizes App Store Connect *requires*; it downscales each to fill the
  smaller device slots. Rendering one set per family covers the whole listing.
- Rendered at **1x** on purpose — Apple validates exact pixel dimensions, so a
  2x render (e.g. 2580×5592) would be rejected.
- Upload order in App Store Connect = display order on the product page; shot
  01 (the hook) should be first.
