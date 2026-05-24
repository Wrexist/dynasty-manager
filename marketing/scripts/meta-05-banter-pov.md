# Meta-05 — Banter POV ("Mate, you'll never guess")

**Platform:** Meta Reels / Stories
**Length:** 25 seconds
**Aspect:** 9:16 (1080×1920)
**Effort:** UGC creator $200-500 (face-cam essential — DO NOT self-shoot this)

## Pitch

Pure UGC. A creator films a 25-second vertical phone-shot, half-face-cam,
half-screen-record, telling the most banter football-manager story they've
got. The format the football TikTok algorithm is trained on.

## Hook variants

| ID | Visual | Caption | Mechanism |
|----|--------|---------|-----------|
| A  | Face-cam, creator laughing already, holding phone | "Mate. You'll never guess." | POV question |
| B  | Mid-laugh smile, creator pointing at phone screen | "Look what happened in my save." | Curiosity |
| C  | Creator pretending to be on the verge of tears, phone in hand | "I think I might cry." | Comic exaggeration |
| D  | Creator deadpan: "So I'm playing this football manager." | (text: "So I'm playing this game...") | Story-opener |

## Shot list — UGC structure (loose, creator-led)

This is NOT a tight shot list. Brief the creator on the **arc**:

> **Arc:** "Mate, you'll never guess what just happened. So I was on a 6-game
> losing streak [SHOW SCREEN: form guide, all L's]. Board's about to sack
> me. Last game of the season. We're 1-0 down at 89 minutes. I bring on the
> wonderkid I scouted in season 1 [SHOW SCREEN: sub-on animation]. 90+3,
> bicycle kick. WE WIN. I keep my job. [SHOW: post-match popup with the
> board-confidence bar going up]. Honestly, what is this game."

Total length 20-22 seconds creator footage + 3-second CTA card.

## Beats (within the creator's 22 seconds)

| Time | What's on screen |
|------|------------------|
| 00:00-00:02 | Face-cam, hook |
| 00:02-00:05 | Cut to phone screen — form guide showing 6 L's in a row |
| 00:05-00:08 | Face-cam back, creator's reaction (laughing, despairing) |
| 00:08-00:12 | Phone screen: match clock at 89:00, score 0-1, then sub-on animation for wonderkid |
| 00:12-00:15 | Phone screen: minute 90+3, goal animation, score flips to 1-1 |
| 00:15-00:17 | Hold on score, crowd cheer, scoreboard ticks |
| 00:17-00:20 | Face-cam reaction — explosion of relief, laughing |
| 00:20-00:22 | "Honestly, what is this game" — caption + face-cam |
| 00:22-00:25 | CTA card |

## Captions

Captions should be CREATOR-VOICE, not brand-voice:
- "mate. you'll never guess what just happened."
- "6 losses in a row. board about to sack me."
- "89 mins. 0-1. one chance."
- "bring on the kid I scouted in season 1."
- "90+3. bicycle kick. WHAT."
- "honestly what is this game"

Lowercase, no exclamation points, no hashtags. Reads like a text message.

## Music

- **Vibe:** none from the creator side — let their voice carry it. Background music optional, very low (-18dB), upbeat indie/lo-fi if added.
- **YouTube Audio Library:** "lo-fi happy", "upbeat indie" — only as fade-in for the CTA card.

## CTA card

- Visual: app icon + "DYNASTY MANAGER" + "Free on iOS".
- Caption: "Get sacked. Probably. Free on iOS."
- Self-deprecating CTA outperforms cheerful CTAs on banter creatives — counterintuitive but proven.

## Capture instructions (for the creator)

Hand the creator this brief, verbatim:

> Hey — film a 22-second TikTok-style vertical phone video, half your face,
> half your screen showing Dynasty Manager. Tell the realest football-manager
> story you've got — a comeback win, a wonderkid signing, a sacking, a cup
> final. The arc should be: setup the stakes (~5s), build the drama (~10s),
> payoff (~5s), reaction (~2s). Caption it like a text message, not an ad.
> Send raw — we'll add the CTA card. Pay is $X for the video + posting rights.
> Sponsored disclosure mandatory.

## ffmpeg recipe

```bash
# Creator sends raw vertical mp4 / mov. We add the CTA card.
bash marketing/postproduction/build-ad.sh \
  --raw creator-raw.mp4 \
  --append-cta-card true \
  --cta-image marketing/posters/cta-card.png \
  --cta-duration 3 \
  --out meta-05-banter-pov.mp4
```

## Why this should convert

- **UGC drives +20% retention** vs polished (Mega Digital 2025) — creator voice is the unfakeable signal.
- **Football banter is a known meme structure** — viewers recognize the format and pre-commit to watching.
- **Self-deprecating brand voice** ("Get sacked. Probably.") differentiates from EA FC's hype-bro positioning.
- **Highest hold-rate format** of all 10 — narrative structure with a payoff at 00:17 keeps viewers to the CTA.

## Test plan

| Setting | Value |
|---------|-------|
| Platform | Meta Reels (and port to TikTok Spark) |
| Spend | $300 on creator + $500 paid spend |
| Variants | 4 hooks (A/B/C/D) cut from the same raw footage |
| Targeting | Broad, English-speaking, football interest |
| Kill | CPI > $5 after 5K impressions OR hold-rate < 8% |
| Scale | CPI < $3.50 AND hold-rate > 12% → scale to $200/day for 7 days |

This is the highest-confidence concept in the kit. Run it first if budget is constrained.
