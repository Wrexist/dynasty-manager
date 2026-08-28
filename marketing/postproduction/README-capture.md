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
| `legend` | `0` | `1` forces a Hall of Legends pull; `0` deals ordinary real players |
| `realOnly` | `1` | Reject any pack containing an invented player (see below) |
| `minHero` | `0` | Re-roll until the best card reaches this OVR |
| `hook` / `mid` / `cta` | — | Caption text (URL-encoded) |
| `hookUntil` / `midFrom` / `midUntil` / `ctaFrom` | 3.4 / 6.5 / 9.5 / 13 | Caption timing, in seconds **from the start of the take** — the rig zeroes the harness clock via `window.__adClockStart`, so these match the finished file rather than running ahead of it |

Captions are rendered in the DOM, not burned by ffmpeg — the bundled Playwright
ffmpeg is a stripped build with no `drawtext`. Doing them in the DOM also keeps
them in the app's own font and palette.

## Output format — MP4, and why it is not automatic everywhere

**TikTok's uploader accepts MP4/MOV/MPEG/3GP/AVI and rejects WebM.** The
Playwright-bundled ffmpeg is a stripped build with no libx264, so a rig using
only that binary can produce nothing TikTok will take — which is exactly how
the first cut of these ads shipped in an unusable format.

`encode-ad.mjs` now picks its container from what it can actually do. It tries,
best first: `$FFMPEG`, `.cache/ffmpeg`, `node_modules/ffmpeg-static/ffmpeg`,
`ffmpeg` on PATH, then Playwright's. The first build that reports `libx264`
wins and the output is H.264 MP4 (`setsar=1`, `+faststart`, high profile,
CRF 18). If only a VP8 build is found it still encodes, but names the file
`.webm` and warns that TikTok will refuse it — it will not hand you an `.mp4`
containing VP8.

To get the H.264 path on a machine without ffmpeg:

```bash
npm run ads:ffmpeg     # ~79 MB into .cache/ffmpeg, gitignored
```

That is a fetch-on-demand rather than a dependency on purpose: `ffmpeg-static`
in `package.json` would put a 79 MB postinstall in front of every contributor
and every CI run to serve one marketing script, and committing the binary would
put it in every clone forever.

## Real players only — the trap this rig fell into

`pickRealPlayerForPack` falls back to a **procedurally generated** player when
a band has nobody real at the rolled position. That is correct in the game and
wrong in an ad whose whole claim is "these are FC27's actual players".

Worse, the fallback fires for the whole pack if the real-player pool has not
been loaded — it is lazily imported, and the app awaits it during init while a
bare harness does not. The first cut of these ads was five invented players per
frame, with real-*sounding* names (Iker Gutierrez, Radamel Zapata) that read as
genuine. The harness now awaits `loadNationalPool()` before generating, and
`realOnly=1` rejects any pack still containing a generated card. If you ever see
plausible-but-unfamiliar names in a capture, check the console: the rig logs
loudly rather than shipping them.

Achievable hero floors with `realOnly=1`, measured over 300 packs per cell:

| tier | 88 | 90 | 91 | 92 | 94 |
|---|---|---|---|---|---|
| `rare` | 58% | 42% | 25% | 18% | 0% |
| `premium` | 30% | 0% | — | — | — |
| `icon` | 100% | 41% | 29% | 24% | 5% |

`rare` at `minHero=92` gives Wirtz / Vini Jr. / Yamal / Valverde; `icon` at 94
gives Salah, Mbappé, Haaland, Bellingham. `premium` cannot exceed 89 with real
players, so do not ask it to.

## Flags

`FlagIcon` loads from an external CDN with `loading="lazy"` and falls back to
an emoji flag on failure — and headless Chromium has no emoji font, so the
fallback is a blank box. The harness preloads every flag the pack needs and
waits for them before mounting the overlay. Every card wore an empty rectangle
before that.

## Framing

Capture is 780×1688 (9:19.5); the encoder scales to 1080 wide and centre-crops
to 1080×1920. Captions sit at 18% from the top and 12% from the bottom, each
behind a feathered scrim — the crop eats the outer edges, TikTok's own chrome
covers the bottom fifth and the right rail, and an unscrimmed caption over the
gold card artwork loses. An early cut put the hook at 9% and it landed exactly
on the crop line.

## Known limits

- One `pack` plan is implemented. Other screens need their own click sequence
  in `capture-ad.mjs` and their own harness route.
- Audio is not captured. Add music in-platform (TikTok's Commercial Music
  Library keeps the asset licensed for paid use).
