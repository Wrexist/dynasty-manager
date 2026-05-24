# TikTok-04 — Promotion Rewind ("Div 4 to Premier League in one save")

**Format:** In-feed video (or Spark Ad if creator-shot)
**Length:** 18-21 seconds
**Effort:** Self-shoot 30-45 min OR UGC creator $200-400

## Pitch

Cup-lift moment → hard cut backwards through season highlights, all the way
back to the empty starter squad. Same arc as Meta-01, but TikTok-shorter and
TikTok-banter. Pure underdog porn.

## Hook (0-1s) — 4 variants

| ID | Visual | Caption (lowercase, big text overlay) |
|----|--------|----------------------------------------|
| A  | Cup-lift moment, gold flash | "div 4 to premier league in one save" |
| B  | Black 0.3s → cup-lift hits | "couldn't put it down" |
| C  | Trophy room screen, multiple trophies | "this took 5 in-game seasons. and one weekend." |
| D  | Face-cam (UGC), creator pointing at phone | "lads. this happened." |

## Shot list

| Time | Shot | Caption |
|------|------|---------|
| 00:00-00:01 | Hook | Hook caption |
| 00:01-00:03 | Cup-lift animation in full — particles, gold flash, manager celebration | "premier league. just promoted." |
| 00:03-00:03.3 | Hard cut backwards | (text: "←") |
| 00:03.3-00:05 | Last match: 90+3, late winner, scoreline flips | "title-clinching goal" |
| 00:05-00:05.3 | Cut | "←" |
| 00:05.3-00:07 | Wonderkid debut animation | "wonderkid I scouted in season 1" |
| 00:07-00:07.3 | Cut | "←" |
| 00:07.3-00:09 | Inbox — "BOARD: You will be sacked if you don't finish top 6" | "board threat in season 2" |
| 00:09-00:09.3 | Cut | "←" |
| 00:09.3-00:11 | Squad screen — div 4 starting XI, all 55-65 OVR | "div 4 starter squad" |
| 00:11-00:14 | Hold on squad screen, slow camera pan | "started here." |
| 00:14-00:17 | Match-by-match form guide showing season-long progression: L L L W D W W W ... | "5 seasons. one save." |
| 00:17-00:21 | Native CTA — "search Dynasty Manager" lowercase text on plain background | "search Dynasty Manager. it's free." |

## Music

- **Vibe:** dramatic build with a beat-drop at 00:11 (start of "started here" hold) and another at 00:17 (CTA).
- **YouTube Audio Library:** "epic build cinematic", "underdog anthem", "orchestral hip-hop"
- **TikTok-native option:** use a trending dramatic-build sound (Sound Library on TikTok). Trend-jacking acceptable HERE because the format is timeless.

## Captions

Lowercase, period-terminated, sized large enough to fill ~70% of frame width.
Caption at every beat:
- "premier league. just promoted."
- "title-clinching goal"
- "wonderkid I scouted in season 1"
- "board threat in season 2"
- "div 4 starter squad"
- "started here."
- "5 seasons. one save."
- "search Dynasty Manager. it's free."

## CTA — native style, no brand card

Plain text overlay on last frame:
> **"search Dynasty Manager. it's free."**

Add app icon ONLY if hold-rate testing shows viewers wanted clearer brand recall.

## Capture instructions

1. **Cinematic Capture → "Promotion Rewind"** beat (when shipped, sequence multiple beats).
2. Manual recipe — capture each beat separately and assemble:
   - Cup-lift: end-of-season trophy modal screen-recorded
   - Late winner: mid-match overlay during a close game
   - Wonderkid debut: load a save and screen-record the player's first match
   - Board threat: open Inbox, capture a board confidence message
   - Starter squad: start a new career in div-4 club, screen-record squad screen

## ffmpeg recipe

```bash
# Multi-clip assembly — concat 5-6 screen-recordings in reverse-chronology
bash marketing/postproduction/build-ad.sh \
  --raw-clips cup-lift.mov,late-winner.mov,wonderkid-debut.mov,board-threat.mov,starter-squad.mov \
  --reverse-order false \
  --captions promotion-captions.srt \
  --music cinematic-build.mp3 \
  --out tiktok-04-promotion-rewind.mp4
```

## Why this should convert

- **Underdog narrative** has the highest hold-rate of any format for sports games (it's the FM/Top Eleven save-story content engine in 20 seconds).
- **Reverse-chronology structure** is rare on TikTok = pattern interrupt for the algorithm and the viewer.
- **Five micro-stakes ramps** in 14 seconds = sustained hold.

## Test plan

| Setting | Value |
|---------|-------|
| Platform | TikTok in-feed (or Spark if creator-shot) |
| Spend | $300 over 7 days |
| Variants | 4 hooks × 1 body |
| Kill | CPI > $4 OR hold-rate < 12% after 5K impressions |
| Scale | CPI < $2.50 AND hold-rate > 15% → port to Meta as Meta-01 variant |
