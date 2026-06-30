# App Store Screenshots

App Store screenshots for Dynasty Manager that frame **real in-game
screenshots** of the running app inside a device mockup, with a bold headline
and feature-highlight callouts. Brand is the app's dark-glass + gold aesthetic.

## Pipeline (3 steps)

```bash
# 0. dev server (IPv4 host — :: is not supported in the dev container)
npx vite --host 127.0.0.1 --port 8080

# 1. capture real in-game screens → dist/cap-*.png  (628×1308 @2x)
node marketing/app-store/capture.mjs

# 2. frame them into App Store layouts (HTML for both devices)
node marketing/app-store/gen.mjs

# 3. rasterise → dist/shot-*.png at exact 1x App Store sizes
bash marketing/app-store/render-all.sh
```

## Files

| File | Role |
|------|------|
| `capture.mjs` | Drives the app (new Sandbox save: England → Premier League → Arsenal, real players) and screenshots each feature screen into `dist/cap-*.png`. The community-pack import on first launch takes ~60–90s. |
| `gen.mjs` | Frames each capture into a device mockup with headline + callouts. Edit the `SHOTS` array to change copy or which capture/callouts a shot uses. |
| `_appstore.css` | Single design system; iPhone vs iPad is just a `.shot` / `.shot.ipad` class (callouts reflow into the wide iPad margins). |
| `shot-NN-*.iphone.html` | Generated — **do not hand-edit.** 1290×2796 (Apple 6.9"). |
| `shot-NN-*.ipad.html` | Generated — **do not hand-edit.** 2048×2732 (Apple 12.9" iPad Pro). |
| `render-all.sh` | Rasterises every `*.html` → `dist/*.png` at exact 1x size. |
| `dist/` | All captures + rendered PNGs. **Gitignored** (same as `posters/dist`) — regenerate on demand. |

## The 10 screenshots (each over a real screen)

1. **Build a football dynasty** — dashboard hub + 5★ badge
2. **Manage the clubs you love** — club picker + league pills
3. **Build your dream squad** — squad (real FUT-style cards) + rating callouts
4. **Master your tactics** — formation pitch + chemistry callouts
5. **Live every minute** — live match (xG, momentum, commentary) callouts
6. **Win the transfer window** — market + budget / target callouts
7. **Chase the icons** — pack screen (rare gold) + walkout callouts
8. **Develop wonderkids** — youth academy + dev-speed / potential callouts
9. **Lead your nation** — national-team squad + World Cup callout
10. **Climb every league** — full league table + promotion / Europe callouts

## Apple sizing notes

- **6.9" iPhone** (1290×2796) and **12.9" iPad Pro** (2048×2732) are the only
  two sizes App Store Connect *requires*; it downscales each to fill the
  smaller device slots, so one set per family covers the whole listing.
- Captures and final shots render at **1x** — Apple validates exact pixel
  dimensions, so a 2x render would be rejected.
- Upload order in App Store Connect = display order; lead with shot 01.
