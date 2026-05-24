# TikTok-05 — "Why Is This Free" (Question-Hook Evergreen)

**Format:** In-feed video or Spark Ad
**Length:** 14 seconds
**Effort:** Self-shoot 20 min — the rapid-cut tour does all the work

## Pitch

The most evergreen, lowest-effort, most-portable script in the kit. Open
with the question, take a 10-second rapid-cut tour of the most visually
compelling app surfaces, close with "ngl this is free."

This format has no trend dependency, no creator dependency, no story
dependency. It runs for months. Use as the always-on baseline creative.

## Hook (0-1s) — 4 variants

| ID | Visual | Caption |
|----|--------|---------|
| A  | Face-cam (or just phone screen), creator deadpan | "how is this game £0" |
| B  | Pack walkout reveal at peak frame | "ngl how is this free" |
| C  | Cup-lift, freeze-frame, zoom-in | "this game is free?" |
| D  | Big text-only black frame, white text | "I genuinely don't understand how this is free" |

## Shot list — rapid cuts (every 1-2 seconds)

| Time | Shot |
|------|------|
| 00:00-00:01 | Hook |
| 00:01-00:02.5 | Pack opening — walkout flash (1.5s) |
| 00:02.5-00:04 | Tactical board with formation, drag-drop animation (1.5s) |
| 00:04-00:05.5 | Transfer market — scroll through cards, prices tick (1.5s) |
| 00:05.5-00:07 | Match-day overlay — minute clock running, scoreboard, goal animation (1.5s) |
| 00:07-00:08.5 | Squad screen — list of players, ratings, sort animation (1.5s) |
| 00:08.5-00:10 | Trophy cabinet — multiple trophies, gold (1.5s) |
| 00:10-00:11.5 | Inbox — incoming bid notification slides in (1.5s) |
| 00:11.5-00:14 | Plain frame, lowercase white text: **"ngl this is free."** + "search Dynasty Manager" |

Each cut needs to be CRISP. The visual variety is the hook — 7 different
in-app surfaces in 10 seconds.

## Captions (lowercase, one per beat)

- Hook: "how is this game £0"
- "pack walkouts"
- "real tactics"
- "live transfer market"
- "every minute simulated"
- "92 clubs, 4 divisions"
- "trophies"
- "live transfer bids"
- "ngl this is free"

## Music

- **Vibe:** upbeat, drum-led, percussive. Each cut should land on a beat.
- **YouTube Audio Library:** "upbeat percussion", "energetic indie", "trap beat instrumental" at ~120-130 BPM.
- **Sync:** every video cut at 1.5s should land on a kick drum. This is what makes the rapid-fire feel addictive vs jarring.

## CTA

Plain frame, lowercase white text on black:
> **"ngl this is free."**
> **"search Dynasty Manager"**

That's it. No brand card. The native lowercase reads as a real recommendation.

## Capture instructions

Capture each of these 7 in-app moments as a 2-3 second screen recording:

1. **Pack walkout** — open a Rare Gold pack, capture explode → walkout (2s)
2. **Tactics** — open Tactics page, drag a player to a new position (2s)
3. **Transfer market** — open Transfer page, scroll through listings (2s)
4. **Match-day** — start a match, capture goal animation + scoreboard (2s)
5. **Squad screen** — Squad page, scroll-sort by rating (2s)
6. **Trophy cabinet** — Trophy Cabinet page, full view of trophies (2s)
7. **Inbox bid** — open Inbox, show an incoming bid notification (2s)

All on iPhone, vertical, QuickTime recording. Trim each to ~1.5s in iMovie or CapCut.

## ffmpeg recipe

```bash
# Multi-clip rapid-cut assembly
bash marketing/postproduction/build-ad.sh \
  --raw-clips pack.mov,tactics.mov,transfer.mov,match.mov,squad.mov,trophy.mov,inbox.mov \
  --clip-duration 1.5 \
  --transition cut \
  --captions free-captions.srt \
  --music upbeat-120bpm.mp3 \
  --beat-sync true \
  --out tiktok-05-why-is-this-free.mp4
```

## Why this should convert

- **Question hook** is one of the highest-performing opener types on TikTok across all categories (Mega Digital 2025 — cites 63%+ of high-CTR TikToks deliver key message in opening moment).
- **"Free" as the differentiator** — single most powerful word in F2P mobile ads. Lead with it.
- **Visual variety** in 10 seconds shows depth without explaining it. Lets the viewer's brain do the work.
- **Evergreen format** — no story, no creator, no trend dependency. Runs for months with no rework.
- **Cross-platform port** — same edit works on Meta Reels with caption tweak.

## Test plan

This is the **always-on baseline**. Set it and forget it for 30 days.

| Setting | Value |
|---------|-------|
| Platform | TikTok in-feed + Meta Reels (run same edit on both) |
| Spend | $20-30/day evergreen, no expiry |
| Variants | 4 hooks × 1 body |
| Refresh | Re-cut the body every 60 days as new app features ship |
| Read | This is the baseline against which you measure all other creatives. If a story-driven creative can't beat this baseline's CPI, it's not worth scaling. |

If this concept hits CPI < $3 sustained, you've validated that "Dynasty
Manager is free" is the strongest hook in your kit. Lean into it everywhere.
