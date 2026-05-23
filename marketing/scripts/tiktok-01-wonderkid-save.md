# TikTok-01 — Wonderkid Save-Story (Spark Ad)

**Format:** Spark Ad (boost an organic creator post)
**Length:** 15 seconds
**Aspect:** 9:16 (1080×1920)
**Effort:** UGC creator $200-500, boost as Spark Ad

## Pitch

Football-niche creator films a 15-second POV: "found a £0 wonderkid 3 saves
ago." Phone-shot. Banter voice. Real reaction. The Spark Ad inherits the
creator's social proof (followers, comments) and lands 30-40% lower CPA
than brand-shot in-feed (Tenjin 2025).

## Creator-shoot brief (paste directly into the creator's DM)

> Hi! Quick brief — please film vertical TikTok, ~15 seconds, phone-shot,
> half-face / half-screen-record:
>
> 1. Open on you mid-sentence: "found a £0 wonderkid 3 saves ago" — say it
>    like you're telling your mate, not announcing.
> 2. Cut to your phone screen — show Dynasty Manager scouting/youth screen
>    with a young player highlighted. Tap "Sign."
> 3. Back to face-cam for ~2 seconds: "look what he is now."
> 4. Cut to phone screen — show the same player 2-3 seasons later (high
>    overall, top scorer stat).
> 5. Show inbox notification of a big-money bid (rejection optional).
> 6. End on you laughing: "search Dynasty Manager."
>
> Caption your post however you want. Lowercase, no hashtags, no ad-speak.
> Sponsored tag mandatory. We pay $X + posting rights for Spark Ads.

## Hook (0.0-1.0s — film 3 variants)

| ID | Visual | Caption (auto-add lowercase text overlay) |
|----|--------|-------------------------------------------|
| A  | Face-cam, mid-laugh, holding phone toward camera | "found a £0 wonderkid 3 saves ago" |
| B  | Phone screen — finger pointing at scouting card | "free wonderkid, 17 years old, 92 potential" |
| C  | Black for 0.3s → smash-cut to high-OVR player card | "this kid is free" |

## Body beats (within creator's 13 seconds)

| Time | Beat |
|------|------|
| 00:00-00:01 | Hook |
| 00:01-00:04 | Phone — scouting screen, sign flow |
| 00:04-00:06 | Face-cam: "look what he is now" |
| 00:06-00:09 | Phone — same player, 3 seasons later (sortable squad showing him at top) |
| 00:09-00:11 | Phone — fake bid in inbox, hover reject |
| 00:11-00:13 | Face-cam: "mate." or "search Dynasty Manager." |
| 00:13-00:15 | Native caption: "trying this tonight" (no formal CTA) |

## Music

- **From creator's own:** they pick whatever's trending in football TikTok that week. Don't dictate.
- **If music-less:** their voice carries it. Most football-niche TikToks run voice-over with low/no music.

## CTA — soft, native

- Final caption text overlay: **"search Dynasty Manager"** OR **"trying this tonight"** OR **"ngl this is free"**.
- DO NOT use "Download now", "Link in bio", "Get the app." Reads as ad immediately.

## Production realism check

- Phone-shootable in <20 min? ✅
- Looks like an ad in first 2s? ❌ (UGC face-cam = looks native)
- Would a real football fan share? ✅ (it's just a save story)

## ffmpeg recipe

Creator sends raw vertical mp4. We boost the original post as a Spark Ad
— DO NOT re-cut or re-add brand chrome. The whole point of Spark is
preserving native authenticity.

If absolutely necessary to add a CTA card (only if creator explicitly didn't include one):
```bash
bash marketing/postproduction/build-ad.sh \
  --raw creator-raw.mov \
  --append-cta-card true \
  --cta-style minimal \
  --out tiktok-01-wonderkid-save.mp4
```

## Why this should convert

- **Spark Ads CPA 30-40% lower** than in-feed brand creative (Tenjin 2025).
- **UGC + football niche** = highest hook-rate for sports management games on TikTok per FM22/Top Eleven case studies.
- **No production polish** = doesn't trigger the "this is an ad" scroll reflex.

## Test plan

| Setting | Value |
|---------|-------|
| Platform | TikTok Spark Ads |
| Spend | $300 over 7 days |
| Creators | 2-3 football-niche, 10K-100K followers |
| Hooks | 3 cuts of the same creator's body footage |
| Kill | CPI > $5 OR hold-rate < 12% after 5K impressions |
| Scale | CPI < $3 AND hold-rate > 15% → $100/day for 7 days |
