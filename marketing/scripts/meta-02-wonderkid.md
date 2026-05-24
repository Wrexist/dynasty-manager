# Meta-02 — Wonderkid Reveal ("£0. 17. 92 potential.")

**Platform:** Meta Reels / Stories / Feed
**Length:** 22 seconds
**Aspect:** 9:16 (1080×1920)
**Effort:** Self-shoot 1h, OR UGC creator $200-500

## Pitch

The football fantasy: scout a free 17-year-old wonderkid, build him into a
£80M star, reject every bid. Pure "this is the dream" content for the
football-management audience.

## Hook variants

| ID | Visual | Caption (large text) | Mechanism |
|----|--------|----------------------|-----------|
| A  | Scouting screen, magnifying glass over a youth player card | "£0. 17 years old. 92 potential." | Stakes/numbers |
| B  | Same scouting screen, finger tapping "Sign" | "Found him for free." | Authority |
| C  | Close-up of player card overall ticking up: 68 → 70 → 75 → 88 → 92 | "From 68 to 92 in 3 seasons." | Progression |
| D  | Black for 0.3s → "REJECT" stamp slams onto an £80M bid notification | "Some things money can't buy." | Banter |

## Shot list

| Time | Shot | Caption |
|------|------|---------|
| 00:00-00:01.5 | **HOOK** (pick) | Hook caption |
| 00:01.5-00:04 | Scouting screen, player attribute reveal animation | "He cost £0." |
| 00:04-00:06 | "Sign" button confirmation modal, tap to accept | "I signed him as a 17-year-old." |
| 00:06-00:09 | First-team debut: kit-on animation, runs onto pitch | "Debut: season 1." |
| 00:09-00:11 | Match goal cinematic, scoreboard ticks up | "First goal: minute 73." |
| 00:11-00:13 | Season-summary modal showing 12 goals stat | "12 goals. Won the title." |
| 00:13-00:16 | Transfer inbox: incoming bid "£80,000,000 — Real Madrid" | "£80m bid from Real." |
| 00:16-00:18 | Hover hand on "Reject" → tap. Red "REJECTED" stamp animation | "Mine." |
| 00:18-00:20 | App icon + "Free on iOS" CTA card | "Find your wonderkid. Free." |
| 00:20-00:22 | Hold | (silent) |

## VO (optional)

> "Found a free wonderkid in season one. Real Madrid bid eighty million in season three. Mate, he's not for sale."

11 seconds, overlay 00:09-00:20. Banter-leaning UK English tone.

## Music

- **Vibe:** Confident hip-hop instrumental, mid-tempo, drum-heavy. Should feel like a confidence anthem, not cinematic.
- **YouTube Audio Library search:** "confident hip-hop", "swagger instrumental", "trap chill"
- **Specific:** "Big Boss" by NEFFEX (royalty-free if you credit), or any instrumental from the "Hip Hop & Rap" YT Library category at ~85-95 BPM.

## CTA card

- Visual: app icon, "DYNASTY MANAGER" wordmark, "Free on iOS" badge.
- Caption: "Find your wonderkid. Free."

## Capture instructions

1. **Cinematic Capture → "Wonderkid Signing"** beat (when shipped).
2. Manual recipe:
   - Start any save, open Youth Academy or Scouting.
   - Find a player with potential > 88 (or generate one — load a save with a known wonderkid).
   - Screen-record the scouting/sign flow.
   - For the £80M bid moment: load a save where you have a star (any 88+ player), use the dev console or wait for an AI bid, screen-record the inbox.
3. For the "REJECTED" stamp: this is post-production overlay (PNG + Premiere/CapCut keyframe animation). Asset in `marketing/posters/assets/rejected-stamp.png` if rendered.

## ffmpeg recipe

```bash
bash marketing/postproduction/build-ad.sh \
  --raw wonderkid-raw.mov \
  --captions wonderkid-captions.srt \
  --vo wonderkid-vo.m4a \
  --music confident-hip-hop.mp3 \
  --out meta-02-wonderkid.mp4
```

## Why this should convert

- **Football fantasy** — every football manager community is 80% wonderkid lists. Tapping into the existing meme/desire is the cheapest hook.
- **Stakes ramp** clear: free → debut → title → £80M bid → reject. Five micro-payoffs in 20 seconds.
- **Banter "Mine."** ending lands the brand voice — informal, fan-aligned, anti-corporate.

## Test plan

Same structure as Meta-01. 4 hooks × shared body, $500 over 10 days. Compare CPI against Meta-01 to see which angle wins for *this* audience: underdog narrative vs wonderkid fantasy.
