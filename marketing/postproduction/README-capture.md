# Headless ad capture — 1080×1920 at a true 60fps

Generates finished vertical ad footage from the real app in Chromium. No phone,
no screen recording, no creator. Regenerate any time a visual changes.

```bash
npm run dev -- --host 127.0.0.1          # terminal 1

# terminal 2 — capture, then encode
node marketing/postproduction/capture-ad.mjs /tmp/ad1 \
  "http://127.0.0.1:8080/capture.html?tier=rare&legend=1&hook=YOUR%20LEGENDS%20DON'T%20RETIRE&mid=THEY%20COME%20BACK%20AS%20CARDS&cta=DYNASTY%20MANAGER%20·%20FREE%20ON%20IOS" \
  4 pack

node marketing/postproduction/encode-ad.mjs /tmp/ad1 /tmp/ad1.webm 0.3 13.6
```

## The problem this solves

Chromium's DevTools screencast is the only way to pull frames out of a headless
page, and its JPEG encoder is the bottleneck: measured in this container it
delivers **58fps at 390×844, 28fps at 780×1688, and 13fps at 1080×2338**. So a
real-time capture cannot produce a 60fps asset at ad resolution. Duplicating
frames to hit 60 is not 60fps — it is 28fps in a 60fps container, and it looks
like it.

`capture-ad.mjs` slows the page down instead. It patches `performance.now`,
`Date.now`, `setTimeout` and `setInterval` inside the page, and drops the CDP
Animation domain playback rate, all by the same factor (default 4×). The
screencast still runs at ~28 real fps, but the page is running at quarter
speed, so that is **~95–140 frames per second of page time**. Every frame is
genuinely rendered — nothing is duplicated or interpolated.

`encode-ad.mjs` then picks, for each 1/60s slot on the page-time timeline, the
frame that was actually on screen at that instant, and encodes at a constant
60fps.

Both halves of the dilation matter: the JS clock patch covers framer-motion
(rAF-driven), and the Animation domain covers CSS keyframes and transitions,
which run on the compositor clock the JS patch cannot reach. The `setTimeout`
stretch covers the pack overlay's phase scheduler — without it the phases fire
early relative to the animations they bracket.

## Query parameters (`capture.html`)

| Param | Default | Meaning |
|---|---|---|
| `tier` | `rare` | Pack tier: `rare`, `icon`, `premium` |
| `legend` | `1` | `1` forces a Hall of Legends pull; `0` for an ordinary open |
| `hook` / `mid` / `cta` | — | Caption text (URL-encoded) |
| `hookUntil` / `midFrom` / `midUntil` / `ctaFrom` | 3.4 / 6.5 / 9.5 / 13 | Caption timing, in **page-time seconds** |

Captions are rendered in the DOM, not burned by ffmpeg — the bundled Playwright
ffmpeg is a stripped build with no `drawtext` (and no libx264: output is VP8
WebM, which TikTok, Reels and Shorts all accept). Doing them in the DOM also
keeps them in the app's own font and palette.

## Framing

Capture is 780×1688 (9:19.5); `encode-ad.mjs` scales to 1080 wide and
centre-crops to 1080×1920. Keep captions between 20% and 74% of frame height —
outside that they are eaten by the crop or by TikTok's own chrome.

## Known limits

- One `pack` plan is implemented. Other screens need their own click sequence
  in `capture-ad.mjs` and their own harness route.
- Audio is not captured. Add music in-platform (TikTok's Commercial Music
  Library keeps the asset licensed for paid use).
