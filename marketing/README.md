# Dynasty Manager — Marketing Kit

Everything you need to ship paid UA creatives for Meta and TikTok without
re-thinking the brief every time. Hand any one of these scripts to a creator
(or shoot yourself with a phone) and ship in under an hour.

## How to use this directory

```
marketing/
├── README.md              ← you are here
├── scripts/
│   ├── meta-01-trophy-rewind.md       ← 5 Meta/Reels scripts
│   ├── meta-02-wonderkid.md
│   ├── meta-03-transfer-drama.md
│   ├── meta-04-pack-walkout.md
│   ├── meta-05-banter-pov.md
│   ├── tiktok-01-wonderkid-save.md    ← 5 TikTok Spark Ad scripts
│   ├── tiktok-02-pack-reaction.md
│   ├── tiktok-03-bid-reject.md
│   ├── tiktok-04-promotion-rewind.md
│   └── tiktok-05-why-is-this-free.md
├── posters/               ← Static HTML poster ads (open in browser, screenshot to PNG at 1080×1920)
│   ├── poster-01-trophy.html
│   ├── poster-02-wonderkid.html
│   ├── poster-03-pack-walkout.html
│   ├── poster-04-transfer-bid.html
│   ├── poster-05-banter.html
│   └── render-all.sh      ← optional: render all posters to PNG via Chromium headless
├── postproduction/
│   ├── build-ad.sh        ← ffmpeg pipeline: raw screen-recording + captions → final 9:16 ad
│   └── captions.template.srt
└── ai-prompts.md          ← Ready-to-paste Runway / Veo / Sora prompts
```

## The fastest path to a shipped ad

1. **Pick a script** from `scripts/`. Each is frame-precise — every shot, caption, length, and CTA is decided.
2. **Capture the footage:**
   - **Easiest:** in-app — enable "Cinematic Mode" (Settings → Cinematic Capture) and screen-record on iPhone with QuickTime or the iOS recorder. The mode loops the canonical money-shot beats framed for 9:16.
   - **Authentic UGC:** pay a football-niche TikTok creator (10K-100K followers) ~$200-500 to record the script as a Spark Ad — current best-performing format.
   - **AI-generated:** use the prompts in `ai-prompts.md` with Runway, Veo, or Sora.
3. **Post-produce** with `postproduction/build-ad.sh raw.mov caption-file.srt music.mp3 → final.mp4`.
4. **Launch** as Meta Advantage+ Creative (4-6 hook variants × 1 body) or TikTok Spark Ads. See `/project:marketing-playbook` for budgets and kill criteria.

## What's the conversion math?

Industry baselines for iOS sports-sim ads, 2025-2026:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Hook-rate (3s view %) | < 15% | Kill the hook |
| Hold-rate (% to CTA) | < 5% | Kill the variant |
| CPI | > $6 | Kill (after 5K impressions) |
| CPI | < $4 + hold > 10% | Scale |

The spread between best and worst hook on identical body footage is **40-60%**.
That means: don't pick "the best" script. Run 3-5 hooks of the same body in
parallel and let the platform algorithm route. The Advantage+ Creative
campaign type is now the default for sub-$10K/mo accounts.

## Tone — non-negotiable

- **Banter > polished.** UK/EU football fans reward informal voice.
- **Captions on every frame** — 80% of Reels/TikTok plays are sound-off.
- **No fail-ads, no bait-and-switch** — damages D1 retention (14% vs 32%) and platform policy is tightening.
- **No logo cold-opens, no menu screens in the first 3s** — instant scroll.

## Don't forget the leaks

The best ad in the world doesn't fix a leaky App Store page. Before pushing
paid spend, verify the ASO issues are addressed:

- ✅ iPhone-first device family (shipped)
- ✅ In-app review prompts at peak moments (shipped — targets 50+ ratings to unlock the reviews section)
- ⏳ App Preview video (Issue 3, P0 — single highest-ROI ASO fix, +25-35% CVR)
- ⏳ Emotional-peak screenshots (Issue 11)
- ⏳ Subtitle + keyword optimization (Issues 4, 5)
- ⏳ Category change to Games > Sports (Issue 7)
- ⏳ PT-BR + DE + EN-GB localization (Issue 6)

Run `/project:marketing-playbook "should I run paid now"` for a stage-aware
go/no-go.
