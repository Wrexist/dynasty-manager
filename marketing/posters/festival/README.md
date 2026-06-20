# World Cup Festival — promo creatives

On-brand promo images for the 2026 World Cup Festival live event (dark-glass +
gold, matching the in-app design). Built as **SVG** (scalable, editable).

| File | Size | Use |
|---|---|---|
| `festival-hero-9x16.svg` | 1080×1920 | Stories / Reels / TikTok, App Store screenshot |
| `festival-square-1x1.svg` | 1080×1080 | Instagram / Facebook feed |
| `festival-screen-9x16.svg` | 1080×1920 | In-app screen mockup (phone frame) — store/feature shot |

## Rasterise to PNG/JPG
SVGs work directly in Canva/Figma/Keynote (drag them in). For PNGs:

```bash
# Option A — Playwright (Chromium), same tool as render-all.sh:
npx playwright install chromium   # one-time
node -e "import('playwright').then(async({chromium})=>{const b=await chromium.launch();const p=await b.newPage();for(const [f,w,h] of [['festival-hero-9x16',1080,1920],['festival-square-1x1',1080,1080],['festival-screen-9x16',1080,1920]]){await p.setViewportSize({width:w,height:h});await p.goto('file://'+process.cwd()+'/marketing/posters/festival/'+f+'.svg');await p.screenshot({path:'marketing/posters/festival/'+f+'.png',clip:{x:0,y:0,width:w,height:h}});}await b.close();})"

# Option B — rsvg-convert / ImageMagick:
rsvg-convert -w 1080 -h 1920 festival-hero-9x16.svg -o festival-hero-9x16.png
```

> Note: SVGs reference Oswald/DM Sans (the app fonts) with system-sans
> fallbacks. Install those fonts before rasterising for pixel-perfect type.
